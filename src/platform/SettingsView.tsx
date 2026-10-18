import { useState } from "react";
import type { PlatformSource } from "../core/platform";
import { createHref, PROJECTS_ROUTE, platformApi, studioHref } from "./api";
import { useResource } from "./data";
import { Command, Notice, Panel, StatusPill, buttonPrimary, buttonQuiet } from "./ui";

const connectionLabels: Record<string, string> = {
  "next-app": "Next.js App Router",
  "next-pages": "Next.js Pages Router",
  react: "React renderer wrapper",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-[var(--seene-border)] py-3 last:border-b-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-[var(--seene-text-muted)]">{label}</dt>
      <dd className="break-words font-mono text-xs text-[var(--seene-text)]">{value}</dd>
    </div>
  );
}

export function SettingsView({ project }: { project: string }) {
  const settings = useResource(`settings:${project}`, async () => {
    const result = await platformApi.projects();
    return { home: result.home, project: result.projects.find(item => item.path === project) };
  });
  const [error, setError] = useState("");
  const [confirmForget, setConfirmForget] = useState(false);
  const [check, setCheck] = useState<{ loading: boolean; source?: PlatformSource; error: string }>({ loading: false, error: "" });
  const [discovery, setDiscovery] = useState<{ loading: boolean; total?: number; pages?: number; sections?: number; components?: number; error: string }>({ loading: false, error: "" });

  const recheck = async () => {
    setCheck({ loading: true, error: "" });
    try {
      const result = await platformApi.inspectSource(project);
      setCheck({ loading: false, source: result.source, error: "" });
    } catch (failure) {
      setCheck({ loading: false, error: failure instanceof Error ? failure.message : "This folder could not be read." });
    }
  };

  const discover = async () => {
    setDiscovery({ loading: true, error: "" });
    try {
      const result = await platformApi.content(project);
      const files = result.content.files;
      setDiscovery({
        loading: false, error: "", total: files.length,
        pages: files.filter(file => file.kind === "page").length,
        sections: files.filter(file => file.kind === "section").length,
        components: files.filter(file => file.kind === "component").length,
      });
    } catch (failure) {
      setDiscovery({ loading: false, error: failure instanceof Error ? failure.message : "Discovery failed." });
    }
  };

  const forget = async () => {
    setError("");
    try {
      await platformApi.removeProject(project);
      window.location.hash = PROJECTS_ROUTE;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The project could not be forgotten."); }
  };

  const found = settings.data?.project;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <a className="font-mono text-xs text-[var(--seene-text-muted)] hover:text-[var(--seene-text)]" href={PROJECTS_ROUTE}>← Projects</a>
        <h1 className="text-3xl font-medium tracking-tight text-[var(--seene-text)]">Settings</h1>
        {found && <StatusPill ok={found.connected} label={found.connected ? "Connected" : "Not connected"} />}
      </header>

      {settings.error && <Notice>{settings.error}</Notice>}
      {error && <Notice>{error}</Notice>}
      {settings.loading && !settings.data && <p className="text-sm text-[var(--seene-text-muted)]">Reading this project…</p>}
      {settings.data && !found && <Notice>This project is not registered with Seene any more. Return to Projects and add it again.</Notice>}

      {found && settings.data && (
        <>
          <Panel title="Project" description="A project is a link to an application that lives outside Seene.">
            <dl>
              <Row label="Name" value={found.name} />
              <Row label="Folder" value={found.path} />
              <Row label="Package manager" value={found.packageManager ?? "unknown"} />
              <Row label="Connected entry" value={found.entry ?? "not connected"} />
              <Row label="Host connection" value={found.adapter ? connectionLabels[found.adapter] ?? found.adapter : "not connected"} />
              <Row label="Scene directory" value={found.sceneDirectory} />
              <Row label="Scenes" value={String(found.sceneCount)} />
              <Row label="Seene home" value={settings.data.home} />
            </dl>
          </Panel>

          <Panel title="Source application" description="The folder Seene reads. Re-check it, or discover what can be presented right now.">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={buttonQuiet} disabled={check.loading} onClick={() => void recheck()}>
                {check.loading ? "Checking…" : "Re-check folder"}
              </button>
              <button type="button" className={buttonQuiet} disabled={discovery.loading} onClick={() => void discover()}>
                {discovery.loading ? "Discovering…" : "Discover targets"}
              </button>
              <a className={buttonPrimary} href={createHref("scene", project)}>+ Scene</a>
              <a className={buttonQuiet} href={createHref("walkthrough", project)}>+ Walkthrough</a>
              <a className={buttonQuiet} href={studioHref(project)}>Open studio</a>
            </div>
            {check.error && <div className="mt-3"><Notice>{check.error}</Notice></div>}
            {check.source && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-[var(--seene-text-muted)]">
                  {check.source.exists ? (check.source.react ? "React application found." : "This folder does not depend on React.") : "This folder is missing."}
                  {" "}{check.source.connected ? "Seene is connected." : "Seene is not connected yet."}
                </p>
                {check.source.issue && <Notice tone="info">{check.source.issue}</Notice>}
              </div>
            )}
            {discovery.error && <div className="mt-3"><Notice>{discovery.error}</Notice></div>}
            {discovery.total !== undefined && (
              <p className="mt-3 text-sm text-[var(--seene-text-muted)]">
                Found {discovery.total} presentable file{discovery.total === 1 ? "" : "s"}: {discovery.pages} page{discovery.pages === 1 ? "" : "s"}, {discovery.sections} section{discovery.sections === 1 ? "" : "s"}, {discovery.components} component{discovery.components === 1 ? "" : "s"}.
              </p>
            )}
          </Panel>

          <Panel title="Keep this connection healthy" description="Run these in the application's own folder with its package manager.">
            <ul className="space-y-3 text-sm text-[var(--seene-text-muted)]">
              <li>Refresh the scene catalog after adding files: <Command>pnpm exec seene sync</Command></li>
              <li>Validate the recorded connection: <Command>pnpm exec seene validate</Command></li>
              <li>Read the catalog as JSON: <Command>pnpm exec seene scenes --json</Command></li>
            </ul>
          </Panel>

          {found.issues.length > 0 && (
            <Panel title="Diagnostics" description="Seene reports what it can and cannot read in this project.">
              <div className="space-y-2">
                {found.issues.map(issue => <Notice key={`${issue.path}:${issue.message}`}>{`${issue.path}: ${issue.message}`}</Notice>)}
              </div>
            </Panel>
          )}

          <Panel title="Forget project" description="Removes the project from this Seene installation. Your application and its scenes stay untouched.">
            {confirmForget ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={buttonQuiet} onClick={forget}>Confirm forget</button>
                <button type="button" className={buttonQuiet} onClick={() => setConfirmForget(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className={buttonQuiet} onClick={() => setConfirmForget(true)}>Forget project</button>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
