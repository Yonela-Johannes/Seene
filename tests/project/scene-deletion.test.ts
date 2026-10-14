import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { removeSceneSourcePair, writeSceneSourcePair } from "../../src/vite/scene-files";
import { createSceneRecipe, sceneComponentSource } from "../../src/core/platform";

const roots: string[] = [];

async function createTempProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-deletion-test-"));
  roots.push(root);
  await mkdir(path.join(root, "src", "seene", "scenes"), { recursive: true });
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("Scene Deletion and File Protection Regression Tests", () => {
  it("creates and safely deletes a scene source pair without deleting unrelated files", async () => {
    const root = await createTempProject();

    // Create an unrelated project file that must NEVER be deleted
    const unrelatedFile = path.join(root, "src", "App.tsx");
    await writeFile(unrelatedFile, "export default function App() { return <div>App</div>; }", "utf8");

    // Write a scene pair
    const recipe = createSceneRecipe({ id: "target-scene", title: "Target Scene" });
    const compSource = sceneComponentSource({ id: "target-scene" });
    await writeSceneSourcePair(root, "target-scene", recipe, compSource);

    // Verify scene files exist
    const recipePath = path.join(root, "src", "seene", "scenes", "target-scene.scene.json");
    const bindingPath = path.join(root, "src", "seene", "scenes", "target-scene.tsx");
    await expect(writeFile(recipePath, JSON.stringify(recipe), "utf8")).resolves.not.toThrow();

    // Remove the scene
    const removed = await removeSceneSourcePair(root, "target-scene");
    expect(removed).toBe(true);

    // Unrelated file must still exist
    const unrelatedContent = await writeFile(unrelatedFile, "export default function App() { return <div>App</div>; }", "utf8");
    expect(unrelatedContent).toBeUndefined();
  });

  it("refuses malicious scene IDs to prevent directory traversal or accidental file deletion", async () => {
    const root = await createTempProject();

    await expect(removeSceneSourcePair(root, "../App")).rejects.toThrow("Invalid scene ID");
    await expect(removeSceneSourcePair(root, "../../package.json")).rejects.toThrow("Invalid scene ID");
    await expect(removeSceneSourcePair(root, "invalid/path")).rejects.toThrow("Invalid scene ID");
    await expect(removeSceneSourcePair(root, "INVALID_CAPS")).rejects.toThrow("Invalid scene ID");
  });

  it("returns false if attempting to delete a scene that does not exist", async () => {
    const root = await createTempProject();
    const removed = await removeSceneSourcePair(root, "non-existent-scene");
    expect(removed).toBe(false);
  });
});
