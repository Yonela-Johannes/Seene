import { z } from "zod";
import { SceneRecipeSchema, SCENE_RECIPE_DIRECTORY, SceneRecipeIdSchema, type SceneCatalog, type SceneRecipe } from "./recipes";
import { motionDuration } from "./motion";
import { applyPresentationPreset, type PreviewDefinitionInput } from "./preview";
import { createWalkthroughFromSections, compileWalkthrough, type WalkthroughDocumentInput } from "./walkthrough";
import type { SceneIssue } from "./scene";

export const PLATFORM_HOME_DIRECTORY = ".seene";
export const PLATFORM_REGISTRY_FILE = "projects.json";
export const PLATFORM_API_PREFIX = "/__seene/platform";
export const SCENE_PRESENTATION_SURFACE = "host";
export const SCENE_PRESENTATION_WIDTH = 1400;
export const SCENE_PRESENTATION_HEIGHT = 980;
export const SEENE_PREVIEW_QUERY_PARAM = "seene-preview";
export const SEENE_SCENE_QUERY_PARAM = "seene-scene";
export const SEENE_APPLICATION_QUERY_PARAM = "seene-app";
export const SEENE_PREVIEW_QUERY_PARAMS = Object.freeze([
  SEENE_PREVIEW_QUERY_PARAM,
  SEENE_SCENE_QUERY_PARAM,
  SEENE_APPLICATION_QUERY_PARAM,
]);

export const PlatformIssueSchema = z.strictObject({
  path: z.string(),
  message: z.string().min(1),
});
export const ProjectEntrySchema = z.strictObject({
  path: z.string().trim().min(1).max(1000),
  name: z.string().trim().min(1).max(120),
  addedAt: z.string().trim().min(1).max(40),
});
export const ProjectRegistrySchema = z.strictObject({
  version: z.literal(1),
  projects: z.array(ProjectEntrySchema).max(200),
});
export const RegisterProjectSchema = z.strictObject({
  path: z.string().trim().min(1).max(1000).refine(value => !/[\u0000-\u001f]/.test(value), "Use a filesystem path without control characters."),
});
export const PlatformProjectSchema = z.strictObject({
  path: z.string().min(1),
  name: z.string().min(1),
  connected: z.boolean(),
  sceneDirectory: z.string().min(1),
  sceneCount: z.number().int().nonnegative(),
  addedAt: z.string().min(1),
  updatedAt: z.string().optional(),
  packageManager: z.enum(["npm", "pnpm", "yarn", "bun"]).optional(),
  entry: z.string().min(1).optional(),
  adapter: z.enum(["next-app", "next-pages", "react"]).optional(),
  issues: z.array(PlatformIssueSchema),
});
export const PlatformSceneSchema = z.strictObject({
  id: SceneRecipeIdSchema,
  title: z.string().min(1),
  description: z.string(),
  source: z.string().min(1),
  binding: z.string().min(1),
  durationMs: z.number().nonnegative(),
  hasSnapshot: z.boolean(),
  applicationRoute: z.string().min(1).optional(),
});
export const PlatformCatalogSchema = z.strictObject({
  scenes: z.array(PlatformSceneSchema),
  issues: z.array(PlatformIssueSchema),
});
export const PlatformContentSelectionSchema = z.strictObject({
  file: z.string().trim().min(1).max(400),
  export: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, "Use a JavaScript identifier for a named export.").optional(),
});
export const PlatformContentFileSchema = z.strictObject({
  path: z.string().min(1),
  default: z.boolean(),
  exports: z.array(z.string()),
  kind: z.enum(["page", "section", "component"]).optional(),
  title: z.string().optional(),
  route: z.string().optional(),
});
export const PlatformContentSchema = z.strictObject({
  files: z.array(PlatformContentFileSchema),
});
export const SceneDraftSchema = z.strictObject({
  id: SceneRecipeIdSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  compositionType: z.enum(["scene", "walkthrough"]).optional(),
  content: PlatformContentSelectionSchema.optional(),
  sections: z.array(PlatformContentSelectionSchema).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});
export const CreateSceneRequestSchema = z.strictObject({ path: RegisterProjectSchema.shape.path, ...SceneDraftSchema.shape });
export const DuplicateSceneRequestSchema = z.strictObject({
  path: RegisterProjectSchema.shape.path,
  id: SceneRecipeIdSchema,
  newId: SceneRecipeIdSchema,
});
export const RenameSceneRequestSchema = z.strictObject({
  path: RegisterProjectSchema.shape.path,
  id: SceneRecipeIdSchema,
  newId: SceneRecipeIdSchema,
});
export const RemoveSceneRequestSchema = z.strictObject({ path: RegisterProjectSchema.shape.path, id: SceneRecipeIdSchema });

export const PlatformProjectsSchema = z.strictObject({
  home: z.string().min(1),
  projects: z.array(PlatformProjectSchema),
});
export const PlatformCatalogResponseSchema = z.strictObject({
  project: PlatformProjectSchema,
  catalog: PlatformCatalogSchema,
});
export const PlatformContentResponseSchema = z.strictObject({
  project: PlatformProjectSchema,
  content: PlatformContentSchema,
});
export const PlatformSceneResponseSchema = z.strictObject({
  project: PlatformProjectSchema,
  scene: PlatformSceneSchema,
  catalog: PlatformCatalogSchema,
});
export const PlatformStatusSchema = z.strictObject({
  origin: z.string().min(1),
  url: z.string().min(1),
  reachable: z.boolean(),
  message: z.string().min(1),
});
export const PlatformErrorSchema = z.strictObject({ error: z.string().min(1) });

export type ProjectEntry = z.output<typeof ProjectEntrySchema>;
export type ProjectRegistry = z.output<typeof ProjectRegistrySchema>;
export type PlatformProject = z.output<typeof PlatformProjectSchema>;
export type PlatformCatalog = z.output<typeof PlatformCatalogSchema>;
export type PlatformScene = z.output<typeof PlatformSceneSchema>;
export type PlatformContent = z.output<typeof PlatformContentSchema>;
export type PlatformStatus = z.output<typeof PlatformStatusSchema>;
export type SceneDraft = z.output<typeof SceneDraftSchema>;

export function loadProjectRegistry(text: string | undefined): ProjectRegistry {
  if (text === undefined) return { version: 1, projects: [] };
  let document: unknown;
  try { document = JSON.parse(text); } catch { return { version: 1, projects: [] }; }
  const projects: ProjectEntry[] = [];
  const candidates = document && typeof document === "object" && Array.isArray((document as { projects?: unknown }).projects)
    ? (document as { projects: unknown[] }).projects : [];
  for (const candidate of candidates) {
    const parsed = ProjectEntrySchema.safeParse(candidate);
    if (parsed.success && !projects.some(entry => entry.path === parsed.data.path)) projects.push(parsed.data);
  }
  return { version: 1, projects };
}

export function registryWithout(root: string, entries: ProjectEntry[]): ProjectRegistry {
  return { version: 1, projects: entries.filter(entry => entry.path !== root) };
}

export function sceneIdFromTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function sceneComponentName(id: string): string {
  return "Scene" + id.split("-").filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

export function defaultSceneDefinition(): PreviewDefinitionInput {
  return {
    scene: {
      version: 3,
      camera: { perspective: 1800, rotateX: 4, rotateY: -7 },
      focus: { distance: 1800, fStop: 8, focalLength: 50, maxBlur: 6 },
      nodes: [{ id: SCENE_PRESENTATION_SURFACE }],
    },
    motion: { durationMs: 5000, speed: 0.8, tracks: [] },
  };
}

export function createSceneRecipe(input: {
  id: string;
  title: string;
  description?: string;
  applicationRoute?: string;
  compositionType?: "scene" | "walkthrough";
  sections?: Array<{ id: string; title: string; file: string; export?: string; durationMs?: number }>;
  walkthrough?: WalkthroughDocumentInput;
  width?: number;
  height?: number;
}): SceneRecipe {
  const isWalkthrough = input.compositionType === "walkthrough";
  const def = defaultSceneDefinition();
  const walkthrough = input.walkthrough
    ?? (isWalkthrough && input.sections?.length
      ? createWalkthroughFromSections({
          title: input.title,
          sections: input.sections.map(section => ({
            file: section.file,
            ...(section.export ? { export: section.export } : {}),
            title: section.title,
          })),
        })
      : undefined);
  const compiled = walkthrough ? compileWalkthrough(walkthrough) : null;
  const settings = walkthrough?.settings;
  return SceneRecipeSchema.parse({
    version: 1,
    id: input.id,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(input.applicationRoute ? { application: { route: input.applicationRoute } } : {}),
    definition: {
      ...def,
      ...(compiled ? { motion: compiled.motion } : isWalkthrough ? { motion: { durationMs: 10000, speed: 1, tracks: [] } } : {}),
      ...(input.width && !settings ? { width: input.width } : settings ? { width: settings.width } : {}),
      ...(input.height && !settings ? { height: input.height } : settings ? { height: settings.height } : {}),
      compositionType: isWalkthrough ? "walkthrough" : "scene",
      ...(isWalkthrough ? { walkthroughSettings: { durationAuto: true } } : {}),
      ...(isWalkthrough ? { sizingMode: "viewport", minHeight: "100vh" } : {}),
      ...(input.sections ? { sections: input.sections } : {}),
      ...(walkthrough ? { walkthrough } : {}),
    },
  });
}

export function sceneComponentSource(input: {
  id: string;
  compositionType?: "scene" | "walkthrough";
  content?: { importSpecifier: string; export?: string; id?: string; title?: string } | Array<{ importSpecifier: string; export?: string; id?: string; title?: string }>;
  sections?: Array<{ importSpecifier: string; export?: string; id?: string; title?: string }>;
  walkthrough?: WalkthroughDocumentInput;
}): string {
  const name = sceneComponentName(input.id);
  const isWalkthrough = input.compositionType === "walkthrough";

  const rawSections: Array<{ importSpecifier: string; export?: string; id?: string; title?: string }> =
    input.sections ?? (Array.isArray(input.content) ? input.content : input.content ? [input.content] : []);

  if (isWalkthrough) {
    if (rawSections.length === 0) {
      return `// @seene-scaffold-version 1
"use client";
import { Surface } from "@thatg33k/seene";

export default function ${name}() {
  return (
    <Surface id="host" style={{ width: "100%", height: "auto", minHeight: "100vh" }}>
      <div style={{ padding: "4rem", textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Website Walkthrough</h1>
        <p style={{ opacity: 0.7 }}>Edit src/seene/scenes/${input.id}.tsx to add your page sections.</p>
      </div>
    </Surface>
  );
}
`;
    }

    const imports: string[] = [];
    const elements: string[] = [];
    const usedNames = new Set<string>();
    const taggedIds = input.walkthrough
      ? input.walkthrough.nodes.filter(node => node.type === "show" && node.target?.file).map(node => node.id)
      : [];

    rawSections.forEach((sec, idx) => {
      const sourceName = sec.export && sec.export !== "default"
        ? sec.export
        : sec.importSpecifier.split("/").pop()?.replace(/\.[jt]sx?$/, "") || sec.title || `Section${idx + 1}`;
      const baseName = sourceName.replace(/^\d+/, "").split(/[^A-Za-z0-9_$]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("") || `Section${idx + 1}`;
      let compName = /^[A-Z_$]/.test(baseName) ? baseName : `Section${baseName}`;
      if (/^\d/.test(compName)) compName = `Section${compName}`;
      let suffix = 2;
      while (usedNames.has(compName)) compName = `${baseName}${suffix++}`;
      usedNames.add(compName);
      const binding = sec.export ? `{ ${sec.export} as ${compName} }` : compName;
      imports.push(`import ${binding} from ${JSON.stringify(sec.importSpecifier)};`);
      const sectionId = taggedIds[idx];
      elements.push(sectionId
        ? `<WebsiteSection id=${JSON.stringify(sectionId)} label=${JSON.stringify(sec.title ?? compName)}><${compName} /></WebsiteSection>`
        : `<${compName} />`);
    });

    const previewImport = taggedIds.length ? `\nimport { WebsiteSection } from "@thatg33k/seene/preview";` : "";

    return `// @seene-scaffold-version 1
"use client";
import { Surface } from "@thatg33k/seene";${previewImport}
${imports.join("\n")}

export default function ${name}() {
  return (
    <Surface id="host" style={{ width: "100%", height: "auto", minHeight: "100vh" }}>
      ${elements.join("\n      ")}
    </Surface>
  );
}
`;
  }

  if (rawSections.length === 0) {
    return `// @seene-scaffold-version 1
"use client";
import { Surface } from "@thatg33k/seene";

export default function ${name}() {
  return (
    <Surface id="host" style={{ width: 1400, height: 980 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Scene Preview</h1>
        <p style={{ fontSize: 14, opacity: 0.7 }}>Edit src/seene/scenes/${input.id}.tsx to add your component.</p>
      </div>
    </Surface>
  );
}
`;
  }

  const imports: string[] = [];
  const elements: string[] = [];

  rawSections.forEach((item, idx) => {
    const compName = rawSections.length === 1 ? "HostComponent" : `HostComponent${idx + 1}`;
    const binding = item.export ? `{ ${item.export} as ${compName} }` : compName;
    imports.push(`import ${binding} from ${JSON.stringify(item.importSpecifier)};`);
    elements.push(`<${compName} />`);
  });

  return `// @seene-scaffold-version 1
"use client";
import { Surface } from "@thatg33k/seene";
${imports.join("\n")}

export default function ${name}() {
  return (
    <Surface id="host" style={{ width: 1400, height: 980 }}>
      ${elements.join("\n      ")}
    </Surface>
  );
}
`;
}

export function validateHostComponent(hostPath: string, source: string): { valid: boolean; warning?: string } {
  const normPath = hostPath.replace(/\\/g, "/");
  const analysis = analyzeApplicationModule(source);

  if (!analysis.default) {
    throw new Error(`Host component "${hostPath}" has no default export.`);
  }

  let warning: string | undefined = undefined;
  const isRoute = /(?:^|\/)(?:page|layout|_app|_document|route)\.[a-z0-9]+$/i.test(normPath);
  const isAsync = /export\s+default\s+async\b/i.test(source)
    || /async\s+function\s+[A-Za-z0-9_$]+[\s\S]*?export\s+default/i.test(source)
    || /const\s+[A-Za-z0-9_$]+\s*=\s*async\b[\s\S]*?export\s+default/i.test(source);

  if (isRoute || isAsync) {
    const reason = isRoute && isAsync
      ? "is a route file and an async Server Component"
      : isRoute
      ? "is a route file"
      : "is an async Server Component";
    warning = `Warning: ${hostPath} ${reason}, which cannot be mounted in the client tree.`;
  }

  return { valid: true, warning };
}

export function componentImportSpecifier(target: string): string {
  const normalized = target.replace(/\\/g, "/").replace(/^\.\//, "");
  const withoutExt = normalized.replace(/\.(?:[cm]?[jt]sx?)$/, "");
  return `@/${withoutExt.replace(/^src\//, "")}`;
}

export function isDocumentOrLayoutWrapper(target: string): boolean {
  const norm = target.replace(/\\/g, "/").toLowerCase();
  const basename = norm.split("/").pop() || "";
  if (basename.startsWith("layout.") || basename.startsWith("_document.") || basename.startsWith("_app.")) return true;
  if (norm.includes("/seene/") || basename.startsWith("seene.")) return true;
  return false;
}

export function isApplicationSourcePath(target: string): boolean {
  const normalized = target.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.includes("..")) return false;
  if (!/^(?:src|app|pages|components)\/[A-Za-z0-9._/-]+\.(?:tsx|jsx)$/.test(normalized)) return false;
  if (normalized.startsWith(SCENE_RECIPE_DIRECTORY + "/")) return false;
  if (isDocumentOrLayoutWrapper(normalized)) return false;
  return true;
}

export function isIconOrPrimitive(filePath: string, exportName?: string): boolean {
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  if (norm.includes("/icon/") || norm.includes("/icons/") || norm.includes("/svg/") || norm.includes("/svgs/") || norm.includes("/lucide/") || norm.includes("/radix/") || norm.includes("/primitives/")) return true;
  const basename = norm.split("/").pop() || "";
  if (basename.endsWith("icon.tsx") || basename.endsWith("icon.jsx") || basename.endsWith("svg.tsx") || basename.endsWith("svg.jsx") || basename.endsWith("glyph.tsx")) return true;
  if (exportName) {
    const lowerExport = exportName.toLowerCase();
    if (lowerExport.endsWith("icon") || lowerExport.endsWith("svg") || lowerExport.endsWith("glyph")) return true;
  }
  return false;
}

export function classifyApplicationUnit(filePath: string, exportName?: string): { kind: "page" | "section" | "component"; title: string; route?: string } {
  const norm = filePath.replace(/\\/g, "/");
  const basename = norm.split("/").pop()?.replace(/\.[jt]sx$/, "") || "Unit";

  const isPage = /^app\/(?:.*\/)?page\.[jt]sx$/.test(norm)
    || /^pages\/(?:.*\/)?[A-Za-z0-9_-]+\.[jt]sx$/.test(norm)
    || norm.startsWith("src/pages/")
    || norm.startsWith("src/routes/")
    || norm.startsWith("src/app/")
    || basename.endsWith("Page")
    || basename.endsWith("Screen")
    || basename.endsWith("View");

  if (isPage) {
    let route = "/";
    if (/^app\/(.*)\/page\.[jt]sx$/.test(norm)) {
      route = "/" + norm.replace(/^app\//, "").replace(/\/page\.[jt]sx$/, "");
    } else if (/^pages\/(.*)\.[jt]sx$/.test(norm)) {
      const stem = norm.replace(/^pages\//, "").replace(/\.[jt]sx$/, "");
      route = stem === "index" ? "/" : "/" + stem;
    } else if (/^src\/pages\/(.*)\.[jt]sx$/.test(norm)) {
      const stem = norm.replace(/^src\/pages\//, "").replace(/\.[jt]sx$/, "");
      route = stem === "index" ? "/" : "/" + stem;
    }
    const cleanRoute = route === "/" ? "Home" : route.replace(/^\//, "").split(/[/_-]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    return { kind: "page", title: `${cleanRoute} Page`, route };
  }

  const isSection = norm.includes("/sections/")
    || norm.includes("/components/sections/")
    || basename.endsWith("Section")
    || basename.endsWith("Hero")
    || basename.endsWith("Header")
    || basename.endsWith("Footer")
    || basename.endsWith("Showcase")
    || basename.endsWith("Features")
    || basename.endsWith("Pricing")
    || basename.endsWith("CTA")
    || basename.endsWith("Banner")
    || basename.endsWith("Navbar")
    || basename.endsWith("Panel");

  if (isSection) {
    const formatted = basename.replace(/([a-z])([A-Z])/g, "$1 $2");
    return { kind: "section", title: formatted.endsWith("Section") ? formatted : `${formatted} Section` };
  }

  const formatted = (exportName && exportName !== "default" ? exportName : basename).replace(/([a-z])([A-Z])/g, "$1 $2");
  return { kind: "component", title: formatted };
}

export function analyzeApplicationModule(source: string): { default: boolean; exports: string[] } {
  const found = new Set<string>();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
    /export\s+(?:const|let|var|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) found.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const clause of match[1].split(",")) {
      const name = clause.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) found.add(name);
    }
  }
  const hasDefault = /export\s+default\b/.test(source) || /export\s*\{[^}]*\b(?:as\s+default|default)\b/.test(source);
  return { default: hasDefault, exports: [...found].sort((a, b) => a.localeCompare(b)) };
}

export function isAllowedDevOrigin(origin: string): boolean {
  if (!origin || typeof origin !== "string") return false;
  const match = /^https?:\/\/(?:\[([a-fA-F0-9:]+)\]|([^/:]+))(?::\d+)?\/?$/.exec(origin.trim());
  if (!match) return false;
  const ipv6 = match[1];
  const hostname = match[2];
  if (ipv6 === "::1" || ipv6 === "0:0:0:0:0:0:0:1") return true;
  if (hostname) {
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) return true;
    if (/^127\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
    const match172 = /^172\.(\d+)\.\d+\.\d+$/.exec(hostname);
    if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return true;
  }
  return false;
}

export function isDocumentApplication(adapter: string | undefined): boolean {
  return adapter === "next-app" || adapter === "next-pages";
}

export function defaultDevOrigin(adapter: string | undefined): string {
  return isDocumentApplication(adapter) ? "http://localhost:3000" : "http://127.0.0.1:5173";
}

export const SEENE_PROTOCOL_VERSION = 1;

const safeApplicationRoute = /^\/(?:[A-Za-z0-9._~-]+\/?)*$/;

export function sanitizeApplicationRoute(route: string): string | undefined {
  const trimmed = route.trim();
  if (!trimmed.startsWith("/")) return undefined;
  const normalized = trimmed.replace(/\/+$/, "") || "/";
  return safeApplicationRoute.test(normalized) ? normalized : undefined;
}

const appRouterUnit = /(?:^|\/)app\/(.*\/)?(?:page|layout)$/;
const pagesRouterEntry = /(?:^|\/)pages\/(?:_app|_document|index)$/;

function applicationModuleRoute(modulePath: string): string | undefined {
  const value = modulePath.replace(/\.(?:[cm]?[jt]sx?)$/, "");
  const appRouter = appRouterUnit.exec(value);
  if (appRouter) {
    const directories = (appRouter[1] ?? "").split("/").filter(Boolean).filter(part => !/^\(.*\)$/.test(part));
    return sanitizeApplicationRoute("/" + directories.join("/"));
  }
  if (pagesRouterEntry.test(value)) return "/";
  return undefined;
}

function relativeModulePath(bindingPath: string, specifier: string): string {
  const stack = bindingPath.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { stack.pop(); continue; }
    stack.push(part);
  }
  return stack.join("/");
}

function importedSpecifiers(source: string): string[] {
  const found = new Set<string>();
  for (const pattern of [/from\s*["']([^"']+)["']/g, /import\s*["']([^"']+)["']/g, /import\s*\(\s*["']([^"']+)["']\s*\)/g]) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

export function sceneApplicationRoute(input: { source: string; bindingPath: string }): string | undefined {
  const declared = /<ApplicationPreview\b[^>]*\broute\s*=\s*["']([^"']+)["']/.exec(input.source);
  if (declared) {
    const route = sanitizeApplicationRoute(declared[1]);
    if (route) return route;
  }
  for (const specifier of importedSpecifiers(input.source)) {
    if (specifier === "next/document") return "/";
    if (!specifier.startsWith(".")) continue;
    const route = applicationModuleRoute(relativeModulePath(input.bindingPath, specifier));
    if (route) return route;
  }
  return undefined;
}

export function applicationRouteForContent(file: string, exportName?: string): string | undefined {
  const unit = classifyApplicationUnit(file, exportName);
  return unit.kind === "page" && unit.route ? sanitizeApplicationRoute(unit.route) : undefined;
}

export function previewUrl(adapter: string | undefined, origin: string, sceneId?: string, applicationRoute?: string): string {
  const base = origin.replace(/\/+$/, "");
  const route = isDocumentApplication(adapter) ? "/seene" : "/";
  const parameters = [`${SEENE_PREVIEW_QUERY_PARAM}=1`];
  if (sceneId) parameters.push(`${SEENE_SCENE_QUERY_PARAM}=${sceneId}`);
  if (applicationRoute) parameters.push(`${SEENE_APPLICATION_QUERY_PARAM}=${applicationRoute}`);
  return `${base}${route}?${parameters.join("&")}`;
}

export function platformHome(configured: string | undefined, home: string): string {
  const value = configured?.trim();
  return value ? value : `${home.replace(/[\\/]+$/, "")}/${PLATFORM_HOME_DIRECTORY}`;
}

export function summarizeCatalog(catalog: SceneCatalog): PlatformCatalog {
  return {
    issues: catalog.issues.map(issue => ({ path: issue.path, message: issue.message })),
    scenes: catalog.scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      description: scene.description ?? "",
      source: scene.source,
      binding: scene.binding,
      durationMs: scene.definition.motion ? motionDuration(scene.definition.motion) : 0,
      hasSnapshot: scene.snapshot !== undefined,
      ...(scene.application ? { applicationRoute: scene.application.route } : {}),
    })),
  };
}

export function issueFor(error: unknown, target = ""): SceneIssue {
  const known = error instanceof Error && "code" in error && "target" in error;
  const reported = known && typeof (error as { target?: unknown }).target === "string" ? String((error as { target: string }).target) : target;
  return {
    path: reported,
    message: known ? (error as Error).message : "Unable to read this project's files. Check the path and permissions, then retry.",
  };
}
