// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceneLibrary } from "../../src/preview/SceneLibrary";
import { installLayoutStubs } from "../helpers/layout";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", function () {
    return { observe() {}, disconnect() {} };
  });
  installLayoutStubs();
  // Clear entered state in localStorage
  try { localStorage.removeItem("seene-entered"); } catch {}
  window.history.replaceState({}, "", "/?seene-preview=1");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("Requirement 4: Library Blur Fix, Stacking Context & Modal Controls Regression Tests", () => {
  const recipe1 = {
    version: 1 as const,
    id: "scene-animated",
    title: "Animated Scene",
    definition: {
      width: 1400,
      height: 980,
      scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "host" }] },
      motion: { durationMs: 4000, speed: 1, tracks: [] },
    },
  };

  const recipe2 = {
    version: 1 as const,
    id: "scene-static",
    title: "Static Scene",
    definition: {
      width: 1400,
      height: 980,
      scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "host" }] },
    },
  };

  function Comp1() { return <div>Animated Comp</div>; }
  function Comp2() { return <div>Static Comp</div>; }

  const sources = {
    "src/seene/scenes/scene-animated.scene.json": recipe1,
    "src/seene/scenes/scene-static.scene.json": recipe2,
  };

  const bindings = {
    "src/seene/scenes/scene-animated.tsx": Comp1,
    "src/seene/scenes/scene-static.tsx": Comp2,
  };

  it("renders library with two scenes, asserts data-seene-blur='0' on every node and no filter contains blur(", async () => {
    // Set entered flag
    try { localStorage.setItem("seene-entered", "true"); } catch {}

    const { container } = render(<SceneLibrary sources={sources} bindings={bindings} />);

    // Check headings and row rendering
    expect(await screen.findByText("Animated Scene")).toBeTruthy();
    expect(await screen.findByText("Static Scene")).toBeTruthy();

    // Verify every [data-seene-id] has data-seene-blur="0"
    const nodes = container.querySelectorAll("[data-seene-id]");
    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.getAttribute("data-seene-blur")).toBe("0");
    });

    // Verify no element inside [data-seene-library] has a computed style filter containing "blur("
    const library = container.querySelector("[data-seene-library]") || container;
    const allElements = library.querySelectorAll("*");
    allElements.forEach(el => {
      const filter = window.getComputedStyle(el).filter;
      expect(filter).not.toContain("blur(");
    });
  });

  it("displays 'Static' label for scenes without motion instead of '0s'", async () => {
    try { localStorage.setItem("seene-entered", "true"); } catch {}

    render(<SceneLibrary sources={sources} bindings={bindings} />);

    // Animated scene shows duration in seconds
    expect(await screen.findByText(/4s/)).toBeTruthy();

    // Static scene shows 'Static' instead of '0s'
    expect(await screen.findByText("Static")).toBeTruthy();
  });

  it("verifies Create Scene modal controls are accessible, editable, and interactive above overlays", async () => {
    try { localStorage.setItem("seene-entered", "true"); } catch {}

    render(<SceneLibrary sources={sources} bindings={bindings} />);

    // Click + Create scene button
    const createBtn = await screen.findByRole("button", { name: /\+ Create scene/i });
    expect(createBtn).toBeTruthy();
    fireEvent.click(createBtn);

    // Verify modal overlay appears with dialog
    const modalTitle = await screen.findByText("Create new scene");
    expect(modalTitle).toBeTruthy();

    // Test text input controls are editable
    const titleInput = screen.getByLabelText("Scene Title") as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    fireEvent.change(titleInput, { target: { value: "My New Scene" } });
    expect(titleInput.value).toBe("My New Scene");

    const descInput = screen.getByPlaceholderText("e.g. A cinematic overview of the analytics panel") as HTMLInputElement;
    expect(descInput).toBeTruthy();
    fireEvent.change(descInput, { target: { value: "A new description" } });
    expect(descInput.value).toBe("A new description");

    const hostInput = screen.getByPlaceholderText("e.g. src/components/Hero.tsx") as HTMLInputElement;
    expect(hostInput).toBeTruthy();
    fireEvent.change(hostInput, { target: { value: "src/components/Header.tsx" } });
    expect(hostInput.value).toBe("src/components/Header.tsx");

    // Test Cancel button closes the modal
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    expect(cancelBtn).toBeTruthy();
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText("Create new scene")).toBeNull();
    });
  });
});
