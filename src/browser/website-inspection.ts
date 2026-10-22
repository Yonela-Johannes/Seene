import {
  WebsiteInspectionSchema,
  WebsiteInspectError,
  inspectWebsiteHtml,
  isBlockedWebsiteHost,
  type WebsiteInspection,
} from "../core";

/** Subresource protocols a page may legitimately request. Navigation is restricted separately. */
const ALLOWED_RESOURCE_PROTOCOLS = new Set(["http:", "https:", "data:", "blob:"]);
/** The final inspected document itself must be a real web page. */
const ALLOWED_PAGE_PROTOCOLS = new Set(["http:", "https:"]);

async function launchBrowser(): Promise<import("playwright").Browser> {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch({ headless: true, channel: "chromium" });
  } catch {
    return await chromium.launch({ headless: true, channel: "chrome" });
  }
}

type DomSection = { id: string; label: string; tagName?: string; selector?: string; heading?: string };
type DomPage = { url: string; title: string; path: string };
type DomElement = {
  id: string;
  label: string;
  kind: "button" | "link" | "input" | "interactive";
  selector: string;
  href?: string;
  text?: string;
};
type DomSnapshot = {
  title: string;
  description?: string;
  sections: DomSection[];
  pages: DomPage[];
  interactiveElements: DomElement[];
};

/**
 * Read the live DOM rather than re-parsing serialized HTML. This is the only way to derive
 * selectors that are unique on the page (nth-of-type paths), so a generated step targets the
 * section it was discovered from instead of the first element with the same tag name.
 */
async function inspectDom(page: import("playwright").Page): Promise<DomSnapshot> {
  return page.evaluate((): DomSnapshot => {
    const slugify = (text: string): string =>
      text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
    const escapeIdent = (value: string): string => {
      const css = typeof CSS !== "undefined" ? CSS : undefined;
      if (css && typeof css.escape === "function") return css.escape(value);
      return value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`);
    };
    const selectorFor = (element: HTMLElement): string => {
      if (element.id) return `#${escapeIdent(element.id)}`;
      const parts: string[] = [];
      let current: HTMLElement | null = element;
      while (current && current !== document.documentElement) {
        if (current.id) {
          parts.unshift(`#${escapeIdent(current.id)}`);
          break;
        }
        let part = current.tagName.toLowerCase();
        const parent: HTMLElement | null = current.parentElement;
        if (parent) {
          const sameTag = Array.from(parent.children).filter(child => child.tagName === current!.tagName) as HTMLElement[];
          if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        if (current === document.body) break;
        current = parent;
      }
      return parts.join(" > ");
    };
    const visible = (element: HTMLElement): boolean =>
      element.getClientRects().length > 0 && !element.closest("[hidden], nav, footer");

    const title = document.title?.trim() || location.hostname;
    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() ||
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content?.trim() ||
      undefined;

    const headingOf = (element: HTMLElement): string | undefined => {
      const heading = element.matches("h1, h2, h3")
        ? element
        : element.querySelector<HTMLElement>("h1, h2, h3");
      return heading?.textContent?.trim() || undefined;
    };

    // Prefer real page landmarks. Drop ancestors that merely contain another landmark so the
    // same visual section is not discovered twice (for example <main> around several <section>s).
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>("[data-section-id], [data-seene-section], section, article, main, header"),
    ).filter(element => visible(element) && element !== document.body);
    const landmarks = candidates.filter(element => !candidates.some(other => other !== element && element.contains(other)));

    const sections: DomSection[] = [];
    const seenSections = new Set<string>();
    const addSection = (element: HTMLElement) => {
      const heading = headingOf(element);
      const explicitId = element.dataset.sectionId || element.dataset.seeneSection || element.id;
      const label = element.dataset.sectionLabel || heading || element.getAttribute("aria-label") || explicitId || element.tagName.toLowerCase();
      let id = slugify(explicitId || heading || element.tagName.toLowerCase());
      if (seenSections.has(id)) id = `${id}-${sections.length + 1}`;
      if (seenSections.has(id)) return;
      seenSections.add(id);
      sections.push({
        id,
        label: label.length > 50 ? `${label.slice(0, 50)}…` : label,
        tagName: element.tagName.toLowerCase(),
        selector: selectorFor(element),
        ...(heading ? { heading } : {}),
      });
    };

    if (landmarks.length > 0) landmarks.forEach(addSection);
    else {
      Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3"))
        .filter(visible)
        .forEach(addSection);
    }

    const pages: DomPage[] = [{ url: location.href, title: "Home", path: location.pathname || "/" }];
    const seenPages = new Set<string>([location.href]);
    for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
      if (pages.length >= 10) break;
      try {
        const resolved = new URL(anchor.getAttribute("href") || "", location.href);
        resolved.hash = "";
        if (resolved.origin !== location.origin) continue;
        if (!["http:", "https:"].includes(resolved.protocol)) continue;
        const href = resolved.href;
        if (href === location.href || seenPages.has(href)) continue;
        seenPages.add(href);
        const label = anchor.textContent?.trim() || anchor.getAttribute("aria-label") || resolved.pathname;
        pages.push({ url: href, title: label.length > 80 ? `${label.slice(0, 80)}…` : label, path: resolved.pathname || "/" });
      } catch {
        // Ignore malformed links.
      }
    }

    const interactiveElements: DomElement[] = [];
    const seenElements = new Set<string>();
    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [role='button']"),
    )) {
      if (interactiveElements.length >= 15) break;
      if (!visible(element)) continue;
      const text =
        element.getAttribute("aria-label")?.trim() ||
        element.textContent?.trim() ||
        (element as HTMLInputElement).value?.trim() ||
        element.getAttribute("placeholder")?.trim() ||
        element.getAttribute("title")?.trim() ||
        "";
      if (!text || text.length > 60) continue;
      const selector = selectorFor(element);
      if (seenElements.has(selector)) continue;
      seenElements.add(selector);
      const tag = element.tagName.toLowerCase();
      const kind: DomElement["kind"] =
        tag === "a"
          ? "link"
          : tag === "button" || element.getAttribute("role") === "button"
            ? "button"
            : tag === "input" || tag === "select" || tag === "textarea"
              ? "input"
              : "interactive";
      interactiveElements.push({
        id: slugify(element.id || text),
        label: text,
        kind,
        selector,
        ...(kind === "link" ? { href: (element as HTMLAnchorElement).href } : {}),
        text,
      });
    }

    return { title, description, sections, pages, interactiveElements };
  });
}

/** Inspect a URL with a headless browser. Never returns a fabricated inspection. */
export async function inspectWithBrowser(url: string): Promise<WebsiteInspection> {
  let browser: import("playwright").Browser | undefined;
  try {
    browser = await launchBrowser();
  } catch {
    throw new WebsiteInspectError(
      "Browser inspection is not available. Install Playwright Chromium (`npx playwright install chromium`) and retry.",
      "unreachable",
    );
  }
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    // Block internal services and non-web protocols for every request in the page, including
    // redirects, subresources and client-side navigation.
    await page.route("**/*", route => {
      const request = route.request();
      try {
        const target = new URL(request.url());
        if (isBlockedWebsiteHost(target.hostname)) return route.abort();
        if (!ALLOWED_RESOURCE_PROTOCOLS.has(target.protocol)) return route.abort();
      } catch {
        return route.abort();
      }
      return route.continue();
    });
    let response: Awaited<ReturnType<typeof page.goto>>;
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    } catch (error) {
      throw new WebsiteInspectError(
        `The browser could not load ${url}. ${error instanceof Error ? error.message : "The navigation failed."}`,
        "unreachable",
      );
    }
    if (response && !response.ok()) throw new WebsiteInspectError(`The website answered with HTTP ${response.status()}.`, "http-error");
    const finalUrl = page.url();
    if (!finalUrl) throw new WebsiteInspectError("The browser did not finish navigating to the website.", "unreachable");
    const parsedFinal = new URL(finalUrl);
    if (isBlockedWebsiteHost(parsedFinal.hostname) || !ALLOWED_PAGE_PROTOCOLS.has(parsedFinal.protocol))
      throw new WebsiteInspectError("The website redirected to an address Seene cannot inspect.", "blocked");
    // Give client-rendered shells a short chance to paint real content, then read the live DOM.
    await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    const html = await page.content();
    const dom = await inspectDom(page);
    const preview = await page.screenshot({ type: "jpeg", quality: 72, animations: "disabled" }).catch(() => undefined);
    const scrollHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)).catch(() => undefined);
    const inspection = inspectWebsiteHtml(parsedFinal.href, html, response ? response.headers() : undefined);
    return WebsiteInspectionSchema.parse({
      ...inspection,
      title: dom.title || inspection.title,
      ...(dom.description ? { description: dom.description } : {}),
      // Live DOM selectors win; the static parse remains the fallback when the DOM is empty.
      sections: dom.sections.length > 0 ? dom.sections : inspection.sections,
      pages: dom.pages.length > 0 ? dom.pages : inspection.pages,
      interactiveElements: dom.interactiveElements.length > 0 ? dom.interactiveElements : inspection.interactiveElements,
      inspectedWith: "browser",
      ...(preview ? { previewImage: `data:image/jpeg;base64,${preview.toString("base64")}` } : {}),
      ...(scrollHeight !== undefined ? { scrollHeight } : {}),
    });
  } finally {
    await browser.close().catch(() => undefined);
  }
}
