import { z } from "zod";
import { WebsiteInspectionSchema, type WebsiteInspection } from "./websiteInspector";
import {
  WalkthroughDocumentSchema,
  createWalkthroughFromWebsite,
  type WalkthroughDocument,
  type WalkthroughDocumentInput,
  type WebsiteWalkthroughTarget,
} from "./walkthrough";
import { sanitizeUrlForDisplay, validateWebsiteUrl } from "./url";

export const WebsiteProjectSchema = z.strictObject({
  version: z.literal(1),
  id: z.string().min(1).max(160),
  url: z.string().min(1).max(2000),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  inspection: WebsiteInspectionSchema,
  walkthrough: WalkthroughDocumentSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type WebsiteProject = z.output<typeof WebsiteProjectSchema>;

export const WebsiteProjectSummarySchema = z.strictObject({
  id: z.string().min(1),
  url: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  sectionCount: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
});
export type WebsiteProjectSummary = z.output<typeof WebsiteProjectSummarySchema>;

export const WebsiteInspectRequestSchema = z.strictObject({
  url: z.string().trim().min(1).max(2000),
  browser: z.boolean().optional(),
});

export const WebsiteImportSectionSchema = z.strictObject({
  id: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160),
  selector: z.string().trim().min(1).max(240).optional(),
});

export const WebsiteImportPageSchema = z.strictObject({
  url: z.string().trim().min(1).max(2000),
  title: z.string().trim().min(1).max(160),
});

export const WebsiteImportTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("section"),
    id: z.string().trim().min(1).max(160),
    label: z.string().trim().min(1).max(160),
    selector: z.string().trim().min(1).max(240).optional(),
  }),
  z.strictObject({
    kind: z.literal("page"),
    url: z.string().trim().min(1).max(2000),
    title: z.string().trim().min(1).max(160),
  }),
  z.strictObject({
    kind: z.literal("element"),
    selector: z.string().trim().min(1).max(240),
    label: z.string().trim().min(1).max(160),
    action: z.enum(["show", "click", "focus"]).optional(),
  }),
]);

export const WebsiteImportRequestSchema = z.strictObject({
  url: z.string().trim().min(1).max(2000),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).optional(),
  sections: z.array(WebsiteImportSectionSchema).max(128).optional(),
  pages: z.array(WebsiteImportPageSchema).max(32).optional(),
  targets: z.array(WebsiteImportTargetSchema).max(160).optional(),
  browser: z.boolean().optional(),
});

export const WebsiteUpdateRequestSchema = z.strictObject({
  url: z.string().trim().min(1).max(2000),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  walkthrough: WalkthroughDocumentSchema.optional(),
  refreshInspection: z.boolean().optional(),
});

export const WebsiteProjectResponseSchema = z.strictObject({
  project: WebsiteProjectSchema,
});
export const WebsiteProjectsResponseSchema = z.strictObject({
  projects: z.array(WebsiteProjectSummarySchema),
});

export function websiteProjectId(url: string): string {
  // FNV-1a keeps IDs stable across browsers/servers without pulling node:crypto into the client.
  let hash = 0x811c9dc5;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const slug = sanitizeUrlForDisplay(url)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "website";
  return `${slug}-${hash.toString(36)}`;
}

export function summarizeWebsiteProject(project: WebsiteProject): WebsiteProjectSummary {
  return WebsiteProjectSummarySchema.parse({
    id: project.id,
    url: project.url,
    title: project.title,
    ...(project.description ? { description: project.description } : {}),
    sectionCount: project.inspection.sections.length,
    pageCount: project.inspection.pages.length,
    stepCount: project.walkthrough.nodes.length,
    updatedAt: project.updatedAt,
  });
}

export function createWebsiteProject(input: {
  inspection: WebsiteInspection;
  walkthrough?: WalkthroughDocumentInput;
  title?: string;
  description?: string;
  pages?: Array<{ url: string; title: string }>;
  targets?: WebsiteWalkthroughTarget[];
  now?: Date;
}): WebsiteProject {
  const validation = validateWebsiteUrl(input.inspection.url);
  if (!validation.valid) throw new Error(validation.error ?? "Invalid website URL.");
  const url = validation.normalized!;
  const timestamp = (input.now ?? new Date()).toISOString();
  const title = input.title?.trim() || input.inspection.title || sanitizeUrlForDisplay(url);
  const walkthrough = input.walkthrough
    ? WalkthroughDocumentSchema.parse(input.walkthrough)
    : createWalkthroughFromWebsite({
        url,
        title,
        ...(input.description ? { description: input.description } : {}),
        sections: input.inspection.sections.map(section => ({
          id: section.id,
          label: section.label,
          ...(section.selector ? { selector: section.selector } : {}),
        })),
        ...(input.pages ? { pages: input.pages } : {}),
        ...(input.targets ? { targets: input.targets } : {}),
      });
  return WebsiteProjectSchema.parse({
    version: 1,
    id: websiteProjectId(url),
    url,
    title,
    ...(input.description ? { description: input.description } : {}),
    inspection: input.inspection,
    walkthrough,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Update a stored project without discarding its original source or inspection. */
export function updateWebsiteProject(
  project: WebsiteProject,
  patch: {
    title?: string;
    description?: string | null;
    walkthrough?: WalkthroughDocumentInput;
    inspection?: WebsiteInspection;
    now?: Date;
  },
): WebsiteProject {
  return WebsiteProjectSchema.parse({
    ...project,
    ...(patch.title ? { title: patch.title } : {}),
    ...(patch.description === null ? { description: undefined } : patch.description ? { description: patch.description } : {}),
    ...(patch.walkthrough ? { walkthrough: WalkthroughDocumentSchema.parse(patch.walkthrough) } : {}),
    ...(patch.inspection ? { inspection: patch.inspection } : {}),
    updatedAt: (patch.now ?? new Date()).toISOString(),
  });
}

export function websiteProjectTitle(inspection: WebsiteInspection): string {
  return inspection.title || sanitizeUrlForDisplay(inspection.url);
}

export type { WalkthroughDocument };
