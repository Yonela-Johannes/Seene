import { useMemo, useState, useEffect, type FormEvent } from "react";
import { sceneIdFromTitle } from "../core/platform";
import { platformApi, studioHref } from "./api";
import { useResource } from "./data";
import { Notice } from "./ui";

type Selection = { file: string; export?: string; title?: string };

function parseSelection(value: string): Selection | undefined {
  if (!value) return undefined;
  const [file, exported] = value.split("#");
  return exported ? { file, export: exported } : { file };
}

function selectionValue(selection: Selection): string {
  return selection.export ? `${selection.file}#${selection.export}` : selection.file;
}

export function CreateSceneDialog({ project, onClose, onCreated }: { project: string; onClose: () => void; onCreated: (sceneId: string) => void }) {
  const content = useResource(`content:${project}`, () => platformApi.content(project));
  const [title, setTitle] = useState("");
  const [compositionType, setCompositionType] = useState<"scene" | "walkthrough">("scene");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "page" | "section" | "component">("all");
  const [choice, setChoice] = useState("");
  const [selectedSections, setSelectedSections] = useState<Selection[]>([]);
  const [customHostPath, setCustomHostPath] = useState("");
  const [showCustomPath, setShowCustomPath] = useState(false);
  const [width, setWidth] = useState<number>(1400);
  const [height, setHeight] = useState<number>(980);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useMemo(() => sceneIdFromTitle(title), [title]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const allFiles = useMemo(() => content.data?.content.files ?? [], [content.data]);

  const filteredFiles = useMemo(() => {
    return allFiles.filter(file => {
      if (activeTab !== "all" && file.kind !== activeTab) return false;
      if (!search.trim()) return true;
      const query = search.toLowerCase().trim();
      return (
        file.path.toLowerCase().includes(query) ||
        (file.title && file.title.toLowerCase().includes(query)) ||
        (file.route && file.route.toLowerCase().includes(query)) ||
        file.exports.some(e => e.toLowerCase().includes(query))
      );
    });
  }, [allFiles, activeTab, search]);

  const handleSelectFile = (filePath: string, exportName?: string, fileTitle?: string) => {
    const val = selectionValue({ file: filePath, export: exportName });
    if (compositionType === "scene") {
      if (choice === val) {
        setChoice("");
      } else {
        setChoice(val);
        setCustomHostPath("");
      }
    } else {
      // Walkthrough: add component to selectedSections sequence
      const exists = selectedSections.some(s => selectionValue(s) === val);
      if (!exists) {
        setSelectedSections(prev => [...prev, { file: filePath, export: exportName, title: fileTitle }]);
      }
    }
  };

  const removeSection = (index: number) => {
    setSelectedSections(prev => prev.filter((_, idx) => idx !== index));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedSections.length) return;
    setSelectedSections(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) { setError("Use a scene name containing letters or digits."); return; }
    setSaving(true);
    setError("");
    try {
      let created;
      if (compositionType === "walkthrough") {
        created = await platformApi.createScene({
          path: project,
          id,
          title: title.trim(),
          compositionType: "walkthrough",
          sections: selectedSections.length > 0 ? selectedSections : undefined,
          content: selectedSections.length > 0 ? selectedSections[0] : customHostPath.trim() ? { file: customHostPath.trim() } : undefined,
        });
      } else {
        const selection = customHostPath.trim() ? { file: customHostPath.trim() } : parseSelection(choice);
        created = await platformApi.createScene({
          path: project,
          id,
          title: title.trim(),
          compositionType: "scene",
          content: selection,
          width,
          height,
        });
      }
      onCreated(created.scene.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The scene could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-scene-modal-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-surface-2)] text-[var(--seene-text)] shadow-2xl relative z-[10001] pointer-events-auto"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[var(--seene-border)] px-6 py-4 shrink-0">
          <div>
            <h2 id="create-scene-modal-title" className="text-lg font-semibold text-[var(--seene-text)]">
              Create Scene
            </h2>
            <p className="text-xs text-[var(--seene-text-muted)]">
              Choose scene composition type and select project components.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-sm text-[var(--seene-text-muted)] hover:bg-[var(--seene-surface)] hover:text-[var(--seene-text)] transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </header>

        {/* Form Body */}
        <form className="flex flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <div className="flex-1 overflow-y-auto space-y-5 px-6 py-5">
            {/* Scene Type Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--seene-text-muted)]">
                Scene Composition Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCompositionType("scene")}
                  className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all ${
                    compositionType === "scene"
                      ? "border-[var(--seene-accent)] bg-[var(--seene-surface)] shadow-md"
                      : "border-[var(--seene-border)] bg-[var(--seene-surface-2)] hover:border-[var(--seene-border-text)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎥</span>
                    <strong className="text-sm font-semibold text-[var(--seene-text)]">Single Scene</strong>
                  </div>
                  <p className="text-[11px] text-[var(--seene-text-muted)] leading-relaxed">
                    3D spatial camera framing a single component or fixed canvas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCompositionType("walkthrough")}
                  className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all ${
                    compositionType === "walkthrough"
                      ? "border-[var(--seene-accent)] bg-[var(--seene-surface)] shadow-md"
                      : "border-[var(--seene-border)] bg-[var(--seene-surface-2)] hover:border-[var(--seene-border-text)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📜</span>
                    <strong className="text-sm font-semibold text-[var(--seene-text)]">Website Walkthrough</strong>
                  </div>
                  <p className="text-[11px] text-[var(--seene-text-muted)] leading-relaxed">
                    Full-page scroll walkthrough connecting page sections from hero to footer.
                  </p>
                </button>
              </div>
            </div>

            {/* Scene Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-[var(--seene-text-muted)]" htmlFor="scene-name">
                Scene Name <span className="text-red-400">*</span>
              </label>
              <input
                id="scene-name"
                type="text"
                required
                autoFocus
                value={title}
                placeholder={compositionType === "walkthrough" ? "e.g. Website Full Tour" : "e.g. Hero Showcase"}
                onChange={event => setTitle(event.target.value)}
                className="w-full rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] px-4 py-2.5 text-sm text-[var(--seene-text)] placeholder-[var(--seene-text-muted)] focus:border-[var(--seene-accent)] focus:outline-none transition-all"
              />
              {id ? (
                <p className="font-mono text-[11px] text-[var(--seene-text-muted)]">
                  Output: <span className="text-[var(--seene-text)]">src/seene/scenes/{id}.scene.json</span> & <span className="text-[var(--seene-text)]">{id}.tsx</span>
                </p>
              ) : null}
            </div>

            {/* Single Scene Dimensions config */}
            {compositionType === "scene" ? (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)]">
                <div className="space-y-1">
                  <label className="block text-[11px] text-[var(--seene-text-muted)] uppercase tracking-wider font-medium" htmlFor="scene-width">
                    Canvas Width (px)
                  </label>
                  <input
                    id="scene-width"
                    type="number"
                    min="320"
                    max="3840"
                    value={width}
                    onChange={e => setWidth(parseInt(e.target.value) || 1400)}
                    className="w-full rounded-lg border border-[var(--seene-border)] bg-[var(--seene-surface-2)] px-3 py-1.5 text-xs text-[var(--seene-text)] font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-[var(--seene-text-muted)] uppercase tracking-wider font-medium" htmlFor="scene-height">
                    Canvas Height (px)
                  </label>
                  <input
                    id="scene-height"
                    type="number"
                    min="320"
                    max="3840"
                    value={height}
                    onChange={e => setHeight(parseInt(e.target.value) || 980)}
                    className="w-full rounded-lg border border-[var(--seene-border)] bg-[var(--seene-surface-2)] px-3 py-1.5 text-xs text-[var(--seene-text)] font-mono"
                  />
                </div>
              </div>
            ) : null}

            {/* Ordered Sections List for Walkthrough */}
            {compositionType === "walkthrough" && selectedSections.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-[var(--seene-accent)]/40 bg-[var(--seene-surface)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--seene-text)] uppercase tracking-wider">
                    Walkthrough Sequence ({selectedSections.length} sections)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSections([])}
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedSections.map((sec, idx) => (
                    <div
                      key={`${sec.file}-${idx}`}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[var(--seene-surface-2)] border border-[var(--seene-border)] text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-[11px] text-[var(--seene-accent)] font-bold">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <strong className="block font-medium text-[var(--seene-text)] truncate">
                            {sec.title || sec.file.split("/").pop()?.replace(/\.[jt]sx$/, "")}
                          </strong>
                          <span className="block font-mono text-[10px] text-[var(--seene-text-muted)] truncate">
                            {sec.file}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, -1)}
                          className="px-2 py-1 rounded bg-[var(--seene-surface)] border border-[var(--seene-border)] text-[10px] disabled:opacity-30 hover:bg-[var(--seene-border)]"
                          title="Move section up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === selectedSections.length - 1}
                          onClick={() => moveSection(idx, 1)}
                          className="px-2 py-1 rounded bg-[var(--seene-surface)] border border-[var(--seene-border)] text-[10px] disabled:opacity-30 hover:bg-[var(--seene-border)]"
                          title="Move section down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSection(idx)}
                          className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] hover:bg-red-500/30"
                          title="Remove section"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Component Picker Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium uppercase tracking-wider text-[var(--seene-text-muted)]">
                  {compositionType === "walkthrough"
                    ? "Add Project Components to Walkthrough Sequence"
                    : "Select Project Component"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomPath(!showCustomPath)}
                  className="text-xs text-[var(--seene-accent)] hover:underline"
                >
                  {showCustomPath ? "Hide custom path input" : "Enter custom path manually"}
                </button>
              </div>

              {showCustomPath ? (
                <div className="space-y-1.5 rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-3">
                  <label className="block text-xs text-[var(--seene-text-muted)]" htmlFor="custom-host-path">
                    Custom Component Relative Path
                  </label>
                  <input
                    id="custom-host-path"
                    type="text"
                    value={customHostPath}
                    placeholder="e.g. src/components/Header.tsx"
                    onChange={event => { setCustomHostPath(event.target.value); if (event.target.value) setChoice(""); }}
                    className="w-full rounded-lg border border-[var(--seene-border)] bg-[var(--seene-surface-2)] px-3 py-2 text-xs font-mono text-[var(--seene-text)] placeholder-[var(--seene-text-muted)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </div>
              ) : null}

              {/* Search & Tabs */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs text-[var(--seene-text-muted)] pointer-events-none">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search components, pages, sections..."
                    className="w-full rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] pl-8 pr-8 py-2 text-xs text-[var(--seene-text)] placeholder-[var(--seene-text-muted)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute inset-y-0 right-2 flex items-center px-1 text-xs text-[var(--seene-text-muted)] hover:text-[var(--seene-text)]"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-1 text-xs">
                  {(["all", "page", "section", "component"] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? "bg-[var(--seene-surface-2)] text-[var(--seene-text)] shadow-sm"
                          : "text-[var(--seene-text-muted)] hover:text-[var(--seene-text)]"
                      }`}
                    >
                      {tab === "all" ? "All" : `${tab}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selectable Component List */}
              <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-2 space-y-1">
                {/* Option 00: Entire Application / Blank Canvas */}
                <button
                  type="button"
                  onClick={() => { setChoice(""); setCustomHostPath(""); }}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-all ${
                    !choice && !customHostPath && compositionType === "scene"
                      ? "border border-[var(--seene-accent)] bg-[var(--seene-surface-2)] text-[var(--seene-text)] shadow-sm"
                      : "border border-transparent hover:bg-[var(--seene-surface-2)] text-[var(--seene-text-muted)] hover:text-[var(--seene-text)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] text-[var(--seene-accent)] font-semibold shrink-0">00</span>
                    <div className="min-w-0">
                      <strong className="block font-medium text-[var(--seene-text)]">Entire Application / Blank Canvas</strong>
                      <span className="block truncate text-[11px] opacity-70">Creates a clean scene container</span>
                    </div>
                  </div>
                  {!choice && !customHostPath && compositionType === "scene" ? <span className="text-[var(--seene-accent)] font-bold text-sm shrink-0">✓</span> : null}
                </button>

                {content.loading ? (
                  <div className="p-6 text-center text-xs text-[var(--seene-text-muted)]">
                    Scanning project components…
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--seene-text-muted)]">
                    {search ? `No components match "${search}"` : "No project components found in src/, app/ or pages/"}
                  </div>
                ) : (
                  filteredFiles.map((file, idx) => {
                    const val = selectionValue({ file: file.path });
                    const isSelected = compositionType === "scene" ? choice === val : selectedSections.some(s => selectionValue(s) === val);
                    const indexStr = String(idx + 1).padStart(2, "0");

                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => handleSelectFile(file.path, undefined, file.title)}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-all ${
                          isSelected
                            ? "border border-[var(--seene-accent)] bg-[var(--seene-surface-2)] text-[var(--seene-text)] shadow-sm"
                            : "border border-transparent hover:bg-[var(--seene-surface-2)] text-[var(--seene-text-muted)] hover:text-[var(--seene-text)]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-[11px] text-[var(--seene-text-muted)] font-semibold shrink-0">
                            {indexStr}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <strong className="font-medium text-[var(--seene-text)] truncate">
                                {file.title || file.path.split("/").pop()?.replace(/\.[jt]sx$/, "")}
                              </strong>
                              {file.kind ? (
                                <span className="rounded bg-[var(--seene-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--seene-text-muted)] border border-[var(--seene-border)] uppercase shrink-0">
                                  {file.kind}
                                </span>
                              ) : null}
                              {file.route ? (
                                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] text-blue-400 border border-blue-500/20 shrink-0">
                                  {file.route}
                                </span>
                              ) : null}
                            </div>
                            <span className="block truncate font-mono text-[11px] opacity-70 mt-0.5">
                              {file.path}
                            </span>
                          </div>
                        </div>

                        {isSelected ? <span className="text-[var(--seene-accent)] font-bold text-sm shrink-0">{compositionType === "walkthrough" ? "+ Added" : "✓"}</span> : null}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-[var(--seene-text-muted)]">
                {allFiles.length > 0 ? `${allFiles.length} project targets discovered.` : content.error || "Discovering application content…"}
              </p>
            </div>

            {error ? <Notice>{error}</Notice> : null}
          </div>

          {/* Footer Actions */}
          <footer className="flex items-center justify-between border-t border-[var(--seene-border)] px-6 py-4 bg-[var(--seene-surface)] shrink-0">
            <a
              className="rounded-xl border border-[var(--seene-border)] px-4 py-2 text-xs font-medium text-[var(--seene-text-muted)] hover:text-[var(--seene-text)] hover:bg-[var(--seene-surface-2)] transition-colors"
              href={studioHref(project)}
              onClick={onClose}
            >
              Cancel
            </a>

            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--seene-accent)] px-5 py-2 text-xs font-medium text-[var(--seene-surface)] transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {saving ? "Creating Scene…" : "Create Scene"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
