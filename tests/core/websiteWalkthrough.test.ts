import { describe, expect, it } from "vitest";
import { createWalkthroughFromWebsite, validateWalkthrough } from "../../src/core";

describe("createWalkthroughFromWebsite", () => {
  it("creates a valid walkthrough document for a website URL", () => {
    const doc = createWalkthroughFromWebsite({
      url: "https://example.com",
      title: "Example Tour",
      description: "Guided tour of example.com",
      sections: [
        { id: "hero", label: "Hero Banner", selector: "#hero" },
        { id: "features", label: "Key Features", selector: "#features" },
      ],
    });

    expect(doc.title).toBe("Example Tour");
    expect(doc.nodes.length).toBe(4); // start, hero, features, end
    expect(doc.nodes[0].type).toBe("start");
    expect(doc.nodes[1].title).toBe("Hero Banner");
    expect(doc.nodes[2].title).toBe("Key Features");
    expect(doc.nodes[3].type).toBe("end");

    const review = validateWalkthrough(doc);
    expect(review.valid).toBe(true);
  });

  it("handles missing sections by providing default walkthrough steps", () => {
    const doc = createWalkthroughFromWebsite({
      url: "http://localhost:3000/app",
    });

    expect(doc.title).toBe("localhost:3000/app");
    expect(doc.nodes.length).toBe(5); // start, show-hero, scroll-features, show-overview, end
    const review = validateWalkthrough(doc);
    expect(review.valid).toBe(true);
  });
});
