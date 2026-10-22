import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  WebsiteInspectionSchema,
  WebsiteInspectError,
  WebsiteProjectSchema,
  createWalkthroughFromWebsite,
  createWebsiteProject,
  inspectWebsiteHtml,
  isBlockedWebsiteHost,
  updateWebsiteProject,
  validateWebsiteUrl,
  websiteProjectId,
  type WebsiteInspection,
  type WebsiteProject,
} from "../core";
import { inspectWithBrowser } from "../browser/website-inspection";

export { WebsiteInspectError } from "../core";

export const WEBSITE_PROJECT_DIRECTORY = "websites";
const MAX_HTML_BYTES = 2_000_000;
const INSPECT_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;

export function websiteDirectory(home: string): string {
  return path.join(home, WEBSITE_PROJECT_DIRECTORY);
}

export function websiteProjectFile(home: string, id: string): string {
  return path.join(websiteDirectory(home), `${id}.json`);
}

function assertInspectable(url: string): string {
  const validation = validateWebsiteUrl(url);
  if (!validation.valid) throw new WebsiteInspectError(validation.error ?? "Invalid website URL.", "invalid-url");
  const parsed = new URL(validation.normalized!);
  if (isBlockedWebsiteHost(parsed.hostname))
    throw new WebsiteInspectError("That host is reserved for internal services and cannot be inspected.", "blocked");
  return parsed.href;
}

function headersObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function readLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_HTML_BYTES) throw new WebsiteInspectError("The page is too large to inspect safely.", "unreachable");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new WebsiteInspectError("The page is too large to inspect safely.", "unreachable");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8");
}

async function fetchStatic(url: string): Promise<{ inspection: WebsiteInspection; finalUrl: string }> {
  let current = url;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INSPECT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Seene/0.1.6 (+https://github.com/Yonela-Johannes/Seene)",
        },
      });
    } catch (error) {
      throw new WebsiteInspectError(
        `Could not reach ${current}. ${error instanceof Error ? error.message : "The request failed."}`,
        "unreachable",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new WebsiteInspectError(`The site redirected without a destination (${response.status}).`, "http-error");
      current = assertInspectable(new URL(location, current).href);
      continue;
    }
    if (!response.ok) {
      throw new WebsiteInspectError(`The website answered with HTTP ${response.status}.`, "http-error");
    }
    const finalUrl = assertInspectable(response.url || current);
    const html = await readLimited(response);
    const inspection = inspectWebsiteHtml(finalUrl, html, headersObject(response.headers));
    return { inspection, finalUrl };
  }
  throw new WebsiteInspectError("The website redirected too many times.", "unreachable");
}


export async function inspectWebsiteUrl(url: string, options?: { browser?: boolean }): Promise<WebsiteInspection> {
  const normalized = assertInspectable(url);
  let staticError: WebsiteInspectError | undefined;
  let staticInspection: WebsiteInspection | undefined;
  try {
    staticInspection = (await fetchStatic(normalized)).inspection;
  } catch (error) {
    staticError = error instanceof WebsiteInspectError ? error : new WebsiteInspectError("The website could not be inspected.", "unreachable");
  }

  const needsBrowser = options?.browser === true || !staticInspection || staticInspection.sections.length < 2;
  if (needsBrowser) {
    try {
      return await inspectWithBrowser(staticInspection?.url ?? normalized);
    } catch (browserError) {
      if (staticInspection) {
        return WebsiteInspectionSchema.parse({
          ...staticInspection,
          fallbackReason: `Browser inspection was unavailable, so this project uses static HTML. ${browserError instanceof Error ? browserError.message : ""}`.trim(),
        });
      }
      if (staticError?.code === "http-error" || staticError?.code === "blocked" || staticError?.code === "invalid-url") throw staticError;
      throw new WebsiteInspectError(
        `${staticError?.message ?? "The website could not be inspected."} ${browserError instanceof Error ? browserError.message : ""}`.trim(),
        "unreachable",
      );
    }
  }
  return staticInspection!;
}

export async function readWebsiteProjects(home: string): Promise<WebsiteProject[]> {
  const directory = websiteDirectory(home);
  const names = await readdir(directory).catch(() => [] as string[]);
  const projects = await Promise.all(
    names
      .filter(name => name.endsWith(".json"))
      .map(async name => {
        try {
          const parsed = JSON.parse(await readFile(path.join(directory, name), "utf8")) as unknown;
          return WebsiteProjectSchema.parse(parsed);
        } catch {
          return undefined;
        }
      }),
  );
  return projects.filter((project): project is WebsiteProject => project !== undefined);
}

export async function readWebsiteProject(home: string, url: string): Promise<WebsiteProject | undefined> {
  const validation = validateWebsiteUrl(url);
  if (!validation.valid) return undefined;
  const id = websiteProjectId(validation.normalized!);
  try {
    const parsed = JSON.parse(await readFile(websiteProjectFile(home, id), "utf8")) as WebsiteProject;
    if (parsed.url !== validation.normalized) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function writeWebsiteProject(home: string, project: WebsiteProject): Promise<void> {
  await mkdir(websiteDirectory(home), { recursive: true });
  const target = websiteProjectFile(home, project.id);
  const temporary = `${target}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, JSON.stringify(project, null, 2) + "\n", "utf8");
  await rename(temporary, target);
}

export async function removeWebsiteProject(home: string, url: string): Promise<boolean> {
  const validation = validateWebsiteUrl(url);
  if (!validation.valid) return false;
  const target = websiteProjectFile(home, websiteProjectId(validation.normalized!));
  try {
    await rm(target);
    return true;
  } catch {
    return false;
  }
}

export async function saveImportedWebsite(
  home: string,
  input: {
    inspection: WebsiteInspection;
    title?: string;
    description?: string;
    sections?: Array<{ id: string; label: string; selector?: string }>;
    pages?: Array<{ url: string; title: string }>;
    targets?: Array<
      | { kind: "section"; id: string; label: string; selector?: string }
      | { kind: "page"; url: string; title: string }
      | { kind: "element"; selector: string; label: string; action?: "show" | "click" | "focus" }
    >;
    now?: Date;
  },
): Promise<WebsiteProject> {
  const inspection = input.inspection;
  const discoveredSections = new Map(inspection.sections.map(section => [section.id, section]));
  const discoveredPages = new Map(inspection.pages.map(page => [page.url, page]));
  const discoveredElements = new Map(inspection.interactiveElements.map(element => [element.selector, element]));

  // Only keep selections that were actually discovered. The client cannot invent a section,
  // selector or page URL and have the platform persist it as if it had been inspected.
  const requestedSections = input.sections ?? inspection.sections;
  const sections = requestedSections.flatMap(requested => {
    const found = discoveredSections.get(requested.id)
      ?? (requested.selector ? inspection.sections.find(section => section.selector === requested.selector) : undefined);
    if (!found) return [];
    return [{ id: found.id, label: found.label, ...(found.selector ? { selector: found.selector } : {}) }];
  });
  const requestedPages = input.pages ?? inspection.pages;
  const pages = requestedPages.flatMap(requested => {
    const found = discoveredPages.get(requested.url);
    if (!found) return [];
    return [{ url: found.url, title: found.title || found.path }];
  });

  type ImportedTarget =
    | { kind: "section"; id: string; label: string; selector?: string }
    | { kind: "page"; url: string; title: string }
    | { kind: "element"; selector: string; label: string; action?: "show" | "click" | "focus" };
  let targets: ImportedTarget[] | undefined;
  if (input.targets) {
    targets = [];
    for (const requested of input.targets) {
      if (requested.kind === "page") {
        const found = discoveredPages.get(requested.url);
        if (found) targets.push({ kind: "page", url: found.url, title: found.title || found.path });
      } else if (requested.kind === "element") {
        const found = discoveredElements.get(requested.selector);
        if (found) targets.push({
          kind: "element",
          selector: found.selector,
          label: found.label,
          ...(requested.action ? { action: requested.action } : {}),
        });
      } else {
        const found = discoveredSections.get(requested.id);
        if (found) targets.push({
          kind: "section",
          id: found.id,
          label: found.label,
          ...(found.selector ? { selector: found.selector } : {}),
        });
      }
    }
  }

  const title = input.title?.trim() || inspection.title;
  const project = createWebsiteProject({
    inspection,
    title,
    ...(input.description ? { description: input.description } : {}),
    walkthrough: createWalkthroughFromWebsite({
      url: inspection.url,
      title,
      ...(input.description ? { description: input.description } : {}),
      sections,
      pages,
      ...(targets ? { targets } : {}),
    }),
    ...(input.now ? { now: input.now } : {}),
  });
  await writeWebsiteProject(home, project);
  return project;
}

export function mergeInspection(project: WebsiteProject, inspection: WebsiteInspection, now = new Date()): WebsiteProject {
  return updateWebsiteProject(project, { inspection, now });
}
