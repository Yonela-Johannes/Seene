/**
 * Deterministic timeline evaluation for WebsiteWalkthrough.
 * 
 * Maps timestamps to scroll positions and sections, and provides
 * deterministic timeline-to-scroll synchronization.
 */

/**
 * Represents a section boundary in the timeline.
 */
export interface SectionBoundary {
  /** Unique identifier for the section */
  id: string;
  /** Human-readable label for the section */
  label: string;
  /** Start time of this section in milliseconds */
  startTime: number;
  /** End time of this section in milliseconds */
  endTime: number;
  /** Optional duration for this section in milliseconds */
  duration?: number;
  /** Optional pause before this section in milliseconds */
  pause?: number;
  /** Optional scroll offset for this section in pixels */
  scrollOffset?: number;
  /** Start position in pixels relative to viewport */
  startPosition: number;
  /** End position in pixels relative to viewport */
  endPosition: number;
}

/**
 * Timeline evaluation options for configuring timeline behavior.
 */
export interface TimelineOptions {
  /** Total timeline duration in milliseconds */
  duration: number;
  /** Optional scroll container for relative positioning */
  scrollContainer?: HTMLElement;
  /** Whether to use height-weighted timing by default */
  useHeightWeightedTiming?: boolean;
  /** Whether to clamp invalid timestamps and positions */
  clamp?: boolean;
}

/**
 * Timeline state representing current position and active section.
 */
export interface TimelineState {
  /** Current timestamp in milliseconds */
  time: number;
  /** Target scroll position in pixels */
  scrollPosition: number;
  /** Currently active section ID */
  activeSectionId: string | null;
  /** Progress through current section (0-1) */
  sectionProgress: number;
}

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
 * Pure function that maps timestamps to target scroll positions.
 * 
 * Given a timeline and section boundaries, returns the target scroll position
 * for the specified timestamp. Uses height-weighted timing by default.
 * 
 * @param time - Timestamp in milliseconds
 * @param options - Timeline configuration
 * @param boundaries - Section boundaries with positions
 * @returns Target scroll position in pixels
 */
export function evaluateTimeline(time: number, options: TimelineOptions, boundaries: SectionBoundary[]): number {
  // Clamp invalid timestamps if requested
  if (options.clamp) {
    time = Math.max(0, Math.min(time, options.duration));
  }

  // Find active section for the given time
  const activeBoundary = boundaries.find(boundary => 
    time >= boundary.startTime && time < boundary.endTime
  );

  if (!activeBoundary) {
    // No active section (before first section, between sections, or after last)
    return 0;
  }

  // Calculate progress through active section
  const sectionDuration = activeBoundary.endTime - activeBoundary.startTime;
  if (sectionDuration <= 0) {
    return activeBoundary.startPosition;
  }

  const progress = (time - activeBoundary.startTime) / sectionDuration;

  // Calculate target scroll position based on section progress
  const sectionHeight = activeBoundary.endPosition - activeBoundary.startPosition;
  if (sectionHeight <= 0) {
    return activeBoundary.startPosition + (activeBoundary.scrollOffset || 0);
  }

  // Use height-weighted timing by default
  if (options.useHeightWeightedTiming !== false) {
    const scrollPosition = activeBoundary.startPosition + 
      (progress * sectionHeight) + 
      (activeBoundary.scrollOffset || 0);
    return scrollPosition;
  }

  // Custom duration-based timing
  const duration = activeBoundary.duration || sectionDuration;
  const customProgress = (time - activeBoundary.startTime) / duration;
  const customScrollPosition = activeBoundary.startPosition + 
    (Math.min(customProgress, 1) * sectionHeight) + 
    (activeBoundary.scrollOffset || 0);
  
  return customScrollPosition;
}

/**
 * Pure function that maps timestamps to active sections.
 * 
 * Given a timeline and section boundaries, returns the active section
 * for the specified timestamp.
 * 
 * @param time - Timestamp in milliseconds
 * @param boundaries - Section boundaries
 * @returns Active section ID or null if no active section
 */
export function getActiveSection(time: number, boundaries: SectionBoundary[]): string | null {
  const activeBoundary = boundaries.find(boundary => 
    time >= boundary.startTime && time < boundary.endTime
  );

  return activeBoundary?.id || null;
}

/**
 * Pure function that maps sections and progress to deterministic timestamps.
 * 
 * Given a section ID and progress (0-1), returns the corresponding timestamp
 * in the timeline that will produce that progress through the section.
 * 
 * @param sectionId - Section ID
 * @param progress - Progress through section (0-1)
 * @param boundaries - Section boundaries
 * @returns Deterministic timestamp in milliseconds
 */
export function getTimestampForSection(sectionId: string, progress: number, boundaries: SectionBoundary[]): number {
  const boundary = boundaries.find(b => b.id === sectionId);
  
  if (!boundary) {
    throw new Error(`Section with ID "${sectionId}" not found in timeline`);
  }

  // Ensure progress is within valid range
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  // Calculate timestamp based on section duration
  const sectionDuration = boundary.duration || 
    (boundary.endTime - boundary.startTime);

  return boundary.startTime + (clampedProgress * sectionDuration);
}

/**
 * Pure function that evaluates timeline state for a given timestamp.
 * 
 * Provides complete timeline evaluation including scroll position,
 * active section, and section progress.
 * 
 * @param time - Timestamp in milliseconds
 * @param options - Timeline configuration
 * @param boundaries - Section boundaries with positions
 * @returns Complete timeline state
 */
export function evaluateTimelineState(time: number, options: TimelineOptions, boundaries: SectionBoundary[]): TimelineState {
  // Clamp invalid timestamps if requested
  const clampedTime = options.clamp ? Math.max(0, Math.min(time, options.duration)) : time;

  // Find active section for the given time
  const activeBoundary = boundaries.find(boundary => 
    clampedTime >= boundary.startTime && clampedTime < boundary.endTime
  );

  let scrollPosition = 0;
  let activeSectionId: string | null = null;
  let sectionProgress = 0;

  if (activeBoundary) {
    activeSectionId = activeBoundary.id;
    
    const sectionDuration = activeBoundary.endTime - activeBoundary.startTime;
    if (sectionDuration > 0) {
      sectionProgress = (clampedTime - activeBoundary.startTime) / sectionDuration;
    }

    // Calculate scroll position
    const sectionHeight = activeBoundary.endPosition - activeBoundary.startPosition;
    if (sectionHeight > 0) {
      scrollPosition = activeBoundary.startPosition + 
        (sectionProgress * sectionHeight) + 
        (activeBoundary.scrollOffset || 0);
    } else {
      scrollPosition = activeBoundary.startPosition + (activeBoundary.scrollOffset || 0);
    }
  }

  return {
    time: clampedTime,
    scrollPosition,
    activeSectionId,
    sectionProgress,
  };
}

/**
 * Calculate section boundaries from discovered sections and timeline options.
 * 
 * Converts discovered sections into a timeline with proper timing, pauses,
 * and positions for deterministic playback.
 * 
 * @param discoveredSections - Discovered sections from section discovery
 * @param options - Timeline configuration
 * @returns Section boundaries ready for timeline evaluation
 */
export function calculateSectionBoundaries(
  discoveredSections: DiscoveredSection[], 
  options: TimelineOptions
): SectionBoundary[] {
  const boundaries: SectionBoundary[] = [];
  let currentTime = 0;

  for (let i = 0; i < discoveredSections.length; i++) {
    const section = discoveredSections[i];

    // Add pause before section (except for first section)
    if (i > 0 && section.pause) {
      currentTime += section.pause;
    }

    const boundary: SectionBoundary = {
      id: section.id,
      label: section.label,
      startTime: currentTime,
      endTime: currentTime + (section.duration || 0),
      duration: section.duration,
      pause: section.pause,
      scrollOffset: section.scrollOffset,
      startPosition: section.startPosition,
      endPosition: section.endPosition,
    };

    boundaries.push(boundary);
    currentTime = boundary.endTime;
  }

  // Ensure total duration matches options.duration if provided
  if (options.duration && boundaries.length > 0) {
    const lastBoundary = boundaries[boundaries.length - 1];
    const lastBoundaryDuration = lastBoundary.endTime - lastBoundary.startTime;
    
    if (Math.abs(lastBoundaryDuration - options.duration) > 1) {
      // Scale the last section to match desired duration
      const timeToAllocate = options.duration - (currentTime - (lastBoundary.pause || 0));
      lastBoundary.duration = timeToAllocate > 0 ? timeToAllocate : 0;
      lastBoundary.endTime = lastBoundary.startTime + lastBoundary.duration;
    }
  }

  return boundaries;
}

/**
 * Clamp invalid scroll positions to valid range.
 * 
 * @param position - Scroll position to clamp
 * @param min - Minimum valid position
 * @param max - Maximum valid position
 * @returns Clamped scroll position
 */
export function clampScrollPosition(position: number, min: number, max: number): number {
  return Math.max(min, Math.min(position, max));
}
