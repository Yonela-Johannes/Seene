import { z } from "zod";
import { isSameOriginRoute, validateWebsiteUrl } from "./url";

export const InspectedSectionSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  tagName: z.string().optional(),
  selector: z.string().optional(),
  heading: z.string().optional(),
});
export type InspectedSection = z.infer<typeof InspectedSectionSchema>;

export const InspectedElementSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["button", "link", "input", "interactive"]),
  selector: z.string(),
  href: z.string().optional(),
  text: z.string().optional(),
});
export type InspectedElement = z.infer<typeof InspectedElementSchema>;

export const InspectedPageRouteSchema = z.strictObject({
  url: z.string(),
  title: z.string(),
  path: z.string(),
});
export type InspectedPageRoute = z.infer<typeof InspectedPageRouteSchema>;

export const WebsiteInspectionSchema = z.strictObject({
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  sections: z.array(InspectedSectionSchema).default([]),
  pages: z.array(InspectedPageRouteSchema).default([]),
  interactiveElements: z.array(InspectedElementSchema).default([]),
  status: z.enum(["ok", "iframe-blocked", "cors-restricted", "error"]).default("ok"),
  canIframe: z.boolean().default(true),
  fallbackReason: z.string().optional(),
});
export type WebsiteInspection = z.infer<typeof WebsiteInspectionSchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function getMetaAttribute(html: string, metaName: string): string | undefined {
  const metaRegex = /<meta\s+[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const nameMatch = tag.match(/(?:name|property)=["']?([^"'\s>]+)["']?/i);
    if (nameMatch && nameMatch[1].toLowerCase() === metaName.toLowerCase()) {
      const contentMatch = tag.match(/content=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      if (contentMatch) {
        return (contentMatch[1] ?? contentMatch[2] ?? contentMatch[3] ?? "").trim();
      }
    }
  }
  return undefined;
}

/**
 * Inspect an HTML string and headers to discover title, sections, pages, interactive targets, and iframe compatibility.
 */
export function inspectWebsiteHtml(
  targetUrl: string,
  html: string,
  headers?: Record<string, string>
): WebsiteInspection {
  const validation = validateWebsiteUrl(targetUrl);
  const normalizedUrl = validation.normalized ?? targetUrl;
  const urlObj = new URL(normalizedUrl);

  let canIframe = true;
  let status: WebsiteInspection["status"] = "ok";
  let fallbackReason: string | undefined;

  // Check headers for iframe embedding blocks
  if (headers) {
    const lowerHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      lowerHeaders[k.toLowerCase()] = v;
    }

    const xfo = lowerHeaders["x-frame-options"]?.toLowerCase();
    const csp = lowerHeaders["content-security-policy"]?.toLowerCase();

    if (xfo === "deny" || (xfo === "sameorigin" && !validation.isLocalhost)) {
      canIframe = false;
      status = "iframe-blocked";
      fallbackReason = `The site sends "X-Frame-Options: ${xfo.toUpperCase()}", preventing iframe embedding.`;
    } else if (csp && csp.includes("frame-ancestors") && !csp.includes("*") && !csp.includes("'self'")) {
      canIframe = false;
      status = "iframe-blocked";
      fallbackReason = "The site's Content-Security-Policy (frame-ancestors) restricts embedding.";
    }
  }

  // Extract Title
  let title = urlObj.hostname;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].trim()) {
    title = titleMatch[1].trim();
  } else {
    const ogTitle = getMetaAttribute(html, "og:title");
    if (ogTitle) title = ogTitle;
  }

  // Extract Description
  const description = getMetaAttribute(html, "description") ?? getMetaAttribute(html, "og:description");

  const sections: InspectedSection[] = [];
  const pages: InspectedPageRoute[] = [];
  const interactiveElements: InspectedElement[] = [];

  const seenSectionIds = new Set<string>();
  const seenPageUrls = new Set<string>([normalizedUrl]);
  const seenElementSelectors = new Set<string>();

  // Add homepage route
  pages.push({
    url: normalizedUrl,
    title: "Home",
    path: urlObj.pathname || "/",
  });

  // Extract Headings as Section candidates
  const headingRegex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gis;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    const rawText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!rawText || rawText.length < 2) continue;
    const id = slugify(rawText);
    if (seenSectionIds.has(id)) continue;
    seenSectionIds.add(id);

    sections.push({
      id,
      label: rawText.length > 50 ? rawText.slice(0, 50) + "…" : rawText,
      tagName: `h${match[1]}`,
      selector: `h${match[1]}`,
      heading: rawText,
    });
    if (sections.length >= 16) break;
  }

  // Extract Explicit Section IDs/Landmarks from HTML tags
  const sectionTagRegex = /<(section|article|main|header|footer)[^>]*?(?:id=["']([^"']+)["']|data-section-id=["']([^"']+)["']|data-seene-section=["']([^"']+)["'])?[^>]*>/gi;
  while ((match = sectionTagRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const sectionId = match[2] || match[3] || match[4] || `${tagName}-${sections.length + 1}`;
    const id = slugify(sectionId);
    if (seenSectionIds.has(id)) continue;
    seenSectionIds.add(id);

    sections.push({
      id,
      label: match[2] || match[3] || match[4] || `${tagName.toUpperCase()} Section`,
      tagName,
      selector: match[2] ? `#${match[2]}` : `[data-section-id="${sectionId}"]`,
    });
    if (sections.length >= 24) break;
  }

  // Fallback default sections if none discovered
  if (sections.length === 0) {
    sections.push(
      { id: "hero", label: "Hero Banner", selector: "#hero, header, main" },
      { id: "features", label: "Key Features", selector: "#features, section" },
      { id: "content", label: "Main Content", selector: "main, article" },
      { id: "footer", label: "Footer Overview", selector: "footer" },
    );
  }

  // Extract same-origin links for page route discovery
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;

    try {
      const resolved = new URL(href, normalizedUrl);
      if (isSameOriginRoute(resolved.href, normalizedUrl) && !seenPageUrls.has(resolved.href)) {
        seenPageUrls.add(resolved.href);
        pages.push({
          url: resolved.href,
          title: linkText || resolved.pathname,
          path: resolved.pathname,
        });
        if (pages.length >= 10) break;
      }
    } catch {}
  }

  // Extract interactive elements (buttons and primary links)
  const buttonRegex = /<(button|a)[^>]*?(?:id=["']([^"']+)["']|data-seene-target=["']([^"']+)["']|role=["']button["'])?[^>]*>(.*?)<\/\1>/gis;
  while ((match = buttonRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const elementId = match[2] || match[3];
    const text = match[4].replace(/<[^>]+>/g, "").trim();
    if (!text || text.length > 40) continue;

    const selector = elementId ? `#${elementId}` : `${tag}:contains("${text.slice(0, 20)}")`;
    if (seenElementSelectors.has(selector)) continue;
    seenElementSelectors.add(selector);

    interactiveElements.push({
      id: slugify(elementId || text),
      label: text,
      kind: tag === "a" ? "link" : "button",
      selector: elementId ? `#${elementId}` : `${tag}`,
      text,
    });
    if (interactiveElements.length >= 12) break;
  }

  return WebsiteInspectionSchema.parse({
    url: normalizedUrl,
    title,
    description,
    sections,
    pages,
    interactiveElements,
    status,
    canIframe,
    fallbackReason,
  });
}

/**
 * Inspect a live DOM container element (in browser/iframe) to extract structured section and target information.
 */
export function inspectContainerElement(container: HTMLElement, targetUrl: string): WebsiteInspection {
  const validation = validateWebsiteUrl(targetUrl);
  const normalizedUrl = validation.normalized ?? targetUrl;
  const doc = container.ownerDocument;

  const title = doc.title?.trim() || new URL(normalizedUrl).hostname;
  const sections: InspectedSection[] = [];
  const interactiveElements: InspectedElement[] = [];

  // Discover explicit & semantic elements in DOM
  const headings = Array.from(container.querySelectorAll<HTMLElement>("h1, h2, h3, [data-section-id], [data-seene-section], header, main, section, article"));
  const seenIds = new Set<string>();

  headings.forEach((element, index) => {
    const text = element.textContent?.trim() || "";
    const headingText = element.querySelector("h1, h2, h3")?.textContent?.trim() || text;
    const explicitId = element.dataset.sectionId || element.dataset.seeneSection || element.id;
    const id = slugify(explicitId || headingText || `section-${index + 1}`);

    if (seenIds.has(id) || !headingText) return;
    seenIds.add(id);

    const selector = explicitId
      ? (element.id ? `#${element.id}` : `[data-section-id="${explicitId}"]`)
      : element.tagName.toLowerCase();

    sections.push({
      id,
      label: headingText.length > 50 ? headingText.slice(0, 50) + "…" : headingText,
      tagName: element.tagName.toLowerCase(),
      selector,
      heading: headingText,
    });
  });

  // Discover buttons & interactive links
  const buttons = Array.from(container.querySelectorAll<HTMLElement>("button, a[href], [role='button']"));
  buttons.forEach((btn, index) => {
    const text = btn.textContent?.trim() || btn.getAttribute("aria-label") || "";
    if (!text || text.length > 40 || interactiveElements.length >= 15) return;

    const selector = btn.id ? `#${btn.id}` : btn.dataset.sectionId ? `[data-section-id="${btn.dataset.sectionId}"]` : btn.tagName.toLowerCase();
    interactiveElements.push({
      id: slugify(btn.id || text || `button-${index + 1}`),
      label: text,
      kind: btn.tagName.toLowerCase() === "a" ? "link" : "button",
      selector,
      text,
      href: (btn as HTMLAnchorElement).href || undefined,
    });
  });

  return WebsiteInspectionSchema.parse({
    url: normalizedUrl,
    title,
    sections,
    pages: [{ url: normalizedUrl, title: "Home", path: new URL(normalizedUrl).pathname }],
    interactiveElements,
    status: "ok",
    canIframe: true,
  });
}
