// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWalkthroughDocument, type WalkthroughTarget } from "../../src/core";
import {
  applyWalkthroughHighlights,
  awaitWalkthroughExpectation,
  checkWalkthroughExpectation,
  clickWalkthroughTarget,
  clickabilityIssue,
  measureWalkthroughAnchors,
  resolveWalkthroughScrollTop,
  resolveWalkthroughTarget,
  safeWalkthroughQuery,
} from "../../src/preview/walkthroughRuntime";

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function stubScroller(offsets: Record<string, number>): HTMLDivElement {
  const scroller = document.createElement("div");
  scroller.scrollTop = 0;
  Object.defineProperty(scroller, "clientHeight", { value: 400, configurable: true });
  Object.defineProperty(scroller, "scrollHeight", { value: 1200, configurable: true });
  scroller.getBoundingClientRect = () => rect(0, 400);
  for (const [id, top] of Object.entries(offsets)) {
    const section = document.createElement("div");
    section.setAttribute("data-section-id", id);
    section.getBoundingClientRect = () => rect(top, 300);
    scroller.append(section);
  }
  return scroller;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("target resolution", () => {
  it("prefers an explicit selector, then stable Seene attributes", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div id="hero" data-section-id="hero">hero</div>
      <div data-website-section-id="about">about</div>
      <button data-seene-target="create">create</button>
      <button class="cta">cta</button>
    `;
    expect(resolveWalkthroughTarget(root, { kind: "section", sectionId: "hero" })?.id).toBe("hero");
    expect(resolveWalkthroughTarget(root, { kind: "section", sectionId: "about" })?.textContent).toBe("about");
    expect(resolveWalkthroughTarget(root, { kind: "element", selector: ".cta" })?.className).toBe("cta");
    expect(resolveWalkthroughTarget(root, { kind: "section", sectionId: "missing" })).toBeNull();
    expect(safeWalkthroughQuery(root, "not a (selector")).toBeNull();
  });
});

describe("scroll mapping", () => {
  it("measures ordered anchors and maps a fractional anchor index to a pixel offset", () => {
    const document_ = createWalkthroughDocument({
      title: "Tour",
      targets: [
        { title: "Hero", target: { kind: "section", sectionId: "hero" } },
        { title: "Features", target: { kind: "section", sectionId: "features" } },
      ],
    });
    const scroller = stubScroller({ hero: 0, features: 400 });
    const anchors = measureWalkthroughAnchors(scroller, document_);
    expect(anchors.map(anchor => anchor.key)).toEqual(["section|hero||||", "section|features||||"]);
    expect(anchors.map(anchor => anchor.offsetTop)).toEqual([0, 400]);

    // Start-aligned: the second anchor drives the scroller to its top.
    expect(resolveWalkthroughScrollTop(anchors, 1, scroller, "start", 0)).toBe(400);
    // Halfway between anchors interpolates.
    expect(resolveWalkthroughScrollTop(anchors, 0.5, scroller, "start", 0)).toBe(200);
    // Center alignment accounts for viewport height and the section height.
    expect(resolveWalkthroughScrollTop(anchors, 1, scroller, "center", 0)).toBe(350);
    // Offsets are applied.
    expect(resolveWalkthroughScrollTop(anchors, 0, scroller, "start", -20)).toBe(0);
  });
});

describe("interaction helpers", () => {
  it("clicks a real target and reports disabled targets", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    const handler = vi.fn();
    button.addEventListener("click", handler);
    root.append(button);
    expect(clickWalkthroughTarget(button).ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);

    button.setAttribute("disabled", "");
    expect(clickabilityIssue(button)).toBe("The target is disabled.");
    expect(clickWalkthroughTarget(button).ok).toBe(false);
  });

  it("checks and awaits the expected UI state", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const target: WalkthroughTarget = { kind: "section", sectionId: "panel" };
    const immediate = checkWalkthroughExpectation(root, { sectionId: "panel", state: "visible" });
    expect(immediate.ok).toBe(false);

    const hidden = document.createElement("div");
    hidden.setAttribute("hidden", "");
    hidden.setAttribute("data-section-id", "panel");
    root.append(hidden);
    expect(checkWalkthroughExpectation(root, { sectionId: "panel", state: "hidden" }).ok).toBe(true);

    const pending = awaitWalkthroughExpectation(root, { sectionId: "panel", state: "visible" }, 80);
    hidden.removeAttribute("hidden");
    const outcome = await pending;
    expect(outcome.ok).toBe(true);
    expect(root.querySelector("[data-section-id=panel]")).toBe(hidden);
    void target;
  });

  it("times out when the expected state never appears", async () => {
    const root = document.createElement("div");
    const outcome = await awaitWalkthroughExpectation(root, { selector: ".never", state: "visible" }, 30);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("Timed out");
  });

  it("highlights exactly one resolved target", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-section-id="a">a</div><div data-section-id="b">b</div>`;
    const frame = {
      highlight: { nodeId: "n", target: { kind: "section", sectionId: "b" } as WalkthroughTarget, style: "outline", paddingPx: 8, opacity: 1 },
    } as never;
    applyWalkthroughHighlights(root, frame);
    const active = root.querySelectorAll("[data-seene-walkthrough-active]");
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute("data-section-id")).toBe("b");
    applyWalkthroughHighlights(root, { highlight: null } as never);
    expect(root.querySelectorAll("[data-seene-walkthrough-active]")).toHaveLength(0);
  });
});
