import { useEffect, useState, type FormEvent } from "react";
import { defaultDevOrigin, previewUrl, type PlatformStatus } from "../core/platform";
import { createHref, platformApi, presentHref, settingsHref, useStudioBridge, PROJECTS_ROUTE } from "./api";
import { useResource } from "./data";
import { Command, Notice, Panel, StatusPill, fieldClass } from "./ui";
import { SeeneButton } from "./site";

const buttonPrimary = "seene-btn seene-btn-primary seene-btn-nav";
const buttonQuiet = "seene-btn seene-btn-secondary seene-btn-nav";

export function StudioView({ project, initialScene }: { project: string; initialScene?: string }) {
  const catalog = useResource(`catalog:${project}`, () => platformApi.catalog(project));
  const [selected, setSelected] = useState(initialScene ?? "");
  const [origin, setOrigin] = useState("http://127.0.0.1:5173");
  const [status, setStatus] = useState<PlatformStatus>();
  const [statusError, setStatusError] = useState("");
  const [checking, setChecking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [message, setMessage] = useState("");

  const data = catalog.data;
  const scenes = data?.catalog.scenes ?? [];
  const activeScene = scenes.find(scene => scene.id === selected);
  const studioUrl = data ? previewUrl(data.project.adapter, origin, activeScene?.id, activeScene?.applicationRoute) : "";

  useEffect(() => {
    if (data?.project.adapter) {
      setOrigin(defaultDevOrigin(data.project.adapter));
    }
  }, [data?.project.adapter]);

  useEffect(() => {
    if (initialScene) setSelected(initialScene);
  }, [initialScene]);

  const bridge = useStudioBridge(project, !!status?.reachable);
  const isConnected = !!(data?.project.connected && (!status?.reachable || bridge.liveConnected));

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setStatusError("");
    try { setStatus(await platformApi.status(project, origin.trim())); }
    catch (failure) { setStatusError(failure instanceof Error ? failure.message : "The preview could not be checked."); }
    finally { setChecking(false); }
  };

  const removeScene = async (id: string) => {
    setConfirmDelete("");
    setMessage("");
    try {
      await platformApi.removeScene(project, id);
      if (selected === id) setSelected("");
      catalog.reload();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "The scene could not be removed."); }
  };

  const duplicateScene = async (id: string) => {
    setMessage("");
    try {
      const newId = `${id}-copy`;
      await platformApi.duplicateScene(project, id, newId);
      setSelected(newId);
      catalog.reload();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "The scene could not be duplicated."); }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <a className="font-mono text-xs text-[var(--seene-text-muted)] hover:text-[var(--seene-text)]" href={PROJECTS_ROUTE}>← Projects</a>
        <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="seene-h2 text-3xl">{data?.project.name ?? "Studio"}</h1>
          <p className="truncate font-mono text-xs text-[var(--seene-text-muted)]">{project}</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <StatusPill ok={isConnected} label={isConnected ? "Connected" : "Not connected"} />}
          <SeeneButton variant="secondary" size="nav" href={settingsHref(project)}>Settings</SeeneButton>
          {scenes.length > 0 && <SeeneButton variant="primary" size="nav" href={presentHref(project, activeScene?.id ?? scenes[0].id)}>Present</SeeneButton>}
        </div>
        </div>
      </header>

      {catalog.error && <Notice>{catalog.error}</Notice>}
      {catalog.loading && !data && <p className="text-sm text-[var(--seene-text-muted)]">Reading this project's scenes…</p>}
      {message && <Notice>{message}</Notice>}
      {data && !data.project.connected && (
        <Notice tone="info">
          This project is not connected yet. Run <Command>pnpm exec seene init</Command> in {project}, then refresh.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel
          title="Scenes"
          description="Every scene presents real UI from this application."
          actions={
            <div className="flex items-center gap-2">
              <a className={buttonQuiet} href={createHref("walkthrough", project)}>+ Walkthrough</a>
              <a className={buttonPrimary} href={createHref("scene", project)}>+ Scene</a>
            </div>
          }
        >
          {scenes.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--seene-text-muted)]">No scenes yet. Create the first one to present part of your application.</p>
              <div className="flex flex-wrap gap-2">
                <a className={buttonPrimary} href={createHref("scene", project)}>Create a scene</a>
                <a className={buttonQuiet} href={createHref("walkthrough", project)}>Create a walkthrough</a>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {scenes.map((scene, index) => (
                <li
                  key={scene.id}
                  data-scene-id={scene.id}
                  className={`rounded-xl border px-4 py-3 ${selected === scene.id ? "border-[var(--seene-text-muted)] bg-[var(--seene-surface-2)]" : "border-[var(--seene-border)] bg-[var(--seene-surface)]"}`}
                >
                  <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setSelected(scene.id)}>
                    <span className="font-mono text-xs text-[var(--seene-text-muted)]">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-medium text-[var(--seene-text)]">{scene.title}</strong>
                      <span className="block truncate text-xs text-[var(--seene-text-muted)]">{scene.description || "A scene from your application"}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="rounded-sm border border-[var(--seene-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--seene-text-muted)]">
                        {scene.compositionType === "walkthrough" ? "Walkthrough" : "Scene"}
                      </span>
                      <span className="font-mono text-xs text-[var(--seene-text-muted)]">{Math.round(scene.durationMs / 1000)}s</span>
                    </span>
                  </button>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a className={buttonQuiet} href={previewUrl(data?.project.adapter, origin, scene.id, scene.applicationRoute)} target="_blank" rel="noreferrer">Open in app studio</a>
                    <a className={buttonQuiet} href={presentHref(project, scene.id)}>Present</a>
                    <button type="button" className={buttonQuiet} onClick={() => duplicateScene(scene.id)}>Duplicate</button>
                    {confirmDelete === scene.id ? (
                      <>
                        <button type="button" className={buttonQuiet} onClick={() => removeScene(scene.id)}>Confirm delete</button>
                        <button type="button" className={buttonQuiet} onClick={() => setConfirmDelete("")}>Cancel</button>
                      </>
                    ) : (
                      <button type="button" className={buttonQuiet} onClick={() => setConfirmDelete(scene.id)}>Delete</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data && data.catalog.issues.length > 0 && (
            <div className="mt-4 space-y-2">
              {data.catalog.issues.map(issue => <Notice key={`${issue.path}:${issue.message}`}>{`${issue.path}: ${issue.message}`}</Notice>)}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Preview"
            description="Your application renders here from its own development server, with Seene's camera, focus and timeline active."
          >
            <form className="flex flex-col gap-3 sm:flex-row" aria-label="Connect preview" onSubmit={connect}>
              <label className="sr-only" htmlFor="preview-origin">Development server</label>
              <input id="preview-origin" className={fieldClass} value={origin} onChange={event => setOrigin(event.target.value)} placeholder="http://127.0.0.1:5173" />
              <button type="submit" className={buttonPrimary} disabled={checking}>{checking ? "Checking…" : "Connect"}</button>
            </form>
            {statusError && <div className="mt-3"><Notice>{statusError}</Notice></div>}
            {bridge.applicationError && (
              <div className="mt-3">
                <Notice>{`Your application reported an error: ${bridge.applicationError.message}`}</Notice>
              </div>
            )}
            {status && (
              <div className="mt-3 space-y-3">
                <Notice tone={status.reachable ? "info" : "error"}>{status.message}</Notice>
                {status.reachable && <iframe key={studioUrl} title="Application preview" className="h-[520px] w-full rounded-xl border border-[var(--seene-border)] bg-black" src={studioUrl} />}
              </div>
            )}
            <p className="mt-4 text-xs text-[var(--seene-text-muted)]">
              Camera, focus, motion and the timeline are edited live inside your application's own studio. Seene stores each scene as a recipe next to its component.
            </p>
          </Panel>
        </div>
      </div>

    </div>
  );
}

