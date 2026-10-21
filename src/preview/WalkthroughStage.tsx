import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Scene } from "../react";
import {
  resolveWalkthroughChain,
  type PreviewDefinition,
  type SceneIssue,
  type WalkthroughDocument,
  type WalkthroughFrame,
} from "../core";
import {
  applyWalkthroughHighlights,
  applyWalkthroughScroll,
  awaitWalkthroughExpectation,
  clickWalkthroughTarget,
  measureWalkthroughAnchors,
  resolveWalkthroughScrollTop,
  resolveWalkthroughTarget,
} from "./walkthroughRuntime";

export type WalkthroughStageProps = {
  definition: PreviewDefinition;
  document: WalkthroughDocument;
  frame: WalkthroughFrame;
  children: ReactNode;
  onIssue?: (issue: string) => void;
  onDiagnostics?: (issues: SceneIssue[]) => void;
  className?: string;
};

/**
 * Renders the walkthrough stage. Scroll, highlights and captions are driven by the resolved
 * frame; interactions run when playback crosses their checkpoint, and the content is remounted
 * when playback seeks backwards so the application returns to a deterministic state.
 */
export function WalkthroughStage({ definition, document, frame, children, onIssue, onDiagnostics, className }: WalkthroughStageProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [resetToken, setResetToken] = useState(0);
  const executed = useRef<Set<string>>(new Set());
  const previousCheckpoint = useRef(-1);
  const issuesRef = useRef(onIssue);
  issuesRef.current = onIssue;

  const nodeById = useMemo(() => new Map(document.nodes.map(node => [node.id, node])), [document]);
  const stepIndex = useMemo(() => new Map(frame.steps.map(step => [step.nodeId, step.index])), [frame.steps]);
  const chainLength = useMemo(() => resolveWalkthroughChain(document).nodes.length, [document]);

  const runInteractions = useCallback(
    (completed: string[]) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      for (const nodeId of completed) {
        if (executed.current.has(nodeId)) continue;
        executed.current.add(nodeId);
        const node = nodeById.get(nodeId);
        if (!node?.target) continue;
        const element = resolveWalkthroughTarget(scroller, node.target);
        if (!element) {
          if (node.action?.required !== false) issuesRef.current?.(`"${node.title}" could not find its target element.`);
          continue;
        }
        const result = clickWalkthroughTarget(element);
        if (!result.ok) {
          if (node.action?.required !== false) issuesRef.current?.(`"${node.title}" could not activate its target: ${result.message ?? "unknown error"}`);
          continue;
        }
        if (node.action?.expect) {
          void awaitWalkthroughExpectation(scroller, node.action.expect, node.action.timeoutMs).then(outcome => {
            if (!outcome.ok && node.action?.required !== false)
              issuesRef.current?.(`"${node.title}" did not reach the expected state: ${outcome.message ?? "unknown result"}`);
          });
        }
      }
    },
    [nodeById],
  );

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (frame.checkpointIndex < previousCheckpoint.current) {
      let cleared = false;
      for (const nodeId of [...executed.current]) {
        const index = stepIndex.get(nodeId) ?? -1;
        if (index > frame.checkpointIndex) {
          executed.current.delete(nodeId);
          cleared = true;
        }
      }
      if (cleared) {
        setResetToken(token => token + 1);
        return;
      }
    }
    previousCheckpoint.current = frame.checkpointIndex;

    if (frame.scroll) {
      const anchors = measureWalkthroughAnchors(scroller, document);
      const node = nodeById.get(frame.scroll.nodeId);
      const align = node?.scroll?.align ?? "start";
      const offsetPx = node?.scroll?.offsetPx ?? 0;
      applyWalkthroughScroll(scroller, resolveWalkthroughScrollTop(anchors, frame.scroll.anchorIndex, scroller, align, offsetPx));
    }
    applyWalkthroughHighlights(scroller, frame);
    runInteractions(frame.completedClickNodeIds);
  }, [frame, document, resetToken, nodeById, stepIndex, runInteractions]);

  return (
    <Scene
      camera={{ ...definition.scene.camera, x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 }}
      focus={{ ...definition.scene.focus, maxBlur: 0 }}
      motion={definition.motion}
      recipeNodes={definition.scene.nodes}
      timeMs={frame.timeMs}
      onDiagnostics={onDiagnostics}
      style={{ width: "100%", height: "100%" }}
    >
      <div
        className={`seene-walkthrough-stage${className ? ` ${className}` : ""}`}
        data-seene-walkthrough-stage=""
        data-seene-walkthrough-node={frame.activeNodeId ?? undefined}
      >
        <div className="seene-walkthrough-scroll" ref={scrollerRef} data-seene-walkthrough-scroll="">
          <div key={resetToken}>{children}</div>
        </div>
        {frame.caption ? (
          <div className="seene-walkthrough-caption" data-position={frame.caption.position} role="note">
            {frame.caption.text}
          </div>
        ) : null}
      </div>
    </Scene>
  );
}
