/**
 * Section discovery utilities for WebsiteWalkthrough.
 * 
 * Discovers sections from React elements using explicit markers and semantic fallbacks.
 * Supports both explicit discovery (via data-seene-section) and semantic discovery
 * (from document landmarks and structured content).
 */

/**
 * Represents a discovered section with stable metadata.
 */
export interface DiscoveredSection {
  /** Stable identifier for the section */
  id: string;
  /** Human-readable label for the section */
  label: string;
  /** DOM element reference for measurement and interaction */
  element: HTMLElement;
  /** Document-relative start position in pixels */
  startPosition: number;
  /** Document-relative end position in pixels */
  endPosition: number;
  /** Height of the section in pixels */
  height: number;
  /** Optional duration for this section in milliseconds */
  duration?: number;
  /** Optional pause before this section in milliseconds */
  pause?: number;
  /** Optional scroll offset to position this section within the viewport */
  scrollOffset?: number;
}

/**
 * Result of explicit section discovery from data attributes.
 */
export interface ExplicitSectionDiscoveryResult {
  /** Discovered sections in document order */
  sections: DiscoveredSection[];
  /** Sections with duplicate IDs (first occurrence wins) */
  duplicateIds?: string[];
}

/**
 * Result of semantic section discovery from document structure.
 */
export interface SemanticSectionDiscoveryResult {
  /** Discovered sections in document order */
  sections: DiscoveredSection[];
}

/**
 * Discover sections from React element trees using explicit markers.
 * 
 * Looks for elements marked with `data-seene-section` attribute and extracts
 * metadata from standardized data attributes.
 * 
 * @param container - The container element to search within
 * @returns Discovered sections with metadata
 */
export function discoverExplicitSections(container: HTMLElement): ExplicitSectionDiscoveryResult {
  const sectionElements = Array.from(
    container.querySelectorAll<HTMLElement>("[data-section-id], [data-seene-section], [data-website-section-id], [data-walkthrough-target]")
  );

  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  const sections: DiscoveredSection[] = [];

  sectionElements.forEach((element) => {
    const id =
      element.dataset.sectionId ||
      element.dataset.seeneSectionId ||
      element.dataset.seeneSection ||
      element.dataset.websiteSectionId ||
      element.dataset.walkthroughTarget ||
      element.id;
    if (!id) {
      return;
    }

    const label =
      element.dataset.sectionLabel ||
      element.dataset.seeneSectionLabel ||
      element.dataset.seeneSectionTitle ||
      element.getAttribute("aria-label") ||
      element.querySelector("h1, h2, h3, h4")?.textContent?.trim() ||
      id;
    const duration = element.dataset.seeneSectionDuration 
      ? parseInt(element.dataset.seeneSectionDuration, 10) 
      : undefined;
    const pause = element.dataset.seeneSectionPause 
      ? parseInt(element.dataset.seeneSectionPause, 10) 
      : undefined;
    const scrollOffset = element.dataset.seeneSectionScrollOffset 
      ? parseInt(element.dataset.seeneSectionScrollOffset, 10) 
      : undefined;

    if (seenIds.has(id)) {
      duplicateIds.push(id);
      return; // Skip duplicates
    }
    seenIds.add(id);

    const startPosition = element.offsetTop;
    const endPosition = startPosition + element.offsetHeight;
    const height = element.offsetHeight;

    sections.push({
      id,
      label,
      element,
      startPosition,
      endPosition,
      height,
      duration,
      pause,
      scrollOffset,
    });
  });

  return { sections, duplicateIds: duplicateIds.length > 0 ? duplicateIds : undefined };
}

/**
 * Discover sections from document structure as semantic fallback.
 * 
 * When explicit markers are absent, discovers reasonable top-level landmarks
 * such as `main`, `header`, `section`, `article`, and suitable labelled regions.
 * Excludes navigation, footers, hidden elements, and redundant nested elements.
 * 
 * @param container - The container element to search within
 * @returns Discovered sections using semantic discovery
 */
export function discoverSemanticSections(container: HTMLElement): SemanticSectionDiscoveryResult {
  const sectionElements: HTMLElement[] = [];

  // Prioritize standard HTML5 section elements
  const semanticElements = [
    "HEADER", "MAIN", "FOOTER", 
    "SECTION", "ARTICLE", "ASIDE",
    "NAV", "DIV" // fallback for generic sections
  ];

  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    
    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();
    
    // Skip excluded elements
    if (tagName === "NAV" || tagName === "FOOTER" || 
        element.closest("nav") || element.closest("footer")) {
      return;
    }
    
    // Skip hidden elements
    if (element.offsetParent === null) return;
    
    const isSemanticSection = semanticElements.includes(tagName) && 
                              tagName !== "DIV" ||
                              (tagName === "DIV" && hasIdentifyingAttributes(element));
    
    if (isSemanticSection) {
      sectionElements.push(element);
    }
    
    // Recursively walk child nodes (avoid nested sections)
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childElement = child as HTMLElement;
        // Don't process nested semantic sections
        if (!semanticElements.includes(childElement.tagName.toUpperCase()) || 
            childElement === element) {
          walk(child);
        }
      }
    });
  };

  walk(container);

  const sections: DiscoveredSection[] = [];

  sectionElements.forEach((element) => {
    // Generate stable ID from tag name and content or position
    const tagName = element.tagName.toLowerCase();
    const id = `section-${tagName}-${sections.length + 1}`;
    
    // Try to get label from heading elements or accessible label
    let label = "";
    const heading = element.querySelector("h1, h2, h3, h4, h5, h6");
    if (heading?.textContent?.trim()) {
      label = heading.textContent.trim();
    } else if (element.id) {
      label = element.id;
    } else {
      // Generate label from tag name and first text content
      let firstText: string | undefined;
      Array.from(element.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          firstText = node.textContent.trim();
        }
      });
      
      if (firstText) {
        label = firstText.length > 50 ? firstText.substring(0, 50) + "..." : firstText;
      } else {
        label = tagName.charAt(0).toUpperCase() + tagName.slice(1);
      }
    }

    const startPosition = element.offsetTop;
    const endPosition = startPosition + element.offsetHeight;
    const height = element.offsetHeight;

    sections.push({
      id,
      label,
      element,
      startPosition,
      endPosition,
      height,
    });
  });

  return { sections };
}

/**
 * Check if a DIV element has identifying attributes that make it a good candidate section.
 * 
 * @param element - The element to check
 * @returns True if the element has identifying attributes
 */
function hasIdentifyingAttributes(element: HTMLElement): boolean {
  // Check for common identifying data attributes
  if (element.dataset.seeneSection || 
      element.dataset.section ||
      element.dataset.content ||
      element.id) {
    return true;
  }
  
  // Check for semantic roles
  if (element.getAttribute("role") === "main" || 
      element.getAttribute("role") === "region") {
    return true;
  }
  
  // Check for aria-label or aria-labelledby
  if (element.getAttribute("aria-label") || 
      element.getAttribute("aria-labelledby")) {
    return true;
  }
  
  return false;
}