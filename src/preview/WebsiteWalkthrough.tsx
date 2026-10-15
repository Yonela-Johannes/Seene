"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WebsiteSection } from "./WebsiteSection";
import { 
  DiscoveredSection, 
  discoverExplicitSections, 
  discoverSemanticSections
} from "./sectionDiscovery";
import {
  SectionBoundary,
  TimelineOptions,
  evaluateTimeline,
  getActiveSection,
  getTimestampForSection,
  evaluateTimelineState,
  calculateSectionBoundaries
} from "./websiteTimeline";

export type WebsiteSectionDefinition = {
  /** Unique identifier for the section */
  id: string;
  /** Human-readable label displayed in UI controls, tooltips, or navigation */
  label: string;
  /** Optional duration for this section in milliseconds */
  duration?: number;
  /** Optional pause before this section in milliseconds */
  pause?: number;
  /** Optional scroll offset to position this section within the viewport */
  scrollOffset?: number;
  /** Section content - rendered as normal React children */
  children: ReactNode;
};

export type WebsiteWalkthroughProps = {
  /** Full-page content mode - accepts complete React page content */
  children?: ReactNode;
  /** Explicit-section mode - ordered list of section definitions */
  sections?: WebsiteSectionDefinition[];
  /** Optional CSS class for the walkthrough container */
  className?: string;
  /** Enable timeline playback controls */
  enableTimeline?: boolean;
  /** Called when timeline duration changes */
  onDurationChange?: (duration: number) => void;
  /** Called when play/pause state changes */
  onPlayPause?: (playing: boolean) => void;
  /** Called when seek position changes */
  onSeek?: (time: number) => void;
  /** Format function for timeline timestamps */
  formatTime?: (ms: number) => string;
  /** External timeline state (when controlled) */
  seekTime?: number;
  isPlaying?: boolean;
  duration?: number;
};

export function WebsiteWalkthrough(props: WebsiteWalkthroughProps): ReactNode {
  const {
    children,
    sections: explicitSections,
    className,
    enableTimeline = false,
    onDurationChange,
    onPlayPause,
    onSeek,
    formatTime,
    seekTime,
    isPlaying,
    duration,
  } = props;

  // Internal state for timeline control
  const [internalSeekTime, setInternalSeekTime] = useState(0);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [internalDuration, setInternalDuration] = useState(0);
  const [maxScrollDistance, setMaxScrollDistance] = useState(0);
  const maxScrollDistanceRef = useRef(0);
  
  // Use external state if provided, otherwise internal
  const seekTimeValue = seekTime !== undefined ? seekTime : internalSeekTime;
  const isPlayingValue = isPlaying !== undefined ? isPlaying : internalIsPlaying;
  const durationValue = duration !== undefined ? duration : internalDuration;

  // Viewport ref for section discovery and measurement
  const viewportRef = useRef<HTMLDivElement>(null);
  
  // Discovered sections state
  const [discoveredSections, setDiscoveredSections] = useState<DiscoveredSection[]>([]);
  const [sectionBoundaries, setSectionBoundaries] = useState<SectionBoundary[]>([]);

  // Create combined sections for backward compatibility
  const combinedSections = useMemo(() => {
    if (explicitSections) {
      return explicitSections;
    }
    // If sections are not provided, WebsiteSection will use its own discovery
    return undefined;
  }, [explicitSections]);

  // Section discovery and measurement
  useEffect(() => {
    if (!viewportRef.current) return;

    const container = viewportRef.current;
    
    // Discover rendered sections from explicit definitions
    let discovered: DiscoveredSection[] = [];
    
    if (explicitSections) {
      const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-section-id]'));
      discovered = explicitSections.flatMap((section) => {
        const element = elements.find(candidate => candidate.dataset.sectionId === section.id);
        if (!element) return [];
        return [{
          id: section.id,
          label: section.label,
          element,
          startPosition: 0,
          endPosition: 0,
          height: 0,
          duration: section.duration,
          pause: section.pause,
          scrollOffset: section.scrollOffset,
        }];
      });
    } else if (children) {
      // Discover sections from DOM when children are provided
      const explicit = discoverExplicitSections(container);
      const semantic = discoverSemanticSections(container);
      discovered = [...explicit.sections, ...semantic.sections];
    }

    // Measure sections and update state
    const measureSections = () => {
      const measured: DiscoveredSection[] = [];
      
      discovered.forEach((section) => {
        const element = section.element;
        const startPosition = element.offsetTop;
        const endPosition = startPosition + element.offsetHeight;
        const height = element.offsetHeight;
        
        measured.push({
          ...section,
          startPosition,
          endPosition,
          height,
        });
      });
      
      setDiscoveredSections(measured);
    };

    // Initial measurement
    measureSections();
    
    // Setup resize observer for remeasurement
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureSections) : null;
    if (observer && container) {
      observer.observe(container);
      discovered.forEach(section => observer.observe(section.element));
    }
    
    // Setup mutation observer for content changes
    const mutationObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(measureSections) : null;
    if (mutationObserver && container) {
      mutationObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-seene-section']
      });
    }
    
    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [explicitSections, children]);

  // Calculate section boundaries when discovered sections change
  useEffect(() => {
    if (discoveredSections.length === 0) return;
    
    const options: TimelineOptions = {
      duration: durationValue || 0,
      useHeightWeightedTiming: true,
      clamp: true,
    };
    
    const boundaries = calculateSectionBoundaries(discoveredSections, options);
    setSectionBoundaries(boundaries);
    
    if (!durationValue && boundaries.length > 0) {
      const totalDuration = boundaries.reduce((sum, boundary) => sum + (boundary.pause || 0) + (boundary.duration || 0), 0);
      setInternalDuration(totalDuration);
      onDurationChange?.(totalDuration);
    }
  }, [discoveredSections, durationValue, onDurationChange]);

  // Timeline synchronization effect
  useEffect(() => {
    if (!enableTimeline || sectionBoundaries.length === 0) return;
    
    // Handle external seekTime changes
    if (seekTime !== undefined && seekTime !== seekTimeValue) {
      setInternalSeekTime(seekTime);
      onSeek?.(seekTime);
    }
    
    // Handle external isPlaying changes
    if (isPlaying !== undefined && isPlaying !== isPlayingValue) {
      setInternalIsPlaying(isPlaying);
      onPlayPause?.(isPlaying);
    }
    
    return () => {
      // Cleanup
    };
  }, [enableTimeline, sectionBoundaries, seekTime, seekTimeValue, isPlaying, isPlayingValue, onSeek, onPlayPause]);

  // Playback animation effect
  useEffect(() => {
    if (!enableTimeline || !isPlayingValue || sectionBoundaries.length === 0 || durationValue <= 0) return;
    
    const startTime = performance.now() - seekTimeValue;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const next = Math.min(durationValue, elapsed);
      
      if (next !== seekTimeValue) {
        setInternalSeekTime(next);
        onSeek?.(next);
      }
      
      if (next < durationValue) {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(animate);
        } else {
          setTimeout(animate, 16);
        }
      } else {
        setInternalIsPlaying(false);
        onPlayPause?.(false);
      }
    };
    
    const frame = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [enableTimeline, isPlayingValue, sectionBoundaries, durationValue, seekTimeValue, onSeek, onPlayPause]);

  const syncScrollMetrics = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    maxScrollDistanceRef.current = max;
    setMaxScrollDistance(max);
    if (max <= 0 && viewport.scrollTop !== 0) {
      viewport.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    syncScrollMetrics();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncScrollMetrics) : null;
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [syncScrollMetrics, children, explicitSections]);

  // Synchronize timeline time to viewport scroll position
  useEffect(() => {
    if (!viewportRef.current) return;
    const options: TimelineOptions = { duration: durationValue || 5000, clamp: true };
    const max = maxScrollDistanceRef.current;

    if (sectionBoundaries.length > 0) {
      const state = evaluateTimelineState(seekTimeValue, options, sectionBoundaries);
      const nextScroll = max > 0 ? Math.min(Math.max(0, state.scrollPosition), max) : state.scrollPosition;
      if (Math.abs(viewportRef.current.scrollTop - nextScroll) > 2) {
        viewportRef.current.scrollTop = nextScroll;
      }
      return;
    }

    if (durationValue > 0 && max > 0) {
      const progress = Math.min(Math.max(seekTimeValue / durationValue, 0), 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const nextScroll = eased * max;
      if (Math.abs(viewportRef.current.scrollTop - nextScroll) > 2) {
        viewportRef.current.scrollTop = nextScroll;
      }
    } else if (viewportRef.current.scrollTop !== 0) {
      viewportRef.current.scrollTop = 0;
    }
  }, [seekTimeValue, durationValue, sectionBoundaries, maxScrollDistance]);

  // Synchronize manual user scrolling to timeline time
  const handleViewportScroll = useCallback(() => {
    if (!viewportRef.current || isPlayingValue) return;
    const currentScroll = viewportRef.current.scrollTop;
    const totalDuration = durationValue || 5000;
    const range = maxScrollDistanceRef.current || 1;
    const progress = Math.min(Math.max(currentScroll / range, 0), 1);
    const bestTime = progress * totalDuration;

    if (Math.abs(seekTimeValue - bestTime) > 100) {
      if (seekTime !== undefined) {
        onSeek?.(bestTime);
      } else {
        setInternalSeekTime(bestTime);
        onSeek?.(bestTime);
      }
    }
  }, [durationValue, isPlayingValue, seekTimeValue, seekTime, onSeek]);

  const handlePlayPause = useCallback(() => {
    if (!enableTimeline) return;
    const newPlayingState = !isPlayingValue;
    if (isPlaying !== undefined) {
      onPlayPause?.(newPlayingState);
    } else {
      setInternalIsPlaying(newPlayingState);
      onPlayPause?.(newPlayingState);
    }
  }, [enableTimeline, isPlayingValue, isPlaying, onPlayPause]);

  const handleSeek = useCallback((time: number) => {
    if (!enableTimeline) return;
    
    if (seekTime !== undefined) {
      onSeek?.(time);
    } else {
      setInternalSeekTime(time);
      onSeek?.(time);
    }
  }, [enableTimeline, seekTime, onSeek]);

  const handleSeekToSection = useCallback((sectionId: string) => {
    if (!enableTimeline) return;
    
    const section = sectionBoundaries.find(b => b.id === sectionId);
    if (section) {
      handleSeek(section.startTime);
    }
  }, [enableTimeline, sectionBoundaries, handleSeek]);

  // Render timeline controls if enabled
  const timelineControls = enableTimeline && durationValue > 0 ? (
    <div className="website-walkthrough-timeline-controls" data-seene-chrome="walkthrough-timeline">
      <button 
        onClick={handlePlayPause}
        disabled={!durationValue}
        className="seene-control seene-primary seene-icon"
        aria-label={isPlayingValue ? "Pause" : "Play"}
        data-seene-chrome="walkthrough-timeline-button"
      >
        {isPlayingValue ? '⏸' : '▶'}
      </button>
      <input 
        type="range" 
        min="0" 
        max={durationValue} 
        value={seekTimeValue} 
        onChange={(e) => handleSeek(Number(e.target.value))}
        className="website-walkthrough-timeline-slider"
      />
      <span className="website-walkthrough-time-display">
        {formatTime ? formatTime(seekTimeValue) : `${Math.floor(seekTimeValue / 60000)}:${String(Math.floor(seekTimeValue / 1000) % 60).padStart(2, '0')}`}
      </span>
    </div>
  ) : null;

  const scrollDiagnostic = enableTimeline && maxScrollDistance <= 0 && durationValue > 0
    ? "Walkthrough content isn't taller than the viewport"
    : "";

  return (
    <div className={`website-walkthrough ${combinedSections ? 'website-walkthrough-sections' : 'website-walkthrough-full-page'} ${className || ''}`.trim()}>
      <div 
        ref={viewportRef}
        className="website-walkthrough-viewport"
        style={{ position: 'relative', overflowY: 'auto', height: '100%', minHeight: '100%', width: '100%' }}
        onScroll={handleViewportScroll}
      >
        {/* Render sections from explicit definitions */}
        {combinedSections?.map((section) => (
          <div
            key={section.id}
            id={`website-section-${section.id}`}
            className="website-walkthrough-section"
            data-section-id={section.id}
            data-section-label={section.label}
            data-section-duration={section.duration}
            data-section-pause={section.pause}
            data-section-scroll-offset={section.scrollOffset}
          >
            {section.children}
          </div>
        ))}
        
        {/* Render WebsiteSection components for automatic discovery */}
        {combinedSections === undefined && children}
      </div>
      
      {scrollDiagnostic ? <div role="status" className="website-walkthrough-diagnostic">{scrollDiagnostic}</div> : null}
      {timelineControls}
    </div>
  );
}
