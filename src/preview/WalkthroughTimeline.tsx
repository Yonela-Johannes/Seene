/**
 * SOURCE OF TRUTH: WalkthroughTimeline.
 * WHAT: render one continuous timeline with a selectable segment per authored step, a scrubber,
 * a playhead and playback controls.
 * WHY: nodes and timeline must describe the same walkthrough so preview and export agree.
 * WHERE: consumed by WalkthroughStudio.
 */
import type { ReactNode } from "react";
import type { WalkthroughStep } from "../core";

export type TimelineSegment = Pick<WalkthroughStep, "nodeId" | "title" | "startTime" | "endTime"> & { type: string };

export type WalkthroughTimelineProps = {
  steps: Array<TimelineSegment & { nodeId: string }>;
  durationMs: number;
  timeMs: number;
  playing: boolean;
  activeNodeId: string | null;
  selectedNodeId: string | null;
  formatTime: (ms: number) => string;
  onSeek: (ms: number) => void;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
  onToggle: () => void;
  onRestart: () => void;
  onStep: (direction: -1 | 1) => void;
  label?: string;
  showScrubber?: boolean;
  showTransport?: boolean;
};

export function WalkthroughTimeline({
  steps,
  durationMs,
  timeMs,
  playing,
  activeNodeId,
  selectedNodeId,
  formatTime,
  onSeek,
  onSelect,
  onPreview,
  onToggle,
  onRestart,
  onStep,
  label = "walkthrough",
  showScrubber = true,
  showTransport = true,
}: WalkthroughTimelineProps): ReactNode {
  const total = durationMs || 1;
  return (
    <div className="seene-studio-timeline" data-seene-chrome="studio-timeline">
      {showTransport ? (
      <div className="seene-studio-transport">
        <button type="button" className="seene-control seene-icon" onClick={onRestart} aria-label={label === "walkthrough" ? "Restart walkthrough" : "Restart scene"}>
          ⏮
        </button>
        <button type="button" className="seene-control seene-icon" onClick={() => onStep(-1)} aria-label={`Previous ${label} step`}>
          ◀|
        </button>
        <button type="button" className="seene-control seene-primary seene-icon" onClick={onToggle} aria-label={label === "walkthrough" ? (playing ? "Pause" : "Play") : (playing ? "Pause scene" : "Play scene")}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className="seene-control seene-icon" onClick={() => onStep(1)} aria-label={`Next ${label} step`}>
          |▶
        </button>
        <output className="seene-studio-time" data-testid="walkthrough-time">
          {formatTime(timeMs)} / {formatTime(durationMs)}
        </output>
      </div>
      ) : null}
      <div className="seene-studio-track" data-seene-chrome="studio-track">
        {steps.map(step => {
          const left = (step.startTime / total) * 100;
          const width = ((step.endTime - step.startTime) / total) * 100;
          return (
            <button
              key={step.nodeId}
              type="button"
              className="seene-studio-segment"
              data-type={step.type}
              data-selected={selectedNodeId === step.nodeId}
              data-active={activeNodeId === step.nodeId}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%` }}
              onClick={() => onSelect(step.nodeId)}
              onDoubleClick={() => onPreview(step.nodeId)}
              title={`${step.title} · ${formatTime(step.startTime)}`}
            >
              <span>{step.title}</span>
            </button>
          );
        })}
        <div className="seene-studio-playhead" style={{ left: `${(timeMs / total) * 100}%` }} aria-hidden="true" />
      </div>
      {showScrubber ? (
      <input
        className="seene-studio-scrub"
        aria-label={`${label === "walkthrough" ? "Walkthrough" : "Scene"} time`}
        type="range"
        min={0}
        max={durationMs || 1}
        step={10}
        value={timeMs}
        disabled={!durationMs}
        onChange={event => onSeek(Number(event.target.value))}
      />
      ) : null}
    </div>
  );
}
