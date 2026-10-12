// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectPreview, SceneLibrary, SceneModuleLibrary } from "../../src/preview";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPdwAAAAASUVORK5CYII=";
const recipe = (id: string, title: string, snapshot?: { image: string; timeMs: number }) => ({
  version: 1,
  id,
  title,
  definition: { scene: { version: 3, nodes: [{ id: "host" }] } },
  ...(snapshot ? { snapshot } : {}),
});

import { installLayoutStubs } from "../helpers/layout";

function enterLibrary(query = "?seene-preview=1") {
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

it("keeps the preview create-scene dialog accessible and explains a missing Next.js handler accurately", async () => {
  enterLibrary();
  const request = vi.fn(async () => ({
    ok: true,
    headers: { get: () => "text/html; charset=utf-8" },
    json: async () => ({}),
  }));
  vi.stubGlobal("fetch", request);
  render(<ProjectPreview projectId="next-project" enabled sceneModules={{}} createSceneEndpoint="/api/seene/create-scene" />);
  fireEvent.click(await screen.findByRole("button", { name: "+ Create scene" }));
  const dialog = screen.getByRole("dialog", { name: "Create new scene" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.getAttribute("aria-describedby")).toBe("seene-create-description");
  fireEvent.change(screen.getByLabelText("Scene Title"), { target: { value: "Landing page check" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create scene" }).closest("form")!);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Re-run seene init"));
  expect(request).toHaveBeenCalledWith("/api/seene/create-scene", expect.objectContaining({ method: "POST" }));
});

it("uses inert cached images without mounting host scenes and recovers a failed image on replacement", () => {
  enterLibrary();
  const Host = vi.fn(() => null);
  const sources = (snapshot?: { image: string; timeMs: number }) => ({
    "src/seene/scenes/demo.scene.json": recipe("demo", "Actual scene", snapshot),
  });
  const bindings = { "src/seene/scenes/demo.tsx": Host };
  const view = render(<SceneLibrary sources={sources({ image, timeMs: 0 })} bindings={bindings} />);
  const link = screen.getByRole("link", { name: /Actual scene/ });
  const img = link.querySelector("img")!;
  expect(img.getAttribute("src")).toBe(image);
  expect(Host).not.toHaveBeenCalled();
  fireEvent.error(img);
  expect(link.querySelector("img")).toBeNull();
  expect(link.textContent).toContain("01");
  view.rerender(<SceneLibrary sources={sources({ image: image.replace("Pdw", "Pdx"), timeMs: 0 })} bindings={bindings} />);
  const replacement = link.querySelector("img")!;
  expect(replacement).not.toBe(img);
  expect(replacement.hidden).toBe(false);
  view.rerender(<SceneLibrary sources={sources()} bindings={bindings} />);
  expect(link.querySelector("img")).toBeNull();
  expect(link.textContent).toContain("01");
  expect(Host).not.toHaveBeenCalled();
});

it("opens a scene with the real host application as its rendered child", async () => {
  enterLibrary("?seene-preview=1&seene-scene=demo");
  const { Surface } = await import("../../src/react");
  function Scene() {
    return <Surface id="host"><main>Existing React application</main></Surface>;
  }
  const modules = {
    "/src/seene/scenes/demo.scene.json": async () => ({ default: recipe("demo", "Actual scene") }),
    "/src/seene/scenes/demo.tsx": async () => ({ default: Scene }),
  };
  render(
    <SceneModuleLibrary
      modules={modules}
    />,
  );
  expect(await screen.findByText("Existing React application")).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Back to scenes" }));
  await waitFor(() => expect(screen.getByRole("link", { name: /Actual scene/ })).toBeTruthy());
});

it("keeps three valid scenes available while reporting the path of one broken component module", async () => {
  enterLibrary();
  const modules = {
    "/src/seene/scenes/alpha.scene.json": async () => ({ default: recipe("alpha", "Alpha scene") }),
    "/src/seene/scenes/alpha.tsx": async () => ({ default: () => null }),
    "/src/seene/scenes/beta.scene.json": async () => ({ default: recipe("beta", "Beta scene") }),
    "/src/seene/scenes/beta.tsx": async () => ({ default: () => null }),
    "/src/seene/scenes/broken.scene.json": async () => ({ default: recipe("broken", "Broken scene") }),
    "/src/seene/scenes/broken.tsx": async () => {
      throw new Error("Broken component import failed");
    },
    "/src/seene/scenes/delta.scene.json": async () => ({ default: recipe("delta", "Delta scene") }),
    "/src/seene/scenes/delta.tsx": async () => ({ default: () => null }),
  };
  render(<SceneModuleLibrary modules={modules} />);
  expect(await screen.findByRole("link", { name: /Alpha scene/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Beta scene/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Delta scene/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Broken scene/ })).toBeNull();
  fireEvent.click(screen.getByText(/Some scene files have problems \(1\)/));
  expect(await screen.findByText("src/seene/scenes/broken.tsx")).toBeTruthy();
  await waitFor(() => expect(document.querySelector("details li")?.textContent).toContain("Broken component import failed"));
  expect(document.querySelectorAll("[data-seene-id^='scene-row-']").length).toBe(3);
});

it("renders a dedicated 'Scene not found' view listing available slugs when deep-linking to an unknown slug", async () => {
  enterLibrary("?seene-preview=1&seene-scene=unknown-slug");
  const modules = {
    "/src/seene/scenes/alpha.scene.json": async () => ({ default: recipe("alpha", "Alpha scene") }),
    "/src/seene/scenes/alpha.tsx": async () => ({ default: () => null }),
    "/src/seene/scenes/beta.scene.json": async () => ({ default: recipe("beta", "Beta scene") }),
    "/src/seene/scenes/beta.tsx": async () => ({ default: () => null }),
  };
  render(<SceneModuleLibrary modules={modules} />);
  expect(await screen.findByRole("heading", { name: "Scene not found" })).toBeTruthy();
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("unknown-slug");
  expect(alert.textContent).toContain("Alpha scene");
  expect(alert.textContent).toContain("Beta scene");
  expect(screen.queryByText(/Some scene files have problems/)).toBeNull();
  expect(screen.queryByRole("region", { name: "Scene library" })).toBeNull();
});

it("shows an explicit error banner naming the broken file and reason when deep-linking to an existing scene with a broken component", async () => {
  enterLibrary("?seene-preview=1&seene-scene=broken");
  const modules = {
    "/src/seene/scenes/alpha.scene.json": async () => ({ default: recipe("alpha", "Alpha scene") }),
    "/src/seene/scenes/alpha.tsx": async () => ({ default: () => null }),
    "/src/seene/scenes/broken.scene.json": async () => ({ default: recipe("broken", "Broken scene") }),
    "/src/seene/scenes/broken.tsx": async () => {
      throw new Error("Component module evaluation failed");
    },
  };
  render(<SceneModuleLibrary modules={modules} />);
  expect(await screen.findByRole("heading", { name: "Scene cannot be opened" })).toBeTruthy();
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("src/seene/scenes/broken.tsx");
  expect(alert.textContent).toContain("Component module evaluation failed");
  expect(screen.queryByRole("region", { name: "Scene library" })).toBeNull();
});

it("shows explicit error banner for broken JSX component", async () => {
  enterLibrary("?seene-preview=1&seene-scene=broken-jsx");
  const modules = {
    "/src/seene/scenes/broken-jsx.scene.json": async () => ({ default: recipe("broken-jsx", "Broken JSX") }),
    "/src/seene/scenes/broken-jsx.jsx": async () => {
      throw new Error("JSX module execution failed");
    },
  };
  render(<SceneModuleLibrary modules={modules} />);
  expect(await screen.findByRole("heading", { name: "Scene cannot be opened" })).toBeTruthy();
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("src/seene/scenes/broken-jsx.jsx");
  expect(alert.textContent).toContain("JSX module execution failed");
});

it("diagnoses recipe node missing from component and surface missing from recipe nodes", async () => {
  enterLibrary("?seene-preview=1&seene-scene=mismatch");
  const { ScenePreview } = await import("../../src/preview");
  const { Surface } = await import("../../src/react");
  const mismatchDefinition = {
    width: 1000, height: 600,
    scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "a" }, { id: "b" }] },
    motion: { durationMs: 1000, tracks: [] },
  };
  render(
    <ScenePreview definition={mismatchDefinition} title="Mismatch test">
      <Surface id="a">A</Surface>
      <Surface id="c">C</Surface>
    </ScenePreview>,
  );
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Recipe node 'b' has no mounted Surface component");
  expect(alert.textContent).toContain("Mounted Surface 'c' has no recipe node declaration");
});

it("route based scene recipe omitting application surface produces no false mismatch", async () => {
  const { ScenePreview } = await import("../../src/preview");
  const { Surface } = await import("../../src/react");
  const { SCENE_PRESENTATION_SURFACE } = await import("../../src/core/platform");
  const routeDefinition = {
    width: 1000, height: 600,
    scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "hero" }] },
    motion: { durationMs: 1000, tracks: [] },
  };
  render(
    <ScenePreview definition={routeDefinition} title="Route test">
      <Surface id={SCENE_PRESENTATION_SURFACE}>
        <Surface id="hero">Hero</Surface>
      </Surface>
    </ScenePreview>,
  );
  expect(screen.queryByRole("alert")).toBeNull();
});

it("shows loading state without flashing not found during lazy module resolution", async () => {
  enterLibrary("?seene-preview=1&seene-scene=deferred");
  let resolvePromise!: (val: unknown) => void;
  const deferredPromise = new Promise(resolve => {
    resolvePromise = resolve;
  });
  const modules = {
    "/src/seene/scenes/deferred.scene.json": () => deferredPromise,
    "/src/seene/scenes/deferred.tsx": async () => ({ default: () => null }),
  };
  render(<SceneModuleLibrary modules={modules} />);
  expect(screen.getByText("Loading your scenes…")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Scene not found" })).toBeNull();
  act(() => {
    resolvePromise({ default: recipe("deferred", "Deferred scene") });
  });
  await waitFor(() => {
    expect(screen.queryByText("Loading your scenes…")).toBeNull();
  });
});
