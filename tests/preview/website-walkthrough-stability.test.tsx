// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const discoverExplicit = vi.hoisted(() => vi.fn());

vi.mock("../../src/preview/sectionDiscovery", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/preview/sectionDiscovery")>();
  discoverExplicit.mockImplementation(actual.discoverExplicitSections);
  return { ...actual, discoverExplicitSections: discoverExplicit };
});

import { WebsiteWalkthrough } from "../../src/preview/WebsiteWalkthrough";

function Page() {
  return (
    <div>
      <section data-section-id="hero">Hero</section>
      <section data-section-id="features">Features</section>
    </div>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("WebsiteWalkthrough discovery stability", () => {
  it("does not re-discover sections when a parent re-renders with a new children element", () => {
    const view = render(
      <WebsiteWalkthrough>
        <Page />
      </WebsiteWalkthrough>,
    );

    expect(discoverExplicit).toHaveBeenCalledTimes(1);

    // A parent that re-renders on scroll (as the walkthrough fixture does) produces a fresh
    // element object for its children on every frame. Discovery must not run again unless the
    // DOM or the section definitions actually change, otherwise each pass writes new state and
    // the measurement -> boundary -> scroll sync effects cascade.
    for (let index = 0; index < 5; index += 1) {
      view.rerender(
        <WebsiteWalkthrough>
          <Page />
        </WebsiteWalkthrough>,
      );
    }

    expect(discoverExplicit).toHaveBeenCalledTimes(1);
  });
});
