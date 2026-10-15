// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi } from "vitest";
import { resolvePresentation } from "../../src/core/presentation";
import { WebsiteWalkthrough, WebsiteSection } from "../../src/preview";

describe("WebsiteWalkthrough Phase 1 Functionality", () => {
  it("renders full-page children correctly", () => {
    const content = <div data-testid="walkthrough-content">Walkthrough Content</div>;
    const { container } = render(
      <WebsiteWalkthrough>
        {content}
      </WebsiteWalkthrough>
    );
    
    const walkthroughElement = container.firstChild as HTMLElement;
    expect(walkthroughElement.className).toContain("website-walkthrough");
    expect(walkthroughElement.className).toContain("website-walkthrough-full-page");
    expect(screen.getByTestId("walkthrough-content")).toBeTruthy();
    expect(screen.getByTestId("walkthrough-content").textContent).toBe("Walkthrough Content");
  });

  it("renders sections from definitions", () => {
    const sections = [
      {
        id: "section-1",
        label: "Section 1",
        children: <div data-testid="section-1-content">Section 1 Content</div>,
        duration: 5000,
        pause: 1000,
        scrollOffset: 100,
      },
      {
        id: "section-2", 
        label: "Section 2",
        children: <div data-testid="section-2-content">Section 2 Content</div>,
      },
    ];
    
    const { container } = render(<WebsiteWalkthrough sections={sections} />);
    
    const walkthroughElement = container.firstChild as HTMLElement;
    expect(walkthroughElement.className).toContain("website-walkthrough");
    expect(walkthroughElement.className).toContain("website-walkthrough-sections");
    
    // Check section content
    const section1 = screen.getByTestId("section-1-content");
    expect(section1).toBeTruthy();
    
    const section2 = screen.getByTestId("section-2-content");
    expect(section2).toBeTruthy();
    
    // Check section metadata in DOM
    const section1Container = section1.closest("[data-section-id]");
    expect(section1Container?.getAttribute("data-section-id")).toBe("section-1");
    expect(section1Container?.getAttribute("data-section-label")).toBe("Section 1");
    expect(section1Container?.getAttribute("data-section-duration")).toBe("5000");
    expect(section1Container?.getAttribute("data-section-pause")).toBe("1000");
    expect(section1Container?.getAttribute("data-section-scroll-offset")).toBe("100");
  });

  it("maps a timeline seek to the measured position of rendered sections", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("website-walkthrough-section") ? 600 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("data-section-id") === "section-2" ? 600 : 0;
    });

    const { container } = render(
      <WebsiteWalkthrough
        sections={[
          { id: "section-1", label: "First", duration: 2000, children: <div>First</div> },
          { id: "section-2", label: "Second", duration: 2000, children: <div>Second</div> },
        ]}
        enableTimeline
        duration={4000}
        seekTime={3000}
      />,
    );

    const viewport = container.querySelector(".website-walkthrough-viewport") as HTMLElement;
    await waitFor(() => expect(viewport.scrollTop).toBe(900));
  });

  it("maps scroll progress to start, midpoint and end positions for tall content", async () => {
    const { container, rerender } = render(
      <WebsiteWalkthrough enableTimeline duration={4000}>
        <div style={{ height: 2000 }}>Tall content</div>
      </WebsiteWalkthrough>,
    );

    const viewport = container.querySelector(".website-walkthrough-viewport") as HTMLElement;
    Object.defineProperty(viewport, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 400, configurable: true });

    rerender(
      <WebsiteWalkthrough enableTimeline duration={4000} seekTime={0}>
        <div style={{ height: 2000 }}>Tall content</div>
      </WebsiteWalkthrough>,
    );
    await waitFor(() => expect(viewport.scrollTop).toBe(0));

    rerender(
      <WebsiteWalkthrough enableTimeline duration={4000} seekTime={2000}>
        <div style={{ height: 2000 }}>Tall content</div>
      </WebsiteWalkthrough>,
    );
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(700));
    await waitFor(() => expect(viewport.scrollTop).toBeLessThan(1200));

    rerender(
      <WebsiteWalkthrough enableTimeline duration={4000} seekTime={4000}>
        <div style={{ height: 2000 }}>Tall content</div>
      </WebsiteWalkthrough>,
    );
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(1550));
  });

  it("keeps native scroll position when no timeline is configured", () => {
    const { container } = render(
      <WebsiteWalkthrough>
        <div style={{ height: 2000 }}>Tall standalone story</div>
      </WebsiteWalkthrough>,
    );
    const viewport = container.querySelector(".website-walkthrough-viewport") as HTMLElement;
    Object.defineProperty(viewport, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 400, configurable: true });
    viewport.scrollTop = 600;
    fireEvent.scroll(viewport);
    expect(viewport.scrollTop).toBe(600);
  });

  it("defaults walkthrough scenes to a flat camera when no preset is supplied", () => {
    const definition = {
      compositionType: "walkthrough" as const,
      scene: {
        version: 3 as const,
        camera: { perspective: 1800, rotateX: 4, rotateY: -7, rotateZ: 0 },
        focus: { distance: 1800, fStop: 8, focalLength: 50, maxBlur: 6 },
        nodes: [{ id: "host" }],
      },
      motion: { durationMs: 5000, speed: 1, tracks: [] },
      width: 1400,
      height: 980,
    };

    const resolved = resolvePresentation(definition, undefined);
    const camera = resolved.scene.camera!;
    expect(camera.rotateX).toBe(0);
    expect(camera.rotateY).toBe(0);
    expect(camera.rotateZ).toBe(0);
    expect(camera.perspective).toBeGreaterThanOrEqual(2000);

    const explicitPreset = resolvePresentation(definition, "depth");
    expect(explicitPreset.scene.camera?.rotateX).toBe(6);
    expect(explicitPreset.scene.camera?.rotateY).toBe(-16);
  });

  it("renders empty sections gracefully", () => {
    const { container } = render(<WebsiteWalkthrough sections={[]} />);
    
    const walkthroughElement = container.firstChild as HTMLElement;
    expect(walkthroughElement.className).toContain("website-walkthrough");
    expect(walkthroughElement.className).toContain("website-walkthrough-sections");
  });

  it("renders WebsiteSection component correctly", () => {
    const { container } = render(
      <WebsiteSection id="test-section" label="Test Section">
        <div>Test Content</div>
      </WebsiteSection>
    );
    
    const sectionElement = container.firstChild as HTMLElement;
    expect(sectionElement.className).toContain("website-section");
    expect(sectionElement.id).toBe("website-section-test-section");
    expect(sectionElement.dataset.websiteSectionId).toBe("test-section");
    expect(sectionElement.dataset.websiteSectionLabel).toBe("Test Section");
    expect(sectionElement.textContent).toBe("Test Content");
  });

  it("handles missing content gracefully", () => {
    const { container } = render(<WebsiteWalkthrough />);
    
    const walkthroughElement = container.firstChild as HTMLElement;
    expect(walkthroughElement.className).toContain("website-walkthrough");
  });

  it("applies custom className to WebsiteWalkthrough", () => {
    const { container } = render(
      <WebsiteWalkthrough className="custom-walkthrough">
        <div>Content</div>
      </WebsiteWalkthrough>
    );
    
    const walkthroughElement = container.firstChild as HTMLElement;
    expect(walkthroughElement.className).toContain("website-walkthrough");
    expect(walkthroughElement.className).toContain("website-walkthrough-full-page");
    expect(walkthroughElement.className).toContain("custom-walkthrough");
  });
});
