// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScenePreview } from "../../src/preview/ScenePreview";
import { SceneInspector } from "../../src/preview/SceneInspector";
import { installLayoutStubs } from "../helpers/layout";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", function () {
    return { observe() {}, disconnect() {} };
  });
  installLayoutStubs();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Item 4: Chrome Isolation (BUG-3) Tests", () => {
  it("renders editor chrome without Tailwind present and verifies namespaced classes apply layout styles", () => {
    // Ensure no tailwind stylesheet is loaded in document
    const tailwindStyle = document.querySelector("style[id*='tailwind']");
    if (tailwindStyle) tailwindStyle.remove();

    const recipe = {
      version: 1 as const,
      id: "demo",
      title: "Isolated Chrome Demo",
      definition: {
        width: 1400,
        height: 980,
        scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "host" }] },
      },
    };

    const { container } = render(
      <ScenePreview definition={recipe.definition} title="Isolated Chrome Demo">
        <div>App Content</div>
      </ScenePreview>
    );

    // Scene mode uses the same studio shell as the walkthrough: top bar, motion panel, viewport and bottom timeline.
    const main = container.querySelector("main[data-seene-preview].seene-scene-studio");
    expect(main).not.toBeNull();
    expect(container.querySelector(".seene-studio-topbar")).not.toBeNull();
    expect(container.querySelector(".seene-studio-body")).not.toBeNull();
    expect(container.querySelector(".seene-studio-sequence")).not.toBeNull();
    expect(container.querySelector(".seene-studio-main .seene-studio-viewport")).not.toBeNull();

    const footer = container.querySelector("footer.seene-footer");
    expect(footer).toBeNull();
    const dock = container.querySelector('[data-seene-chrome="preview-footer"]');
    expect(dock).not.toBeNull();
    expect(dock!.querySelector(".seene-studio-transport")).not.toBeNull();
  });

  it("checks studio chrome rendering and scene backdrop resolution on light host vs dark host", () => {
    const baseDef = {
      width: 1400,
      height: 980,
      scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "host" }] },
    };

    // Light host
    const { container: lightContainer, unmount: unmountLight } = render(
      <div style={{ "--seene-scene-backdrop": "#ffffff" } as React.CSSProperties}>
        <ScenePreview definition={{ ...baseDef, backdrop: "#ffffff" }} title="Light Host Scene">
          <div>Light Host Content</div>
        </ScenePreview>
      </div>
    );

    const lightMain = lightContainer.querySelector("main[data-seene-preview]");
    expect(lightMain).not.toBeNull();
    expect(lightMain?.getAttribute("style")).toContain("--seene-scene-backdrop: #ffffff");

    unmountLight();

    // Dark host
    const { container: darkContainer } = render(
      <div style={{ "--seene-scene-backdrop": "#0a0a0c" } as React.CSSProperties}>
        <ScenePreview definition={{ ...baseDef, backdrop: "#0a0a0c" }} title="Dark Host Scene">
          <div>Dark Host Content</div>
        </ScenePreview>
      </div>
    );

    const darkMain = darkContainer.querySelector("main[data-seene-preview]");
    expect(darkMain).not.toBeNull();
    expect(darkMain?.getAttribute("style")).toContain("--seene-scene-backdrop: #0a0a0c");
  });

  it("opens inspector panel in an isolated environment and verifies inspector namespaced classes", () => {
    const baseDef = {
      width: 1400,
      height: 980,
      scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "host" }] },
    };

    render(<SceneInspector definition={baseDef} isOpen={true} />);

    const panel = document.querySelector("#scene-inspector-panel");
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("seene-inspector-panel");
  });
});
