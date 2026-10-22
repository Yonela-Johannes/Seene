import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  compileWalkthrough,
  connectWalkthroughNodes,
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
  type WalkthroughDocument,
  type WalkthroughNode,
  type WalkthroughNodeType,
} from "../core";
import { previewTheme } from "../preview/theme";
import { usePreviewSession } from "../preview/session";
import { WalkthroughInspector } from "../preview/WalkthroughInspector";
import { WalkthroughTimeline } from "../preview/WalkthroughTimeline";
import { measureElementTop } from "../preview/WebsiteWalkthrough";
import type { WebsiteProject } from "../core";
import { platformApi, PROJECTS_ROUTE } from "./api";
import { useResource } from "./data";
import { Notice } from "./ui";

const ADDABLE_TYPES: WalkthroughNodeType[] = ["show", "scroll", "focus", "highlight", "click", "navigate", "wait", "camera", "transition", "caption"];

function timeLabel(ms: number): string {
  const value = Math.max(0, Math.round(ms));
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}.${String(Math.floor((value % 1000) / 100))}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function WebsiteStudioView({ url, initialScene }: { url: string; initialScene?: string }) {
  const resource = useResource(`website:${url}`, () => platformApi.website(url));
  const project = resource.data?.project;

  if (resource.error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-12">
        <Notice>{resource.error}</Notice>
        <p className="text-sm text-[var(--seene-text-muted)]">Website projects live in the local platform server. Re-import the URL from the homepage, or start the Seene development server and retry.</p>
        <a className="seene-btn seene-btn-primary seene-btn-nav" href={PROJECTS_ROUTE}>Back to projects</a>
      </div>
    );
  }
  if (!project) {
    return <p className="px-6 py-12 text-sm text-[var(--seene-text-muted)]">Loading website project…</p>;
  }
  // Re-key on the persisted revision so "Reload" adopts a changed document (including the
  // freshest inspection) instead of keeping stale editor state from the previous fetch.
  return <WebsiteStudio key={project.updatedAt} project={project} initialScene={initialScene} onReload={() => resource.reload()} />;
}

function WebsiteStudio({ project, initialScene, onReload }: { project: WebsiteProject; initialScene?: string; onReload: () => void }) {
  const [document, setDocument] = useState<WalkthroughDocument>(project.walkthrough);
  const [selectedId, setSelectedId] = useState<string | null>(initialScene ?? project.walkthrough.nodes[1]?.id ?? project.walkthrough.nodes[0]?.id ?? null);
  const [inspectorTab, setInspectorTab] = useState<"node" | "global">("node");
  const [sidebar, setSidebar] = useState(true);
  const [inspector, setInspector] = useState(true);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserTab, setBrowserTab] = useState<"section" | "page" | "element">("section");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pageUrl, setPageUrl] = useState(project.url);
  const [iframeReady, setIframeReady] = useState(false);
  const [previewLimited, setPreviewLimited] = useState(!project.inspection.canIframe);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSaved = useRef(JSON.stringify(project.walkthrough));
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlighted = useRef<HTMLElement | null>(null);
  const undoStack = useRef<WalkthroughDocument[]>([]);
  const redoStack = useRef<WalkthroughDocument[]>([]);

  const compiled = useMemo(() => compileWalkthrough(document), [document]);
  const schedule = useMemo(() => walkthroughSchedule(document), [document]);
  const review = useMemo(() => validateWalkthrough(document), [document]);

  const definitionInput = useMemo(() => {
    if (!compiled) return undefined;
    return {
      compositionType: "walkthrough" as const,
      sizingMode: "viewport" as const,
      minHeight: "100vh",
      width: document.settings.width,
      height: document.settings.height,
      scene: {
        version: 3 as const,
        camera: { perspective: 2000, x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 },
        focus: { distance: 1800, fStop: 8, focalLength: 50, maxBlur: 0 },
        nodes: [{ id: "host" }],
      },
      motion: compiled.motion,
      walkthrough: document,
    };
  }, [compiled, document]);

  const session = usePreviewSession(definitionInput, document);
  const frame = useMemo(() => (compiled ? resolveWalkthroughFrame(compiled, session.timeMs) : null), [compiled, session.timeMs]);
  const selected = useMemo(() => getWalkthroughNode(document, selectedId ?? ""), [document, selectedId]);

  // Persist the same serializable document the npm Studio uses. Debounced so editing is smooth.
  useEffect(() => {
    const serialized = JSON.stringify(document);
    if (serialized === lastSaved.current) return;
    if (autosave.current) clearTimeout(autosave.current);
    setSaveState("saving");
    autosave.current = setTimeout(() => {
      void platformApi.updateWebsite({ url: project.url, walkthrough: document })
        .then(() => { lastSaved.current = serialized; setSaveState("saved"); })
        .catch(error => { setSaveState("error"); setNotice(error instanceof Error ? error.message : "The walkthrough could not be saved."); });
    }, 900);
    return () => { if (autosave.current) clearTimeout(autosave.current); };
  }, [document, project.url]);

  const saveNow = useCallback(async () => {
    setSaveState("saving");
    try {
      await platformApi.updateWebsite({ url: project.url, walkthrough: document });
      lastSaved.current = JSON.stringify(document);
      setSaveState("saved");
      setNotice("Walkthrough saved.");
    } catch (error) {
      setSaveState("error");
      setNotice(error instanceof Error ? error.message : "The walkthrough could not be saved.");
    }
  }, [document, project.url]);

  const apply = useCallback((next: WalkthroughDocument, options?: { history?: boolean }) => {
    if (options?.history !== false) {
      undoStack.current.push(document);
      redoStack.current = [];
    }
    setDocument(next);
    if (next.nodes.some(node => node.id === selectedId)) return;
    setSelectedId(next.nodes[1]?.id ?? next.nodes[0]?.id ?? null);
  }, [document, selectedId]);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(document);
    setDocument(previous);
  }, [document]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(document);
    setDocument(next);
  }, [document]);

  const addNode = useCallback((type: WalkthroughNodeType, init?: Partial<Parameters<typeof createWalkthroughNode>[1]>) => {
    const id = `${type}-${Date.now().toString(36).slice(-5)}`;
    const anchor = selectedId ?? document.nodes[document.nodes.length - 2]?.id ?? document.nodes[0]?.id;
    const result = insertWalkthroughNode(document, createWalkthroughNode(type, { id, ...init }), anchor);
    apply(result.document);
    setSelectedId(id);
    setInspectorTab("node");
    if (result.issues.length) setNotice(result.issues[0].message);
    setBrowserOpen(false);
  }, [apply, document, selectedId]);

  const updateSelected = useCallback((patch: Partial<WalkthroughNode>) => {
    if (!selectedId) return;
    apply(updateWalkthroughNode(document, selectedId, patch).document);
  }, [apply, document, selectedId]);

  const selectNode = useCallback((id: string, seek = true) => {
    setSelectedId(id);
    setInspectorTab("node");
    if (!seek) return;
    const step = schedule.steps.find(item => item.nodeId === id);
    if (step) session.seek(step.startTime + Math.min(step.durationMs, 40));
  }, [schedule.steps, session]);

  const exportConfig = useCallback(() => {
    const anchor = window.document.createElement("a");
    anchor.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(document, null, 2));
    anchor.download = `${document.title || "walkthrough"}.scene.json`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [document]);

  const importConfig = useCallback((text: string) => {
    try {
      const review = validateWalkthrough(JSON.parse(text));
      if (review.valid && review.document) {
        apply(review.document);
        setNotice("Imported walkthrough configuration.");
      } else setNotice(review.issues[0]?.message ?? "Invalid walkthrough JSON.");
    } catch {
      setNotice("Could not parse the walkthrough JSON file.");
    }
  }, [apply]);

  // Move the preview iframe to the last page navigation at or before the active step.
  useEffect(() => {
    if (!frame) return;
    let target = project.url;
    for (let index = 0; index <= frame.activeIndex && index < document.nodes.length; index += 1) {
      const node = document.nodes[index];
      if (node?.type === "navigate" && node.target?.url && isHttpUrl(node.target.url)) target = node.target.url;
    }
    setPageUrl(previous => previous === target ? previous : target);
  }, [document.nodes, frame, project.url]);

  // Drive same-origin framed sites: scroll to the target and apply a visible highlight. Remote
  // origins cannot be scripted, so the step still displays with an explicit limitation message.
  useEffect(() => {
    if (!frame || !iframeReady) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let frameDocument: Document | null = null;
    try { frameDocument = iframe.contentDocument; } catch { frameDocument = null; }
    if (!frameDocument) {
      setPreviewLimited(true);
      return;
    }
    const node = document.nodes.find(item => item.id === frame.activeNodeId);
    if (!node) return;
    if (highlighted.current) {
      highlighted.current.style.outline = "";
      highlighted.current.style.outlineOffset = "";
      highlighted.current = null;
    }
    const target = node.target?.selector ? frameDocument.querySelector<HTMLElement>(node.target.selector) : null;
    if (target) {
      const scroller = (frameDocument.scrollingElement || frameDocument.documentElement) as HTMLElement;
      try {
        if (node.type === "show" || node.type === "scroll") {
          const align = node.scroll?.align ?? "start";
          const viewport = scroller.clientHeight || 0;
          const height = target.getBoundingClientRect().height;
          const offset = measureElementTop(target, scroller);
          const top = align === "center" ? offset - (viewport - height) / 2 : align === "end" ? offset - viewport + height : offset;
          scroller.scrollTop = Math.max(0, top + (node.scroll?.offsetPx ?? 0));
        }
        if (node.type === "highlight" || node.highlight) {
          target.style.outline = `3px solid ${node.highlight?.color ?? "#7c9cff"}`;
          target.style.outlineOffset = `${node.highlight?.paddingPx ?? 8}px`;
          highlighted.current = target;
        }
      } catch {
        setPreviewLimited(true);
      }
    }
  }, [document.nodes, frame, iframeReady]);

  useEffect(() => () => {
    if (autosave.current) clearTimeout(autosave.current);
    if (highlighted.current) {
      highlighted.current.style.outline = "";
      highlighted.current.style.outlineOffset = "";
    }
  }, []);

  const currentStep = frame ? document.nodes.find(node => node.id === frame.activeNodeId) : undefined;
  const statusText = session.playing ? "Playing" : "Live preview";

  return (
    <main data-seene-preview="" data-seene-walkthrough-studio="" data-seene-website-studio="" className="seene-walkthrough-studio" style={{ "--seene-scene-backdrop": "#000" } as CSSProperties}>
      <style>{previewTheme}</style>
      <div className="seene-studio-topbar" data-seene-chrome="studio-topbar">
        <div className="seene-studio-topbar-group">
          <a className="seene-control" href={PROJECTS_ROUTE}>← Projects</a>
          <input
            aria-label="Walkthrough title"
            className="seene-studio-title"
            value={document.title}
            onChange={event => setDocument({ ...document, title: event.target.value || "Walkthrough" })}
          />
          <span className="seene-studio-badge" data-state={review.valid ? "valid" : "invalid"}>
            {review.valid ? `${schedule.steps.length} steps` : `${review.issues.length} issue${review.issues.length === 1 ? "" : "s"}`}
          </span>
          <span className="seene-studio-badge" data-state="valid">{statusText}</span>
        </div>
        <div className="seene-studio-topbar-group">
          <a className="seene-control" href={project.url} target="_blank" rel="noreferrer noopener">Open live site</a>
          <button type="button" className="seene-control" onClick={exportConfig}>Export JSON</button>
          <button type="button" className="seene-control" onClick={undo} disabled={undoStack.current.length === 0} aria-label="Undo">Undo</button>
          <button type="button" className="seene-control" onClick={redo} disabled={redoStack.current.length === 0} aria-label="Redo">Redo</button>
          <button type="button" className="seene-control" onClick={() => setSidebar(value => !value)} aria-pressed={sidebar}>Nodes</button>
          <button type="button" className="seene-control" onClick={() => setInspector(value => !value)} aria-pressed={inspector}>Inspector</button>
          <button type="button" className="seene-control" onClick={() => void onReload()}>Reload</button>
          <button type="button" className="seene-control seene-primary" onClick={() => void saveNow()} disabled={!review.valid}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {!review.valid && review.issues.length > 0 ? (
        <div className="seene-studio-notice" role="alert">
          <strong>Walkthrough needs attention</strong>
          <ul>{review.issues.slice(0, 4).map((issue, index) => <li key={`${issue.path}:${index}`}>{issue.path}: {issue.message}</li>)}</ul>
        </div>
      ) : notice ? (
        <div className="seene-studio-notice" role="status">{notice}</div>
      ) : null}

      <div className="seene-studio-body">
        {sidebar ? (
          <aside className="seene-studio-sequence" aria-label="Walkthrough sequence">
            <header className="seene-studio-panel-head">
              <h2>Sequence</h2>
              <button type="button" className="seene-control seene-small" onClick={() => setBrowserOpen(true)}>+ Add</button>
            </header>
            <ol className="seene-studio-nodes">
              {schedule.steps.map((step, index) => {
                const node = getWalkthroughNode(document, step.nodeId);
                return (
                  <li key={step.nodeId} data-selected={selectedId === step.nodeId} data-active={frame?.activeNodeId === step.nodeId}>
                    <div className="seene-studio-node-connector" data-first={index === 0} data-last={index === schedule.steps.length - 1} />
                    <button type="button" className="seene-studio-node" data-type={step.type} onClick={() => selectNode(step.nodeId)}>
                      <span className="seene-studio-node-type">{step.type}</span>
                      <span className="seene-studio-node-title">{node?.title ?? step.title}</span>
                      <span className="seene-studio-node-time">{timeLabel(step.startTime)}</span>
                    </button>
                    <div className="seene-studio-node-actions">
                      <button type="button" className="seene-control seene-tiny" onClick={() => apply(moveWalkthroughNode(document, step.nodeId, -1).document)} disabled={index === 0} aria-label={`Move ${node?.title ?? step.title} earlier`}>↑</button>
                      <button type="button" className="seene-control seene-tiny" onClick={() => apply(moveWalkthroughNode(document, step.nodeId, 1).document)} disabled={index === schedule.steps.length - 1} aria-label={`Move ${node?.title ?? step.title} later`}>↓</button>
                      <button type="button" className="seene-control seene-tiny" onClick={() => apply(duplicateWalkthroughNode(document, step.nodeId).document)} aria-label={`Duplicate ${node?.title ?? step.title}`}>⧉</button>
                      <button type="button" className="seene-control seene-tiny" onClick={() => apply(disconnectWalkthroughNodes(document, step.nodeId).document)} aria-label={`Disconnect ${node?.title ?? step.title}`}>⤫</button>
                      <button type="button" className="seene-control seene-tiny seene-danger" onClick={() => setConfirmRemove(step.nodeId)} aria-label={`Remove ${node?.title ?? step.title}`}>✕</button>
                    </div>
                  </li>
                );
              })}
            </ol>
            {schedule.steps.length <= 2 ? (
              <p className="seene-studio-hint" role="status">
                No page sections were discovered, so there are no steps yet. Use <strong>+ Add</strong> to insert a page, scroll, focus, highlight or navigation step.
              </p>
            ) : null}
            <div className="seene-studio-add-row">
              {ADDABLE_TYPES.map(type => (
                <button key={type} type="button" className="seene-control seene-small" onClick={() => addNode(type)}>+ {type}</button>
              ))}
            </div>
          </aside>
        ) : null}

        <div className="seene-studio-main">
          <div className="seene-studio-viewport seene-viewport" aria-label="Website preview">
            {project.inspection.canIframe ? (
              <iframe
                ref={iframeRef}
                title="Imported website preview"
                src={pageUrl}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                referrerPolicy="no-referrer"
                onLoad={() => setIframeReady(true)}
                style={{ width: "100%", height: "100%", border: 0, background: "#fff" }}
              />
            ) : project.inspection.previewImage ? (
              <img src={project.inspection.previewImage} alt={`Inspected snapshot of ${project.inspection.title}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
            ) : (
              <div className="seene-empty seene-chrome" style={{ height: "100%" }}>
                <h1>{project.inspection.title}</h1>
                <p>{project.inspection.fallbackReason ?? "This site does not allow direct embedding."}</p>
                <a className="seene-control" href={project.url} target="_blank" rel="noreferrer noopener">Open the live site</a>
              </div>
            )}
            {previewLimited && project.inspection.canIframe ? (
              <div role="status" className="seene-studio-notice" style={{ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 10, zIndex: 2 }}>
                This site is cross-origin, so browser security prevents Seene from scrolling or highlighting inside the live preview. Steps are saved and can still be exported as JSON.
              </div>
            ) : null}
            {!project.inspection.canIframe && project.inspection.fallbackReason ? (
              <div role="status" className="seene-studio-notice" style={{ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 10, zIndex: 2 }}>
                {project.inspection.fallbackReason}
              </div>
            ) : null}
            {currentStep ? (
              <div className="seene-walkthrough-caption" data-position="bottom" role="note" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 18, zIndex: 2 }}>
                {currentStep.title}
              </div>
            ) : null}
          </div>
          <WalkthroughTimeline
            steps={schedule.steps}
            durationMs={session.durationMs}
            timeMs={session.timeMs}
            playing={session.playing}
            activeNodeId={frame?.activeNodeId ?? null}
            selectedNodeId={selectedId}
            formatTime={timeLabel}
            onSeek={ms => session.seek(ms)}
            onSelect={id => selectNode(id)}
            onPreview={id => { selectNode(id); if (!session.playing) session.toggle(); }}
            onToggle={() => session.toggle()}
            onRestart={() => session.seek(0)}
            onStep={direction => {
              const index = schedule.steps.findIndex(step => step.nodeId === frame?.activeNodeId);
              const next = schedule.steps[Math.min(schedule.steps.length - 1, Math.max(0, index + direction))];
              if (next) selectNode(next.nodeId);
            }}
          />
        </div>

        {inspector ? (
          <WalkthroughInspector
            document={document}
            node={selected}
            tab={inspectorTab}
            status={statusText}
            onTabChange={setInspectorTab}
            onUpdateDocument={patch => setDocument({ ...document, ...patch })}
            onUpdateNode={updateSelected}
            onUpdateGlobals={patch => setDocument({ ...document, settings: { ...document.settings, ...patch } })}
            onConnect={toId => { if (selectedId) apply(connectWalkthroughNodes(document, selectedId, toId).document); }}
            onResetNode={() => { if (selectedId) apply(updateWalkthroughNode(document, selectedId, createWalkthroughNode(selected?.type ?? "show", { id: selectedId })).document); }}
            onExportConfig={exportConfig}
            onImportConfig={importConfig}
          />
        ) : null}
      </div>

      {browserOpen ? (
        <div className="seene-studio-modal" role="dialog" aria-modal="true" aria-label="Add website step">
          <div className="seene-studio-modal-panel">
            <header className="seene-studio-panel-head">
              <h2>Add a step</h2>
              <button type="button" className="seene-control" onClick={() => setBrowserOpen(false)}>Close</button>
            </header>
            <div className="seene-studio-tabs">
              <button type="button" aria-pressed={browserTab === "section"} onClick={() => setBrowserTab("section")}>Sections</button>
              <button type="button" aria-pressed={browserTab === "page"} onClick={() => setBrowserTab("page")}>Pages</button>
              <button type="button" aria-pressed={browserTab === "element"} onClick={() => setBrowserTab("element")}>Interactions</button>
            </div>
            <ul className="seene-studio-browser">
              {browserTab === "section" && project.inspection.sections.map(section => (
                <li key={section.id}>
                  <button type="button" onClick={() => addNode("show", { title: section.label, target: { kind: "section", sectionId: section.id, ...(section.selector ? { selector: section.selector } : {}), label: section.label } })}>
                    <strong>{section.label}</strong><span>show · {section.selector ?? section.id}</span>
                  </button>
                  <button type="button" onClick={() => addNode("scroll", { title: section.label, target: { kind: "section", sectionId: section.id, ...(section.selector ? { selector: section.selector } : {}), label: section.label } })}>
                    <strong>Scroll to {section.label}</strong><span>scroll · {section.selector ?? section.id}</span>
                  </button>
                </li>
              ))}
              {browserTab === "page" && project.inspection.pages.map(page => (
                <li key={page.url}>
                  <button type="button" onClick={() => addNode("navigate", { title: page.title || page.path, target: { kind: "page", url: page.url, label: page.title || page.path } })}>
                    <strong>{page.title || page.path}</strong><span>navigate · {page.url}</span>
                  </button>
                </li>
              ))}
              {browserTab === "element" && project.inspection.interactiveElements.map(element => (
                <li key={`${element.kind}:${element.id}:${element.selector}`}>
                  <button type="button" onClick={() => addNode(element.kind === "link" || element.kind === "button" ? "click" : "focus", { title: element.label, target: { kind: "element", selector: element.selector, label: element.label } })}>
                    <strong>{element.label}</strong><span>{element.kind} · {element.selector}</span>
                  </button>
                  <button type="button" onClick={() => addNode("highlight", { title: element.label, target: { kind: "element", selector: element.selector, label: element.label } })}>
                    <strong>Highlight {element.label}</strong><span>highlight · {element.selector}</span>
                  </button>
                </li>
              ))}
              {((browserTab === "section" && project.inspection.sections.length === 0) ||
                (browserTab === "page" && project.inspection.pages.length === 0) ||
                (browserTab === "element" && project.inspection.interactiveElements.length === 0)) ? (
                <li className="seene-studio-hint">Nothing was discovered in this category. Add a generic step from the sequence toolbar instead.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {confirmRemove ? (
        <div className="seene-studio-modal" role="dialog" aria-modal="true" aria-label="Remove step">
          <div className="seene-studio-modal-panel seene-studio-confirm">
            <h2>Remove “{getWalkthroughNode(document, confirmRemove)?.title}”?</h2>
            <p>This deletes the step. You can undo afterwards.</p>
            <div className="seene-studio-confirm-actions">
              <button type="button" className="seene-control" onClick={() => setConfirmRemove(null)}>Cancel</button>
              <button type="button" className="seene-control seene-danger" onClick={() => { apply(removeWalkthroughNode(document, confirmRemove).document); setConfirmRemove(null); }}>Remove step</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
