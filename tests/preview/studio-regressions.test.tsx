// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceneInspector } from "../../src/preview/SceneInspector";
import { usePreviewSession } from "../../src/preview/session";
import {
  defaultSceneDefinition,
  SCENE_PRESENTATION_SURFACE,
} from "../../src/core/platform";
import { uniformFocusBlur } from "../../src/core/spatial";
import {
  presentPreview,
  subjectFocusDistance,
  type PreviewDefinitionInput,
} from "../../src/core/preview";

function lastCall<T>(fn: ReturnType<typeof vi.fn>): T {
  return fn.mock.calls[fn.mock.calls.length - 1][0] as T;
}

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Studio defaults
// ---------------------------------------------------------------------------

describe("studio defaults", () => {
  it("the default scene definition presents a sharp subject at the projection plane", () => {
    const definition = defaultSceneDefinition().scene;
    const camera = definition.camera;
    const focus = definition.focus;
    // The subject surface sits at perspective + camera.z from the lens.
    const defocus = Math.abs(focus!.distance! - subjectFocusDistance(camera));
    const blur = uniformFocusBlur(
      {
        depth: 0,
        distance: defocus,
        span: 100,
        maxBlur: focus!.maxBlur!,
        fStop: focus!.fStop!,
        focalLength: focus!.focalLength!,
        scale: 1,
      },
      100,
    );
    expect(blur).toBe(0);
  });

  it("presentPreview accepts the default definition", () => {
    const result = presentPreview(defaultSceneDefinition());
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bug B: changing settings must not permanently break playback
// ---------------------------------------------------------------------------

function sessionHook() {
  const probe: { value: ReturnType<typeof usePreviewSession> | null } = {
    value: null,
  };
  function Probe({ input }: { input: PreviewDefinitionInput }) {
    probe.value = usePreviewSession(input, 0);
    return null;
  }
  return { Probe, probe };
}

describe("settings changes keep playback alive", () => {
  const base: PreviewDefinitionInput = {
    scene: {
      version: 3,
      camera: { perspective: 1800 },
      focus: { distance: 1800, fStop: 8, focalLength: 50, maxBlur: 4 },
      nodes: [{ id: "host" }],
    },
    motion: {
      durationMs: 10000,
      speed: 1,
      tracks: [
        {
          target: { kind: "camera" },
          property: "y",
          keyframes: [
            { timeMs: 0, value: -80 },
            { timeMs: 4000, value: 0 },
            { timeMs: 10000, value: 80 },
          ],
        },
        {
          target: { kind: "focus" },
          property: "distance",
          keyframes: [
            { timeMs: 0, value: 1720 },
            { timeMs: 10000, value: 1880 },
          ],
        },
      ],
    },
    walkthroughSettings: { durationAuto: true },
  };

  it("shortening a walkthrough timeline clamps keyframes instead of emptying tracks", () => {
    const onChange = vi.fn();
    render(<SceneInspector definition={base} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
    fireEvent.click(screen.getByRole("tab", { name: "Motion" }));
    const input = screen.getByRole("spinbutton", {
      name: /Walkthrough duration/i,
    });
    fireEvent.change(input, { target: { value: "2" } });

    const emitted = lastCall<PreviewDefinitionInput>(onChange);
    // Every track still has at least one keyframe, so the definition stays valid.
    for (const track of emitted.motion!.tracks!) {
      expect(track.keyframes.length).toBeGreaterThan(0);
      expect(
        track.keyframes.every(
          (frame) => frame.timeMs <= emitted.motion!.durationMs!,
        ),
      ).toBe(true);
    }
    expect(presentPreview(emitted).valid).toBe(true);
  });

  it("extremely short durations keep playback available (play enabled)", () => {
    const { Probe, probe } = sessionHook();
    const onChange = vi.fn();
    render(
      <>
        <SceneInspector definition={base} onChange={onChange} />
        <Probe input={base} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
    fireEvent.click(screen.getByRole("tab", { name: "Motion" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /Walkthrough duration/i }),
      { target: { value: "0.2" } },
    );

    // Feed the emitted definition into the session: it must validate.
    const emitted = lastCall<PreviewDefinitionInput>(onChange);
    const { rerender } = render(<Probe input={emitted} />);
    expect(probe.value!.definition).not.toBeNull();
    expect(probe.value!.valid).toBe(true);
    expect(probe.value!.durationMs).toBeGreaterThan(0);
    rerender(<Probe input={emitted} />);
  });
});

// ---------------------------------------------------------------------------
// Invalid focus configurations must be impossible to slide into
// ---------------------------------------------------------------------------

describe("focus sliders stay inside the valid schema range", () => {
  it("focus distance slider never emits distance <= focalLength", () => {
    const onChange = vi.fn();
    render(
      <SceneInspector
        definition={{
          scene: {
            version: 3,
            camera: { perspective: 1800 },
            focus: { distance: 60, fStop: 8, focalLength: 50, maxBlur: 6 },
            nodes: [{ id: "host" }],
          },
        }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
    const distance = screen.getByRole("slider", { name: /Focus Distance/i });
    const min = Number(distance.getAttribute("min"));
    expect(min).toBeGreaterThan(50); // focalLength + 1
    const emitted = onChange.mock.calls.at(-1)?.[0] as PreviewDefinitionInput | undefined;
    expect(
      emitted?.scene?.focus?.distance ?? 60,
    ).toBeGreaterThanOrEqual(min);
  });

  it("focal length slider clamps to stay below the focus distance", () => {
    const onChange = vi.fn();
    render(
      <SceneInspector
        definition={{
          scene: {
            version: 3,
            camera: { perspective: 1800 },
            focus: { distance: 60, fStop: 8, focalLength: 50, maxBlur: 6 },
            nodes: [{ id: "host" }],
          },
        }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
    // Slider render value is clamped, and any change is clamped on emit.
    fireEvent.change(screen.getByRole("slider", { name: /Focal Length/i }), {
      target: { value: "300" },
    });
    const emitted = lastCall<PreviewDefinitionInput>(onChange);
    expect(emitted.scene.focus!.focalLength!).toBeLessThan(
      emitted.scene.focus!.distance!,
    );
    expect(presentPreview(emitted).valid).toBe(true);
  });
});
