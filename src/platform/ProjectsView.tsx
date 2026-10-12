/** SOURCE OF TRUTH: Seene local project console.
 * WHAT: register local React projects and open their studios.
 * WHY: the public landing page is static; this console needs the local platform server.
 * WHERE: Platform renders it at #/projects.
 */
import { useState, type FormEvent } from "react";
import { HOME_ROUTE, platformApi, settingsHref, studioHref } from "./api";
import { useResource } from "./data";
import { Command, Notice, Panel, StatusPill, fieldClass } from "./ui";
import { FrameSection, Kbd, PlusIcon, SeeneButton } from "./site";
import { SEENE_BRAND, SEENE_INSTALL_COMMAND } from "../core/branding";

export function ProjectsView() {
  const projects = useResource("projects", () => platformApi.projects());
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState("");

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await platformApi.addProject(target.trim());
      setTarget("");
      projects.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The project could not be added.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (path: string) => {
    setError("");
    setConfirmRemove("");
    try {
      await platformApi.removeProject(path);
      projects.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The project could not be removed.");
    }
  };

  const list = projects.data?.projects ?? [];
  // A static host has no platform API. Say so plainly instead of rendering an
  // empty console that looks broken.
  const unavailable = !projects.loading && projects.data === undefined;

  return (
    <>
      <FrameSection label="Local studio" edge="both" rails={[{ kind: "solid", flex: 2 }, { kind: "dashed", flex: 3 }, { kind: "solid", flex: 4 }]}>
        <div className="py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="seene-h2 text-3xl">Local studio</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--seene-text-muted)]">
                Register React projects on this machine to open their Seene studios. This console runs
                locally and is not part of the public site.
              </p>
            </div>
            <SeeneButton variant="secondary" size="nav" href={HOME_ROUTE}>Back to overview</SeeneButton>
          </div>

          <div className="mt-8 space-y-3">
            {unavailable && (
              <Notice tone="info">
                This console needs the Seene development server. Run <Command>npm run dev</Command> in the
                Seene repository and open <Command>#/projects</Command> again.
              </Notice>
            )}

            <Panel title="Register project" description="Enter the folder path of your React application on this machine.">
              <form className="flex flex-col gap-3 sm:flex-row sm:items-start" aria-label="Register project" onSubmit={add}>
                <label className="sr-only" htmlFor="project-path">Project folder path</label>
<input
                   id="project-path"
                   className="w-full rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] px-3 py-2 text-sm placeholder:text-[var(--seene-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--seene-accent)]"
                   value={target}
                   autoComplete="off"
                   spellCheck={false}
                   placeholder="/Users/you/projects/my-app"
                   onChange={event => setTarget(event.target.value)}
                 />
<SeeneButton variant="primary" size="nav" kbd={<Kbd onPrimary>R</Kbd>} loading={busy} disabled={!target.trim()} className="gap-1.5" type="submit">
                   <PlusIcon /> Register project
                 </SeeneButton>
              </form>
              {error && <div className="mt-3"><Notice>{error}</Notice></div>}
            </Panel>

            {projects.error && <Notice>{projects.error}</Notice>}
            {projects.loading && !projects.data && <p className="text-sm text-[var(--seene-text-muted)]">Loading registered projects…</p>}
<section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium tracking-tight">Your projects</h2>
                <span className="font-mono text-xs text-[var(--seene-text-muted)]">{list.length} registered</span>
              </div>

                  {list.length === 0 ? (
                   <div className="space-y-2 rounded-md border border-dashed border-[var(--seene-border)] bg-[var(--seene-surface)] p-8 text-center">
                     <p className="text-sm font-medium">No projects registered yet</p>
                     <p className="text-xs text-[var(--seene-text-muted)]">
                       Run <Command>{SEENE_INSTALL_COMMAND}</Command> in your React project first.
                     </p>
                   </div>
                 ) : (
                   <div className="grid gap-4 sm:grid-cols-2">
                     {list.map(project => (
                       <article key={project.path} data-project-path={project.path} className="flex flex-col justify-between gap-4 rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6 shadow-sm hover:shadow-md transition-shadow">
                         <div className="space-y-3">
                           <header className="flex items-start justify-between gap-2">
                             <div className="min-w-0 space-y-0.5">
                               <h3 className="truncate text-lg font-medium text-[var(--seene-text)]">{project.name}</h3>
                               <p className="truncate font-mono text-xs text-[var(--seene-text-muted)]" title={project.path}>{project.path}</p>
                             </div>
                             <StatusPill ok={project.connected} label={project.connected ? "Connected" : "Not connected"} />
                           </header>
                           <p className="text-xs text-[var(--seene-text-muted)]">
                             {project.sceneCount === 1 ? "1 scene" : `${project.sceneCount} scenes`}
                             {project.adapter ? ` · ${project.adapter}` : ""}
                             {project.packageManager ? ` · ${project.packageManager}` : ""}
                           </p>
                         </div>

                         <div className="flex flex-wrap items-center gap-2 border-t border-[var(--seene-border)] pt-2">
                           <a className="seene-btn seene-btn-primary seene-btn-nav" href={studioHref(project.path)}>Open studio</a>
                           <a className="seene-btn seene-btn-secondary seene-btn-nav" href={settingsHref(project.path)}>Settings</a>
                           {confirmRemove === project.path ? (
                             <>
                               <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => void remove(project.path)}>Confirm remove</button>
                               <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => setConfirmRemove("")}>Cancel</button>
                             </>
                           ) : (
                             <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => setConfirmRemove(project.path)}>Remove</button>
                           )}
                         </div>

                         {!project.connected && (
                           <Notice tone="info">Run <Command>seene init</Command> in this project folder, then refresh.</Notice>
                         )}
                       </article>
                     ))}
                   </div>
                 )}
            </section>
          </div>
        </div>
      </FrameSection>

      <FrameSection label="Footer" edge="top">
        <footer className="flex flex-col gap-3 py-8 text-xs text-[var(--seene-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>{SEENE_BRAND.name} · Local studio</span>
          <a className="hover:underline" href={SEENE_BRAND.repository} target="_blank" rel="noreferrer noopener">{SEENE_BRAND.packageName} on GitHub</a>
        </footer>
      </FrameSection>
    </>
  );
}