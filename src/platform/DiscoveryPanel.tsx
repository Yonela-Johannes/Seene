import { useCallback, useEffect, useRef, useState } from "react";
import { platformApi, studioHref, type ScanResponse } from "./api";
import { DirectoryPicker } from "./DirectoryPicker";
import { Command, Notice, Panel } from "./ui";
import type { PlatformDiscoveredProject } from "../core/platform";

const FRAMEWORK_LABEL: Record<PlatformDiscoveredProject["framework"], string> = {
  next: "Next.js",
  vite: "Vite",
  react: "React",
};

function Badge({ children, tone = "quiet" }: { children: string; tone?: "quiet" | "accent" }) {
  return (
    <span
      className={
        tone === "accent"
          ? "inline-flex items-center rounded-full border border-[var(--seene-accent)] bg-[var(--seene-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--seene-accent)]"
          : "inline-flex items-center rounded-full border border-[var(--seene-border)] bg-[var(--seene-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--seene-text-muted)]"
      }
    >
      {children}
    </span>
  );
}

function relative(ms?: number): string {
  if (ms === undefined) return "";
  const elapsed = Date.now() - ms;
  const days = Math.floor(elapsed / 86_400_000);
  if (days >= 1) return `edited ${days === 1 ? "yesterday" : `${days} days ago`}`;
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours >= 1) return `edited ${hours === 1 ? "1 hour ago" : `${hours} hours ago`}`;
  return "edited recently";
}

export function DiscoveryPanel({ onRegistered, compact = false }: { onRegistered: () => void; compact?: boolean }) {
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [picking, setPicking] = useState(false);
  const runId = useRef(0);

  const run = useCallback(async (roots?: string[]) => {
    const id = ++runId.current;
    setScanning(true);
    setError("");
    try {
      const result = await platformApi.discoverProjects(roots);
      if (id === runId.current) setScan(result);
    } catch (failure) {
      if (id === runId.current) setError(failure instanceof Error ? failure.message : "Seene could not scan this computer.");
    } finally {
      if (id === runId.current) setScanning(false);
    }
  }, []);

  useEffect(() => { void run(); }, [run]);

  const register = async (project: PlatformDiscoveredProject) => {
    setBusy(project.path);
    setError("");
    try {
      await platformApi.addProject(project.path);
      onRegistered();
      await run();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : `${project.name} could not be registered.`);
    } finally {
      setBusy("");
    }
  };

  const projects = scan?.projects ?? [];
  const found = projects.filter(project => !project.registered);

  return (
    <Panel
      title="Found on this computer"
      description={`Seene reads folder names and package.json only. Nothing leaves this machine. Scanned ${scan?.scanned ?? 0} ${scan?.scanned === 1 ? "folder" : "folders"}.`}
      actions={
        <>
          <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => setPicking(true)}>Scan a folder…</button>
          <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" disabled={scanning} onClick={() => void run()}>
            {scanning ? "Scanning…" : "Scan again"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice>{error}</Notice>}
        {!scan && scanning && <p className="text-sm text-[var(--seene-text-muted)]">Looking through common project folders…</p>}
        {scan && projects.length === 0 && (
          <div className="space-y-2 rounded-sm border border-dashed border-[var(--seene-border)] p-6 text-center">
            <p className="text-sm font-medium">No React projects found</p>
            <p className="text-xs text-[var(--seene-text-muted)]">
              Seene looked in {scan.roots.length} common {scan.roots.length === 1 ? "folder" : "folders"} such as <Command>~/Projects</Command>.
              Use <strong className="font-medium">Scan a folder…</strong> to point it at your code.
            </p>
          </div>
        )}
        {projects.length > 0 && (
          <ul className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
            {projects.map(project => (
              <li
                key={project.path}
                data-discovered-path={project.path}
                className="flex min-w-0 flex-col gap-3 rounded-md border border-[var(--seene-border)] bg-[var(--seene-bg)] p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    {project.registered && <Badge tone="accent">Registered</Badge>}
                    {project.hasSeene && <Badge tone="accent">Has Seene</Badge>}
                  </div>
                  <p className="truncate font-mono text-xs text-[var(--seene-text-muted)]" title={project.path}>{project.path}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--seene-text-muted)]">
                    <span>{FRAMEWORK_LABEL[project.framework]}</span>
                    {project.reactVersion && <span>· React {project.reactVersion}</span>}
                    {project.packageManager && <span>· {project.packageManager}</span>}
                    {project.sceneCount > 0 && <span>· {project.sceneCount === 1 ? "1 scene" : `${project.sceneCount} scenes`}</span>}
                    {relative(project.modifiedMs) && <span>· {relative(project.modifiedMs)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {project.registered ? (
                    <a className="seene-btn seene-btn-primary seene-btn-nav" href={studioHref(project.path)}>Open studio</a>
                  ) : (
                    <button
                      type="button"
                      className="seene-btn seene-btn-primary seene-btn-nav"
                      disabled={busy === project.path}
                      onClick={() => void register(project)}
                    >
                      {busy === project.path ? "Registering…" : "Register"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {scan && projects.length > 0 && found.length === 0 && (
          <p className="text-xs text-[var(--seene-text-muted)]">Every React project Seene found is already registered.</p>
        )}
        {scan?.truncated && <p className="text-xs text-[var(--seene-text-muted)]">More projects exist than Seene listed. Scan a specific folder to narrow it down.</p>}
      </div>

      {picking && (
        <DirectoryPicker
          onClose={() => setPicking(false)}
          onSelect={path => { setPicking(false); void run([path]); }}
        />
      )}
    </Panel>
  );
}
