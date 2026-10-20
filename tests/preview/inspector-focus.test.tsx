// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SceneInspector } from "../../src/preview/SceneInspector";
import { subjectFocusDistance, type PreviewDefinitionInput } from "../../src/core/preview";

afterEach(() => cleanup());

function focusedDefinition(): PreviewDefinitionInput {
  return {
    scene: {
      version: 3,
      camera: { perspective: 1800, x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 },
      focus: { distance: 1800, fStop: 8, focalLength: 50, maxBlur: 6 },
      nodes: [{ id: "host" }],
    },
  };
}

function renderInspector(definition: PreviewDefinitionInput) {
  const onChange = vi.fn();
  render(<SceneInspector definition={definition} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
  return onChange;
}

function lastCall(fn: ReturnType<typeof vi.fn>): PreviewDefinitionInput {
  return fn.mock.calls[fn.mock.calls.length - 1][0];
}

it("keeps the subject focused when the camera z changes", () => {
  const onChange = renderInspector(focusedDefinition());
  fireEvent.change(screen.getByRole("spinbutton", { name: /Cam Z/ }), { target: { value: "400" } });

  const emitted = lastCall(onChange);
  expect(emitted.scene.camera?.z).toBe(400);
  expect(emitted.scene.focus?.distance).toBe(subjectFocusDistance(emitted.scene.camera));
  expect(emitted.scene.focus?.distance).toBe(2200);
});

it("keeps the subject focused when perspective changes", () => {
  const onChange = renderInspector(focusedDefinition());
  fireEvent.change(screen.getByRole("slider", { name: /Perspective/ }), { target: { value: "2600" } });

  const emitted = lastCall(onChange);
  expect(emitted.scene.camera?.perspective).toBe(2600);
  expect(emitted.scene.focus?.distance).toBe(2600);
});

it("resets focus alongside the camera so the subject stays sharp", () => {
  const definition = focusedDefinition();
  definition.scene.camera = { ...definition.scene.camera, perspective: 2400, z: 200 };
  definition.scene.focus = { ...definition.scene.focus, distance: 2600 };
  const onChange = renderInspector(definition);

  fireEvent.click(screen.getByRole("button", { name: "Reset Camera" }));

  const emitted = lastCall(onChange);
  expect(emitted.scene.camera).toMatchObject({ perspective: 1800, z: 0 });
  expect(emitted.scene.focus?.distance).toBe(1800);
});

it("preserves a deliberate focus pull instead of dragging focus with the camera", () => {
  const definition = focusedDefinition();
  definition.scene.focus = { ...definition.scene.focus, distance: 900 };
  const onChange = renderInspector(definition);

  fireEvent.change(screen.getByRole("spinbutton", { name: /Cam Z/ }), { target: { value: "400" } });

  const emitted = lastCall(onChange);
  expect(emitted.scene.camera?.z).toBe(400);
  expect(emitted.scene.focus?.distance).toBe(900);
});

it("camera motion presets mirror focus so the subject does not blur mid-move", () => {
  const onChange = renderInspector(focusedDefinition());
  fireEvent.click(screen.getByRole("button", { name: "Dolly" }));

  const emitted = lastCall(onChange);
  const tracks = emitted.motion?.tracks ?? [];
  const focusTrack = tracks.find(track => track.target.kind === "focus" && track.property === "distance");
  expect(focusTrack).toBeTruthy();
  const base = focusedDefinition().scene.camera;
  const basePerspective = base?.perspective ?? 1400;
  const baseZ = base?.z ?? 0;
  expect(focusTrack?.keyframes.map(frame => frame.value)).toEqual([
    basePerspective - 120,
    basePerspective + 80,
  ]);
  expect(baseZ).toBe(0);
});

it("camera motion presets leave a deliberate focus pull untouched", () => {
  const definition = focusedDefinition();
  definition.scene.focus = { ...definition.scene.focus, distance: 900 };
  const onChange = renderInspector(definition);
  fireEvent.click(screen.getByRole("button", { name: "Dolly" }));

  const tracks = lastCall(onChange).motion?.tracks ?? [];
  expect(tracks.some(track => track.target.kind === "focus")).toBe(false);
});
