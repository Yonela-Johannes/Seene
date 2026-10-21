import { LandingView } from "./LandingView";
import { ProjectsView } from "./ProjectsView";
import { SettingsView } from "./SettingsView";
import { StudioView } from "./StudioView";
import { CreateView } from "./CreateView";
import { PresentationView } from "./PresentationView";
import { CREATE_ROUTE, PROJECTS_ROUTE } from "./api";
import { useHashRoute } from "./data";
import { SiteHeader, useSiteShortcuts } from "./site";
import { useEffect, useState } from "react";
import { SEENE_INSTALL_COMMAND } from "../core/branding";

/** The command menu offers real navigation and the install command.
 * There is no account, so nothing here signs a user in or out. */
const COMMANDS = [
  { label: "Go to overview", href: "#/" },
  { label: "Open the local studio", href: PROJECTS_ROUTE },
  { label: "Create a scene", href: `${CREATE_ROUTE}?kind=scene` },
  { label: "Create a walkthrough", href: `${CREATE_ROUTE}?kind=walkthrough` },
];

export function Platform() {
  const route = useHashRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);
  useSiteShortcuts();
  useEffect(() => {
    if (route.view !== "home") return;
    const target = window.location.hash.slice(1);
    if (target !== "demo" && target !== "install") return;
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" }));
  }, [route.view]);
  return (
    <div className="min-h-screen bg-[var(--seene-bg)] text-[var(--seene-text)]">
      <SiteHeader onPalette={() => setPaletteOpen(true)} />
      <main>
        {route.view === "home" && <LandingView />}
        {route.view === "projects" && <ProjectsView />}
        {route.view === "create" && <CreateView initialKind={route.kind} initialProject={route.project} initialUrl={route.url} />}
        {route.view === "studio" && <StudioView project={route.project} initialScene={route.scene} />}
        {route.view === "settings" && <SettingsView project={route.project} />}
        {route.view === "present" && <PresentationView project={route.project} scene={route.scene} />}
      </main>
      {paletteOpen && (
        <div role="dialog" aria-modal="true" aria-label="Command menu" className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-24" onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-md rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] p-2 shadow-xl" onClick={event => event.stopPropagation()}>
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--seene-text-muted)]">Command menu</p>
            <div className="mt-1 grid gap-1">
              {COMMANDS.map(command => (
                <a key={command.href} className="seene-nav-item" href={command.href} onClick={() => setPaletteOpen(false)}>{command.label}</a>
              ))}
              <button type="button" className="seene-nav-item" onClick={() => { void navigator.clipboard?.writeText(SEENE_INSTALL_COMMAND); setPaletteOpen(false); }}>Copy install command</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
