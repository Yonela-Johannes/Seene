import { useCallback, useEffect, useMemo, useRef, useState, useId, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AUTHORED_PRESENTATION, SUPPORTED_EXPORT_FPS, ExportFrameRateSchema, SCENE_TRANSITION_DURATION, type TransitionPresetName, type PreviewDefinition, type PreviewDefinitionInput } from "../core";
import { Scene, SceneErrorBoundary, useSceneCapture } from "../react";
import { resolvePresentation } from "../core";
import { usePreviewSession } from "./session";
import { usePreviewConnection, type PreviewHot } from "./connection";
import { BrandAttribution } from "./BrandAttribution";
import { GettingStarted } from "./GettingStarted";
import { PresentationPicker } from "./PresentationPicker";
import { TransitionPicker } from "./TransitionPicker";
import { SceneInspector } from "./SceneInspector";
import { WebsiteWalkthrough } from "./WebsiteWalkthrough";
import { previewTheme } from "./theme";
import { useSceneBackdrop } from "./backdrop";

const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export type ScenePreviewProps = {
  definition?: PreviewDefinitionInput;
  children?: ReactNode;
  title?: string;
  backHref?: string;
  onBack?: () => void;
  revision?: unknown;
  hot?: PreviewHot;
  presentation?: string;
  onPresentationChange?: (id: string) => void;
  transition?: TransitionPresetName;
  onTransitionChange?: (id: TransitionPresetName | undefined) => void;
  duration?: number;
  seekTime?: number;
  isPlaying?: boolean;
  onDurationChange?: (duration: number) => void;
  onPlayPause?: (playing: boolean) => void;
  onSeek?: (time: number) => void;
  timelineRef?: React.RefObject<HTMLDivElement>;
  formatTime?: (ms: number) => string;
  onSaveDefinition?: (definition: PreviewDefinitionInput) => Promise<void> | void;
};

const timeLabel = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

function Glyph({ kind }: { kind: "play" | "pause" | "restart" | "export" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="w-4 h-4">
      {kind === "play" ? (
        <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />
      ) : kind === "pause" ? (
        <path d="M8 5v14M16 5v14" strokeWidth="4" />
      ) : kind === "restart" ? (
        <path d="M5 9a8 8 0 1 1 0 7M5 3v6h6" />
      ) : (
        <path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" />
      )}
    </svg>
  );
}

function Capture({ durationMs, seek }: { durationMs: number; seek: (ms: number) => void }) {
  useSceneCapture({ durationMs, seek });
  return null;
}

function ExportMenu({ disabled, panelHost }: { disabled: boolean; panelHost: HTMLDivElement | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (disabled) setOpen(false);
    else if (open) panelHost?.querySelector("select")?.focus();
  }, [disabled, open, panelHost]);

  const details = useRef<HTMLDetailsElement>(null);
  const [fps, setFps] = useState(60);
  const [crf, setCrf] = useState(18);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  const command = `pnpm exec seene export --url ${quote(typeof location === "undefined" ? "http://localhost:5173" : location.href)} --output scene-${fps}.mp4 --fps ${fps} --quality ${crf}`;

  return disabled ? (
    <button className="seene-control opacity-50 cursor-not-allowed" disabled>
      <Glyph kind="export" />
      <span>Export</span>
    </button>
  ) : (
    <details className="seene-export relative" ref={details} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="seene-control seene-primary cursor-pointer" aria-controls={panelId}>
        <Glyph kind="export" />
        <span>Export</span>
      </summary>
      {open && panelHost
        ? createPortal(
            <div
              id={panelId}
              role="region"
              aria-label="Export your scene"
              data-seene-chrome="export-panel"
              className="seene-export-panel seene-chrome bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-2xl space-y-3 text-xs text-zinc-200"
              onKeyDown={event => {
                if (event.key === "Escape" && details.current) {
                  details.current.open = false;
                  setOpen(false);
                  details.current.querySelector("summary")?.focus();
                }
              }}
            >
              <strong className="text-sm font-semibold text-white block">Export Scene Video</strong>
              <p className="text-zinc-400">Run this command in your project terminal to render a frame-accurate MP4 video.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 block">
                  <span className="text-zinc-400">Frame Rate</span>
                  <select
                    aria-label="Export frame rate"
                    value={fps}
                    onChange={event => {
                      setFps(ExportFrameRateSchema.parse(Number(event.target.value)));
                      setCopied(false);
                    }}
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                  >
                    {SUPPORTED_EXPORT_FPS.map(value => (
                      <option key={value} value={value}>
                        {value} fps
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 block">
                  <span className="text-zinc-400">Quality</span>
                  <select
                    aria-label="Export quality (CRF)"
                    value={crf}
                    onChange={event => {
                      setCrf(Number(event.target.value));
                      setCopied(false);
                    }}
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                  >
                    <option value={18}>High (CRF 18)</option>
                    <option value={23}>Standard (CRF 23)</option>
                    <option value={28}>Compact (CRF 28)</option>
                  </select>
                </label>
              </div>
              <code className="block bg-zinc-950 p-2.5 rounded font-mono text-[11px] text-zinc-300 break-all select-all border border-zinc-800">
                {command}
              </code>
              <button
                type="button"
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 transition-colors cursor-pointer"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(command);
                    setCopied(true);
                    setCopyError(false);
                  } catch {
                    setCopyError(true);
                  }
                }}
              >
                {copied ? "Copied" : "Copy Command"}
              </button>
              <p role="status" className="text-[11px] text-zinc-500">
                {copyError ? "Select and copy the command above manually." : "Requires Chromium and FFmpeg installed locally."}
              </p>
            </div>,
            panelHost,
          )
        : null}
    </details>
  );
}

function containsWebsiteWalkthrough(children: ReactNode): boolean {
  const stack: ReactNode[] = Array.isArray(children) ? [...children] : [children];
  while (stack.length) {
    const current = stack.pop();
    if (current == null || typeof current === "string" || typeof current === "number" || typeof current === "boolean") continue;
    if (typeof current === "object" && current && "type" in current) {
      const type = (current as { type?: unknown }).type;
      const objectType = type && typeof type === "object" ? type as Record<string, unknown> : undefined;
      const name = typeof type === "function"
        ? type.name
        : objectType && "displayName" in objectType
          ? String(objectType.displayName)
          : undefined;
      if (type === WebsiteWalkthrough || name === "WebsiteWalkthrough") return true;
      const props = "props" in current ? (current as { props?: { children?: ReactNode } }).props : undefined;
      const nextChildren = props && typeof props === "object" ? props.children : undefined;
      if (nextChildren) stack.push(...(Array.isArray(nextChildren) ? nextChildren : [nextChildren]));
    }
  }
  return false;
}

export function ScenePreview({
  definition: input,
  children,
  title = "Untitled scene",
  backHref,
  onBack,
  revision,
  hot,
  presentation,
  onPresentationChange,
  transition,
  onTransitionChange,
  duration,
  seekTime,
  isPlaying,
  onDurationChange,
  onPlayPause,
  onSeek,
  timelineRef,
  formatTime,
  onSaveDefinition,
}: ScenePreviewProps) {
  const [compositionMode, setCompositionMode] = useState<"scene" | "walkthrough">(() => {
    const mode = typeof window === "undefined" ? null : new URL(window.location.href).searchParams.get("seene-mode");
    return mode === "scroll" ? "walkthrough" : mode === "scene" ? "scene" : input?.compositionType === "walkthrough" ? "walkthrough" : "scene";
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    const mode = compositionMode === "walkthrough" ? "scroll" : "scene";
    if (url.searchParams.get("seene-mode") !== mode) {
      url.searchParams.set("seene-mode", mode);
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [compositionMode]);
  const presented = useMemo(
    () => input === undefined ? undefined : resolvePresentation(input, compositionMode === "walkthrough" ? undefined : presentation),
    [input, presentation, compositionMode],
  );
  const [localDef, setLocalDef] = useState<PreviewDefinitionInput | undefined>(presented);
  useEffect(() => {
    setLocalDef(presented);
  }, [presented]);

  const session = usePreviewSession(localDef, revision);
  const connection = usePreviewConnection(hot, session.pause);
  const [renderError, setRenderError] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [exportPanel, setExportPanel] = useState<HTMLDivElement | null>(null);

  const resetKey = useMemo(() => ({ revision, input: localDef, generation: connection.generation }), [revision, localDef, connection.generation]);

  const failure = useCallback(
    (error: unknown) => {
      session.pause();
      setRenderError(error instanceof Error ? error.message : String(error));
    },
    [session.pause],
  );

  useEffect(() => {
    const element = viewport;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    measure();
    return () => observer?.disconnect();
  }, [viewport]);

  const definition = session.definition;
  const sceneBackdrop = useSceneBackdrop(definition?.backdrop, viewport);
  const blocked = !session.valid || !connection.connected || !!connection.error || !!renderError;
  const scrollCamera = definition ? {
    ...definition.scene.camera,
    x: 0,
    y: 0,
    z: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
  } : undefined;
  const scrollFocus = definition ? { ...definition.scene.focus, maxBlur: 0 } : undefined;
  const scrollMotion = definition?.motion
    ? { ...definition.motion, tracks: definition.motion.tracks.filter(track => track.target.kind === "surface") }
    : undefined;
  const walkthroughSettings = definition?.walkthroughSettings;
  const updateAutoWalkthroughDuration = useCallback((durationMs: number) => {
    setLocalDef(current => {
      if (!current || current.walkthroughSettings?.durationAuto !== true) return current;
      if (current.motion?.durationMs === durationMs && current.motion.speed === 1) return current;
      return {
        ...current,
        motion: { ...(current.motion ?? { tracks: [] }), durationMs, speed: 1 },
      };
    });
  }, []);
  const autoplayStarted = useRef(false);

  useEffect(() => {
    if (!walkthroughSettings?.autoplay) {
      autoplayStarted.current = false;
      return;
    }
    if (compositionMode === "walkthrough" && session.valid && session.durationMs > 0 && !autoplayStarted.current) {
      autoplayStarted.current = true;
      session.toggle();
    }
  }, [compositionMode, walkthroughSettings?.autoplay, session.valid, session.durationMs, session.toggle]);

  const changeCompositionMode = useCallback((next: "scene" | "walkthrough") => {
    setCompositionMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("seene-mode", next === "walkthrough" ? "scroll" : "scene");
    if (next === "walkthrough") {
      url.searchParams.delete("seene-preset");
      onPresentationChange?.(AUTHORED_PRESENTATION);
    }
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [onPresentationChange]);

  useEffect(() => {
    if (compositionMode !== "walkthrough") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("seene-preset")) {
      url.searchParams.delete("seene-preset");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    if (presentation) onPresentationChange?.(AUTHORED_PRESENTATION);
  }, [compositionMode, presentation, onPresentationChange]);

  const [prevDefinition, setPrevDefinition] = useState<PreviewDefinition | undefined>(undefined);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const prevDefinitionRef = useRef<PreviewDefinition | undefined>(undefined);
  const sceneSignature = definition ? JSON.stringify(definition.scene.nodes) : "";

  useEffect(() => {
    if (definition && definition !== prevDefinitionRef.current) {
      const prevSignature = prevDefinitionRef.current ? JSON.stringify(prevDefinitionRef.current.scene.nodes) : "";
      if (prevSignature && prevSignature !== sceneSignature) {
        setPrevDefinition(prevDefinitionRef.current);
        setTransitionProgress(0);
        const start = performance.now();
        const animate = () => {
          const elapsed = performance.now() - start;
          const progress = Math.min(elapsed / SCENE_TRANSITION_DURATION, 1);
          setTransitionProgress(progress);
          if (progress < 1) {
            if (typeof requestAnimationFrame !== "undefined") {
              requestAnimationFrame(animate);
            } else {
              setTimeout(animate, 16);
            }
          }
        };
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(animate);
        } else {
          setTimeout(animate, 16);
        }
      }
      prevDefinitionRef.current = definition;
    }
  }, [definition, sceneSignature]);

  useEffect(() => {
    if (transitionProgress >= 1 && prevDefinition) {
      const timer = setTimeout(() => {
        setPrevDefinition(undefined);
        setTransitionProgress(0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [transitionProgress, prevDefinition]);

  const captureSeek = useCallback(
    (ms: number) => {
      if (blocked) throw new Error("Correct the scene before exporting.");
      session.seek(ms);
    },
    [blocked, session.seek],
  );

  const isViewportSizing = definition?.sizingMode === "viewport" || definition?.sizingMode === "content";
  const scale = definition && size.width && size.height && !isViewportSizing
    ? Math.max(size.width / definition.width, size.height / definition.height)
    : 1;

  const stateText = !connection.connected
    ? "Reconnecting to your app…"
    : connection.error
      ? "Source needs a correction"
      : connection.updating
        ? "Updating scene…"
        : renderError || session.issues.length
          ? "Scene needs a correction"
          : !definition
            ? "Waiting for a scene"
            : session.playing
              ? "Playing"
              : "Live preview";

  return (
    <main
      data-seene-preview=""
      data-seene-state={blocked ? "unavailable" : "ready"}
      style={{ "--seene-scene-backdrop": sceneBackdrop } as CSSProperties}
    >
      <style>{previewTheme}</style>
      <div className="seene-viewport" ref={setViewport} aria-label="Scene preview">
        {!definition && (
          <div className="seene-empty seene-chrome">
            <span className="seene-empty-symbol" aria-hidden="true">
              ↗
            </span>
            <h1>
              A new perspective
              <br />
              on your product.
            </h1>
            <p>Your live scene will appear here. Open Seene inside your app, then use the studio inspector to compose its motion.</p>
          </div>
        )}
      </div>

      <div className="seene-bottom-blur" data-seene-preview-chrome="" data-seene-chrome="preview-blur" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <footer className="seene-footer seene-chrome" data-seene-preview-chrome="" data-seene-chrome="preview-footer" aria-label="Scene controls">
        <div className="seene-controls">
          <div className="seene-export-slot" ref={setExportPanel} />

          {session.issues.length > 0 || connection.error || !connection.connected ? (
            <section className="seene-message seene-chrome" role="alert">
              <strong>{stateText}</strong>
              {session.issues.length > 0 && (
                <>
                  <p>Your last valid scene settings are retained. Correct the source to continue.</p>
                  <ul>
                    {session.issues.map((issue, index) => (
                      <li key={index}>
                        {issue.path}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {connection.error && <p>{connection.error}</p>}
              {!connection.connected && <p>Keep your development server running. The preview reconnects automatically.</p>}
            </section>
          ) : null}

          <SceneErrorBoundary resetKey={resetKey} onError={failure} onReset={() => setRenderError("")}>
            {definition && viewport
              ? createPortal(
                  <div
                    className="seene-canvas"
                    data-seene-capture="scene"
                    data-seene-valid={blocked ? "false" : "true"}
                    data-seene-walkthrough={compositionMode === "walkthrough" ? "" : undefined}
                    style={{ width: "100%", height: "100%", position: "relative" }}
                  >
                    {compositionMode === "walkthrough" ? (
                      <Scene
                        camera={scrollCamera}
                        focus={scrollFocus}
                        motion={scrollMotion}
                        recipeNodes={definition.scene.nodes}
                        timeMs={session.timeMs}
                        onDiagnostics={session.onDiagnostics}
                        style={{ width: "100%", height: "100%" }}
                      >
                        {containsWebsiteWalkthrough(children) ? children : (
                          <WebsiteWalkthrough
                            enableTimeline={false}
                            seekTime={session.timeMs}
                            duration={session.durationMs}
                            isPlaying={session.playing}
                            easing={walkthroughSettings?.easing ?? "linear"}
                            holdAtTopMs={walkthroughSettings?.holdAtTopMs ?? 0}
                            holdAtBottomMs={walkthroughSettings?.holdAtBottomMs ?? 0}
                            startOffset={walkthroughSettings?.startOffset}
                            endOffset={walkthroughSettings?.endOffset}
                            onDurationChange={updateAutoWalkthroughDuration}
                            onSeek={ms => session.seek(ms)}
                            onPlayPause={p => (p ? (session.playing ? undefined : session.toggle()) : session.pause())}
                          >
                            {children}
                          </WebsiteWalkthrough>
                        )}
                      </Scene>
                    ) : (
                      <>
                        {prevDefinition && transitionProgress < 1 ? (
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              width: isViewportSizing ? "100%" : prevDefinition.width,
                              height: isViewportSizing ? "100%" : prevDefinition.height,
                              minHeight: isViewportSizing ? prevDefinition.minHeight || "100vh" : undefined,
                              transform: isViewportSizing ? "none" : `translate(-50%, -50%) scale(${scale})`,
                              transformOrigin: "center",
                              opacity: 1 - easeInOut(transitionProgress),
                              transition: `opacity ${SCENE_TRANSITION_DURATION}ms ease-out`,
                              pointerEvents: "none",
                            }}
                          >
                            <Scene
                              camera={prevDefinition.scene.camera}
                              focus={prevDefinition.scene.focus}
                              motion={prevDefinition.motion}
                              recipeNodes={prevDefinition.scene.nodes}
                              timeMs={session.timeMs}
                              onDiagnostics={session.onDiagnostics}
                              style={{ width: "100%", height: "100%" }}
                            >
                              {children}
                            </Scene>
                          </div>
                        ) : null}

                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: isViewportSizing ? "100%" : definition.width,
                            height: isViewportSizing ? "100%" : definition.height,
                            minHeight: isViewportSizing ? definition.minHeight || "100vh" : undefined,
                            transform: isViewportSizing ? "none" : `translate(-50%, -50%) scale(${scale})`,
                            transformOrigin: "center",
                            opacity: prevDefinition && transitionProgress < 1 ? easeInOut(transitionProgress) : 1,
                            transition: `opacity ${SCENE_TRANSITION_DURATION}ms ease-out`,
                          }}
                        >
                          <Scene
                            camera={definition.scene.camera}
                            focus={definition.scene.focus}
                            motion={definition.motion}
                            recipeNodes={definition.scene.nodes}
                            timeMs={session.timeMs}
                            onDiagnostics={session.onDiagnostics}
                            style={{ width: "100%", height: "100%" }}
                          >
                            {children}
                          </Scene>
                        </div>
                      </>
                    )}
                    <Capture durationMs={session.durationMs} seek={captureSeek} />
                  </div>,
                  viewport,
                )
              : null}
          </SceneErrorBoundary>

          {/* Editor Header Bar */}
          <div className="seene-header flex items-center justify-between gap-4" data-seene-chrome="preview-header">
            <div className="seene-heading flex items-center gap-3">
              {backHref ? (
                <a
                  className="seene-control"
                  href={backHref}
                  onClick={event => {
                    if (onBack && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                      event.preventDefault();
                      onBack();
                    }
                  }}
                >
                  {onBack ? "Back to scenes" : "Back to app"}
                </a>
              ) : onBack ? (
                <button type="button" className="seene-control" onClick={onBack}>
                  Back to scenes
                </button>
              ) : null}

              <h1 className="seene-title">{title}</h1>

              {/* Mode indicator pill */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-full p-0.5 text-[11px]">
                  <button
                  type="button"
                  onClick={() => changeCompositionMode("scene")}
                  aria-pressed={compositionMode === "scene"}
                  data-seene-chrome="composition-mode-scene"
                  className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                    compositionMode === "scene" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Scene
                </button>
                  <button
                  type="button"
                  onClick={() => changeCompositionMode("walkthrough")}
                  aria-pressed={compositionMode === "walkthrough"}
                  data-seene-chrome="composition-mode-scroll"
                  className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                    compositionMode === "walkthrough" ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Scroll
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SceneInspector
                definition={localDef}
                onChange={updated => setLocalDef(updated)}
                onSaveDefinition={onSaveDefinition}
                compositionMode={compositionMode}
                onCompositionModeChange={changeCompositionMode}
              />
              <ExportMenu disabled={blocked || !session.durationMs} panelHost={exportPanel} />
            </div>
          </div>

          {onPresentationChange ? <PresentationPicker value={presentation} onChange={onPresentationChange} disabled={compositionMode === "walkthrough"} /> : null}
          {onTransitionChange ? <TransitionPicker value={transition} onChange={onTransitionChange} /> : null}
          {!definition ? <GettingStarted /> : null}

          {/* Playback Dock & Timeline */}
          <div className="seene-dock" data-seene-chrome="preview-dock">
            <button
              type="button"
              className="seene-control seene-primary seene-icon cursor-pointer"
              disabled={blocked || !session.durationMs}
              aria-label={session.playing ? "Pause" : session.timeMs >= session.durationMs && session.durationMs ? "Replay" : "Play"}
              onClick={session.toggle}
            >
              <Glyph kind={session.playing ? "pause" : "play"} />
            </button>
            <button
              type="button"
              className="seene-control seene-icon cursor-pointer"
              aria-label="Restart"
              disabled={!definition}
              onClick={() => session.seek(0)}
            >
              <Glyph kind="restart" />
            </button>
            <input
              className="seene-timeline"
              aria-label="Scene time"
              aria-valuetext={timeLabel(session.timeMs)}
              type="range"
              min={0}
              max={session.durationMs || 1}
              step={10}
              value={session.timeMs}
              disabled={blocked || !session.durationMs}
              onChange={event => session.seek(Number(event.target.value))}
            />
            <output className="seene-time font-mono" data-testid="scene-time">
              {timeLabel(session.timeMs)} / {timeLabel(session.durationMs)}
            </output>
          </div>

          <div className="seene-preview-meta">
            <span className="seene-status" role="status">
              <span className="seene-status-dot" />
              {stateText}
            </span>
            <BrandAttribution />
          </div>
        </div>
      </footer>
    </main>
  );
}
