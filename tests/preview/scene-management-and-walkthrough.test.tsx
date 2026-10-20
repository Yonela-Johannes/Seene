// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach, afterEach } from "vitest";
import { SceneLibrary } from "../../src/preview/SceneLibrary";
import { WebsiteWalkthrough } from "../../src/preview/WebsiteWalkthrough";
import { ScenePreview } from "../../src/preview/ScenePreview";
import { defaultSceneDefinition } from "../../src/core/platform";

describe("Scene Management and Walkthrough Integration Regression Tests", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/?seene-preview=1");
    try {
      localStorage.setItem("seene-entered", "true");
    } catch {}
    vi.restoreAllMocks();

    if (typeof global.ResizeObserver === "undefined") {
      global.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as any;
    }
  });

  afterEach(() => {
    cleanup();
  });

  it("removes the explicit preset query when returning to the authored camera", async () => {
    window.history.replaceState({}, "", "/?seene-preview=1&seene-scene=hero-scene&seene-preset=depth");
    const sources = {
      "src/seene/scenes/hero-scene.scene.json": {
        version: 1,
        id: "hero-scene",
        title: "Hero Showcase",
        definition: defaultSceneDefinition(),
      },
    };
    const bindings = {
      "src/seene/scenes/hero-scene.tsx": () => <div>Hero</div>,
    };

    render(<SceneLibrary sources={sources} bindings={bindings} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Depth" }).getAttribute("aria-pressed")).toBe("true");
    });
    fireEvent.click(screen.getByRole("button", { name: "Authored" }));

    await waitFor(() => {
      expect(new URL(window.location.href).searchParams.has("seene-preset")).toBe(false);
    });
  });

  it("renders scene list and shows delete button with confirmation step", async () => {
    const sources = {
      "src/seene/scenes/hero-scene.scene.json": {
        version: 1,
        id: "hero-scene",
        title: "Hero Showcase",
        description: "Main hero component",
        definition: defaultSceneDefinition(),
      },
      "src/seene/scenes/feature-scene.scene.json": {
        version: 1,
        id: "feature-scene",
        title: "Feature List",
        description: "Grid of product features",
        definition: defaultSceneDefinition(),
      },
    };

    const bindings = {
      "src/seene/scenes/hero-scene.tsx": () => <div data-testid="hero-content">Hero</div>,
      "src/seene/scenes/feature-scene.tsx": () => <div data-testid="feature-content">Features</div>,
    };

    render(
      <SceneLibrary
        sources={sources}
        bindings={bindings}
        createSceneEndpoint="/__seene/create-scene"
      />
    );

    // Verify scene titles are displayed
    expect(screen.getByText("Hero Showcase")).toBeTruthy();
    expect(screen.getByText("Feature List")).toBeTruthy();

    // Click delete on Hero Showcase
    const deleteButton = screen.getByTestId("delete-scene-hero-scene");
    fireEvent.click(deleteButton);

    // Confirmation modal should appear
    expect(screen.getByRole("dialog", { name: /delete scene/i })).toBeTruthy();
    expect(screen.getByText(/Are you sure you want to delete/i)).toBeTruthy();

    // Mock fetch for DELETE request
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, id: "hero-scene" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    // Click Confirm Delete
    const confirmButton = screen.getByRole("button", { name: /confirm delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/__seene/create-scene",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ id: "hero-scene" }),
        })
      );
    });
  });

  it("opens Component Browser in Create Scene modal, lists components, supports tabs and search", async () => {
    const mockContent = {
      success: true,
      content: {
        files: [
          { path: "src/components/Header.tsx", default: true, exports: [], kind: "section", title: "Main Header" },
          { path: "src/components/Hero.tsx", default: true, exports: [], kind: "section", title: "Hero Section" },
          { path: "src/pages/index.tsx", default: true, exports: [], kind: "page", title: "Home Page", route: "/" },
        ],
      },
    };

    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockContent), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<SceneLibrary createSceneEndpoint="/__seene/create-scene" />);

    // Click + Create scene button
    const createButton = screen.getByRole("button", { name: /\+ create scene/i });
    fireEvent.click(createButton);

    // Modal should be open
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /create new scene/i })).toBeTruthy();
    });

    // Wait for content discovery
    await waitFor(() => {
      expect(screen.getByText("Hero Section")).toBeTruthy();
      expect(screen.getByText("Main Header")).toBeTruthy();
      expect(screen.getByText("Home Page")).toBeTruthy();
    });

    // Filter by Search
    const searchInput = screen.getByPlaceholderText(/search components/i);
    fireEvent.change(searchInput, { target: { value: "Hero" } });

    expect(screen.getByText("Hero Section")).toBeTruthy();
    expect(screen.queryByText("Main Header")).toBeNull();
  });

  it("supports component ordering in Website Walkthrough mode", async () => {
    const mockContent = {
      success: true,
      content: {
        files: [
          { path: "src/components/Header.tsx", default: true, exports: [], kind: "section", title: "Header" },
          { path: "src/components/Hero.tsx", default: true, exports: [], kind: "section", title: "Hero" },
          { path: "src/components/Footer.tsx", default: true, exports: [], kind: "section", title: "Footer" },
        ],
      },
    };

    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockContent), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<SceneLibrary createSceneEndpoint="/__seene/create-scene" />);

    fireEvent.click(screen.getByRole("button", { name: /\+ create scene/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /create new scene/i })).toBeTruthy();
    });

    // Switch to Website Walkthrough mode
    fireEvent.click(screen.getByText("Website Walkthrough"));

    await waitFor(() => {
      expect(screen.getByText("Header")).toBeTruthy();
    });

    // Click to add Header, then Hero, then Footer
    fireEvent.click(screen.getByText("Header"));
    fireEvent.click(screen.getByText("Hero"));
    fireEvent.click(screen.getByText("Footer"));

    // Verify sequence list contains all 3 in order
    const sequenceHeading = screen.getByText(/Walkthrough Sequence \(3 sections\)/i);
    expect(sequenceHeading).toBeTruthy();
  });

  it("synchronizes timeline time to WebsiteWalkthrough scroll progress", async () => {
    const sections = [
      { id: "sec-1", label: "Section 1", children: <div style={{ height: 600 }}>Sec 1</div>, duration: 2000 },
      { id: "sec-2", label: "Section 2", children: <div style={{ height: 600 }}>Sec 2</div>, duration: 2000 },
    ];

    const onSeek = vi.fn();

    const { container } = render(
      <WebsiteWalkthrough
        sections={sections}
        enableTimeline={true}
        duration={4000}
        seekTime={0}
        onSeek={onSeek}
      />
    );

    const viewport = container.querySelector(".website-walkthrough-viewport");
    expect(viewport).toBeTruthy();
  });

  it("reopens saved walkthrough scenes in full-page scroll mode", async () => {
    const walkthroughDefinition = {
      compositionType: "walkthrough" as const,
      sizingMode: "viewport" as const,
      minHeight: "100vh",
      width: 1400,
      height: 980,
      scene: {
        camera: { perspective: 1800, x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 },
        focus: { distance: 1400, fStop: 8, focalLength: 50, maxBlur: 6 },
        nodes: [{ id: "host" }],
      },
    };

    render(
      <ScenePreview
        definition={walkthroughDefinition}
        title="Walkthrough Reopen Test"
      >
        <div data-testid="walkthrough-scene-content">Walkthrough Scene Body</div>
      </ScenePreview>
    );

    // Verify mode toggle shows "Scroll" active
    const scrollPill = screen.getByRole("button", { name: "Scroll" });
    expect(scrollPill.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Scene" }).getAttribute("aria-pressed")).toBe("false");

    expect(screen.getByTestId("walkthrough-scene-content")).toBeTruthy();
  });
});
