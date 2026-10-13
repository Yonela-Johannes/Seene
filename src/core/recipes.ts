import { z } from "zod";
import {OpenPreviewSchema} from "./project";
import { PreviewDefinitionSchema, presentPreview } from "./preview";
import type { SceneIssue } from "./scene";

export const SCENE_RECIPE_DIRECTORY = "src/seene/scenes";
export const SceneRecipeIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase scene slug containing letters, digits and single hyphens.");
export const ListScenesSchema=z.strictObject({});
export const LoadSceneSchema=z.strictObject({sceneId:SceneRecipeIdSchema});
export const OpenSceneSchema=z.strictObject({...OpenPreviewSchema.shape,sceneId:SceneRecipeIdSchema});
export const SnapshotSceneSchema=z.strictObject({
 sceneId:SceneRecipeIdSchema,url:OpenPreviewSchema.shape.url,
 timeMs:z.number().finite().nonnegative().max(120_000).optional(),
});
export const SceneSnapshotSchema=z.strictObject({
 image:z.string().max(128_000).regex(/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/,"Use a Seene-generated PNG snapshot."),
 timeMs:z.number().finite().nonnegative().max(120_000),
});
export const SceneApplicationRouteSchema = z.string().trim().min(1).max(400)
  .regex(/^\/(?:[A-Za-z0-9._~-]+\/?)*$/, "Use an application route containing letters, digits, dots, dashes and slashes, for example /dashboard.");
export const SceneApplicationSchema = z.strictObject({
  route: SceneApplicationRouteSchema,
});
export const SceneRecipeSchema = z.strictObject({
  version: z.literal(1),
  id: SceneRecipeIdSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  definition: PreviewDefinitionSchema,
  application: SceneApplicationSchema.optional(),
  snapshot: SceneSnapshotSchema.optional(),
});
export type SceneRecipeInput = z.input<typeof SceneRecipeSchema>;
export type SceneRecipe = z.output<typeof SceneRecipeSchema>;
export type DiscoveredRecipe = SceneRecipe & { source: string; binding: string };

export const BackdropPatchSchema = z.string().trim().min(1).max(64);
export const SceneUpdateSchema = z.strictObject({
  id: SceneRecipeIdSchema,
  recipe: z.strictObject({
    definition: z.strictObject({
      backdrop: BackdropPatchSchema.optional(),
    }),
  }),
});
export type SceneUpdateInput = z.input<typeof SceneUpdateSchema>;
export type SceneCatalog = {
  scenes: DiscoveredRecipe[];
  selected?: DiscoveredRecipe;
  issues: SceneIssue[];
  warnings: SceneIssue[];
};
function canonicalSourcePath(target: string): boolean {
  return /^src\/seene\/scenes\/[a-z0-9]+(?:-[a-z0-9]+)*\.scene\.json$/.test(target);
}
export function loadSceneRecipes(input: unknown): SceneCatalog {
  if (!input || typeof input !== "object" || !("sources" in input) || !("bindingPaths" in input)
    || !Array.isArray((input as { sources: unknown }).sources) || !Array.isArray((input as { bindingPaths: unknown }).bindingPaths))
    return { scenes: [], issues: [{ path: "catalog", message: "Catalog requires sources and bindingPaths arrays." }], warnings: [] };
  const payload = input as { sources: { path: string; document: unknown }[]; bindingPaths: string[]; sceneId?: unknown };
  if (payload.sceneId !== undefined && typeof payload.sceneId !== "string")
    return { scenes: [], issues: [{ path: "sceneId", message: "Selected scene ID must be a string." }], warnings: [] };
  const bindings = new Set(payload.bindingPaths);
  const map = new Map<string, DiscoveredRecipe>();
  const issues: SceneIssue[] = [];
  const candidates: { path: string; recipe: SceneRecipe }[] = [];
  for (const item of payload.sources) {
    if (!item || typeof item !== "object" || typeof item.path !== "string" || !item.document) {
      issues.push({ path: "catalog.sources", message: "Recipe source must contain path and document." });
      continue;
    }
    if (!canonicalSourcePath(item.path)) {
      issues.push({ path: item.path, message: "Scene recipes must live directly in " + SCENE_RECIPE_DIRECTORY + "/" });
      continue;
    }
    const parsed = SceneRecipeSchema.safeParse(item.document);
    if (!parsed.success) {
      issues.push(...parsed.error.issues.map(i => ({ path: `${item.path}.${i.path.join(".")}`, message: i.message })));
      continue;
    }
    candidates.push({ path: item.path, recipe: parsed.data });
  }
  const idCounts = new Map<string, number>();
  for (const candidate of candidates)
    idCounts.set(candidate.recipe.id, (idCounts.get(candidate.recipe.id) ?? 0) + 1);
  for (const { path, recipe } of candidates) {
    const basename = path.split("/").pop()?.replace(/\.scene\.json$/, "");
    if (recipe.id !== basename) {
      issues.push({ path: path + ".id", message: `Scene ID '${recipe.id}' must match filename '${basename}'.` });
      continue;
    }
    if ((idCounts.get(recipe.id) ?? 0) > 1) {
      issues.push({ path: path + ".id", message: `Duplicate scene ID '${recipe.id}'.` });
      continue;
    }
    const binding = path.replace(/\.scene\.json$/, ".tsx");
    const alternateBinding = path.replace(/\.scene\.json$/, ".jsx");
    const hasBinding = bindings.has(binding);
    const hasAlternateBinding = bindings.has(alternateBinding);
    if (hasBinding && hasAlternateBinding) {
      issues.push({ path: binding, message: `Recipe ${path} has ambiguous components ${binding} and ${alternateBinding}; keep one matching component.` });
      continue;
    }
    if (!hasBinding && !hasAlternateBinding) {
      issues.push({ path: binding, message: `Recipe ${path} needs matching component ${binding} or ${alternateBinding}.` });
      continue;
    }
    map.set(recipe.id, { ...recipe, source: path, binding: hasBinding ? binding : alternateBinding });
  }
  const scenes = [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  const selected = payload.sceneId ? map.get(payload.sceneId) : undefined;
  if (payload.sceneId && !selected)
    issues.push({ path: "sceneId", message: `Scene "${payload.sceneId}" is unavailable. Check its recipe and component diagnostics or choose an available scene.` });
  return { scenes, selected, issues: issues.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0), warnings: [] };
}
