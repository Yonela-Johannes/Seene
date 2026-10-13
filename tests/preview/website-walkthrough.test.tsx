// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, describe } from "vitest";
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
