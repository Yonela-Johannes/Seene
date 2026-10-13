import { useCallback, useEffect, useMemo, useRef, useState, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SUPPORTED_EXPORT_FPS, ExportFrameRateSchema, SCENE_TRANSITION_DURATION, type TransitionPresetName, type PreviewDefinition, type PreviewDefinitionInput } from "../core";
import { Scene, SceneErrorBoundary, useSceneCapture } from "../react";
import { resolvePresentation } from "../core";
import { usePreviewSession } from "./session";
import { usePreviewConnection, type PreviewHot } from "./connection";
import { BrandAttribution } from "./BrandAttribution";
import { GettingStarted } from "./GettingStarted";
import { PresentationPicker } from "./PresentationPicker";
import { TransitionPicker } from "./TransitionPicker";
import { SceneInspector } from "./SceneInspector";
import { previewTheme } from "./theme";

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
  // New duration/timeline controls
  duration?: number;
  seekTime?: number;
  isPlaying?: boolean;
  onDurationChange?: (duration: number) => void;
  onPlayPause?: (playing: boolean) => void;
  onSeek?: (time: number) => void;
  timelineRef?: React.RefObject<HTMLDivElement>;
  formatTime?: (ms: number) => string;
};
const timeLabel = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2,"0")}`;
function Glyph({kind}: {kind: "play" | "pause" | "restart" | "export"}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    {kind === "play" ? <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/> :
      kind === "pause" ? <path d="M8 5v14M16 5v14" strokeWidth="4"/> :
      kind === "restart" ? <path d="M5 9a8 8 0 1 1 0 7M5 3v6h6"/> : <path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>}
  </svg>;
}
function Capture({durationMs, seek}: {durationMs: number; seek: (ms: number) => void}) {
  useSceneCapture({durationMs, seek});
  return null;
}
function ExportMenu({disabled, panelHost}: {disabled: boolean; panelHost: HTMLDivElement | null}) {
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
  return disabled ? <button className="seene-control" disabled><Glyph kind="export"/>Export</button> :
    <details className="seene-export" ref={details} onToggle={event => setOpen(event.currentTarget.open)}><summary className="seene-control seene-primary" aria-controls={panelId}><Glyph kind="export"/>Export</summary>
      {open && panelHost && createPortal(<div id={panelId} role="region" aria-label="Export your scene" className="seene-export-panel seene-chrome" onKeyDown={event => {
        if (event.key === "Escape" && details.current) {
          details.current.open = false;
          setOpen(false);
          details.current.querySelector("summary")?.focus();
        }
      }}><strong>Export your scene</strong>
        <p>Run this in your project to save an MP4. Use a new filename for each export.</p>
        <label>Frame rate<select aria-label="Export frame rate" value={fps} onChange={event => {setFps(ExportFrameRateSchema.parse(Number(event.target.value)));setCopied(false);}}>
          {SUPPORTED_EXPORT_FPS.map(value => <option key={value} value={value}>{value} fps</option>)}
        </select></label>
        <label>Quality<select aria-label="Export quality (CRF)" value={crf} onChange={event => {setCrf(Number(event.target.value));setCopied(false);}}>
          <option value={18}>High (CRF 18)</option>
          <option value={23}>Standard (CRF 23)</option>
          <option value={28}>Compact (CRF 28)</option>
        </select></label><code>{command}</code>
        <button className="seene-control seene-primary" onClick={async () => {
          try { await navigator.clipboard.writeText(command);setCopied(true);setCopyError(false); }
          catch { setCopyError(true); }
        }}>{copied ? "Copied" : "Copy command"}</button>
        <p role="status">{copyError ? "Select and copy the command above." : "Requires Chromium and FFmpeg on your machine."}</p>
      </div>, panelHost)}
    </details>;
}

export function ScenePreview({definition: input, children, title = "Untitled scene", backHref, onBack, revision, hot, presentation, onPresentationChange, transition, onTransitionChange, duration, seekTime, isPlaying, onDurationChange, onPlayPause, onSeek, timelineRef, formatTime}: ScenePreviewProps) {
  const presented = useMemo(
    () => (input === undefined ? undefined : resolvePresentation(input, presentation)),
    [input, presentation],
  );
  const [localDef, setLocalDef] = useState<PreviewDefinitionInput | undefined>(presented);
  useEffect(() => { setLocalDef(presented); }, [presented]);

  const session = usePreviewSession(localDef, revision);
  const connection = usePreviewConnection(hot, session.pause);
  const [renderError, setRenderError] = useState("");
  const [size, setSize] = useState({width: 0, height: 0});
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [exportPanel, setExportPanel] = useState<HTMLDivElement | null>(null);
  const resetKey = useMemo(() => ({revision, input: localDef, generation: connection.generation}), [revision, localDef, connection.generation]);
  const failure = useCallback((error: unknown) => {
    session.pause(); setRenderError(error instanceof Error ? error.message : String(error));
  }, [session.pause]);
  useEffect(() => {
    const element = viewport;
    if (!element) return;
    const measure = () => setSize({width: element.clientWidth, height: element.clientHeight});
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element); measure();
    return () => observer?.disconnect();
  }, [viewport]);
  const definition = session.definition;
  const blocked = !session.valid || !connection.connected || !!connection.error || !!renderError;
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
  const captureSeek = useCallback((ms: number) => {
    if (blocked) throw new Error("Correct the scene before exporting.");
    session.seek(ms);
  }, [blocked, session.seek]);
  const scale = definition && size.width && size.height ? Math.max(size.width / definition.width, size.height / definition.height) : 1;
  const stateText = !connection.connected ? "Reconnecting to your app…" : connection.error ? "Source needs a correction" :
    connection.updating ? "Updating scene…" : renderError || session.issues.length ? "Scene needs a correction" :
    !definition ? "Waiting for a scene" : session.playing ? "Playing" : "Live preview";
  return (
    <main data-seene-preview="" data-seene-state={blocked ? "unavailable" : "ready"}>
    <style>{previewTheme}</style>
    <div className="seene-viewport" ref={setViewport} aria-label="Scene preview">
      {!definition && <div className="seene-empty seene-chrome">
        <span className="seene-empty-symbol" aria-hidden="true">↗</span>
        <h1>A new perspective<br/>on your product.</h1>
        <p>Your live scene will appear here. Open Seene inside your app, then use the studio inspector to compose its motion.</p>
      </div>}
    </div>
    <div className="seene-bottom-blur" data-seene-preview-chrome="" aria-hidden="true"><i/><i/><i/></div>
    <footer className="seene-footer seene-chrome" data-seene-preview-chrome="" aria-label="Scene controls">
      <div className="seene-controls">
        <div className="seene-export-slot" ref={setExportPanel}/>
        {(session.issues.length > 0 || connection.error || !connection.connected) && <section className="seene-message seene-chrome" role="alert">
          <strong>{stateText}</strong>
          {session.issues.length > 0 && <><p>Your last valid scene settings are retained. Correct the source to continue.</p>
            <ul>{session.issues.map((issue,index) => <li key={index}>{issue.path}: {issue.message}</li>)}</ul></>}
          {connection.error && <p>{connection.error}</p>}
          {!connection.connected && <p>Keep your development server running. The preview reconnects automatically.</p>}
        </section>}
        <SceneErrorBoundary resetKey={resetKey} onError={failure} onReset={() => setRenderError("")}>
          {definition && viewport && createPortal(
            <div className="seene-canvas" data-seene-capture="scene" data-seene-valid={blocked ? "false" : "true"}
              style={{width: "100%", height: "100%", position: "relative"}}>
            {prevDefinition && transitionProgress < 1 && (
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: prevDefinition.width, height: prevDefinition.height,
                transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center",
                opacity: 1 - easeInOut(transitionProgress),
                transition: `opacity ${SCENE_TRANSITION_DURATION}ms ease-out`,
                pointerEvents: "none",
              }}>
                <Scene camera={prevDefinition.scene.camera} focus={prevDefinition.scene.focus} motion={prevDefinition.motion}
                  recipeNodes={prevDefinition.scene.nodes}
                  timeMs={session.timeMs} onDiagnostics={session.onDiagnostics} style={{width: prevDefinition.width, height: prevDefinition.height}}>
                  {children}
                </Scene>
              </div>
            )}
            <div style={{
              position: "absolute", left: "50%", top: "50%",
              width: definition.width, height: definition.height,
              transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center",
              opacity: prevDefinition && transitionProgress < 1 ? easeInOut(transitionProgress) : 1,
              transition: `opacity ${SCENE_TRANSITION_DURATION}ms ease-out`,
            }}>
              <Scene camera={definition.scene.camera} focus={definition.scene.focus} motion={definition.motion}
                recipeNodes={definition.scene.nodes}
                timeMs={session.timeMs} onDiagnostics={session.onDiagnostics} style={{width: definition.width, height: definition.height}}>
                {children}
              </Scene>
            </div>
            <Capture durationMs={session.durationMs} seek={captureSeek}/>
          </div>, viewport)}
        </SceneErrorBoundary>
        <div className="seene-header">
          <div className="seene-heading">
            {backHref ? <a className="seene-control" href={backHref} onClick={event => {
              if (onBack && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault(); onBack();
              }
            }}>{onBack ? "Back to scenes" : "Back to app"}</a> : onBack && <button className="seene-control" onClick={onBack}>Back to scenes</button>}
            <h1 className="seene-title">{title}</h1>
          </div>
          <SceneInspector definition={localDef} onChange={updated => setLocalDef(updated)} />
          <ExportMenu disabled={blocked || !session.durationMs} panelHost={exportPanel}/>
        </div>
        {onPresentationChange && <PresentationPicker value={presentation} onChange={onPresentationChange} />}
        {onTransitionChange && <TransitionPicker value={transition} onChange={onTransitionChange} />}
        {!definition && <GettingStarted/>}
        <div className="seene-dock">
          <button className="seene-control seene-primary seene-icon" disabled={blocked || !session.durationMs}
            aria-label={session.playing ? "Pause" : session.timeMs >= session.durationMs && session.durationMs ? "Replay" : "Play"} onClick={session.toggle}>
            <Glyph kind={session.playing ? "pause" : "play"}/>
          </button>
          <button className="seene-control seene-icon" aria-label="Restart" disabled={!definition} onClick={() => session.seek(0)}><Glyph kind="restart"/></button>
          <input className="seene-timeline" aria-label="Scene time" aria-valuetext={timeLabel(session.timeMs)} type="range"
            min={0} max={session.durationMs || 1} step={10} value={session.timeMs} disabled={blocked || !session.durationMs}
            onChange={event => session.seek(Number(event.target.value))}/>
          <output className="seene-time" data-testid="scene-time">{timeLabel(session.timeMs)} / {timeLabel(session.durationMs)}</output>
        </div>
        <div className="seene-preview-meta"><span className="seene-status" role="status"><span className="seene-status-dot"/>{stateText}</span><BrandAttribution/></div>
      </div>
    </footer>
    </main>
  );
}