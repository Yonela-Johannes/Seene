/**
 * SOURCE OF TRUTH: resolveWalkthroughTarget, measureWalkthroughAnchors, applyWalkthroughScroll,
 * applyWalkthroughHighlights, checkWalkthroughExpectation.
 * WHAT: bind the pure walkthrough timeline to real application DOM: resolve stable targets,
 * measure variable-height sections, drive scrolling, highlight elements and verify interactions.
 * WHY: preview and export must follow the same authored sequence against the same real DOM.
 * WHERE: consumed by WalkthroughStage (preview and local MP4 capture).
 */
import {
  resolveWalkthroughChain,
  walkthroughTargetKey,
  type WalkthroughDocument,
  type WalkthroughExpectation,
  type WalkthroughFrame,
  type WalkthroughTarget,
} from "../core";

export type WalkthroughScrollAlign = "start" | "center" | "end";

function escapeIdent(value: string): string {
  const css = typeof CSS !== "undefined" ? CSS : undefined;
  if (css && typeof css.escape === "function") return css.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`);
}

export function safeWalkthroughQuery(container: ParentNode, selector: string): HTMLElement | null {
  try {
    return container.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

/**
 * Resolve a walkthrough target to a real element using stable Seene attributes first, then an
 * explicit selector. Text matching and coordinates are never used.
 */
export function resolveWalkthroughTarget(container: ParentNode, target: WalkthroughTarget | undefined): HTMLElement | null {
  if (!target) return null;
  if (target.selector) {
    const matched = safeWalkthroughQuery(container, target.selector);
    if (matched) return matched;
  }
  const candidates: string[] = [];
  if (target.sectionId) {
    const id = escapeIdent(target.sectionId);
    candidates.push(
      `[data-walkthrough-target="${id}"]`,
      `[data-section-id="${id}"]`,
      `[data-website-section-id="${id}"]`,
      `[data-seene-target="${id}"]`,
      `#${id}`,
    );
  }
  if (target.file) {
    const file = escapeIdent(target.file);
    candidates.push(`[data-seene-file="${file}"]`, `[data-seene-target-file="${file}"]`);
  }
  if (target.export) candidates.push(`[data-seene-export="${escapeIdent(target.export)}"]`);
  for (const selector of candidates) {
    const matched = safeWalkthroughQuery(container, selector);
    if (matched) return matched;
  }
  return null;
}

/** Anchor keys in the same order the schedule assigns anchor indices. */
export function walkthroughAnchorKeys(document: WalkthroughDocument): string[] {
  const keys: string[] = [];
  for (const node of resolveWalkthroughChain(document).nodes) {
    const key = walkthroughTargetKey(node.target);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

export type WalkthroughAnchor = {
  key: string;
  target?: WalkthroughTarget;
  element: HTMLElement | null;
  offsetTop: number;
  height: number;
};

function offsetWithin(scroller: HTMLElement, element: HTMLElement): { offsetTop: number; height: number } {
  const scrollerRect = scroller.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return {
    offsetTop: elementRect.top - scrollerRect.top + (scroller.scrollTop || 0),
    height: elementRect.height,
  };
}

export function measureWalkthroughAnchors(scroller: HTMLElement, document: WalkthroughDocument): WalkthroughAnchor[] {
  const byKey = new Map<string, WalkthroughTarget | undefined>();
  for (const node of resolveWalkthroughChain(document).nodes) {
    const key = walkthroughTargetKey(node.target);
    if (key && !byKey.has(key)) byKey.set(key, node.target);
  }
  return [...byKey.entries()].map(([key, target]) => {
    const element = resolveWalkthroughTarget(scroller, target);
    const measured = element ? offsetWithin(scroller, element) : { offsetTop: 0, height: 0 };
    return { key, target, element, offsetTop: measured.offsetTop, height: measured.height };
  });
}

export function scrollTopForAnchor(anchor: WalkthroughAnchor, scroller: HTMLElement, align: WalkthroughScrollAlign, offsetPx: number): number {
  const viewport = scroller.clientHeight || 0;
  const base =
    align === "center"
      ? anchor.offsetTop - (viewport - anchor.height) / 2
      : align === "end"
        ? anchor.offsetTop - viewport + anchor.height
        : anchor.offsetTop;
  return Math.max(0, base + offsetPx);
}

/**
 * Map a fractional anchor index (as produced by the timeline) to a pixel scroll offset. When
 * sections are unknown (targets unresolved), anchors collapse to evenly spaced stops so the
 * preview still moves, while validation surfaces the missing targets.
 */
export function resolveWalkthroughScrollTop(
  anchors: WalkthroughAnchor[],
  anchorIndex: number,
  scroller: HTMLElement,
  align: WalkthroughScrollAlign,
  offsetPx: number,
): number {
  if (anchors.length === 0) return 0;
  const maxScroll = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
  const clamped = Math.max(0, Math.min(anchors.length - 1, anchorIndex));
  const lower = Math.floor(clamped);
  const upper = Math.min(anchors.length - 1, lower + 1);
  const progress = clamped - lower;
  const lowerTop = scrollTopForAnchor(anchors[lower], scroller, align, offsetPx);
  const upperTop = scrollTopForAnchor(anchors[upper], scroller, align, offsetPx);
  const resolved = lowerTop + (upperTop - lowerTop) * progress;
  return Math.max(0, Math.min(maxScroll, resolved));
}

export function applyWalkthroughScroll(scroller: HTMLElement, top: number): void {
  if (Math.abs((scroller.scrollTop || 0) - top) < 0.5) return;
  scroller.scrollTop = top;
}

export function clearWalkthroughHighlights(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-seene-walkthrough-active]").forEach(element => {
    element.removeAttribute("data-seene-walkthrough-active");
  });
}

export function applyWalkthroughHighlights(root: ParentNode, frame: WalkthroughFrame): HTMLElement | null {
  clearWalkthroughHighlights(root);
  if (!frame.highlight) return null;
  const target = resolveWalkthroughTarget(root, frame.highlight.target);
  if (!target) return null;
  target.setAttribute("data-seene-walkthrough-active", frame.highlight.style);
  target.style.setProperty("--seene-walkthrough-opacity", String(frame.highlight.opacity));
  target.style.setProperty("--seene-walkthrough-padding", `${frame.highlight.paddingPx}px`);
  target.style.setProperty("--seene-walkthrough-color", frame.highlight.color ?? "#7c9cff");
  return target;
}

export function isWalkthroughVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (element.hasAttribute("hidden")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  const view = element.ownerDocument?.defaultView;
  const style = view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(element) : undefined;
  if (style) {
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (style.opacity !== "" && style.opacity !== undefined && Number(style.opacity) === 0) return false;
  }
  return true;
}

export function clickabilityIssue(element: HTMLElement): string | undefined {
  if (element.hasAttribute("disabled")) return "The target is disabled.";
  if (element.getAttribute("aria-disabled") === "true") return "The target is marked aria-disabled.";
  const view = element.ownerDocument?.defaultView;
  const style = view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(element) : undefined;
  if (style && style.pointerEvents === "none") return "The target ignores pointer events.";
  return undefined;
}

/** Execute a real DOM click on a resolved target. Returns a diagnostic when it cannot run. */
export function clickWalkthroughTarget(element: HTMLElement): { ok: boolean; message?: string } {
  const issue = clickabilityIssue(element);
  if (issue) return { ok: false, message: issue };
  try {
    element.click();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The click could not be dispatched." };
  }
}

export function resolveExpectationElement(container: ParentNode, expectation: WalkthroughExpectation): HTMLElement | null {
  if (expectation.selector) {
    const matched = safeWalkthroughQuery(container, expectation.selector);
    if (matched) return matched;
  }
  if (expectation.sectionId) return resolveWalkthroughTarget(container, { kind: "section", sectionId: expectation.sectionId });
  return null;
}

export type WalkthroughActionOutcome = { ok: boolean; message?: string; elapsedMs: number };

export function checkWalkthroughExpectation(container: ParentNode, expectation: WalkthroughExpectation): WalkthroughActionOutcome {
  const element = resolveExpectationElement(container, expectation);
  const visible = element ? isWalkthroughVisible(element) : false;
  const ok = expectation.state === "hidden" ? !visible : visible;
  return {
    ok,
    ...(ok
      ? {}
      : { message: expectation.state === "visible" ? "The expected UI did not appear." : "The expected UI is still visible." }),
    elapsedMs: 0,
  };
}

/** Poll the DOM until the expected state is satisfied or the timeout elapses. */
export function awaitWalkthroughExpectation(
  container: ParentNode,
  expectation: WalkthroughExpectation,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<WalkthroughActionOutcome> {
  const immediate = checkWalkthroughExpectation(container, expectation);
  if (immediate.ok || timeoutMs <= 0) return Promise.resolve(immediate);
  return new Promise(resolve => {
    const startedAt = Date.now();
    let settled = false;
    const finish = (outcome: WalkthroughActionOutcome) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      signal?.removeEventListener("abort", abort);
      resolve(outcome);
    };
    const abort = () => finish({ ok: false, message: "The interaction was cancelled.", elapsedMs: Date.now() - startedAt });
    const check = () => {
      const outcome = checkWalkthroughExpectation(container, expectation);
      if (outcome.ok) return finish({ ok: true, elapsedMs: Date.now() - startedAt });
      if (Date.now() - startedAt >= timeoutMs)
        return finish({ ok: false, message: `Timed out after ${timeoutMs}ms. ${outcome.message ?? ""}`.trim(), elapsedMs: Date.now() - startedAt });
    };
    const timer = setInterval(check, 50);
    signal?.addEventListener("abort", abort);
  });
}
