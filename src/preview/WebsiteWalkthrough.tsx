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
    
    // Discover sections from explicit definitions
    let discovered: DiscoveredSection[] = [];
    
    if (explicitSections) {
      // Create elements from explicit sections for discovery
      const sectionElements: DiscoveredSection[] = explicitSections.map((section) => {
        const element = document.createElement('div');
        element.setAttribute('data-seene-section', '');
        element.setAttribute('data-seene-section-id', section.id);
        element.setAttribute('data-seene-section-label', section.label);
        if (section.duration !== undefined) {
          element.setAttribute('data-seene-section-duration', section.duration.toString());
        }
        if (section.pause !== undefined) {
          element.setAttribute('data-seene-section-pause', section.pause.toString());
        }
        if (section.scrollOffset !== undefined) {
          element.setAttribute('data-seene-section-scroll-offset', section.scrollOffset.toString());
        }
        
        return {
          id: section.id,
          label: section.label,
          element,
          startPosition: 0, // Will be measured
          endPosition: 0,   // Will be measured
          height: 0,        // Will be measured
          duration: section.duration,
          pause: section.pause,
          scrollOffset: section.scrollOffset,
        };
      });
      
      discovered = sectionElements;
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

  // Control handlers
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
    <div className="website-walkthrough-timeline-controls">
      <button 
        onClick={handlePlayPause}
        disabled={!durationValue}
        className="seene-control seene-primary seene-icon"
        aria-label={isPlayingValue ? "Pause" : "Play"}
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

  return (
    <div className={`website-walkthrough ${combinedSections ? 'website-walkthrough-sections' : 'website-walkthrough-full-page'} ${className || ''}`.trim()}>
      <div 
        ref={viewportRef}
        className="website-walkthrough-viewport"
        style={{ position: 'relative', overflowY: 'auto' }}
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
      
      {timelineControls}
    </div>
  );
}
