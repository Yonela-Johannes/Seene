// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceneModuleLibrary } from "../../src/preview";
import { Surface } from "../../src/react";
import { sceneComponentSource } from "../../src/core/platform";
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
  window.history.replaceState({}, "", "/");
});

describe("Tier 1: Canonical Scene Pattern Rendering (jsdom)", () => {
  it("renders a generated scene component WITH a host component and produces non-empty content", async () => {
    window.history.replaceState({}, "", "/?seene-preview=1&seene-scene=with-host");

    const generatedSource = sceneComponentSource({ id: "with-host", content: { importSpecifier: "../../components/Header" } });
    expect(generatedSource.trim().startsWith("// @seene-scaffold-version 1\n\"use client\";")).toBe(true);
    expect(generatedSource).toContain('import HostComponent from "../../components/Header";');
    expect(generatedSource).toContain('<Surface id="host" style={{ width: 1400, height: 980 }}>');
    expect(generatedSource).not.toContain('{children}');

    function HostHeader() {
      return <header data-testid="real-host-header">Real App Header Content</header>;
    }

    function SceneWithHost() {
      return (
        <Surface id="host" style={{ width: 1400, height: 980 }}>
          <HostHeader />
        </Surface>
      );
    }

    const recipe = {
      version: 1,
      id: "with-host",
      title: "Scene With Host",
      definition: {
        width: 1400,
        height: 980,
        scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
      },
    };

    const modules = {
      "/src/seene/scenes/with-host.scene.json": async () => ({ default: recipe }),
      "/src/seene/scenes/with-host.tsx": async () => ({ default: SceneWithHost }),
    };

    render(<SceneModuleLibrary modules={modules} />);

    const header = await screen.findByTestId("real-host-header");
    expect(header).toBeTruthy();
    expect(header.textContent).toBe("Real App Header Content");
  });

  it("renders a generated scene component WITHOUT a host component and produces non-empty visible placeholder content", async () => {
    window.history.replaceState({}, "", "/?seene-preview=1&seene-scene=no-host");

    const generatedSource = sceneComponentSource({ id: "no-host" });
    expect(generatedSource.trim().startsWith("// @seene-scaffold-version 1\n\"use client\";")).toBe(true);
    expect(generatedSource).toContain('Edit src/seene/scenes/no-host.tsx to add your component.');
    expect(generatedSource).toContain('<Surface id="host" style={{ width: 1400, height: 980 }}>');
    expect(generatedSource).not.toContain('{children}');

    function SceneWithoutHost() {
      return (
        <Surface id="host" style={{ width: 1400, height: 980, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#18181b", color: "#f4f4f5", fontFamily: "system-ui, sans-serif", borderRadius: 16, border: "1px solid #27272a" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#ffffff" }}>Scene Preview</h1>
          <p style={{ fontSize: 14, color: "#a1a1aa" }}>Edit src/seene/scenes/no-host.tsx to add your component.</p>
        </Surface>
      );
    }

    const recipe = {
      version: 1,
      id: "no-host",
      title: "Scene Without Host",
      definition: {
        width: 1400,
        height: 980,
        scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
      },
    };

    const modules = {
      "/src/seene/scenes/no-host.scene.json": async () => ({ default: recipe }),
      "/src/seene/scenes/no-host.tsx": async () => ({ default: SceneWithoutHost }),
    };

    render(<SceneModuleLibrary modules={modules} />);

    const heading = await screen.findByText("Scene Preview");
    expect(heading).toBeTruthy();
    const paragraph = screen.getByText("Edit src/seene/scenes/no-host.tsx to add your component.");
    expect(paragraph).toBeTruthy();
  });
});
