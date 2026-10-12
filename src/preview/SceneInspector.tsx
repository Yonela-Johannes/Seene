import { useState } from "react";
import { PRESENTATION_PRESETS, applyPresentationPreset, type PresentationPresetName, type PreviewDefinitionInput } from "../core/preview";

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
};

export function SceneInspector({definition, onChange}: SceneInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!definition) return null;

  const camera = definition.scene?.camera ?? {};
  const focus = definition.scene?.focus ?? {};
  const durMs = definition.motion?.durationMs ?? 0;

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

  return <div className="relative">
    <button className="appearance-none border border-white/20 rounded-full px-4 py-2.5 bg-[var(--seene-surface-2)] text-[var(--seene-text)] text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-[var(--seene-border-text)] transition-colors" onClick={() => setIsOpen(!isOpen)}>
      {isOpen ? "Close Inspector" : "Scene Inspector"}
    </button>
    {isOpen && <div className="absolute bottom-16 right-0 w-84 max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)]/95 p-5 text-xs text-[var(--seene-text)] shadow-2xl backdrop-blur-xl z-50">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--seene-text)]">Presentation Presets</h3>
        <button type="button" onClick={resetCamera} className="text-[11px] text-[var(--seene-text-muted)] hover:text-[var(--seene-text)] underline">Reset Camera</button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-1.5">
        {(Object.keys(PRESENTATION_PRESETS) as PresentationPresetName[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => selectPreset(key)}
            className="rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2.5 py-1.5 text-center text-[11px] font-medium text-[var(--seene-text)] transition-colors hover:bg-[var(--seene-surface)] hover:text-[var(--seene-accent)]"
          >
            {PRESENTATION_PRESETS[key].name}
          </button>
        ))}
      </div>

      <h3 className="mb-3 text-sm font-semibold text-[var(--seene-text)]">Camera & Lens</h3>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <label className="space-y-1"><span>Cam X</span> <input type="number" value={camera.x ?? 0} onChange={e => updateCamera("x", parseFloat(e.target.value) || 0)} className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2 py-1 text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none" /></label>
        <label className="space-y-1"><span>Cam Y</span> <input type="number" value={camera.y ?? 0} onChange={e => updateCamera("y", parseFloat(e.target.value) || 0)} className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2 py-1 text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none" /></label>
        <label className="space-y-1"><span>Cam Z</span> <input type="number" value={camera.z ?? 0} onChange={e => updateCamera("z", parseFloat(e.target.value) || 0)} className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2 py-1 text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none" /></label>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <label className="space-y-1"><span>Rot X</span> <input type="number" value={camera.rotateX ?? 0} onChange={e => updateCamera("rotateX", parseFloat(e.target.value) || 0)} className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2 py-1 text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none" /></label>
        <label className="space-y-1"><span>Rot Y</span> <input type="number" value={camera.rotateY ?? 0} onChange={e => updateCamera("rotateY", parseFloat(e.target.value) || 0)} className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2 py-1 text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none" /></label>
        <label className="space-y-1"><span>Rot Z</span> <input type="number" value={camera.rotateZ ?? 0} onChange={e => updateCamera("rotateZ", parseFloat(e.target.value) || 0)} className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2 py-1 text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none" /></label>
      </div>

      <div className="mb-3">
        <label className="block space-y-1"><span>Perspective: {camera.perspective ?? 1400}</span>
          <input type="range" min="100" max="5000" step="50" value={camera.perspective ?? 1400} onChange={e => updateCamera("perspective", parseFloat(e.target.value))} className="w-full accent-[var(--seene-accent)]" />
        </label>
      </div>

      <div className="mb-3">
        <label className="block space-y-1"><span>Focal Length: {focus.focalLength ?? 50}</span>
          <input type="range" min="10" max="300" step="5" value={focus.focalLength ?? 50} onChange={e => updateFocus("focalLength", parseFloat(e.target.value))} className="w-full accent-[var(--seene-accent)]" />
        </label>
      </div>

      <div className="mb-3">
        <label className="block space-y-1"><span>F-Stop: {focus.fStop ?? 8}</span>
          <input type="range" min="0.7" max="22" step="0.5" value={focus.fStop ?? 8} onChange={e => updateFocus("fStop", parseFloat(e.target.value))} className="w-full accent-[var(--seene-accent)]" />
        </label>
      </div>

      <div className="mb-3">
        <label className="block space-y-1"><span>Focus Distance: {focus.distance ?? 1400}</span>
          <input type="range" min="0" max="3000" step="50" value={focus.distance ?? 1400} onChange={e => updateFocus("distance", parseFloat(e.target.value))} className="w-full accent-[var(--seene-accent)]" />
        </label>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--seene-text-muted)] uppercase tracking-wider mb-2">
          Camera Motion Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(CAMERA_MOTION_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange?.(applyCameraMotionPreset(definition, key as keyof typeof CAMERA_MOTION_PRESETS))}
              className="rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2.5 py-1.5 text-center text-[11px] font-medium text-[var(--seene-text)] transition-colors hover:bg-[var(--seene-surface)] hover:text-[var(--seene-accent)]"
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block space-y-1"><span>Motion Duration (ms):</span>
          <input type="number" step="500" value={durMs} onChange={e => updateDuration(parseFloat(e.target.value) || 2000)} className="w-full rounded border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-2 py-1 text-[var(--seene-text)] focus:border-[var(--seene-accent)] focus:outline-none" />
        </label>
      </div>
    </div>}
  </div>;
}
