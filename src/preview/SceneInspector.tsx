import { useState, useEffect, useCallback } from "react";
import { PRESENTATION_PRESETS, applyPresentationPreset, type PresentationPresetName, type PreviewDefinitionInput } from "../core/preview";
import { parseBackdropMode } from "./backdrop";

const CAMERA_MOTION_PRESETS = {
  dolly: { name: "Dolly", description: "Camera moves toward the subject" },
  orbit: { name: "Orbit", description: "Slow horizontal orbit around the scene" },
  push: { name: "Push", description: "Start wide, close in on the subject" },
  pull: { name: "Pull", description: "Start close, pull back to reveal context" },
} as const;

function applyCameraMotionPreset(definition: PreviewDefinitionInput, preset: keyof typeof CAMERA_MOTION_PRESETS): PreviewDefinitionInput {
  const duration = definition.motion?.durationMs ?? 5000;
  let tracks: NonNullable<NonNullable<PreviewDefinitionInput["motion"]>["tracks"]>;
  switch (preset) {
    case "dolly":
      tracks = [{ target: { kind: "camera" }, property: "z", keyframes: [
        { timeMs: 0, value: -120, easing: "easeInOut" },
        { timeMs: duration, value: 80, easing: "easeInOut" },
      ]}];
      break;
    case "orbit":
      tracks = [{ target: { kind: "camera" }, property: "y", keyframes: [
        { timeMs: 0, value: -80, easing: "cinematic" },
        { timeMs: duration, value: 80, easing: "cinematic" },
      ]}];
      break;
    case "push":
      tracks = [
        { target: { kind: "camera" }, property: "z", keyframes: [
          { timeMs: 0, value: 120, easing: "easeInOut" },
          { timeMs: duration, value: -40, easing: "easeInOut" },
        ]},
        { target: { kind: "camera" }, property: "perspective", keyframes: [
          { timeMs: 0, value: 2000, easing: "easeInOut" },
          { timeMs: duration, value: 1400, easing: "easeInOut" },
        ]},
      ];
      break;
    case "pull":
      tracks = [
        { target: { kind: "camera" }, property: "z", keyframes: [
          { timeMs: 0, value: -80, easing: "easeInOut" },
          { timeMs: duration, value: 100, easing: "easeInOut" },
        ]},
        { target: { kind: "camera" }, property: "perspective", keyframes: [
          { timeMs: 0, value: 1200, easing: "easeInOut" },
          { timeMs: duration, value: 2200, easing: "easeInOut" },
        ]},
      ];
      break;
  }
  return {
    ...definition,
    motion: { durationMs: duration, speed: definition.motion?.speed ?? 0.8, tracks },
  };
}

export type SceneInspectorProps = {
  definition?: PreviewDefinitionInput;
  onChange?: (updated: PreviewDefinitionInput) => void;
  onSaveDefinition?: (definition: PreviewDefinitionInput) => void;
  isOpen?: boolean;
  onToggle?: () => void;
};

export function SceneInspector({definition, onChange, onSaveDefinition, isOpen, onToggle}: SceneInspectorProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalIsOpen;
  const toggle = onToggle || (() => setInternalIsOpen(!open));

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        toggle();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, toggle]);

  if (!definition) return null;

  const camera = definition.scene?.camera ?? {};
  const focus = definition.scene?.focus ?? {};
  const sceneInfo = definition.scene;
  const durMs = definition.motion?.durationMs ?? 0;
  const { mode, color } = parseBackdropMode(definition.backdrop);

  const updateCamera = (key: string, val: number) => {
    if (!onChange) return;
    onChange({
      ...definition,
      scene: {
        ...definition.scene,
        camera: { ...camera, [key]: val }
      }
    });
  };

  const updateFocus = (key: string, val: number) => {
    if (!onChange) return;
    onChange({
      ...definition,
      scene: {
        ...definition.scene,
        focus: { ...focus, [key]: val }
      }
    });
  };

  const updateDuration = (val: number) => {
    if (!onChange) return;
    onChange({
      ...definition,
      motion: { ...(definition.motion || {durationMs: 2000, tracks: []}), durationMs: val }
    });
  };

  const selectPreset = (key: PresentationPresetName) => {
    if (!onChange) return;
    onChange(applyPresentationPreset(definition, key));
  };

  const resetCamera = () => {
    if (!onChange) return;
    onChange({
      ...definition,
      scene: {
        ...definition.scene,
        camera: { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, perspective: 1800 }
      }
    });
  };

  const updateBackdrop = (backdrop: string | undefined) => {
    if (!onChange) return;
    onChange({ ...definition, backdrop: backdrop && backdrop !== "site" ? backdrop : undefined });
  };

  const updateCustomBackdrop = (value: string) => {
    const trimmed = value.trim();
    if (!onChange) return;
    onChange(trimmed ? { ...definition, backdrop: trimmed } : { ...definition, backdrop: undefined });
  };

  const handleSave = useCallback(() => {
    if (!onSaveDefinition) return;
    onSaveDefinition(definition);
  }, [onSaveDefinition, definition]);

  return (
    <div className="relative">
      <button
        className="appearance-none border border-white/20 rounded-full px-4 py-2.5 bg-[var(--seene-surface-2)] text-[var(--seene-text)] text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-[var(--seene-border-text)] transition-all duration-200"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="scene-inspector-panel"
      >
        {open ? "Close Inspector" : "Scene Inspector"}
      </button>

      {open && (
        <div
          id="scene-inspector-panel"
          className="fixed inset-y-0 right-0 w-96 max-w-sm bg-[var(--seene-surface-2)] border-l border-[var(--seene-border-text)] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto"
        >
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--seene-border-text)]">
              <h3 className="text-lg font-semibold text-[var(--seene-text)]">Scene Inspector</h3>
              <button
                onClick={toggle}
                className="text-[var(--seene-text-muted)] hover:text-[var(--seene-text)] transition-colors"
                aria-label="Close inspector"
              >
                ×
              </button>
            </div>

            {/* Scene Info */}
            <div className="bg-[var(--seene-surface)] rounded-lg p-3 space-y-2">
              <h4 className="text-sm font-medium text-[var(--seene-text)]">Scene Information</h4>
              <div className="text-xs text-[var(--seene-text-muted)] space-y-1">
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span>{sceneInfo?.nodes?.[0]?.id || "home"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dimensions:</span>
                  <span>{definition.width || 1400}×{definition.height || 980}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{Math.floor((durMs || 0) / 1000)}s</span>
                </div>
              </div>
            </div>

            {/* Presentation Presets */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--seene-text)]">Presentation Presets</h4>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRESENTATION_PRESETS) as PresentationPresetName[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectPreset(key)}
                    className="rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-3 py-2 text-center text-xs font-medium text-[var(--seene-text)] transition-all hover:bg-[var(--seene-surface-2)] hover:text-[var(--seene-accent)]"
                  >
                    {PRESENTATION_PRESETS[key].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Controls */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--seene-text)]">Camera & Lens</h4>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Cam X</span>
                  <input
                    type="number"
                    value={camera.x ?? 0}
                    onChange={(e) => updateCamera("x", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-2 py-1 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Cam Y</span>
                  <input
                    type="number"
                    value={camera.y ?? 0}
                    onChange={(e) => updateCamera("y", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-2 py-1 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Cam Z</span>
                  <input
                    type="number"
                    value={camera.z ?? 0}
                    onChange={(e) => updateCamera("z", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-2 py-1 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Rot X</span>
                  <input
                    type="number"
                    value={camera.rotateX ?? 0}
                    onChange={(e) => updateCamera("rotateX", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-2 py-1 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Rot Y</span>
                  <input
                    type="number"
                    value={camera.rotateY ?? 0}
                    onChange={(e) => updateCamera("rotateY", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-2 py-1 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Rot Z</span>
                  <input
                    type="number"
                    value={camera.rotateZ ?? 0}
                    onChange={(e) => updateCamera("rotateZ", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-2 py-1 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Perspective</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--seene-text)]">{camera.perspective ?? 1400}</span>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="50"
                      value={camera.perspective ?? 1400}
                      onChange={(e) => updateCamera("perspective", parseFloat(e.target.value))}
                      className="flex-1 ml-3 accent-[var(--seene-accent)]"
                    />
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Focal Length</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--seene-text)]">{focus.focalLength ?? 50}</span>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      step="5"
                      value={focus.focalLength ?? 50}
                      onChange={(e) => updateFocus("focalLength", parseFloat(e.target.value))}
                      className="flex-1 ml-3 accent-[var(--seene-accent)]"
                    />
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">F-Stop</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--seene-text)]">{focus.fStop ?? 8}</span>
                    <input
                      type="range"
                      min="0.7"
                      max="22"
                      step="0.5"
                      value={focus.fStop ?? 8}
                      onChange={(e) => updateFocus("fStop", parseFloat(e.target.value))}
                      className="flex-1 ml-3 accent-[var(--seene-accent)]"
                    />
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[var(--seene-text-muted)]">Focus Distance</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--seene-text)]">{focus.distance ?? 1400}</span>
                    <input
                      type="range"
                      min="0"
                      max="3000"
                      step="50"
                      value={focus.distance ?? 1400}
                      onChange={(e) => updateFocus("distance", parseFloat(e.target.value))}
                      className="flex-1 ml-3 accent-[var(--seene-accent)]"
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Backdrop */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--seene-text)]">Backdrop</h4>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <input type="radio" name="seene-backdrop" value="site"
                    checked={mode === "site"}
                    onChange={() => updateBackdrop("site")} />
                  <span className="text-[var(--seene-text)]">Use site background</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="seene-backdrop" value="transparent"
                    checked={mode === "transparent"}
                    onChange={() => updateBackdrop("transparent")} />
                  <span className="text-[var(--seene-text)]">Transparent</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="seene-backdrop" value="custom"
                    checked={mode === "custom"}
                    onChange={() => updateBackdrop(color ?? "#000000")} />
                  <span className="text-[var(--seene-text)]">Custom</span>
                </label>
              </div>
              {mode === "custom" && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-[var(--seene-text-muted)]">Color</label>
                  <input
                    type="color"
                    aria-label="Custom backdrop color"
                    value={color ?? "#000000"}
                    onChange={(e) => updateBackdrop(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-[var(--seene-border-text)] bg-transparent p-0 outline-none"
                  />
                  <input
                    type="text"
                    aria-label="Custom backdrop color value"
                    value={color ?? "#000000"}
                    onChange={(e) => updateCustomBackdrop(e.target.value)}
                    className="flex-1 rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-2 py-1 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Camera Motion Presets */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-[var(--seene-text-muted)] uppercase tracking-wider">
                Camera Motion Presets
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CAMERA_MOTION_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange?.(applyCameraMotionPreset(definition, key as keyof typeof CAMERA_MOTION_PRESETS))}
                    className="rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-3 py-2 text-center text-xs font-medium text-[var(--seene-text)] transition-all hover:bg-[var(--seene-surface-2)] hover:text-[var(--seene-accent)]"
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Motion Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-[var(--seene-text-muted)] uppercase tracking-wider">
                Motion
              </h4>
              <label className="block space-y-2">
                <span className="text-xs text-[var(--seene-text-muted)]">Motion Duration (ms):</span>
                <input
                  type="number"
                  step="500"
                  value={durMs}
                  onChange={(e) => updateDuration(parseFloat(e.target.value) || 2000)}
                  className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-3 py-2 text-xs text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none"
                />
              </label>
            </div>

            {/* Reset Button */}
            <div className="pt-3 border-t border-[var(--seene-border-text)] space-y-3">
              <button
                onClick={resetCamera}
                className="w-full rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface)] px-3 py-2 text-xs font-medium text-[var(--seene-text)] transition-all hover:bg-[var(--seene-surface-2)]"
              >
                Reset Camera
              </button>
              <button
                type="button"
                data-testid="seene-inspector-save"
                onClick={handleSave}
                disabled={!onSaveDefinition}
                className="w-full rounded-lg border border-[var(--seene-accent)] bg-[var(--seene-accent)] px-3 py-2 text-xs font-medium text-[var(--seene-surface)] transition-all hover:bg-[var(--seene-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Backdrop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
