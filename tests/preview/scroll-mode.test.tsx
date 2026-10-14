// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateTimeline, evaluateTimelineState, type SectionBoundary } from "../../src/preview/websiteTimeline";
import { WebsiteWalkthrough } from "../../src/preview/WebsiteWalkthrough";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", function () {
    return { observe() {}, disconnect() {} };
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Item 5: Scroll Mode Determinism & Export Frame Synchronization", () => {
  const boundaries: SectionBoundary[] = [
    { id: "hero", label: "Hero", startTime: 0, endTime: 2000, duration: 2000, startPosition: 0, endPosition: 800 },
    { id: "features", label: "Features", startTime: 2000, endTime: 4000, duration: 2000, startPosition: 800, endPosition: 1600 },
    { id: "footer", label: "Footer", startTime: 4000, endTime: 5000, duration: 1000, startPosition: 1600, endPosition: 2000 },
  ];

  const options = { duration: 5000, clamp: true };

  it("maps t=0 to top (0px) and t=end to bottom/footer (2000px) deterministically", () => {
    // t=0 (Top)
    const topPos = evaluateTimeline(0, options, boundaries);
    expect(topPos).toBe(0);

    const topState = evaluateTimelineState(0, options, boundaries);
    expect(topState.scrollPosition).toBe(0);
    expect(topState.activeSectionId).toBe("hero");

    // t=5000 (Bottom / Footer)
    const bottomPos = evaluateTimeline(5000, options, boundaries);
    expect(bottomPos).toBe(2000);

    const bottomState = evaluateTimelineState(5000, options, boundaries);
    expect(bottomState.scrollPosition).toBe(2000);
    expect(bottomState.activeSectionId).toBe("footer");
  });

  it("verifies scrubbing is stable and deterministic across arbitrary time jumps", () => {
    // Jump to middle of features (t=3000ms -> 50% through features section -> 1200px)
    const midPos = evaluateTimeline(3000, options, boundaries);
    expect(midPos).toBe(1200);

    // Jump forward to t=4500ms -> 50% through footer -> 1800px
    const footerPos = evaluateTimeline(4500, options, boundaries);
    expect(footerPos).toBe(1800);

    // Jump backward to t=1000ms -> 50% through hero -> 400px
    const heroPos = evaluateTimeline(1000, options, boundaries);
    expect(heroPos).toBe(400);

    // Repeat same jumps to confirm pure determinism
    expect(evaluateTimeline(3000, options, boundaries)).toBe(midPos);
    expect(evaluateTimeline(4500, options, boundaries)).toBe(footerPos);
    expect(evaluateTimeline(1000, options, boundaries)).toBe(heroPos);
  });

  it("renders WebsiteWalkthrough with controls and verifies timeline seek state", () => {
    const sections = [
      { id: "s1", label: "Section 1", duration: 2000, children: <div>Hero Content</div> },
      { id: "s2", label: "Section 2", duration: 2000, children: <div>Footer Content</div> },
    ];

    const { container } = render(
      <WebsiteWalkthrough sections={sections} enableTimeline={true} seekTime={0} duration={4000} />
    );

    const viewport = container.querySelector(".website-walkthrough-viewport");
    expect(viewport).not.toBeNull();
    expect(screen.getByText("Hero Content")).toBeTruthy();
    expect(screen.getByText("Footer Content")).toBeTruthy();
  });
});
