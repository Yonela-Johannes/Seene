import {RESOURCES} from "../core/resources";
import { SCENE_RECIPE_DIRECTORY, type SceneCatalog } from "../core/recipes";
import { sceneApplicationRoute } from "../core/platform";
import type { SceneIssue } from "../core/scene";
import * as services from "./services";
import { extractSurfaceIds } from "./surfaces";

function diagnostic(error: unknown, target = ""): SceneIssue {
  const known = error instanceof Error && "code" in error && "target" in error;
  return { path: known && typeof error.target === "string" ? error.target : target,
    message: known ? error.message : "Unable to read the local scene source. Check files and permissions, then retry." };
}

export async function discoverRecipes(root: string, sceneId?: string): Promise<SceneCatalog> {
  const paths = await services.scanDirectory(root, SCENE_RECIPE_DIRECTORY, 256);
  const sources: { path: string; document: unknown }[] = [];
  const bindingPaths: string[] = [];
  const issues: SceneIssue[] = [];
  for (const path of paths) {
    if (/\.[jt]sx$/.test(path)) {
      try { if (await services.isRegularFile(root, path)) bindingPaths.push(path); }
      catch (error) { issues.push(diagnostic(error, path)); }
    } else if (path.endsWith(".scene.json")) {
      try {
        const text = await services.readText(root, path, 256_000);
        if (text === undefined) {
          issues.push({ path, message: "Recipe disappeared during discovery. Restore it or refresh the scene list." });
          continue;
        }
        let document: unknown;
        try { document = JSON.parse(text); }
        catch {
          issues.push({ path, message: "Invalid recipe JSON. Correct its syntax and reload the scene list." });
          continue;
        }
        sources.push({ path, document });
      } catch (error) { issues.push(diagnostic(error, path)); }
    }
  }
  const catalog = RESOURCES["resolve-recipes"]({ sources, bindingPaths, ...(sceneId === undefined ? {} : { sceneId }) });
  const warnings: SceneIssue[] = [];
  const scenes = await Promise.all(catalog.scenes.map(async scene => {
    let source: string | undefined;
    try { source = await services.readText(root, scene.binding, 64_000); }
    catch (error) { issues.push(diagnostic(error, scene.binding)); }
    if (source === undefined) return scene;
    const textSource = source;
    const scan = extractSurfaceIds(textSource, scene.binding);
    if (scan.unverifiableReason) {
      warnings.push({ path: scene.binding, message: `Surface inspection note: ${scan.unverifiableReason}` });
    } else {
      const declaredIds = new Set(scene.definition.scene.nodes.map(n => n.id));
      for (const n of scene.definition.scene.nodes) {
        if (!scan.literalIds.has(n.id)) {
          warnings.push({ path: `${scene.binding}.nodes.${n.id}`, message: `Recipe node '${n.id}' is missing from component ${scene.binding}.` });
        }
      }
      for (const litId of scan.literalIds) {
        if (!declaredIds.has(litId)) {
          warnings.push({ path: `${scene.binding}.surface.${litId}`, message: `Mounted Surface '${litId}' in ${scene.binding} is missing from recipe nodes.` });
        }
      }
    }
    if (scene.application) return scene;
    const route = sceneApplicationRoute({ source: textSource, bindingPath: scene.binding });
    return route ? { ...scene, application: { route } } : scene;
  }));
  const selected = sceneId === undefined ? undefined : scenes.find(scene => scene.id === sceneId);
  return { ...catalog, scenes, selected,
    issues: [...issues, ...catalog.issues].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    warnings: [...warnings, ...(catalog.warnings ?? [])].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  };
}
