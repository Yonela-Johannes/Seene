// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Surface, type PreviewDefinitionInput } from "../../src";
import { ScenePreview } from "../../src/preview";
import { SCENE_TRANSITION_DURATION } from "../../src/core";
import { installLayoutStubs } from "../helpers/layout";

const definitionA: PreviewDefinitionInput = {
  width: 1000,
  height: 600,
  scene: {
    version: 3,
    camera: { perspective: 1400, x: -240, rotateY: 38 },
    focus: { distance: 1000, fStop: 8, focalLength: 100, maxBlur: 6 },
    nodes: [{ id: "host-a" }],
  },
};

const definitionB: PreviewDefinitionInput = {
  width: 1000,
  height: 600,
  scene: {
    version: 3,
    camera: { perspective: 1200, x: 100, rotateY: -30 },
    focus: { distance: 800, fStop: 2.8, focalLength: 50, maxBlur: 12 },
    nodes: [{ id: "host-b" }],
  },
};

function renderPreview(def: PreviewDefinitionInput) {
  return render(
    <ScenePreview definition={def} title="Test" hot={undefined}>
      <Surface id="host" style={{ width: 800, height: 400 }}>
        <button>Host action</button>
      </Surface>
    </ScenePreview>,
  );
}

const stages = () => document.querySelectorAll('[data-seene-stage]');

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("scene transition cross-fade", () => {
  it("cross-fades when switching to a different scene (different nodes)", async () => {
    const { rerender } = renderPreview(definitionA);

    await waitFor(() => {
      expect(stages().length).toBe(1);
    });

    await act(async () => {
      rerender(
        <ScenePreview definition={definitionB} title="Test B" hot={undefined}>
          <Surface id="host" style={{ width: 800, height: 400 }}>
            <button>Host action B</button>
          </Surface>
        </ScenePreview>,
      );
    });

    await waitFor(() => {
      expect(stages().length).toBe(2);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, SCENE_TRANSITION_DURATION + 100));
    });

    expect(stages().length).toBe(1);
  });

  it("does not cross-fade when only presentation changes (same nodes)", async () => {
    const sameScene: PreviewDefinitionInput = {
      ...definitionA,
      scene: {
        ...definitionA.scene,
        camera: { perspective: 900, x: 0, rotateY: 0 },
      },
    };

    const { rerender } = renderPreview(definitionA);

    await waitFor(() => {
      expect(stages().length).toBe(1);
    });

    await act(async () => {
      rerender(
        <ScenePreview definition={sameScene} title="Test" hot={undefined}>
          <Surface id="host" style={{ width: 800, height: 400 }}>
            <button>Host action</button>
          </Surface>
        </ScenePreview>,
      );
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(stages().length).toBe(1);
  });
});
