import { useMemo, useState, type FormEvent } from "react";
import { sceneIdFromTitle } from "../core/platform";
import { platformApi, studioHref } from "./api";
import { useResource } from "./data";
import { Notice, buttonPrimary, buttonQuiet, fieldClass } from "./ui";

type Selection = { file: string; export?: string };

function selectionValue(selection: Selection): string { return selection.export ? `${selection.file}#${selection.export}` : selection.file; }
function parseSelection(value: string): Selection | undefined {
  if (!value) return undefined;
  const [file, exported] = value.split("#");
  return exported ? { file, export: exported } : { file };
}

export function CreateSceneDialog({ project, onClose, onCreated }: { project: string; onClose: () => void; onCreated: (sceneId: string) => void }) {
  const content = useResource(`content:${project}`, () => platformApi.content(project));
  const [title, setTitle] = useState("");
  const [choice, setChoice] = useState("");
  const [customHostPath, setCustomHostPath] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useMemo(() => sceneIdFromTitle(title), [title]);

  const pages = useMemo(() => content.data?.content.files.filter(f => f.kind === "page") ?? [], [content.data]);
  const sections = useMemo(() => content.data?.content.files.filter(f => f.kind === "section") ?? [], [content.data]);
  const components = useMemo(() => content.data?.content.files.filter(f => !f.kind || f.kind === "component") ?? [], [content.data]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) { setError("Use a scene name containing letters or digits."); return; }
    setSaving(true);
    setError("");
    try {
      const selection = customHostPath.trim() ? { file: customHostPath.trim() } : parseSelection(choice);
      const created = await platformApi.createScene({ path: project, id, title: title.trim(), content: selection });
      onCreated(created.scene.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The scene could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
    <div role="dialog" aria-label="Create scene" className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-bg)]">
      <header className="flex items-center justify-between border-b border-[var(--seene-border)] px-6 py-5">
        <h2 className="text-lg font-medium text-[var(--seene-text)]">Create scene</h2>
          <button type="button" className={buttonQuiet} onClick={onClose}>Close</button>
        </header>
        <form className="space-y-6 px-6 py-5" onSubmit={submit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--seene-text)]" htmlFor="scene-name">Scene name</label>
            <input id="scene-name" className={fieldClass} value={title} placeholder="Dashboard overview" onChange={event => setTitle(event.target.value)} />
            {id && <p className="font-mono text-xs text-[var(--seene-text-muted)]">{`src/seene/scenes/${id}.scene.json`}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--seene-text)]" htmlFor="scene-content">Choose application content</label>
            <select id="scene-content" className={fieldClass} value={choice} onChange={event => setChoice(event.target.value)}>
              <option value="">Your whole application (Default)</option>
              {pages.length > 0 && (
                <optgroup label="Pages">
                  {pages.map(file => (
                    <option key={file.path} value={selectionValue({ file: file.path })}>
                      {`${file.title || file.path}${file.route ? ` (${file.route})` : ""}`}
                    </option>
                  ))}
                </optgroup>
              )}
              {sections.length > 0 && (
                <optgroup label="Sections">
                  {sections.map(file => (
                    <option key={file.path} value={selectionValue({ file: file.path })}>
                      {file.title || file.path}
                    </option>
                  ))}
                </optgroup>
              )}
              {components.length > 0 && (
                <optgroup label="Components">
                  {components.map(file => (
                    <option key={file.path} value={selectionValue({ file: file.path })}>
                      {file.title || file.path}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-[var(--seene-text-muted)]">
              {content.loading ? "Reading your application…" : content.data ? `${content.data.content.files.length} application targets (Pages, Sections, Components) found.` : content.error || "Application content could not be read."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--seene-text)]" htmlFor="scene-host-path">Component to present (optional)</label>
            <input id="scene-host-path" className={fieldClass} value={customHostPath} placeholder="e.g. src/components/Header.tsx" onChange={event => setCustomHostPath(event.target.value)} />
          </div>

          {error && <Notice>{error}</Notice>}
          <p className="text-xs text-[var(--seene-text-muted)]">
            Seene presents the UI you already have. Your application's components and providers stay the source of truth; the scene starts with a camera, focus and motion you edit in the studio.
          </p>
           <div className="flex items-center justify-end gap-2">
                <a className={buttonQuiet} href={studioHref(project)} onClick={onClose}>Cancel</a>
                <button type="submit" className={buttonPrimary} disabled={saving || !title.trim()}>{saving ? "Creating…" : "Create scene"}</button>
              </div>
            </form>
          </div>
        </div>
  );
}
