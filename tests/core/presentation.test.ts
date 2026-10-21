import { describe, it, expect } from "vitest";
import {
  PRESENTATION_PRESETS,
  applyPresentationPreset,
  subjectFocusDistance,
  subjectIsFocused,
  type PresentationPresetName,
  type PreviewDefinitionInput,
} from "../../src/core/preview";
import { PRESENTATIONS, applyPresentation, presentation } from "../../src/core/presentation";
import { evaluateMotion } from "../../src/core/motion";
import { uniformFocusBlur } from "../../src/core/spatial";

describe("presentation presets", () => {
  it("defines all 10 presentation presets", () => {
    const keys = Object.keys(PRESENTATION_PRESETS);
    expect(keys).toEqual([
      "clean", "focus", "depth", "soft-blur", "cinematic",
      "product", "hero", "wide", "close", "dramatic"
    ]);
  });

  it.each(Object.keys(PRESENTATION_PRESETS) as PresentationPresetName[])("applies preset %s to a definition", presetName => {
    const base = {
      scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "surface" }] },
      width: 1400,
      height: 980,
    };
    const updated = applyPresentationPreset(base, presetName);
    const preset = PRESENTATION_PRESETS[presetName];
    expect(updated.scene.camera).toMatchObject(preset.camera);
    expect(updated.scene.focus).toMatchObject(preset.focus);
  });

  it.each(Object.keys(PRESENTATION_PRESETS) as PresentationPresetName[])("preset %s keeps the subject surface on the focal plane", presetName => {
    const base = { scene: { version: 3 as const, camera: {}, focus: {}, nodes: [{ id: "surface" }] } };
    const updated = applyPresentationPreset(base, presetName);
    // The app surface sits at perspective + camera.z from the lens. A preset must
    // frame it without knocking it out of focus.
    expect(updated.scene.focus?.distance).toBe(subjectFocusDistance(updated.scene.camera));
    expect(subjectIsFocused(updated)).toBe(true);
  });

  it("treats a deliberate focus pull as out of focus", () => {
    const definition = {
      scene: {
        version: 3 as const,
        camera: { perspective: 1800, z: 0 },
        focus: { distance: 900, fStop: 8, focalLength: 50, maxBlur: 6 },
        nodes: [{ id: "surface" }],
      },
    };
    expect(subjectFocusDistance(definition.scene.camera)).toBe(1800);
    expect(subjectIsFocused(definition)).toBe(false);
  });

  it("accounts for camera z when measuring subject distance", () => {
    expect(subjectFocusDistance({ perspective: 1800, z: 400 })).toBe(2200);
    expect(subjectFocusDistance({ perspective: 2000, z: -100 })).toBe(1900);
  });

  it("keeps every sharp preset sharp when the host plays its own depth-of-field blur", () => {
    const ranking = { scene: { version: 3 as const, camera: {}, focus: { maxBlur: 8 }, nodes: [{ id: "surface" }] } };
    const updated = applyPresentationPreset(ranking, "clean");
    expect(updated.scene.focus?.maxBlur).toBe(0);
    expect(updated.scene.focus?.distance).toBe(1800);
    expect(subjectIsFocused(updated)).toBe(true);
  });
});

describe("authored treatments", () => {
  const base: PreviewDefinitionInput = {
    scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "surface" }] },
    motion: { durationMs: 5000, speed: 1, tracks: [] },
  };
  const sampledTimes = [0, 0.25, 0.5, 0.75, 1];

  it.each(PRESENTATIONS.map(item => item.id))(
    "treatment %s keeps the subject sharp for the whole move",
    id => {
      const applied = applyPresentation(base, id);
      const durationMs = presentation(id).durationMs;
      const focusSettings = applied.scene.focus!;
      for (const fraction of sampledTimes) {
        const timeMs = Math.round(durationMs * fraction);
        const state = evaluateMotion(applied.motion, timeMs);
        const camera = { ...applied.scene.camera, ...state.camera };
        const focusDistance = state.focus.distance ?? focusSettings.distance!;
        // The subject is not static: an entrance cascade displaces it in z during
        // the move, and each treatment's focus track is authored to follow that
        // live depth (see the parallax treatment note). Measure the actual
        // camera-space depth the renderer computes, not the rest depth.
        const surfaceZ = applied.motion!.tracks.reduce((z, track) => {
          if (track.target.kind !== "surface" || track.property !== "z") return z;
          const value = (state.surfaces as Record<string, Record<string, number>>)[track.target.id]?.[track.property];
          return typeof value === "number" && track.target.id === "surface" ? value : z;
        }, 0);
        const subjectDepth = subjectFocusDistance(camera) - surfaceZ;
        const distance = Math.abs(focusDistance - subjectDepth);
        const blur = uniformFocusBlur(
          { depth: 0, distance, span: 100, maxBlur: focusSettings.maxBlur, fStop: focusSettings.fStop, focalLength: focusSettings.focalLength, scale: 1 },
          100,
        );
        // Natural focus breathing is fine; losing the subject to defocus is not.
        expect(blur, `${id} at ${timeMs}ms`).toBeLessThan(0.5);
      }
    },
  );
});
