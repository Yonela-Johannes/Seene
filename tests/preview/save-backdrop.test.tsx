// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectPreview, SceneModuleLibrary } from "../../src/preview";
import { installLayoutStubs } from "../helpers/layout";

const recipe = (id: string, title: string) => ({
  version: 1,
  id,
  title,
  definition: { scene: { version: 3, nodes: [{ id: "host" }] } },
});

function enterLibrary(query = "?seene-preview=1&seene-scene=demo") {
  window.history.replaceState({}, "", "/" + query);
  vi.stubGlobal("ResizeObserver", function () {
    return { observe() {}, disconnect() {} };
  });
  installLayoutStubs();
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

it("saves the complete edited scene definition when Save Backdrop is clicked in host mode", async () => {
  enterLibrary();
  const request = vi.fn(async () => ({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => ({ success: true }),
  }));
  vi.stubGlobal("fetch", request);
  const modules = {
    "/src/seene/scenes/demo.scene.json": async () => ({ default: recipe("demo", "Demo scene") }),
    "/src/seene/scenes/demo.tsx": async () => ({ default: () => null }),
  };
  render(
    <SceneModuleLibrary
      modules={modules}
      createSceneEndpoint="/__seene/save-scene"
    />,
  );

  await screen.findByRole("button", { name: "Scene Inspector" });
  fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
  fireEvent.click(screen.getByTestId("seene-inspector-save"));

  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/__seene/save-scene",
      expect.objectContaining({ method: "PUT" }),
    ),
  );
  const calls = request.mock.calls as unknown as Array<[string, RequestInit]>;
  const options = calls[0]?.[1];
  const body = JSON.parse(options?.body as string);
  expect(body.id).toBe("demo");
  expect(body.recipe.definition.backdrop).toBe("site");
  expect(body.recipe.definition.width).toBe(1400);
  expect(body.recipe.definition.scene).toEqual(expect.objectContaining({
    camera: expect.any(Object),
    focus: expect.any(Object),
    nodes: expect.arrayContaining([expect.objectContaining({ id: "host" })]),
  }));
});

it("exposes a createSceneEndpoint through ProjectPreview into SceneModuleLibrary", async () => {
  enterLibrary("?seene-preview=1");
  const request = vi.fn(async () => ({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => ({ success: true }),
  }));
  vi.stubGlobal("fetch", request);
  render(
    <ProjectPreview
      projectId="next-project"
      enabled
      sceneModules={{}}
      createSceneEndpoint="/api/seene/create-scene"
    />,
  );
  await screen.findByRole("button", { name: "+ Create scene" });
});
