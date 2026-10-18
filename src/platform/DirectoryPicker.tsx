import { useEffect, useRef, useState } from "react";
import { platformApi } from "./api";
import { useResource } from "./data";
import { Notice, buttonPrimary, buttonQuiet, fieldClass } from "./ui";

export function DirectoryPicker({
  initialPath,
  onSelect,
  onClose,
}: {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [path, setPath] = useState(initialPath ?? "");
  const [typed, setTyped] = useState(initialPath ?? "");
  const panelRef = useRef<HTMLDivElement>(null);
  const listing = useResource(`browse:${path}`, () => platformApi.browseSource(path || undefined));
  const data = listing.data;

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const go = (next: string) => {
    setPath(next);
    setTyped(next);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a project folder"
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 p-4 pt-16"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div ref={panelRef} tabIndex={-1} className="w-full max-w-2xl rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] shadow-2xl outline-none">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--seene-border)] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight uppercase text-[var(--seene-text-muted)]">Choose a folder</h2>
            <p className="mt-0.5 font-mono text-xs text-[var(--seene-text-muted)]">{data?.path ?? path ?? "Home"}</p>
          </div>
          <button type="button" className={buttonQuiet} onClick={onClose}>Close</button>
        </header>

        <div className="border-b border-[var(--seene-border)] px-5 py-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={event => { event.preventDefault(); go(typed.trim()); }}
          >
            <label className="sr-only" htmlFor="picker-path">Folder path</label>
            <input
              id="picker-path"
              className={fieldClass}
              value={typed}
              onChange={event => setTyped(event.target.value)}
              placeholder="/home/you/projects/my-app"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" className={buttonQuiet}>Go</button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={buttonQuiet} disabled={!data?.parent} onClick={() => data?.parent && go(data.parent)}>↑ Up</button>
            {data && <span className="truncate font-mono text-xs text-[var(--seene-text-muted)]">{data.path}</span>}
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto px-2 py-2">
          {listing.loading && <p className="px-3 py-2 text-sm text-[var(--seene-text-muted)]">Reading folders…</p>}
          {listing.error && <div className="p-3"><Notice>{listing.error}</Notice></div>}
          {data?.issue && <div className="p-3"><Notice tone="info">{data.issue}</Notice></div>}
          {data && data.entries.length === 0 && !listing.loading && !data.issue && (
            <p className="px-3 py-2 text-sm text-[var(--seene-text-muted)]">No folders inside here. Use ↑ Up to go back.</p>
          )}
          {data?.entries.map(entry => (
            <div key={entry.path} className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-[var(--seene-surface-2)]">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                onClick={() => go(entry.path)}
                title={`Open ${entry.path}`}
              >
                <span aria-hidden="true" className="text-[var(--seene-text-muted)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
                </span>
                <span className="truncate text-sm text-[var(--seene-text)]">{entry.name}</span>
                {entry.isReactProject && <span className="rounded-sm border border-[var(--seene-accent)] bg-[var(--seene-accent-soft)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--seene-accent)]">React</span>}
                {!entry.isReactProject && entry.hasPackageJson && <span className="rounded-sm border border-[var(--seene-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--seene-text-muted)]">package.json</span>}
              </button>
              <button type="button" className={buttonQuiet} onClick={() => onSelect(entry.path)}>Use</button>
            </div>
          ))}
          {data?.truncated && <p className="px-3 py-2 text-xs text-[var(--seene-text-muted)]">Showing the first 100 folders. Type the path to go deeper.</p>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--seene-border)] px-5 py-3">
          <p className="text-xs text-[var(--seene-text-muted)]">Folders only. Seene reads names to help you find your app; it does not upload anything.</p>
          <button type="button" className={buttonPrimary} disabled={!data?.path} onClick={() => data?.path && onSelect(data.path)}>Use this folder</button>
        </footer>
      </div>
    </div>
  );
}
