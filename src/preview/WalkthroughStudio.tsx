/**
 * SOURCE OF TRUTH: WalkthroughStudio.
 * WHAT: the unified walkthrough authoring workspace: sequence canvas, connected node editing,
 * one continuous timeline, project and node inspector, component browser and playback controls.
 * WHY: replace scene-by-scene authoring with one editable, previewable, exportable walkthrough.
 * WHERE: rendered by ScenePreview when a definition carries a walkthrough document.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  compileWalkthrough,
  connectWalkthroughNodes,
  createWalkthroughDocument,
  createWalkthroughNode,
  disconnectWalkthroughNodes,
  duplicateWalkthroughNode,
  getWalkthroughNode,
  insertWalkthroughNode,
  moveWalkthroughNode,
  removeWalkthroughNode,
  resolveWalkthroughFrame,
  updateWalkthroughNode,
  validateWalkthrough,
  walkthroughSchedule,
  type PreviewDefinition,
  type PreviewDefinitionInput,
  type SceneIssue,
  type WalkthroughDocument,
  type WalkthroughNode,
  type WalkthroughNodeType,
} from "../core";
import { useSceneCapture } from "../react";
import { usePreviewSession } from "./session";
import { useSceneBackdrop } from "./backdrop";
import { previewTheme } from "./theme";
import { WalkthroughStage } from "./WalkthroughStage";
import { WalkthroughInspector } from "./WalkthroughInspector";
import { WalkthroughTimeline } from "./WalkthroughTimeline";

export type WalkthroughStudioProps = {
  definition: PreviewDefinition;
  session: ReturnType<typeof usePreviewSession>;
  title: string;
  backHref?: string;
  onBack?: () => void;
  onExit: () => void;
  onDefinitionChange: (definition: PreviewDefinitionInput) => void;
  onSaveDefinition?: (definition: PreviewDefinitionInput, sections: StudioSection[]) => Promise<void> | void;
  createSceneEndpoint?: string;
  children?: ReactNode;
};

export type StudioSection = { file: string; export?: string; title?: string };

type ContentFile = { path: string; default: boolean; exports: string[]; kind?: "page" | "section" | "component"; title?: string; route?: string };

const ADDABLE_TYPES: WalkthroughNodeType[] = ["show", "scroll", "focus", "highlight", "click", "wait", "camera", "transition", "caption"];

function timeLabel(ms: number): string {
  const value = Math.max(0, Math.round(ms));
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}.${String(Math.floor((value % 1000) / 100))}`;
}

function sectionsFor(document: WalkthroughDocument): StudioSection[] {
  const sections: StudioSection[] = [];
  for (const node of document.nodes) {
    const target = node.target;
    if (!target?.file) continue;
    const key = `${target.file}#${target.export ?? ""}`;
    if (sections.some(section => `${section.file}#${section.export ?? ""}` === key)) continue;
    sections.push({ file: target.file, ...(target.export ? { export: target.export } : {}), ...(target.label ? { title: target.label } : {}) });
  }
  return sections;
}

function CaptureBridge({ durationMs, seek }: { durationMs: number; seek: (ms: number) => void }) {
  useSceneCapture({ durationMs, seek });
  return null;
}

export function WalkthroughStudio({
  definition,
  session,
  title,
  backHref,
  onBack,
  onExit,
  onDefinitionChange,
  onSaveDefinition,
  createSceneEndpoint,
  children,
}: WalkthroughStudioProps) {
  const walkthrough = definition.walkthrough ?? createWalkthroughDocument({ title });
  const compiled = useMemo(() => compileWalkthrough(walkthrough)!, [walkthrough]);
  const schedule = useMemo(() => walkthroughSchedule(walkthrough), [walkthrough]);
  const review = useMemo(() => validateWalkthrough(walkthrough), [walkthrough]);
  const frame = useMemo(() => resolveWalkthroughFrame(compiled, session.timeMs), [compiled, session.timeMs]);

  const [selectedId, setSelectedId] = useState<string | null>(walkthrough.nodes[1]?.id ?? walkthrough.nodes[0]?.id ?? null);
  const [inspectorTab, setInspectorTab] = useState<"node" | "global">("node");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserTab, setBrowserTab] = useState<"component" | "section">("component");
  const [browserSearch, setBrowserSearch] = useState("");
  const [contentFiles, setContentFiles] = useState<ContentFile[] | null>(null);
  const [contentState, setContentState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [contentError, setContentError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [boundary, setBoundary] = useState<number | null>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const [inspector, setInspector] = useState(true);

  const undoStack = useRef<WalkthroughDocument[]>([]);
  const redoStack = useRef<WalkthroughDocument[]>([]);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  const selected = useMemo(() => getWalkthroughNode(walkthrough, selectedId ?? ""), [walkthrough, selectedId]);
  const backdrop = useSceneBackdrop(definition.backdrop, viewport);

  const pushDefinition = useCallback(
    (next: WalkthroughDocument, options?: { history?: boolean }) => {
      if (options?.history !== false) {
        undoStack.current.push(walkthrough);
        redoStack.current = [];
      }
      const nextCompiled = compileWalkthrough(next);
      onDefinitionChange({
        ...definition,
        compositionType: "walkthrough",
        sizingMode: "viewport",
        minHeight: "100vh",
        width: next.settings.width,
        height: next.settings.height,
        walkthrough: next,
        motion: nextCompiled?.motion ?? definition.motion,
      });
    },
    [definition, onDefinitionChange, walkthrough],
  );

  const applyResult = useCallback(
    (result: { document: WalkthroughDocument; issues: SceneIssue[] }, options?: { history?: boolean }) => {
      if (result.issues.length > 0) setNotice(result.issues[0].message);
      else setNotice("");
      if (result.document !== walkthrough) pushDefinition(result.document, options);
    },
    [pushDefinition, walkthrough],
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(walkthrough);
    pushDefinition(previous, { history: false });
  }, [pushDefinition, walkthrough]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(walkthrough);
    pushDefinition(next, { history: false });
  }, [pushDefinition, walkthrough]);

  // Autosave: debounce edits and report state so work is never lost.
  useEffect(() => {
    if (!onSaveDefinition) return;
    const serialized = JSON.stringify(walkthrough);
    if (!lastSaved.current) {
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setSaveState("saving");
    autosaveTimer.current = setTimeout(() => {
      Promise.resolve(onSaveDefinition({ ...definition, walkthrough }, sectionsFor(walkthrough)))
        .then(() => {
          lastSaved.current = serialized;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 900);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [walkthrough, definition, onSaveDefinition]);

  // Single-step preview stops at the authored step boundary.
  useEffect(() => {
    if (boundary !== null && session.timeMs >= boundary) {
      session.pause();
      setBoundary(null);
    }
  }, [boundary, session.timeMs, session.pause]);

  // Keyboard shortcuts for playback and editing.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        session.toggle();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        session.seek(Math.min(session.durationMs, session.timeMs + (event.shiftKey ? 1000 : 100)));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        session.seek(Math.max(0, session.timeMs - (event.shiftKey ? 1000 : 100)));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [redo, session, undo]);

  // Component discovery for the browser.
  const loadContent = useCallback(async () => {
    if (!createSceneEndpoint || contentState === "loading" || contentState === "ready") return;
    setContentState("loading");
    setContentError("");
    const url = createSceneEndpoint.replace(/\/create-scene\/?$/, "/content");
    try {
      const response = await fetch(url);
      const payload = await response.json();
      const files = payload?.content?.files ?? payload?.files;
      if (Array.isArray(files)) {
        setContentFiles(files);
        setContentState("ready");
      } else {
        setContentError(payload?.error ?? "Could not discover project components.");
        setContentState("error");
      }
    } catch {
      setContentError("Could not reach the development server for component discovery.");
      setContentState("error");
    }
  }, [createSceneEndpoint, contentState]);

  useEffect(() => {
    if (browserOpen) void loadContent();
  }, [browserOpen, loadContent]);

  const discoveredSections = useMemo(() => {
    const elements = typeof document === "undefined" || !viewport ? [] : viewport.querySelectorAll<HTMLElement>("[data-section-id],[data-walkthrough-target],[data-website-section-id]");
    return [...elements].map((element, index) => ({
      id: element.getAttribute("data-section-id") ?? element.getAttribute("data-walkthrough-target") ?? element.getAttribute("data-website-section-id") ?? `section-${index + 1}`,
      label: element.getAttribute("data-section-label") ?? element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 48) ?? `Section ${index + 1}`,
      element,
    }));
  }, [viewport, frame.activeNodeId, walkthrough.nodes.length]);

  const addNode = useCallback(
    (type: WalkthroughNodeType, init?: Partial<Parameters<typeof createWalkthroughNode>[1]>) => {
      const id = `${type}-${Date.now().toString(36).slice(-4)}`;
      const node = createWalkthroughNode(type, { id, ...init });
      const anchor = selectedId ?? walkthrough.nodes[walkthrough.nodes.length - 2]?.id ?? walkthrough.nodes[0]?.id;
      const result = insertWalkthroughNode(walkthrough, node, anchor);
      setSelectedId(id);
      setInspectorTab("node");
      applyResult(result);
    },
    [applyResult, selectedId, walkthrough],
  );

  const addComponentNode = useCallback(
    (file: string, exportName: string | undefined, label: string | undefined) => {
      addNode("show", { title: label ?? file.split("/").pop() ?? "Section", target: { kind: "component", file, ...(exportName ? { export: exportName } : {}), ...(label ? { label } : {}) } });
      setBrowserOpen(false);
    },
    [addNode],
  );

  const addSectionNode = useCallback(
    (sectionId: string, label: string) => {
      addNode("scroll", { title: label, target: { kind: "section", sectionId, label } });
      setBrowserOpen(false);
    },
    [addNode],
  );

  const selectNode = useCallback(
    (id: string, seek = true) => {
      setSelectedId(id);
      setInspectorTab("node");
      if (!seek) return;
      const step = schedule.steps.find(item => item.nodeId === id);
      if (step) {
        setBoundary(null);
        session.seek(step.startTime + Math.min(step.durationMs, 40));
      }
    },
    [schedule.steps, session],
  );

  const updateSelected = useCallback(
    (patch: Partial<WalkthroughNode>) => {
      if (!selectedId) return;
      applyResult(updateWalkthroughNode(walkthrough, selectedId, patch));
    },
    [applyResult, selectedId, walkthrough],
  );

  const previewStep = useCallback(
    (id: string) => {
      const step = schedule.steps.find(item => item.nodeId === id);
      if (!step) return;
      setSelectedId(id);
      setBoundary(step.endTime);
      session.seek(step.startTime);
      if (!session.playing) session.toggle();
    },
    [schedule.steps, session],
  );

  const filteredFiles = useMemo(() => {
    if (!contentFiles) return [];
    const query = browserSearch.trim().toLowerCase();
    return contentFiles.filter(file => {
      if (file.kind === "component" && !file.exports.length) return false;
      if (!query) return true;
      return file.path.toLowerCase().includes(query) || (file.title ?? "").toLowerCase().includes(query) || file.exports.some(name => name.toLowerCase().includes(query));
    });
  }, [contentFiles, browserSearch]);

  const statusText = !session.valid
    ? "Needs a correction"
    : session.playing
      ? "Playing"
      : boundary !== null
        ? "Step preview"
        : "Live preview";

  return (
    <main data-seene-preview="" data-seene-walkthrough-studio="" style={{ "--seene-scene-backdrop": backdrop } as CSSProperties} className="seene-walkthrough-studio">
      <style>{previewTheme}</style>
      <div className="seene-studio-topbar" data-seene-chrome="studio-topbar">
        <div className="seene-studio-topbar-group">
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
              Back to scenes
            </a>
          ) : onBack ? (
            <button type="button" className="seene-control" onClick={onBack}>
              Back to scenes
            </button>
          ) : null}
          <input
            aria-label="Walkthrough title"
            className="seene-studio-title"
            value={walkthrough.title}
            onChange={event => pushDefinition({ ...walkthrough, title: event.target.value || "Walkthrough" }, { history: false })}
          />
          <span className="seene-studio-badge" data-state={review.valid ? "valid" : "invalid"}>
            {review.valid ? `${schedule.steps.length} steps` : `${review.issues.length} issue${review.issues.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="seene-studio-topbar-group">
          <button type="button" className="seene-control" onClick={undo} disabled={undoStack.current.length === 0} aria-label="Undo">
            Undo
          </button>
          <button type="button" className="seene-control" onClick={redo} disabled={redoStack.current.length === 0} aria-label="Redo">
            Redo
          </button>
          <button type="button" className="seene-control" onClick={() => setSidebar(value => !value)} aria-pressed={sidebar}>
            Nodes
          </button>
          <button type="button" className="seene-control" onClick={() => setInspector(value => !value)} aria-pressed={inspector}>
            Inspector
          </button>
          <button type="button" className="seene-control" onClick={onExit}>
            Single scene
          </button>
          <button
            type="button"
            className="seene-control seene-primary"
            onClick={() => {
              if (!onSaveDefinition) return;
              setSaveState("saving");
              Promise.resolve(onSaveDefinition({ ...definition, walkthrough }, sectionsFor(walkthrough)))
                .then(() => setSaveState("saved"))
                .catch(() => setSaveState("error"));
            }}
            disabled={!onSaveDefinition || !review.valid}
          >
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {!review.valid && review.issues.length > 0 ? (
        <div className="seene-studio-notice" role="alert">
          <strong>Walkthrough needs attention</strong>
          <ul>
            {review.issues.slice(0, 4).map((issue, index) => (
              <li key={index}>
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : notice ? (
        <div className="seene-studio-notice" role="status">
          {notice}
        </div>
      ) : null}

      <div className="seene-studio-body">
        {sidebar ? (
          <aside className="seene-studio-sequence" aria-label="Walkthrough sequence">
            <header className="seene-studio-panel-head">
              <h2>Sequence</h2>
              <button type="button" className="seene-control seene-small" onClick={() => setBrowserOpen(true)}>
                + Add
              </button>
            </header>
            <ol className="seene-studio-nodes">
              {schedule.steps.map((step, index) => {
                const node = getWalkthroughNode(walkthrough, step.nodeId);
                const chain = schedule.steps.length;
                return (
                  <li key={step.nodeId} data-selected={selectedId === step.nodeId} data-active={frame.activeNodeId === step.nodeId}>
                    <div className="seene-studio-node-connector" data-first={index === 0} data-last={index === chain - 1} />
                    <button
                      type="button"
                      className="seene-studio-node"
                      onClick={() => selectNode(step.nodeId)}
                      onDoubleClick={() => previewStep(step.nodeId)}
                      data-type={step.type}
                      data-disconnected={review.issues.some(issue => issue.path === `nodes.${step.nodeId}`) ? "true" : undefined}
                    >
                      <span className="seene-studio-node-type">{step.type}</span>
                      <span className="seene-studio-node-title">{node?.title ?? step.title}</span>
                      <span className="seene-studio-node-time">{timeLabel(step.startTime)}</span>
                    </button>
                    <div className="seene-studio-node-actions">
                      <button type="button" className="seene-control seene-tiny" onClick={() => applyResult(moveWalkthroughNode(walkthrough, step.nodeId, -1))} disabled={index === 0} aria-label={`Move ${node?.title ?? step.title} earlier`}>
                        ↑
                      </button>
                      <button type="button" className="seene-control seene-tiny" onClick={() => applyResult(moveWalkthroughNode(walkthrough, step.nodeId, 1))} disabled={index === chain - 1} aria-label={`Move ${node?.title ?? step.title} later`}>
                        ↓
                      </button>
                      <button type="button" className="seene-control seene-tiny" onClick={() => applyResult(duplicateWalkthroughNode(walkthrough, step.nodeId))} aria-label={`Duplicate ${node?.title ?? step.title}`}>
                        ⧉
                      </button>
                      <button
                        type="button"
                        className="seene-control seene-tiny"
                        onClick={() => {
                          const result = disconnectWalkthroughNodes(walkthrough, step.nodeId);
                          applyResult(result);
                        }}
                        aria-label={`Disconnect ${node?.title ?? step.title}`}
                      >
                        ⤫
                      </button>
                      <button
                        type="button"
                        className="seene-control seene-tiny seene-danger"
                        onClick={() => setConfirmRemove(step.nodeId)}
                        aria-label={`Remove ${node?.title ?? step.title}`}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="seene-studio-add-row">
              {ADDABLE_TYPES.map(type => (
                <button key={type} type="button" className="seene-control seene-small" onClick={() => addNode(type)}>
                  + {type}
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <section className="seene-studio-main">
          <div className="seene-studio-viewport seene-viewport" ref={setViewport} aria-label="Walkthrough preview">
            <div className="seene-canvas" data-seene-capture="scene" data-seene-valid={session.valid ? "true" : "false"}>
              <WalkthroughStage
                definition={definition}
                document={walkthrough}
                frame={frame}
                onIssue={message => setNotice(message)}
                onDiagnostics={session.onDiagnostics}
              >
                {children}
              </WalkthroughStage>
            </div>
            <CaptureBridge durationMs={session.durationMs} seek={(ms) => session.seek(ms)} />
          </div>
          <WalkthroughTimeline
            steps={schedule.steps}
            durationMs={session.durationMs}
            timeMs={session.timeMs}
            playing={session.playing}
            activeNodeId={frame.activeNodeId}
            selectedNodeId={selectedId}
            formatTime={timeLabel}
            onSeek={ms => {
              setBoundary(null);
              session.seek(ms);
            }}
            onSelect={id => selectNode(id)}
            onPreview={id => previewStep(id)}
            onToggle={() => {
              setBoundary(null);
              session.toggle();
            }}
            onRestart={() => {
              setBoundary(null);
              session.seek(0);
            }}
            onStep={(direction) => {
              const index = schedule.steps.findIndex(step => step.nodeId === frame.activeNodeId);
              const next = schedule.steps[Math.min(schedule.steps.length - 1, Math.max(0, index + direction))];
              if (next) selectNode(next.nodeId);
            }}
          />
        </section>

        {inspector ? (
          <WalkthroughInspector
            document={walkthrough}
            node={selected}
            tab={inspectorTab}
            status={statusText}
            onTabChange={setInspectorTab}
            onUpdateDocument={patch => pushDefinition({ ...walkthrough, ...patch }, { history: false })}
            onUpdateNode={updateSelected}
            onUpdateGlobals={patch => pushDefinition({ ...walkthrough, settings: { ...walkthrough.settings, ...patch } }, { history: false })}
            onConnect={toId => {
              if (!selectedId) return;
              applyResult(connectWalkthroughNodes(walkthrough, selectedId, toId));
            }}
            onResetNode={() => selectedId && applyResult(updateWalkthroughNode(walkthrough, selectedId, createWalkthroughNode(selected?.type ?? "show", { id: selectedId })))}
          />
        ) : null}
      </div>

      {browserOpen
        ? createPortal(
            <div className="seene-studio-modal" role="dialog" aria-modal="true" aria-label="Add walkthrough step">
              <div className="seene-studio-modal-panel">
                <header className="seene-studio-panel-head">
                  <h2>Add a step</h2>
                  <button type="button" className="seene-control" onClick={() => setBrowserOpen(false)}>
                    Close
                  </button>
                </header>
                <div className="seene-studio-tabs">
                  <button type="button" aria-pressed={browserTab === "component"} onClick={() => setBrowserTab("component")}>
                    Components
                  </button>
                  <button type="button" aria-pressed={browserTab === "section"} onClick={() => setBrowserTab("section")}>
                    Page sections
                  </button>
                </div>
                {browserTab === "component" ? (
                  <>
                    <input
                      className="seene-studio-search"
                      placeholder="Search components"
                      value={browserSearch}
                      onChange={event => setBrowserSearch(event.target.value)}
                      aria-label="Search components"
                    />
                    {contentState === "loading" ? <p className="seene-studio-hint">Discovering project components…</p> : null}
                    {contentState === "error" ? <p className="seene-studio-hint seene-danger">{contentError}</p> : null}
                    <ul className="seene-studio-browser">
                      {filteredFiles.map(file =>
                        file.exports.length > 0 ? (
                          file.exports.map(exportName => (
                            <li key={`${file.path}#${exportName}`}>
                              <button type="button" onClick={() => addComponentNode(file.path, exportName, file.title ?? exportName)}>
                                <strong>{file.title ?? exportName}</strong>
                                <span>
                                  {file.path}
                                  #{exportName}
                                </span>
                              </button>
                            </li>
                          ))
                        ) : (
                          <li key={file.path}>
                            <button type="button" onClick={() => addComponentNode(file.path, undefined, file.title ?? file.path)}>
                              <strong>{file.title ?? file.path.split("/").pop()}</strong>
                              <span>{file.path}</span>
                            </button>
                          </li>
                        ),
                      )}
                      {contentState === "ready" && filteredFiles.length === 0 ? <li className="seene-studio-hint">No matching components.</li> : null}
                      {contentState === "idle" ? <li className="seene-studio-hint">Open this walkthrough inside your app to browse components.</li> : null}
                    </ul>
                  </>
                ) : (
                  <ul className="seene-studio-browser">
                    {discoveredSections.map(section => (
                      <li key={section.id}>
                        <button type="button" onClick={() => addSectionNode(section.id, section.label)}>
                          <strong>{section.label}</strong>
                          <span>{section.id}</span>
                        </button>
                      </li>
                    ))}
                    {discoveredSections.length === 0 ? (
                      <li className="seene-studio-hint">No labelled sections are visible yet. Tag elements with data-section-id or add them to the recipe.</li>
                    ) : null}
                  </ul>
                )}
              </div>
            </div>,
            viewport ?? document.body,
          )
        : null}

      {confirmRemove
        ? createPortal(
            <div className="seene-studio-modal" role="dialog" aria-modal="true" aria-label="Remove step">
              <div className="seene-studio-modal-panel seene-studio-confirm">
                <h2>Remove “{getWalkthroughNode(walkthrough, confirmRemove)?.title}”?</h2>
                <p>This deletes the step from the walkthrough. You can undo afterwards.</p>
                <div className="seene-studio-confirm-actions">
                  <button type="button" className="seene-control" onClick={() => setConfirmRemove(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="seene-control seene-danger"
                    onClick={() => {
                      applyResult(removeWalkthroughNode(walkthrough, confirmRemove));
                      setConfirmRemove(null);
                    }}
                  >
                    Remove step
                  </button>
                </div>
              </div>
            </div>,
            viewport ?? document.body,
          )
        : null}
    </main>
  );
}
