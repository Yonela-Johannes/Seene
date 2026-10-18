import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SCENE_PRESENTATION_HEIGHT, SCENE_PRESENTATION_WIDTH, sceneIdFromTitle,
  type PlatformContentFile, type PlatformProject, type PlatformSource,
} from "../core/platform";
import type { ContentResponse } from "./api";
import { PROJECTS_ROUTE, platformApi, studioHref, type CompositionKind } from "./api";
import { useDebounced, useResource } from "./data";
import { DirectoryPicker } from "./DirectoryPicker";
import { Notice, Panel, buttonPrimary, buttonQuiet, fieldClass } from "./ui";
import { SearchIcon, SeeneButton } from "./site";

type Selection = { file: string; export?: string; title: string };
type Filter = "all" | "page" | "section" | "component";
type SourceChoice = Pick<PlatformSource, "path" | "name" | "connected" | "sceneCount" | "registered"> & {
  adapter?: PlatformSource["adapter"];
};

const selectionKey = (selection: Selection): string => (selection.export ? `${selection.file}#${selection.export}` : selection.file);

function titleFor(file: PlatformContentFile, exported?: string): string {
  if (exported && exported !== "default") return exported.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return file.title ?? file.path.split("/").pop()?.replace(/\.[jt]sx?$/, "") ?? file.path;
}

function sourceFromProject(project: PlatformProject): SourceChoice {
  return {
    path: project.path, name: project.name, connected: project.connected,
    sceneCount: project.sceneCount, registered: true, ...(project.adapter ? { adapter: project.adapter } : {}),
  };
}

function sourceFromInspect(source: PlatformSource): SourceChoice {
  return {
    path: source.path, name: source.name, connected: source.connected,
    sceneCount: source.sceneCount, registered: source.registered, ...(source.adapter ? { adapter: source.adapter } : {}),
  };
}

const KIND_COPY: Record<CompositionKind, { title: string; body: string; icon: ReactNode }> = {
  scene: {
    title: "Scene",
    body: "One cinematic composition: a component or a group of sections with a camera, focus and motion timeline.",
    icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 4l-2 5M15 4l-2 5" /></>,
  },
  walkthrough: {
    title: "Walkthrough",
    body: "A connected sequence of components, pages, scrolls and interactions that plays as one continuous video.",
    icon: <><path d="M4 5h16M4 12h16M4 19h9" /><circle cx="19" cy="19" r="2" /></>,
  },
};

export function CreateView({ initialKind, initialProject }: { initialKind?: CompositionKind; initialProject?: string }) {
  const projects = useResource("projects", () => platformApi.projects());
  const [kind, setKind] = useState<CompositionKind | undefined>(initialKind);
  const [source, setSource] = useState<SourceChoice | undefined>(undefined);
  const [step, setStep] = useState<number>(initialKind ? (initialProject ? 3 : 2) : 1);
  const [picking, setPicking] = useState(false);

  // Manual source entry
  const [manualPath, setManualPath] = useState(initialProject ?? "");
  const [inspecting, setInspecting] = useState(false);
  const [inspected, setInspected] = useState<PlatformSource | undefined>(undefined);
  const [inspectError, setInspectError] = useState("");
  const [registering, setRegistering] = useState(false);

  // Targets
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 200);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Selection[]>([]);

  // Configure
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [id, setId] = useState("");
  const [width, setWidth] = useState(SCENE_PRESENTATION_WIDTH);
  const [height, setHeight] = useState(SCENE_PRESENTATION_HEIGHT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Adopt a kind passed through the URL, even when the route changes without remounting the view.
  useEffect(() => {
    if (!initialKind) return;
    setKind(initialKind);
    setStep(previous => (previous === 1 ? (initialProject ? 3 : 2) : previous));
  }, [initialKind, initialProject]);

  // Adopt a project passed through the URL once the registry has loaded.
  useEffect(() => {
    if (source || !initialProject || !projects.data) return;
    const match = projects.data.projects.find(project => project.path === initialProject);
    if (match) setSource(sourceFromProject(match));
  }, [projects.data, initialProject, source]);

  const content = useResource<Pick<ContentResponse, "content">>(
    `content:${source?.path ?? ""}:${filter}:${debouncedQuery}`,
    () => (source
      ? platformApi.content(source.path, { query: debouncedQuery, ...(filter === "all" ? {} : { kinds: [filter] }) })
      : Promise.resolve({ content: { files: [] } })),
  );

  const files = content.data?.content.files ?? [];
  const grouped = useMemo(() => {
    const order: Filter[] = ["page", "section", "component"];
    return order
      .map(group => [group, files.filter(file => file.kind === group)] as const)
      .filter(([, list]) => list.length > 0);
  }, [files]);

  const effectiveStep = !kind ? 1 : !source ? 2 : step;
  const canContinueTargets = selected.length > 0;

  useEffect(() => {
    if (effectiveStep !== 4 || title.trim()) return;
    const first = selected[0];
    if (!first) return;
    setTitle(first.title);
    setId(sceneIdFromTitle(first.title));
  }, [effectiveStep, selected, title]);

  const inspect = async (path: string) => {
    if (!path.trim()) return;
    setInspecting(true);
    setInspectError("");
    setInspected(undefined);
    try {
      const result = await platformApi.inspectSource(path.trim());
      setInspected(result.source);
    } catch (failure) {
      setInspectError(failure instanceof Error ? failure.message : "That folder could not be read.");
    } finally {
      setInspecting(false);
    }
  };

  const registerAndUse = async (path: string) => {
    setRegistering(true);
    setInspectError("");
    try {
      await platformApi.addProject(path);
      projects.reload();
      setSource({ path, name: path.split("/").pop() ?? path, connected: false, sceneCount: 0, registered: true });
      setStep(3);
    } catch (failure) {
      setInspectError(failure instanceof Error ? failure.message : "This project could not be registered.");
    } finally {
      setRegistering(false);
    }
  };

  const chooseRegistered = (project: PlatformProject) => {
    setSource(sourceFromProject(project));
    setStep(3);
  };

  const toggle = (selection: Selection) => {
    setSelected(previous => previous.some(item => selectionKey(item) === selectionKey(selection))
      ? previous.filter(item => selectionKey(item) !== selectionKey(selection))
      : [...previous, selection]);
  };

  const move = (index: number, delta: number) => {
    setSelected(previous => {
      const next = [...previous];
      const target = index + delta;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const create = async () => {
    if (!source || !kind) return;
    const finalTitle = title.trim() || KIND_COPY[kind].title;
    const finalId = id.trim() || sceneIdFromTitle(finalTitle);
    setCreating(true);
    setCreateError("");
    try {
      const result = await platformApi.createScene({
        path: source.path,
        id: finalId,
        title: finalTitle,
        ...(description.trim() ? { description: description.trim() } : {}),
        compositionType: kind,
        sections: selected.map(item => ({ file: item.file, ...(item.export ? { export: item.export } : {}) })),
        ...(kind === "scene" ? { width, height } : {}),
      });
      window.location.hash = studioHref(source.path, result.scene.id);
    } catch (failure) {
      setCreateError(failure instanceof Error ? failure.message : "The scene could not be created.");
      setCreating(false);
    }
  };

  const steps: Array<{ index: number; label: string }> = [
    { index: 1, label: "What to create" },
    { index: 2, label: "Source application" },
    { index: 3, label: "Choose targets" },
    { index: 4, label: "Configure" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <a className="font-mono text-xs text-[var(--seene-text-muted)] hover:text-[var(--seene-text)]" href={PROJECTS_ROUTE}>← Projects</a>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="seene-h2 text-3xl text-left">{kind ? `New ${KIND_COPY[kind].title.toLowerCase()}` : "Create"}</h1>
            <p className="text-sm text-[var(--seene-text-muted)]">
              Pick what to create, choose the application Seene should read, then select the exact components to present.
            </p>
          </div>
          {source && (
            <div className="rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] px-4 py-2">
              <p className="text-xs uppercase tracking-wide text-[var(--seene-text-muted)]">Source</p>
              <p className="text-sm font-medium text-[var(--seene-text)]">{source.name}</p>
              <p className="truncate font-mono text-xs text-[var(--seene-text-muted)]">{source.path}</p>
            </div>
          )}
        </div>
      </header>

      <ol className="flex flex-wrap items-center gap-2" aria-label="Creation steps">
        {steps.map(item => {
          const state = effectiveStep === item.index ? "current" : effectiveStep > item.index ? "done" : "upcoming";
          return (
            <li key={item.index} aria-current={state === "current" ? "step" : undefined}>
              <button
                type="button"
                className={`seene-btn seene-btn-nav ${state === "current" ? "seene-btn-primary" : state === "done" ? "seene-btn-secondary" : "seene-btn-ghost"}`}
                disabled={item.index > 1 && (!kind || (item.index > 2 && !source))}
                onClick={() => setStep(item.index)}
              >
                <span className="font-mono text-xs">{state === "done" ? "✓" : item.index}</span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ol>

      {effectiveStep === 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(KIND_COPY) as CompositionKind[]).map(option => (
            <button
              key={option}
              type="button"
              aria-label={KIND_COPY[option].title}
              aria-pressed={kind === option}
              className={`rounded-md border p-6 text-left transition ${kind === option ? "border-[var(--seene-accent)] bg-[var(--seene-accent-soft)]" : "border-[var(--seene-border)] bg-[var(--seene-surface)] hover:border-[var(--seene-text-muted)]"}`}
              onClick={() => { setKind(option); setStep(2); }}
            >
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface-2)] text-[var(--seene-accent)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{KIND_COPY[option].icon}</svg>
              </span>
              <strong className="mt-3 block text-lg font-semibold text-[var(--seene-text)]">{KIND_COPY[option].title}</strong>
              <span className="mt-1 block text-sm text-[var(--seene-text-muted)]">{KIND_COPY[option].body}</span>
            </button>
          ))}
        </div>
      )}

      {effectiveStep === 2 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Your projects" description="Applications already registered with Seene.">
            {projects.loading && !projects.data && <p className="text-sm text-[var(--seene-text-muted)]">Reading projects…</p>}
            {projects.error && <Notice>{projects.error}</Notice>}
            {projects.data && projects.data.projects.length === 0 && (
              <p className="text-sm text-[var(--seene-text-muted)]">No projects registered yet. Add a folder on the right.</p>
            )}
            <ul className="space-y-2">
              {projects.data?.projects.map(project => (
                <li key={project.path}>
                  <button
                    type="button"
                    className={`w-full rounded-xl border px-4 py-3 text-left ${source?.path === project.path ? "border-[var(--seene-accent)] bg-[var(--seene-accent-soft)]" : "border-[var(--seene-border)] bg-[var(--seene-surface)] hover:border-[var(--seene-text-muted)]"}`}
                    onClick={() => chooseRegistered(project)}
                  >
                    <strong className="block text-sm font-medium text-[var(--seene-text)]">{project.name}</strong>
                    <span className="block truncate font-mono text-xs text-[var(--seene-text-muted)]">{project.path}</span>
                    <span className="mt-1 block text-xs text-[var(--seene-text-muted)]">
                      {project.connected ? "Connected" : "Not connected"} · {project.sceneCount} scene{project.sceneCount === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Another folder" description="Point Seene at a React application that is not registered yet.">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void inspect(manualPath); }}>
              <label className="sr-only" htmlFor="create-path">Project folder path</label>
              <input
                id="create-path"
                className={fieldClass}
                value={manualPath}
                onChange={event => setManualPath(event.target.value)}
                placeholder="/home/you/projects/my-app"
                spellCheck={false}
                autoComplete="off"
              />
              <button type="submit" className={buttonQuiet} disabled={inspecting || !manualPath.trim()}>
                {inspecting ? "Checking…" : "Check folder"}
              </button>
              <button type="button" className={buttonQuiet} onClick={() => setPicking(true)}>Browse…</button>
            </form>
            {inspectError && <div className="mt-3"><Notice>{inspectError}</Notice></div>}
            {inspected && (
              <div className="mt-4 space-y-3 rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface-2)] p-4">
                <p className="text-sm text-[var(--seene-text)]">
                  <strong>{inspected.name}</strong> {inspected.react ? "depends on React" : "does not depend on React"}
                  {inspected.connected ? " and is connected to Seene." : "."}
                </p>
                <p className="font-mono text-xs text-[var(--seene-text-muted)]">{inspected.path}</p>
                {inspected.issue && <Notice tone="info">{inspected.issue}</Notice>}
                <div className="flex flex-wrap gap-2">
                  {inspected.react && inspected.registered && (
                    <button type="button" className={buttonPrimary} onClick={() => { setSource(sourceFromInspect(inspected)); setStep(3); }}>
                      Continue with this folder
                    </button>
                  )}
                  {inspected.react && !inspected.registered && (
                    <button type="button" className={buttonPrimary} disabled={registering} onClick={() => void registerAndUse(inspected.path)}>
                      {registering ? "Registering…" : "Register and continue"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {effectiveStep === 3 && source && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel
            title="Available content"
            description="Discovered from the project's real routes, sections and components."
            actions={<SeeneButton variant="secondary" size="nav" onClick={() => content.reload()}>Refresh</SeeneButton>}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-sm border border-[var(--seene-border)] bg-[var(--seene-surface)] px-3 py-1.5">
                <SearchIcon />
                <input
                  aria-label="Search components"
                  className="w-48 bg-transparent text-sm text-[var(--seene-text)] outline-none placeholder:text-[var(--seene-text-muted)]"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search components…"
                />
              </span>
              {(["all", "page", "section", "component"] as Filter[]).map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  className={filter === value ? "seene-btn seene-btn-primary seene-btn-nav" : "seene-btn seene-btn-ghost seene-btn-nav"}
                  onClick={() => setFilter(value)}
                >
                  {value === "all" ? "All" : `${value}s`}
                </button>
              ))}
            </div>

            {content.loading && <p className="text-sm text-[var(--seene-text-muted)]">Scanning {source.name}…</p>}
            {content.error && <Notice>{content.error}</Notice>}
            {!content.loading && files.length === 0 && (
              <p className="text-sm text-[var(--seene-text-muted)]">
                {query ? `No components match “${query}”.` : "No components were found. Make sure the project has a src, app, pages or components folder."}
              </p>
            )}

            <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
              {grouped.map(([group, list]) => (
                <div key={group}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--seene-text-muted)]">{group}s</p>
                  <ul className="space-y-1">
                    {list.flatMap(file => {
                      const route = file.route;
                      const rows: Array<{ selection: Selection; label: string; sub: string; disabled?: boolean; issue?: string; route?: string }> = [];
                      if (file.previewable === false) {
                        rows.push({ selection: { file: file.path, title: titleFor(file) }, label: titleFor(file), sub: file.path, disabled: true, ...(file.issue ? { issue: file.issue } : {}), ...(route ? { route } : {}) });
                      } else {
                        if (file.default) rows.push({ selection: { file: file.path, title: titleFor(file) }, label: titleFor(file), sub: file.path, ...(route ? { route } : {}) });
                        if (!file.default) {
                          for (const exported of file.exports) {
                            rows.push({ selection: { file: file.path, export: exported, title: titleFor(file, exported) }, label: titleFor(file, exported), sub: `${file.path} · ${exported}`, ...(route ? { route } : {}) });
                          }
                        }
                      }
                      return rows;
                    }).map(row => {
                      const key = selectionKey(row.selection);
                      const active = selected.some(item => selectionKey(item) === key);
                      return (
                        <li key={key}>
                          <label className={`flex cursor-pointer items-start gap-3 rounded-sm border px-3 py-2 ${row.disabled ? "cursor-not-allowed opacity-60" : active ? "border-[var(--seene-accent)] bg-[var(--seene-accent-soft)]" : "border-transparent hover:bg-[var(--seene-surface-2)]"}`}>
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={active}
                              disabled={row.disabled}
                              onChange={() => toggle(row.selection)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-[var(--seene-text)]">{row.label}</span>
                              <span className="block truncate font-mono text-xs text-[var(--seene-text-muted)]">{row.sub}</span>
                              {row.issue && <span className="mt-0.5 block text-xs text-[var(--seene-text-muted)]">{row.issue}</span>}
                            </span>
                            {row.route && <span className="shrink-0 rounded-sm border border-[var(--seene-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--seene-text-muted)]">{row.route}</span>}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title={kind === "walkthrough" ? "Sequence" : "Selection"}
            description={kind === "walkthrough" ? "Ordered top to bottom. This becomes the playback order." : "The content this scene presents."}
          >
            {selected.length === 0 ? (
              <p className="text-sm text-[var(--seene-text-muted)]">Nothing selected yet. Choose components on the left.</p>
            ) : (
              <ol className="space-y-2">
                {selected.map((item, index) => (
                  <li key={selectionKey(item)} className="flex items-center gap-2 rounded-sm border border-[var(--seene-border)] bg-[var(--seene-surface)] px-3 py-2">
                    <span className="font-mono text-xs text-[var(--seene-text-muted)]">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--seene-text)]">{item.title}</span>
                      <span className="block truncate font-mono text-xs text-[var(--seene-text-muted)]">{item.export ? `${item.file} · ${item.export}` : item.file}</span>
                    </span>
                    {kind === "walkthrough" && (
                      <>
                        <button type="button" className={buttonQuiet} aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                        <button type="button" className={buttonQuiet} aria-label={`Move ${item.title} down`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button>
                      </>
                    )}
                    <button type="button" className={buttonQuiet} aria-label={`Remove ${item.title}`} onClick={() => toggle(item)}>Remove</button>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      {effectiveStep === 4 && source && kind && (
        <Panel title="Configure" description={`Name this ${kind}, then create it and open it in the editor.`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-[var(--seene-text-muted)]">Title</span>
              <input className={fieldClass} value={title} onChange={event => { setTitle(event.target.value); setId(sceneIdFromTitle(event.target.value)); }} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--seene-text-muted)]">{kind === "scene" ? "Scene id" : "Walkthrough id"}</span>
              <input className={fieldClass} value={id} onChange={event => setId(event.target.value)} spellCheck={false} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-[var(--seene-text-muted)]">Description (optional)</span>
              <input className={fieldClass} value={description} onChange={event => setDescription(event.target.value)} placeholder={`A ${kind} from ${source.name}`} />
            </label>
            {kind === "scene" && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="text-[var(--seene-text-muted)]">Width</span>
                  <input type="number" min={320} className={fieldClass} value={width} onChange={event => setWidth(Number(event.target.value) || SCENE_PRESENTATION_WIDTH)} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-[var(--seene-text-muted)]">Height</span>
                  <input type="number" min={240} className={fieldClass} value={height} onChange={event => setHeight(Number(event.target.value) || SCENE_PRESENTATION_HEIGHT)} />
                </label>
              </>
            )}
          </div>

          <div className="mt-5 rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--seene-text-muted)]">{selected.length} target{selected.length === 1 ? "" : "s"}</p>
            <p className="mt-1 text-sm text-[var(--seene-text-muted)]">
              {selected.map(item => item.title).join(" → ")}
            </p>
          </div>

          {createError && <div className="mt-4"><Notice>{createError}</Notice></div>}
          <div className="mt-5 flex items-center gap-2">
            <button type="button" className={buttonPrimary} disabled={creating || !title.trim()} onClick={() => void create()}>
              {creating ? "Creating…" : `Create ${KIND_COPY[kind].title.toLowerCase()}`}
            </button>
          </div>
        </Panel>
      )}

      {effectiveStep > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" className={buttonQuiet} onClick={() => setStep(effectiveStep - 1)}>← Back</button>
          {effectiveStep < 4 && (
            <button
              type="button"
              className={buttonPrimary}
              disabled={(effectiveStep === 2 && !source) || (effectiveStep === 3 && !canContinueTargets)}
              onClick={() => setStep(effectiveStep + 1)}
            >
              Continue
            </button>
          )}
        </div>
      )}

      {picking && (
        <DirectoryPicker
          initialPath={manualPath || undefined}
          onClose={() => setPicking(false)}
          onSelect={path => { setPicking(false); setManualPath(path); void inspect(path); }}
        />
      )}
    </div>
  );
}
