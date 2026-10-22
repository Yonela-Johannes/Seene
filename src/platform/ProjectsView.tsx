/** SOURCE OF TRUTH: Seene local project console.
 * WHAT: register local React projects, spot ones Seene already found on this machine, and open their studios.
 * WHY: the public landing page is static; this console needs the local platform server.
 * WHERE: Platform renders it at #/projects.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createHref, HOME_ROUTE, platformApi, settingsHref, studioHref, websiteStudioHref } from "./api";
import { useResource } from "./data";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { DirectoryPicker } from "./DirectoryPicker";
import { Command, Notice, Panel, StatusPill } from "./ui";
import { FrameSection, Kbd, PlusIcon, SeeneButton } from "./site";
import { SEENE_BRAND, SEENE_INIT_COMMAND, SEENE_NPM_INSTALL_COMMAND } from "../core/branding";

export function ProjectsView() {
  const projects = useResource("projects", () => platformApi.projects());
  const websites = useResource("websites", () => platformApi.websites());
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [websiteError, setWebsiteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState("");
  const [confirmRemoveWebsite, setConfirmRemoveWebsite] = useState("");
  const [picking, setPicking] = useState(false);
  const pathInput = useRef<HTMLInputElement>(null);

  // The "R" hint on the Register button is real: press it anywhere on this view
  // (outside a field) to jump into the project path input.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key !== "r" && event.key !== "R") return;
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!document.getElementById("project-path")) return;
      event.preventDefault();
      pathInput.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const removeWebsite = async (url: string) => {
    setWebsiteError("");
    setConfirmRemoveWebsite("");
    try {
      await platformApi.removeWebsite(url);
      websites.reload();
    } catch (failure) {
      setWebsiteError(failure instanceof Error ? failure.message : "The website walkthrough could not be removed.");
    }
  };

  const list = projects.data?.projects ?? [];
  const websiteList = websites.data?.projects ?? [];
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

            <Panel title="Register project" description="Enter the folder path of your React application on this machine, or browse to it.">
              <form className="flex flex-col gap-3 sm:flex-row sm:items-start" aria-label="Register project" onSubmit={add}>
                <label className="sr-only" htmlFor="project-path">Project folder path</label>
<input
                   ref={pathInput}
                   id="project-path"
                   className="w-full rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] px-3 py-2 text-sm placeholder:text-[var(--seene-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--seene-accent)]"
                   value={target}
                   autoComplete="off"
                   spellCheck={false}
                   placeholder="/Users/you/projects/my-app"
                   onChange={event => setTarget(event.target.value)}
                 />
                <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => setPicking(true)}>Browse…</button>
<SeeneButton variant="primary" size="nav" kbd={<Kbd onPrimary>R</Kbd>} loading={busy} disabled={!target.trim()} type="submit">
                   <PlusIcon /> Register project
                 </SeeneButton>
              </form>
              {error && <div className="mt-3"><Notice>{error}</Notice></div>}
            </Panel>

            <div className="grid gap-3 rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--seene-text-muted)]">Project</p>
                <p className="mt-1 text-sm text-[var(--seene-text-muted)]">The React application Seene reads: its routes, sections and components.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--seene-text-muted)]">Scene</p>
                <p className="mt-1 text-sm text-[var(--seene-text-muted)]">One cinematic composition with a camera, focus and motion timeline.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--seene-text-muted)]">Walkthrough</p>
                <p className="mt-1 text-sm text-[var(--seene-text-muted)]">A connected sequence of components, scrolls and interactions that plays as one video.</p>
              </div>
            </div>

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
                       Pick a React project below, or run <Command>{SEENE_NPM_INSTALL_COMMAND}</Command> and then <Command>{SEENE_INIT_COMMAND}</Command> in your project first.
                     </p>
                   </div>
                 ) : (
                   <div className="grid gap-4 sm:grid-cols-2">
                     {list.map(project => (
                       <article key={project.path} data-project-path={project.path} className="flex min-w-0 flex-col justify-between gap-4 rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6 shadow-sm hover:shadow-md transition-shadow">
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
                           <a className="seene-btn seene-btn-secondary seene-btn-nav" href={createHref("scene", project.path)}>+ Scene</a>
                           <a className="seene-btn seene-btn-secondary seene-btn-nav" href={createHref("walkthrough", project.path)}>+ Walkthrough</a>
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

            <section className="space-y-4" aria-labelledby="website-walkthroughs-heading">
              <div className="flex items-center justify-between">
                <h2 id="website-walkthroughs-heading" className="text-xl font-medium tracking-tight">Website walkthroughs</h2>
                <span className="font-mono text-xs text-[var(--seene-text-muted)]">{websiteList.length} saved</span>
              </div>
              <p className="text-xs text-[var(--seene-text-muted)]">
                Websites imported by URL are stored locally and need no npm package in the target site.
              </p>
              {websiteError && <Notice>{websiteError}</Notice>}
              {websites.loading && !websites.data && <p className="text-sm text-[var(--seene-text-muted)]">Loading website walkthroughs…</p>}
              {websites.error && <Notice>{websites.error}</Notice>}
              {!websites.loading && websiteList.length === 0 && (
                <div className="space-y-2 rounded-md border border-dashed border-[var(--seene-border)] bg-[var(--seene-surface)] p-8 text-center">
                  <p className="text-sm font-medium">No website walkthroughs yet</p>
                  <p className="text-xs text-[var(--seene-text-muted)]">
                    Paste a website URL on the <a className="underline" href={HOME_ROUTE}>overview page</a> to import one.
                  </p>
                </div>
              )}
              {websiteList.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {websiteList.map(site => (
                    <article key={site.id} data-website-url={site.url} className="flex min-w-0 flex-col justify-between gap-4 rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="space-y-2">
                        <h3 className="truncate text-lg font-medium text-[var(--seene-text)]">{site.title}</h3>
                        <p className="truncate font-mono text-xs text-[var(--seene-text-muted)]" title={site.url}>{site.url}</p>
                        {site.description && <p className="text-xs text-[var(--seene-text-muted)]">{site.description}</p>}
                        <p className="text-xs text-[var(--seene-text-muted)]">
                          {site.stepCount} step{site.stepCount === 1 ? "" : "s"} · {site.sectionCount} section{site.sectionCount === 1 ? "" : "s"} · {site.pageCount} page{site.pageCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--seene-border)] pt-2">
                        <a className="seene-btn seene-btn-primary seene-btn-nav" href={websiteStudioHref(site.url)}>Open studio</a>
                        <a className="seene-btn seene-btn-secondary seene-btn-nav" href={site.url} target="_blank" rel="noreferrer noopener">Open site</a>
                        {confirmRemoveWebsite === site.url ? (
                          <>
                            <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => void removeWebsite(site.url)}>Confirm remove</button>
                            <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => setConfirmRemoveWebsite("")}>Cancel</button>
                          </>
                        ) : (
                          <button type="button" className="seene-btn seene-btn-secondary seene-btn-nav" onClick={() => setConfirmRemoveWebsite(site.url)}>Remove</button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {!unavailable && <DiscoveryPanel onRegistered={projects.reload} />}
          </div>
        </div>
      </FrameSection>

      <FrameSection label="Footer" edge="top">
        <footer className="flex flex-col gap-3 py-8 text-xs text-[var(--seene-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>{SEENE_BRAND.name} · Local studio</span>
          <a className="hover:underline" href={SEENE_BRAND.repository} target="_blank" rel="noreferrer noopener">{SEENE_BRAND.packageName} on GitHub</a>
        </footer>
      </FrameSection>

      {picking && (
        <DirectoryPicker
          onClose={() => setPicking(false)}
          onSelect={path => { setPicking(false); setTarget(path); }}
        />
      )}
    </>
  );
}