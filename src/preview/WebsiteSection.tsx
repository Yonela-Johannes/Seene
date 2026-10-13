import { type ReactNode } from "react";

export interface WebsiteSectionProps {
  /** Unique identifier for the section, used for discovery and navigation */
  id: string;
  /** Human-readable label displayed in UI controls, tooltips, or navigation */
  label: string;
  /** Section content - rendered as normal React children */
  children: ReactNode;
  /** Optional duration for this section in milliseconds */
  duration?: number;
  /** Optional pause before this section in milliseconds */
  pause?: number;
  /** Optional scroll offset to position this section within the viewport */
  scrollOffset?: number;
  /** Optional CSS class for the section container */
  className?: string;
}

/**
 * A single section within a WebsiteWalkthrough.
 * 
 * Renders its content normally and provides stable metadata for discovery and navigation.
 * Compatible with server-rendered React frameworks and maintains accessibility.
 */
export function WebsiteSection(props: WebsiteSectionProps): ReactNode {
  const { id, label, children, duration, pause, scrollOffset, className } = props;

  return (
    <div
      id={`website-section-${id}`}
      className={`website-section ${className || ""}`.trim()}
      data-website-section-id={id}
      data-website-section-label={label}
      data-website-section-duration={duration}
      data-website-section-pause={pause}
      data-website-section-scroll-offset={scrollOffset}
    >
      {children}
    </div>
  );
}
