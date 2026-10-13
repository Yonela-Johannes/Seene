import { useCallback, createElement, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { SCENE_TRANSITION_DURATION } from "../core";

import {
  AUTHORED_PRESENTATION,
  RESOURCES,
  defaultSceneDefinition,
  motionDuration,
  matrixFor,
  TransformSchema,
  type SceneIssue,
} from "../core";
import {
  SCENE_PRESENTATION_HEIGHT,
  SCENE_PRESENTATION_SURFACE,
  SCENE_PRESENTATION_WIDTH,
  SEENE_APPLICATION_QUERY_PARAM,
  SEENE_PROTOCOL_VERSION,
  sanitizeApplicationRoute,
} from "../core/platform";

import { Scene, Surface, SceneErrorBoundary } from "../react";
import { ApplicationPreview, containsDocumentContent, type ApplicationIssue } from "./application";
import { ScenePreview } from "./ScenePreview";
import type { PreviewHot } from "./connection";
import { GettingStarted } from "./GettingStarted";
import { TRANSITION_PRESETS, type TransitionPresetName, type PreviewDefinitionInput } from "../core/preview";

export type SceneLibraryProps = {
  sources?: Record<string, unknown>;
  bindings?: Record<string, ComponentType<{ children?: ReactNode }>>;
  sourceIssues?: SceneIssue[];
  hostContent?: ReactNode;
  hot?: PreviewHot;
  backHref?: string;
  applicationRoute?: string;
  createSceneEndpoint?: string;
  onApplicationIssue?: (issue: ApplicationIssue) => void;
  transition?: TransitionPresetName;
  onTransitionChange?: (value: TransitionPresetName | undefined) => void;
};

const EMPTY_SOURCES: Record<string, unknown> = {};
const EMPTY_BINDINGS: Record<string, ComponentType<{ children?: ReactNode }>> = {};

const ROW_HEIGHT = 150;
const HEADING_HEIGHT = 110;

const camera = {
  perspective: 1800,
  rotateX: -22,
};

const focus = {
  distance: 1400,
  fStop: 4,
  focalLength: 220,
  maxBlur: 7,
};

const view = matrixFor(
  TransformSchema.parse({
    rotateX: camera.rotateX,
  }),
);

const SCENE_QUERY_PARAM = "seene-scene";
const PRESENTATION_QUERY_PARAM = "seene-preset";


function isPreviewQuery(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.searchParams.get("seene-preview") === "1";
}

function getSelectedSceneId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const url = new URL(window.location.href);
  return url.searchParams.get(SCENE_QUERY_PARAM) ?? undefined;
}

function getPresentationId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const url = new URL(window.location.href);
  return url.searchParams.get(PRESENTATION_QUERY_PARAM) ?? undefined;
}

function getVisibleRows(scroll: number, height: number, count: number) {
  const localY = (screenY: number) => {
    const y = screenY - height / 2;

    const denominator = camera.perspective * view[5] + y * view[9];

    if (denominator <= 0) {
      return -Infinity;
    }

    return height / 2 + (y * camera.perspective) / denominator;
  };

  const top = localY(-3 * focus.maxBlur);
  const bottom = localY(height + 3 * focus.maxBlur);

  const firstVisible =
    Math.floor((scroll + top - (height / 2 - ROW_HEIGHT / 2)) / ROW_HEIGHT) - 1;

  const lastVisible =
    Math.ceil((scroll + bottom - (height / 2 - ROW_HEIGHT / 2)) / ROW_HEIGHT) +
    2;

  return {
    start: Math.max(0, firstVisible),
    end: Math.min(count, Math.max(Math.max(0, firstVisible) + 6, lastVisible)),
  };
}

function SceneSnapshot({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover rounded-md opacity-80"
      onError={() => setFailed(true)}
    />
  );
}

export function SceneLibrary({
  sources = EMPTY_SOURCES,
  bindings = EMPTY_BINDINGS,
  sourceIssues = [],
  hostContent,
  hot,
  backHref,
  applicationRoute,
  createSceneEndpoint = "/__seene/create-scene",
  onApplicationIssue,
  transition,
  onTransitionChange,
}: SceneLibraryProps) {
  const [entered, setEntered] = useState(() => {
    if (typeof window === "undefined") return false;
    return getSelectedSceneId() !== undefined || isPreviewQuery() || localStorage.getItem("seene-entered") === "true";
  });
  const [entrySceneId] = useState(getSelectedSceneId);
  const [sceneId, setSceneId] = useState(getSelectedSceneId);
  const [presentation, setPresentation] = useState(getPresentationId);
  const [scroll, setScroll] = useState(0);
  const [size, setSize] = useState({
    width: 1200,
    height: 1000,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createHostPath, setCreateHostPath] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);

  const { width, height } = size;

  const catalog = useMemo(
    () => {
      const resolved = RESOURCES["resolve-recipes"]({
        sources: Object.entries(sources).map(([path, document]) => ({
          path,
          document,
        })),
        bindingPaths: Object.keys(bindings),
        ...(sceneId ? { sceneId } : {}),
      });
      const failedModulePaths = new Set(sourceIssues.map(issue => issue.path));
      return {
        ...resolved,
        issues: [
          ...resolved.issues.filter(issue =>
            !(failedModulePaths.has(issue.path) && issue.message.includes("needs matching component")),
          ),
          ...sourceIssues,
        ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
      };
    },
    [sources, bindings, sourceIssues, sceneId],
  );

  const selectedScene = catalog.selected;

  const SelectedComponent = selectedScene
    ? bindings[selectedScene.binding]
    : undefined;

  const requestedApplicationRoute = sanitizeApplicationRoute(applicationRoute ?? "");

  const applicationRouteFor = useCallback(
    (scene?: { id: string; application?: { route: string } }) => {
      if (!scene) return undefined;
      if (scene.application) return sanitizeApplicationRoute(scene.application.route);
      if (entrySceneId === undefined || entrySceneId === scene.id) return requestedApplicationRoute;
      return undefined;
    },
    [entrySceneId, requestedApplicationRoute],
  );

  const documentRoute = applicationRouteFor(selectedScene);

  const selectedIsDocument = SelectedComponent
    ? containsDocumentContent(createElement(SelectedComponent))
    : false;
  const effectiveRoute = documentRoute ?? (selectedIsDocument ? (requestedApplicationRoute ?? "/") : undefined);

  useEffect(() => {
    const handlePopState = () => {
      setSceneId(getSelectedSceneId());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (selectedScene && (SelectedComponent || documentRoute || selectedIsDocument)) {
      return;
    }

    const element = scrollerRef.current;

    if (!element) {
      return;
    }

    const measure = () => {
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 1000;
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
      setSize({
        width: Math.min(element.clientWidth || viewportWidth, viewportWidth),
        height: Math.min(element.clientHeight || viewportHeight, viewportHeight),
      });
    };

    const observer = new ResizeObserver(measure);

    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();

    element.scrollTop = savedScrollRef.current;

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selectedScene?.id, SelectedComponent, documentRoute]);

  const buildDestination = useCallback((id?: string, nextPresentation?: string) => {
    const url = new URL(window.location.href);

    if (id) {
      url.searchParams.set(SCENE_QUERY_PARAM, id);
    } else {
      url.searchParams.delete(SCENE_QUERY_PARAM);
    }

    const route = id ? applicationRouteFor(catalog.scenes.find(scene => scene.id === id)) : undefined;
    if (route) {
      url.searchParams.set(SEENE_APPLICATION_QUERY_PARAM, route);
    } else {
      url.searchParams.delete(SEENE_APPLICATION_QUERY_PARAM);
    }

    const chosen = nextPresentation ?? presentation;
    if (chosen) {
      url.searchParams.set(PRESENTATION_QUERY_PARAM, chosen);
    } else {
      url.searchParams.delete(PRESENTATION_QUERY_PARAM);
    }

    return url.pathname + url.search + url.hash;
  }, [presentation, applicationRouteFor, catalog.scenes]);

  const navigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, id?: string) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();

      const destination = buildDestination(id);

      window.history.pushState({}, "", destination);
      setSceneId(id);
    },
    [buildDestination],
  );

  const closeScene = useCallback(() => {
    const destination = buildDestination();

    window.history.pushState({}, "", destination);
    setSceneId(undefined);
  }, [buildDestination]);

  const changePresentation = useCallback(
    (next: string) => {
      const chosen = next === AUTHORED_PRESENTATION ? undefined : next;
      window.history.pushState({}, "", buildDestination(sceneId, chosen));
      setPresentation(chosen);
    },
    [buildDestination, sceneId],
  );

  const openCreateDialog = () => {
    setCreateTitle("");
    setCreateDescription("");
    setCreateHostPath("");
    setCreateError("");
    setCreateSubmitting(false);
    setIsCreating(true);
  };

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!createTitle.trim()) return;

    setCreateSubmitting(true);
    setCreateError("");

    const title = createTitle.trim();
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `scene-${Date.now()}`;

    const recipe = {
      version: 1,
      id,
      title,
      description: createDescription.trim() || "Authored in Seene Studio",
      definition: defaultSceneDefinition(),
    };

    const isIframe = typeof window !== "undefined" && window.parent !== window;

    if (isIframe) {
      try {
        window.parent.postMessage({
          type: "SEENE_CLIENT_CREATE_SCENE",
          version: SEENE_PROTOCOL_VERSION,
          draft: { id, title, description: createDescription.trim() || "Authored in Seene Studio" }
        }, "*");
        setIsCreating(false);
        const destination = buildDestination(id);
        window.history.pushState({}, "", destination);
        setSceneId(id);
        return;
      } catch (err: any) {
        setCreateError("Failed to request scene creation via Studio: " + (err?.message || String(err)));
        setCreateSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch(createSceneEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, recipe, hostPath: createHostPath.trim() || undefined })
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setCreateError(`Seene's scene-creation endpoint at ${createSceneEndpoint} returned HTML instead of JSON. Re-run seene init to generate or repair the local API route. For a custom Vite renderer, add seeneCreateScenePlugin() from @thatg33k/seene/vite.`);
        setCreateSubmitting(false);
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setIsCreating(false);
        const destination = buildDestination(id);
        window.history.pushState({}, "", destination);
        setSceneId(id);
      } else {
        setCreateError(data.error || "Failed to create scene.");
        setCreateSubmitting(false);
      }
    } catch (err: any) {
      setCreateError("Failed to communicate with local development server: " + (err.message || String(err)));
      setCreateSubmitting(false);
    }
  };

   const saveSceneDefinition = useCallback((definition: PreviewDefinitionInput) => {
    if (!createSceneEndpoint || !selectedScene) return;
    void fetch(createSceneEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedScene.id, recipe: { definition: { backdrop: definition.backdrop ?? "site" } } }),
    }).then((res) => {
      void res;
    });
  }, [createSceneEndpoint, selectedScene]);

   if (!entered) {
    return (
      <GettingStarted
        onStartCreating={() => {
          setEntered(true);
          try {
            localStorage.setItem("seene-entered", "true");
          } catch {}
        }}
      />
    );
  }

  if (selectedScene && (effectiveRoute || SelectedComponent)) {
    return (
      <ScenePreview
        definition={selectedScene.definition}
        title={selectedScene.title}
        backHref={buildDestination()}
        onBack={closeScene}
        hot={hot}
        presentation={presentation}
         onPresentationChange={changePresentation}
         transition={transition}
         onTransitionChange={onTransitionChange}
         onSaveDefinition={saveSceneDefinition}
       >
        {effectiveRoute ? (
          <Surface
            id={SCENE_PRESENTATION_SURFACE}
            style={{
              width: SCENE_PRESENTATION_WIDTH,
              height: SCENE_PRESENTATION_HEIGHT,
            }}
          >
            <ApplicationPreview
              route={effectiveRoute}
              title={selectedScene.title}
              onIssue={onApplicationIssue}
            />
          </Surface>
        ) : SelectedComponent ? (
          <SelectedComponent />
        ) : null}
      </ScenePreview>
    );
  }

  const requestedRecipePath = sceneId
    ? Object.keys(sources).find(p => p.endsWith(`/${sceneId}.scene.json`))
    : undefined;

  if (sceneId && !selectedScene && !requestedRecipePath) {
    return (
      <main data-seene-library="" className="fixed inset-0 isolate overflow-hidden bg-[var(--seene-bg)] text-[var(--seene-text)]">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-50 bg-[var(--seene-bg)]" role="alert">
          <div className="max-w-md space-y-4 rounded-2xl border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] p-6 shadow-2xl">
            <h1 className="text-xl font-semibold text-[var(--seene-text)]">Scene not found</h1>
            <p className="text-xs text-[var(--seene-text-muted)] font-mono">
              The requested scene slug &quot;<span className="text-white">{sceneId}</span>&quot; could not be found.
            </p>
            {catalog.scenes.length > 0 ? (
              <div className="pt-2 text-left space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--seene-text-muted)] block">
                  Available scenes ({catalog.scenes.length}):
                </span>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {catalog.scenes.map(s => (
                    <a
                      key={s.id}
                      href={buildDestination(s.id)}
                      onClick={(event) => navigate(event, s.id)}
                      className="rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-3 py-1.5 text-xs text-[var(--seene-text)] hover:text-white hover:border-white transition-colors"
                    >
                      {s.title} <span className="font-mono opacity-60">({s.id})</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--seene-text-muted)]">No valid scenes are currently available in this project.</p>
            )}
            <div className="pt-3">
              <a
                href={buildDestination()}
                onClick={(event) => navigate(event)}
                className="inline-block rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                Go back to all scenes
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (sceneId && (requestedRecipePath || selectedScene) && (!SelectedComponent || !effectiveRoute)) {
    const brokenIssue = catalog.issues.find(issue => (selectedScene && issue.path.includes(selectedScene.binding)) || issue.path.includes(sceneId));
    const bindingPath = selectedScene?.binding || brokenIssue?.path || `src/seene/scenes/${sceneId}.tsx`;
    const brokenReason = brokenIssue?.message || "Component module evaluation failed or component binding is missing.";
    return (
      <main data-seene-library="" className="fixed inset-0 isolate overflow-hidden bg-[var(--seene-bg)] text-[var(--seene-text)]">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-50 bg-[var(--seene-bg)]" role="alert">
          <div className="max-w-md space-y-4 rounded-2xl border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] p-6 shadow-2xl">
            <h1 className="text-xl font-semibold text-[var(--seene-text)]">Scene cannot be opened</h1>
            <p className="text-xs text-[var(--seene-text-muted)] font-mono">
              File: <span className="text-white">{bindingPath}</span>
            </p>
            <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded-lg border border-red-900/50 font-mono text-left">
              {brokenReason}
            </p>
            <div className="pt-3">
              <a
                href={buildDestination()}
                onClick={(event) => navigate(event)}
                className="inline-block rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                Back to all scenes
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const planeWidth = Math.min(940, Math.max(320, width - 64));

  const { start, end } = getVisibleRows(scroll, height, catalog.scenes.length);

  const contentHeight =
    height + Math.max(0, (catalog.scenes.length - 1) * ROW_HEIGHT);

  return (
    <main data-seene-library="" className="fixed inset-0 isolate overflow-hidden bg-[var(--seene-bg)] text-[var(--seene-text)]">
      {catalog.issues.length > 0 && (
        <details className="absolute top-16 left-1/2 z-50 -translate-x-1/2 max-w-lg rounded-xl border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] p-4 text-xs text-[var(--seene-text-muted)]">
          <summary className="cursor-pointer font-medium text-[var(--seene-text)]">
            Some scene files have problems ({catalog.issues.length})
          </summary>

          <ul className="mt-2 space-y-1 pl-4 list-disc">
            {catalog.issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                <strong className="text-[var(--seene-text)]">{issue.path}</strong>
                {": "}
                {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {catalog.scenes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-4">
              <h1 className="text-3xl font-medium tracking-tight text-[var(--seene-text)]">Your scenes will show up here.</h1>
            <p className="text-sm text-[var(--seene-text-muted)]">Create your first cinematic scene to showcase your React components.</p>
            <button
              type="button"
              onClick={openCreateDialog}
                className="mt-4 appearance-none border border-[var(--seene-border-text)] rounded-full px-6 py-3 bg-[var(--seene-surface)] text-[var(--seene-text)] text-xs font-medium inline-flex items-center gap-2 cursor-pointer hover:bg-[var(--seene-surface-2)] transition-colors pointer-events-auto"
            >
              + Create scene
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden outline-none focus:outline-none"
          role="region"
          aria-label="Scene library"
          tabIndex={0}
          onScroll={(event) => {
            const nextScroll = event.currentTarget.scrollTop;

            savedScrollRef.current = nextScroll;
            setScroll(nextScroll);
          }}
        >
          <div
            style={{
              height: contentHeight,
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <SceneErrorBoundary>
                <Scene
                  camera={camera}
                  focus={focus}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <Surface
                    id="scene-list"
                    transform={{ y: -scroll }}
                    style={{
                      position: "absolute",
                      left: (width - planeWidth) / 2,
                      top: height / 2 - HEADING_HEIGHT,
                      width: planeWidth,
                      height: contentHeight,
                    }}
                  >
                    <Surface
                      id="scene-list-heading"
                      style={{
                        position: "absolute",
                        top: 0,
                        width: planeWidth,
                        height: HEADING_HEIGHT,
                      }}
                    >
                      <header className="flex items-center justify-between border-b border-[var(--seene-border-text)] pb-4 pointer-events-auto">
                        <div className="flex items-center gap-4">
                          <h1 className="text-sm font-semibold tracking-wider text-[var(--seene-text-muted)] uppercase">
                            Your scenes
                          </h1>
                          <button
                            type="button"
                            onClick={openCreateDialog}
                            className="appearance-none border border-white/20 rounded-full px-3 py-1.5 bg-[var(--seene-surface-2)] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer bg-[var(--seene-surface-2)] transition-colors"
                          >
                            + Create scene
                          </button>
                        </div>

                        <span className="text-xs font-mono text-[var(--seene-text-muted)]">
                          {catalog.scenes.length}{" "}
                          {catalog.scenes.length === 1 ? "scene" : "scenes"}
                        </span>
                      </header>
                    </Surface>

                    {catalog.scenes.slice(start, end).map((scene, index) => {
                      const number = start + index;
                      const duration = Math.round(
                        (scene.definition.motion
                          ? motionDuration(scene.definition.motion)
                          : 0) / 1000,
                      );

                      return (
                        <Surface
                          key={scene.id}
                          id={`scene-row-${scene.id}`}
                          style={{
                            position: "absolute",
                            top: HEADING_HEIGHT + number * ROW_HEIGHT,
                            width: planeWidth,
                            height: ROW_HEIGHT,
                          }}
                        >
                          <a
                            className="group flex items-center justify-between gap-6 border-b border-[var(--seene-border)] py-6 transition-colors hover:border-[var(--seene-border-text)] focus-visible:outline-2 focus-visible:outline-white"
                            data-scene-id={scene.id}
                            href={buildDestination(scene.id)}
                            onFocus={(event) => {
                              if (
                                event.currentTarget.matches(":focus-visible")
                              ) {
                                scrollerRef.current?.scrollTo({
                                  top: Math.max(0, number * ROW_HEIGHT),
                                  behavior: "smooth",
                                });
                              }
                            }}
                            onClick={(event) => navigate(event, scene.id)}
                          >
                            <span className="relative flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-[var(--seene-surface-2)] border border-[var(--seene-border-text)] font-mono text-xs text-[var(--seene-text-muted)]">
                              {String(number + 1).padStart(2, "0")}

                              {scene.snapshot && (
                                <SceneSnapshot key={scene.snapshot.image} src={scene.snapshot.image} />
                              )}
                            </span>

                            <span className="flex flex-1 flex-col min-w-0">
                              <strong className="text-base font-medium text-[var(--seene-text)] group-hover:text-white truncate">
                                {scene.title}
                              </strong>

                              <span className="text-xs text-[var(--seene-text-muted)] truncate mt-0.5">
                                {scene.description || "A scene from your app"}
                              </span>
                            </span>

                            <span className="flex items-center gap-2 font-mono text-xs text-[var(--seene-text-muted)] group-hover:text-[var(--seene-text)]">
                              {duration}s<span aria-hidden="true">↗</span>
                            </span>
                          </a>
                        </Surface>
                      );
                    })}
                  </Surface>
                </Scene>
              </SceneErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {catalog.scenes.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-40">
          <p className="rounded-full border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)]/90 px-4 py-2 font-mono text-[11px] text-[var(--seene-text-muted)] shadow-md backdrop-blur-md">
            Scroll to browse · Click a scene to play
          </p>
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
          <section role="dialog" aria-modal="true" aria-labelledby="seene-create-title-heading" aria-describedby="seene-create-description" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] p-6 text-[var(--seene-text)] shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--seene-border-text)] pb-4">
              <div className="min-w-0">
                <h2 id="seene-create-title-heading" className="text-lg font-semibold text-[var(--seene-text)]">Create new scene</h2>
                <p id="seene-create-description" className="mt-1 text-xs leading-relaxed text-[var(--seene-text-muted)]">Name your scene. Seene will generate the recipe and component files in your project.</p>
              </div>
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setCreateError(""); }}
                  className="text-[var(--seene-text-muted)] hover:text-[var(--seene-text)] text-sm p-1 cursor-pointer"
                  aria-label="Close"
                >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label htmlFor="seene-create-title" className="block text-xs font-medium text-[var(--seene-text-muted)] uppercase tracking-wider mb-2">
                  Scene Title
                </label>
                <input
                  id="seene-create-title"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Dashboard Showcase"
                   value={createTitle}
                   onChange={(e) => setCreateTitle(e.target.value)}
                   className="w-full rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-4 py-2.5 text-sm text-[var(--seene-text)] placeholder-[var(--seene-text-muted)] focus:border-[var(--seene-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="seene-create-desc" className="block text-xs font-medium text-[var(--seene-text-muted)] uppercase tracking-wider mb-2">
                  Description <span className="text-[var(--seene-text-muted)] font-normal">(optional)</span>
                </label>
                <input
                  id="seene-create-desc"
                  type="text"
                  placeholder="e.g. A cinematic overview of the analytics panel"
                   value={createDescription}
                   onChange={(e) => setCreateDescription(e.target.value)}
                   className="w-full rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-4 py-2.5 text-sm text-[var(--seene-text)] placeholder-[var(--seene-text-muted)] focus:border-[var(--seene-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="seene-create-host" className="block text-xs font-medium text-[var(--seene-text-muted)] uppercase tracking-wider mb-2">
                  Component to present <span className="text-[var(--seene-text-muted)] font-normal">(optional)</span>
                </label>
                <input
                  id="seene-create-host"
                  type="text"
                  placeholder="e.g. src/components/Hero.tsx"
                  value={createHostPath}
                  onChange={(e) => setCreateHostPath(e.target.value)}
                  className="w-full rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-4 py-2.5 text-sm text-[var(--seene-text)] placeholder-[var(--seene-text-muted)] focus:border-[var(--seene-accent)] focus:outline-none"
                />
              </div>

              {createError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400" role="alert">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setCreateError(""); }}
                   className="rounded-lg border border-[var(--seene-border-text)] px-4 py-2 text-xs font-medium text-[var(--seene-text-muted)] hover:border-[var(--seene-accent)] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting || !createTitle.trim()}
                   className="rounded-lg bg-[var(--seene-accent)] px-5 py-2 text-xs font-medium text-white hover:bg-[var(--seene-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {createSubmitting ? "Creating..." : "Create scene"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
