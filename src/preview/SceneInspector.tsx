import { useState, useEffect, useCallback, useRef } from "react";
import type { CameraInput } from "../core";
import { PRESENTATION_PRESETS, applyPresentationPreset, subjectFocusDistance, subjectIsFocused, type PresentationPresetName, type PreviewDefinitionInput } from "../core/preview";
import { parseBackdropMode } from "./backdrop";

const CAMERA_MOTION_PRESETS = {
  dolly: { name: "Dolly", description: "Camera moves toward the subject" },
  orbit: { name: "Orbit", description: "Slow horizontal orbit around the scene" },
  push: { name: "Push", description: "Start wide, close in on the subject" },
  pull: { name: "Pull", description: "Start close, pull back to reveal context" },
} as const;

type MotionTracks = NonNullable<NonNullable<PreviewDefinitionInput["motion"]>["tracks"]>;
type MotionTrack = MotionTracks[number];

type CameraAxisTrack = {
  property: "z" | "perspective" | "y";
  keyframes: Array<{ timeMs: number; value: number; easing: string }>;
};

function withCamera(definition: PreviewDefinitionInput, camera: CameraInput): PreviewDefinitionInput {
  const focus = definition.scene.focus;
  const nextFocus = focus && subjectIsFocused(definition)
    ? { ...focus, distance: subjectFocusDistance(camera) }
    : focus;
  return {
    ...definition,
    scene: {
      ...definition.scene,
      camera,
      ...(nextFocus ? { focus: nextFocus } : {}),
    },
  };
}


function focusTrackForCamera(camera: CameraInput, cameraTracks: CameraAxisTrack[]): MotionTrack | null {
  const basePerspective = camera.perspective ?? 1400;
  const baseZ = camera.z ?? 0;
  const keys = new Map<number, { perspective?: number; z?: number; easing?: string }>();
  for (const track of cameraTracks) {
    if (track.property !== "perspective" && track.property !== "z") continue;
    for (const frame of track.keyframes) {
      const entry = keys.get(frame.timeMs) ?? {};
      if (track.property === "perspective") entry.perspective = frame.value;
      else entry.z = frame.value;
      if (!entry.easing) entry.easing = frame.easing;
      keys.set(frame.timeMs, entry);
    }
  }
  if (keys.size === 0) return null;
  const keyframes = [...keys.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([timeMs, entry]) => ({
      timeMs,
      value: (entry.perspective ?? basePerspective) + (entry.z ?? baseZ),
      easing: entry.easing ?? "easeInOut",
    }));
  return { target: { kind: "focus" }, property: "distance", keyframes };
}

export function applyCameraMotionPreset(definition: PreviewDefinitionInput, preset: keyof typeof CAMERA_MOTION_PRESETS): PreviewDefinitionInput {
  const duration = definition.motion?.durationMs ?? 5000;
  let cameraTracks: CameraAxisTrack[];
  switch (preset) {
    case "dolly":
      cameraTracks = [{ property: "z", keyframes: [
        { timeMs: 0, value: -120, easing: "easeInOut" },
        { timeMs: duration, value: 80, easing: "easeInOut" },
      ]}];
      break;
    case "orbit":
      cameraTracks = [{ property: "y", keyframes: [
        { timeMs: 0, value: -80, easing: "cinematic" },
        { timeMs: duration, value: 80, easing: "cinematic" },
      ]}];
      break;
    case "push":
      cameraTracks = [
        { property: "z", keyframes: [
          { timeMs: 0, value: 120, easing: "easeInOut" },
          { timeMs: duration, value: -40, easing: "easeInOut" },
        ]},
        { property: "perspective", keyframes: [
          { timeMs: 0, value: 2000, easing: "easeInOut" },
          { timeMs: duration, value: 1400, easing: "easeInOut" },
        ]},
      ];
      break;
    case "pull":
      cameraTracks = [
        { property: "z", keyframes: [
          { timeMs: 0, value: -80, easing: "easeInOut" },
          { timeMs: duration, value: 100, easing: "easeInOut" },
        ]},
        { property: "perspective", keyframes: [
          { timeMs: 0, value: 1200, easing: "easeInOut" },
          { timeMs: duration, value: 2200, easing: "easeInOut" },
        ]},
      ];
      break;
  }
  const tracks: MotionTracks = cameraTracks.map(track => ({
    target: { kind: "camera" as const },
    property: track.property,
    keyframes: track.keyframes,
  }));
  if (subjectIsFocused(definition)) {
    const focusTrack = focusTrackForCamera(definition.scene.camera ?? {}, cameraTracks);
    if (focusTrack) tracks.push(focusTrack);
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
  /** Render as a docked studio column (Scene workspace) instead of a fixed overlay. */
  docked?: boolean;
  compositionMode?: "scene" | "walkthrough";
  onCompositionModeChange?: (mode: "scene" | "walkthrough") => void;
};

export function SceneInspector({
  definition,
  onChange,
  onSaveDefinition,
  isOpen,
  onToggle,
  docked = false,
  compositionMode = "scene",
  onCompositionModeChange,
}: SceneInspectorProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [tab, setTab] = useState<"camera" | "motion" | "scene">(compositionMode === "walkthrough" ? "motion" : "camera");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const open = isOpen !== undefined ? isOpen : internalIsOpen;
  const toggle = onToggle || (() => setInternalIsOpen(!open));

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        toggle();
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, toggle]);

  if (!definition) return null;

  const camera = definition.scene?.camera ?? {};
  const focus = definition.scene?.focus ?? {};
  const sceneInfo = definition.scene;
  const durMs = definition.motion?.durationMs ?? 0;
  const { mode, color } = parseBackdropMode(definition.backdrop);
  const sizingMode = definition.sizingMode ?? "fixed";

  const updateCamera = (key: string, val: number) => {
    if (!onChange) return;
    onChange(withCamera(definition, { ...camera, [key]: val } as CameraInput));
  };

  const updateFocus = (key: string, val: number) => {
    if (!onChange) return;
    onChange({
      ...definition,
      scene: {
        ...definition.scene,
        focus: { ...focus, [key]: val },
      },
    });
  };

  const updateDuration = (val: number) => {
    if (!onChange) return;
    onChange({
      ...definition,
      motion: { ...(definition.motion || { durationMs: 2000, tracks: [] }), durationMs: val },
    });
  };

  const updateWalkthroughSetting = (key: string, value: number | string | boolean) => {
    if (!onChange) return;
    onChange({
      ...definition,
      walkthroughSettings: {
        ...definition.walkthroughSettings,
        [key]: value,
      },
    });
  };

  const updateWalkthroughDuration = (seconds: number) => {
    if (!onChange) return;
    const durationMs = Math.max(100, Math.round(seconds * 1000));
    onChange({
      ...definition,
      motion: {
        durationMs,
        speed: 1,
        tracks: (definition.motion?.tracks ?? []).map(track => ({
          ...track,
          keyframes: track.keyframes.filter(frame => frame.timeMs <= durationMs),
        })),
      },
      walkthroughSettings: {
        ...definition.walkthroughSettings,
        durationAuto: false,
      },
    });
  };

  const updateSizingMode = (nextMode: "fixed" | "viewport" | "content") => {
    if (!onChange) return;
    onChange({
      ...definition,
      sizingMode: nextMode,
      minHeight: nextMode === "viewport" ? "100vh" : undefined,
    });
  };

  const updateMinHeight = (val: string) => {
    if (!onChange) return;
    onChange({
      ...definition,
      minHeight: val.trim() || undefined,
    });
  };

  const isPresetActive = (key: PresentationPresetName) => {
    const camera = definition.scene.camera ?? {};
    return Object.entries(PRESENTATION_PRESETS[key]).every(([field, value]) =>
      typeof value !== "object" && (camera as Record<string, unknown>)[field] === value,
    );
  };

  const selectPreset = (key: PresentationPresetName) => {
    if (!onChange) return;
    onChange(applyPresentationPreset(definition, key));
  };

  const resetCamera = () => {
    if (!onChange) return;
    onChange(withCamera(definition, { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, perspective: 1800 }));
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
    <div className={docked ? "seene-inspector-anchor" : "relative"}>
      {!open ? (
      <button
        type="button"
        ref={triggerRef}
        className={`appearance-none border rounded-full px-4 py-2 text-xs font-medium inline-flex items-center gap-2 cursor-pointer transition-all duration-200 ${
          open
            ? "border-[var(--seene-accent)] bg-[var(--seene-accent)] text-[var(--seene-surface)] shadow-md"
            : "border-white/20 bg-[var(--seene-surface-2)] text-[var(--seene-text)] hover:bg-[var(--seene-border-text)]"
        }`}
        onClick={toggle}
        aria-expanded={open}
        aria-controls="scene-inspector-panel"
      >
        <span aria-hidden="true">⚙</span>
        <span>Scene Inspector</span>
      </button>
      ) : null}

      {open ? (
        <aside
          id="scene-inspector-panel"
          data-seene-chrome="inspector-panel"
          className={`seene-inspector-panel fixed inset-y-0 right-0 w-96 max-w-full bg-[#121215]/95 border-l border-zinc-800/80 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto backdrop-blur-xl text-zinc-200 font-sans${docked ? " seene-inspector-panel--docked" : ""}`}
        >
          <div className="p-5 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight">Studio Inspector</h3>
                <p className="text-[11px] text-zinc-400">Camera, lens, composition & playback</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  toggle();
                  requestAnimationFrame(() => triggerRef.current?.focus());
                }}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
                aria-label="Close inspector"
              >
                ✕
              </button>
            </div>

            <div className="seene-inspector-tabs" role="tablist" aria-label="Inspector sections">
              {([["camera", "Camera"], ["motion", "Motion"], ["scene", "Scene"]] as const).map(([id, label]) => (
                <button key={id} type="button" className="seene-control seene-small" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            {/* Mode Selection: Scene vs Full-Page Walkthrough */}
            {onCompositionModeChange && tab === "scene" ? (
              <div className="space-y-2 bg-zinc-900/80 rounded-xl p-3 border border-zinc-800">
                <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Composition Mode</h4>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => onCompositionModeChange("scene")}
                    className={`py-1.5 px-3 rounded-md font-medium text-center transition-all ${
                      compositionMode === "scene"
                        ? "bg-zinc-800 text-white shadow-sm font-semibold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Focused Scene
                  </button>
                  <button
                    type="button"
                    onClick={() => onCompositionModeChange("walkthrough")}
                    className={`py-1.5 px-3 rounded-md font-medium text-center transition-all ${
                      compositionMode === "walkthrough"
                        ? "bg-zinc-800 text-white shadow-sm font-semibold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Full-Page Scroll
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  {compositionMode === "scene"
                    ? "3D spatial scene camera framing a single target surface."
                    : "Scroll-through presentation animating from page hero to footer."}
                </p>
              </div>
            ) : null}

            {/* Scene Info & Sizing */}
            <div className={tab === "scene" ? "bg-zinc-900/80 rounded-xl p-3.5 space-y-3 border border-zinc-800" : "hidden"} data-inspector-tab="scene">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Sizing & Layout</h4>
              <div className="text-xs text-zinc-400 space-y-2">
                <div className="seene-fact-row">
                  <span>Surface ID</span>
                  <span className="seene-field-code">
                    {sceneInfo?.nodes?.[0]?.id || "host"}
                  </span>
                </div>
                <div className="seene-fact-row">
                  <span>Virtual Dimensions</span>
                  <span className="seene-field-code">{definition.width || 1400} × {definition.height || 980} px</span>
                </div>

                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <label className="seene-field-label">Sizing Mode</label>
                  <div className="seene-preset-grid">
                    {(["fixed", "viewport", "content"] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateSizingMode(m)}
                        className={`py-1 rounded text-[11px] capitalize transition-all ${
                          sizingMode === m
                            ? "bg-zinc-800 text-white font-medium shadow-sm"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {sizingMode === "viewport" || sizingMode === "content" ? (
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-400">Min Height</span>
                      <input
                        type="text"
                        value={definition.minHeight ?? "100vh"}
                        placeholder="100vh or 100dvh"
                        onChange={e => updateMinHeight(e.target.value)}
                        className="w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Presentation Presets */}
            <div className={tab === "scene" ? "space-y-3" : "hidden"} data-inspector-tab="scene">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Camera Presets</h4>
              <div className="seene-preset-grid">
                {(Object.keys(PRESENTATION_PRESETS) as PresentationPresetName[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectPreset(key)}
                    data-selected={isPresetActive(key)}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-center text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
                  >
                    {PRESENTATION_PRESETS[key].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera & Lens */}
            <div className={tab === "camera" ? "space-y-3" : "hidden"} data-inspector-tab="camera">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Camera & Lens</h4>

              <div className="seene-field-grid">
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Cam X</span>
                  <input
                    type="number"
                    value={camera.x ?? 0}
                    onChange={(e) => updateCamera("x", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Cam Y</span>
                  <input
                    type="number"
                    value={camera.y ?? 0}
                    onChange={(e) => updateCamera("y", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Cam Z</span>
                  <input
                    type="number"
                    value={camera.z ?? 0}
                    onChange={(e) => updateCamera("z", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="seene-field-grid">
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Rot X°</span>
                  <input
                    type="number"
                    value={camera.rotateX ?? 0}
                    onChange={(e) => updateCamera("rotateX", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Rot Y°</span>
                  <input
                    type="number"
                    value={camera.rotateY ?? 0}
                    onChange={(e) => updateCamera("rotateY", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Rot Z°</span>
                  <input
                    type="number"
                    value={camera.rotateZ ?? 0}
                    onChange={(e) => updateCamera("rotateZ", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              {/* Sliders */}
              <div className="space-y-3 pt-2">
                <label className="block space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Perspective</span>
                    <span className="font-mono text-zinc-200">{camera.perspective ?? 1400}px</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="5000"
                    step="50"
                    value={camera.perspective ?? 1400}
                    onChange={(e) => updateCamera("perspective", parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Focal Length</span>
                    <span className="font-mono text-zinc-200">{focus.focalLength ?? 50}mm</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="300"
                    step="5"
                    value={focus.focalLength ?? 50}
                    onChange={(e) => updateFocus("focalLength", parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>F-Stop / Aperture</span>
                    <span className="font-mono text-zinc-200">f/{focus.fStop ?? 8}</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="22"
                    step="0.5"
                    value={focus.fStop ?? 8}
                    onChange={(e) => updateFocus("fStop", parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </label>

                <label className="block space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Focus Distance</span>
                    <span className="font-mono text-zinc-200">{focus.distance ?? 1400}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="50"
                    value={focus.distance ?? 1400}
                    onChange={(e) => updateFocus("distance", parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </label>
              </div>
            </div>

            {/* Backdrop */}
            <div className="space-y-2.5 pt-2 border-t border-zinc-800">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Backdrop</h4>
                <div className="seene-backdrop-row">
                <label className="seene-radio-label">
                  <input
                    type="radio"
                    name="seene-backdrop"
                    value="site"
                    checked={mode === "site"}
                    onChange={() => updateBackdrop("site")}
                    className="accent-indigo-500"
                  />
                  <span>Site BG</span>
                </label>
                <label className="seene-radio-label">
                  <input
                    type="radio"
                    name="seene-backdrop"
                    value="transparent"
                    checked={mode === "transparent"}
                    onChange={() => updateBackdrop("transparent")}
                    className="accent-indigo-500"
                  />
                  <span>Transparent</span>
                </label>
                <label className="seene-radio-label">
                  <input
                    type="radio"
                    name="seene-backdrop"
                    value="custom"
                    checked={mode === "custom"}
                    onChange={() => updateBackdrop(color ?? "#000000")}
                    className="accent-indigo-500"
                  />
                  <span>Custom</span>
                </label>
              </div>
              {mode === "custom" ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    aria-label="Custom backdrop color"
                    value={color ?? "#000000"}
                    onChange={(e) => updateBackdrop(e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border border-zinc-800 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    aria-label="Custom backdrop color value"
                    value={color ?? "#000000"}
                    onChange={(e) => updateCustomBackdrop(e.target.value)}
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ) : null}
            </div>

            {/* Camera Motion Presets */}
            <div className={tab === "motion" ? "space-y-2.5 pt-2 border-t border-zinc-800" : "hidden"} data-inspector-tab="motion">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Camera Motion Presets
              </h4>
              <div className="seene-preset-grid seene-preset-grid--two">
                {Object.entries(CAMERA_MOTION_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange?.(applyCameraMotionPreset(definition, key as keyof typeof CAMERA_MOTION_PRESETS))}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {compositionMode === "walkthrough" ? (
              <div className={tab === "motion" ? "space-y-3 pt-2 border-t border-zinc-800" : "hidden"} data-inspector-tab="motion">
                <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Walkthrough</h4>
                <label className="block space-y-1 text-xs text-zinc-400">
                  <span>Duration (seconds)</span>
                  <input
                    type="number"
                    aria-label="Walkthrough duration (seconds)"
                    min="0.1"
                    step="0.5"
                    value={durMs / 1000}
                    onChange={event => updateWalkthroughDuration(parseFloat(event.target.value) || 0.1)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100"
                  />
                </label>
                <label className="block space-y-1 text-xs text-zinc-400">
                  <span>Easing</span>
                  <select
                    aria-label="Walkthrough easing"
                    value={definition.walkthroughSettings?.easing ?? "linear"}
                    onChange={event => updateWalkthroughSetting("easing", event.target.value)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100"
                  >
                    <option value="linear">Linear</option>
                    <option value="ease-in-out">Ease in-out</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs text-zinc-400">
                    <span>Hold at top (s)</span>
                    <input type="number" aria-label="Hold at top (seconds)" min="0" step="0.5" value={(definition.walkthroughSettings?.holdAtTopMs ?? 0) / 1000} onChange={event => updateWalkthroughSetting("holdAtTopMs", Math.max(0, Number(event.target.value) || 0) * 1000)} className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100" />
                  </label>
                  <label className="space-y-1 text-xs text-zinc-400">
                    <span>Hold at bottom (s)</span>
                    <input type="number" aria-label="Hold at bottom (seconds)" min="0" step="0.5" value={(definition.walkthroughSettings?.holdAtBottomMs ?? 0) / 1000} onChange={event => updateWalkthroughSetting("holdAtBottomMs", Math.max(0, Number(event.target.value) || 0) * 1000)} className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100" />
                  </label>
                </div>
                <label className="block space-y-1 text-xs text-zinc-400">
                  <span>Start offset (px or section ID)</span>
                  <input type="text" aria-label="Walkthrough start offset" value={String(definition.walkthroughSettings?.startOffset ?? "")} onChange={event => updateWalkthroughSetting("startOffset", event.target.value)} className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100" />
                </label>
                <label className="block space-y-1 text-xs text-zinc-400">
                  <span>End offset (px or section ID)</span>
                  <input type="text" aria-label="Walkthrough end offset" value={String(definition.walkthroughSettings?.endOffset ?? "")} onChange={event => updateWalkthroughSetting("endOffset", event.target.value)} className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100" />
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" aria-label="Autoplay walkthrough" checked={definition.walkthroughSettings?.autoplay ?? false} onChange={event => updateWalkthroughSetting("autoplay", event.target.checked)} className="accent-indigo-500" />
                  Autoplay
                </label>
              </div>
            ) : null}

            {/* Motion Duration */}
            {compositionMode !== "walkthrough" ? <div className={tab === "motion" ? "space-y-2 pt-2 border-t border-zinc-800" : "hidden"} data-inspector-tab="motion">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium uppercase tracking-wider text-zinc-400">Motion Duration</span>
                <span className="font-mono text-zinc-200">{(durMs / 1000).toFixed(1)}s</span>
              </div>
              <input
                type="number"
                step="500"
                min="0"
                value={durMs}
                onChange={(e) => updateDuration(parseFloat(e.target.value) || 2000)}
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
              />
            </div> : null}

            {/* Action Buttons */}
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <button
                type="button"
                onClick={resetCamera}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
              >
                Reset Camera
              </button>
              <button
                type="button"
                data-testid="seene-inspector-save"
                onClick={handleSave}
                disabled={!onSaveDefinition}
                title={onSaveDefinition ? undefined : "This preview is not connected to a scene file, so there is nothing to save."}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {onSaveDefinition ? "Save Scene Settings" : "Preview only - nothing to save"}
              </button>
              {!onSaveDefinition ? (
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Changes apply to this preview immediately. Save is available when the studio is opened from a project scene file.
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
