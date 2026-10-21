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
  if (boundaries.length === 0) return 0;

  if (options.clamp) {
    time = Math.max(0, Math.min(time, options.duration));
  }

  const lastBoundary = boundaries[boundaries.length - 1];

  if (time >= lastBoundary.endTime || (options.duration > 0 && time >= options.duration)) {
    return lastBoundary.endPosition + (lastBoundary.scrollOffset || 0);
  }

  const activeBoundary = boundaries.find(boundary =>
    time >= boundary.startTime && time < boundary.endTime
  ) || lastBoundary;

  const sectionDuration = activeBoundary.endTime - activeBoundary.startTime;
  if (sectionDuration <= 0) {
    return activeBoundary.startPosition + (activeBoundary.scrollOffset || 0);
  }

  const progress = Math.max(0, Math.min(1, (time - activeBoundary.startTime) / sectionDuration));
  const sectionHeight = activeBoundary.endPosition - activeBoundary.startPosition;

  return activeBoundary.startPosition + (progress * sectionHeight) + (activeBoundary.scrollOffset || 0);
}

export function getActiveSection(time: number, boundaries: SectionBoundary[]): string | null {
  if (boundaries.length === 0) return null;
  const lastBoundary = boundaries[boundaries.length - 1];
  if (time >= lastBoundary.endTime) return lastBoundary.id;
  const activeBoundary = boundaries.find(boundary =>
    time >= boundary.startTime && time < boundary.endTime
  );
  return activeBoundary?.id || boundaries[0].id;
}

export function getTimestampForSection(sectionId: string, progress: number, boundaries: SectionBoundary[]): number {
  const boundary = boundaries.find(b => b.id === sectionId);
  
  if (!boundary) {
    throw new Error(`Section with ID "${sectionId}" not found in timeline`);
  }

  const clampedProgress = Math.max(0, Math.min(progress, 1));
  const sectionDuration = boundary.duration || (boundary.endTime - boundary.startTime);

  return boundary.startTime + (clampedProgress * sectionDuration);
}

export function evaluateTimelineState(time: number, options: TimelineOptions, boundaries: SectionBoundary[]): TimelineState {
  if (boundaries.length === 0) {
    return { time: 0, scrollPosition: 0, activeSectionId: null, sectionProgress: 0 };
  }

  const clampedTime = options.clamp ? Math.max(0, Math.min(time, options.duration)) : time;
  const lastBoundary = boundaries[boundaries.length - 1];

  let activeBoundary = boundaries.find(boundary =>
    clampedTime >= boundary.startTime && clampedTime < boundary.endTime
  );

  if (!activeBoundary && (clampedTime >= lastBoundary.endTime || (options.duration > 0 && clampedTime >= options.duration))) {
    activeBoundary = lastBoundary;
  }

  if (!activeBoundary) {
    activeBoundary = boundaries[0];
  }

  const activeSectionId = activeBoundary.id;
  const sectionDuration = activeBoundary.endTime - activeBoundary.startTime;
  const sectionProgress = sectionDuration > 0
    ? Math.max(0, Math.min(1, (clampedTime - activeBoundary.startTime) / sectionDuration))
    : 1;

  const sectionHeight = activeBoundary.endPosition - activeBoundary.startPosition;
  const scrollPosition = activeBoundary.startPosition + (sectionProgress * sectionHeight) + (activeBoundary.scrollOffset || 0);

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
  if (discoveredSections.length === 0) return [];

  // Calculate explicit duration vs unallocated time and heights
  let explicitDuration = 0;
  let unallocatedHeight = 0;
  let unallocatedCount = 0;

  for (const section of discoveredSections) {
    if (section.duration && section.duration > 0) {
      explicitDuration += (section.pause || 0) + section.duration;
    } else {
      explicitDuration += (section.pause || 0);
      const h = section.height > 0 ? section.height : 100;
      unallocatedHeight += h;
      unallocatedCount++;
    }
  }

  const targetTotalDuration = options.duration && options.duration > 0
    ? options.duration
    : Math.max(5000, explicitDuration || 10000);
  const remainingTime = Math.max(0, targetTotalDuration - explicitDuration);

  const boundaries: SectionBoundary[] = [];
  let currentTime = 0;

  for (let i = 0; i < discoveredSections.length; i++) {
    const section = discoveredSections[i];

    if (i > 0 && section.pause) {
      currentTime += section.pause;
    }

    let allocatedDuration = section.duration;
    if (!allocatedDuration || allocatedDuration <= 0) {
      if (options.useHeightWeightedTiming !== false && unallocatedHeight > 0) {
        const h = section.height > 0 ? section.height : 100;
        allocatedDuration = Math.round((h / unallocatedHeight) * remainingTime);
      } else if (unallocatedCount > 0) {
        allocatedDuration = Math.round(remainingTime / unallocatedCount);
      } else {
        allocatedDuration = 2000;
      }
    }

    const boundary: SectionBoundary = {
      id: section.id,
      label: section.label,
      startTime: currentTime,
      endTime: currentTime + allocatedDuration,
      duration: allocatedDuration,
      pause: section.pause,
      scrollOffset: section.scrollOffset,
      startPosition: section.startPosition,
      endPosition: section.endPosition,
    };

    boundaries.push(boundary);
    currentTime = boundary.endTime;
  }

  // Adjust last boundary endTime if total time slightly differs due to rounding
  if (options.duration && options.duration > 0 && boundaries.length > 0) {
    const lastBoundary = boundaries[boundaries.length - 1];
    if (lastBoundary.endTime !== options.duration) {
      const diff = options.duration - lastBoundary.endTime;
      lastBoundary.endTime = options.duration;
      lastBoundary.duration = Math.max(0, (lastBoundary.duration || 0) + diff);
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
