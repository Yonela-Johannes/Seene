// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Surface, type PreviewDefinitionInput } from "../../src";
import { ScenePreview } from "../../src/preview";
import { PRESENTATIONS, presentation, type CaptureBridge } from "../../src/core";

const definition: PreviewDefinitionInput = {
  width: 1000,
  height: 600,
  scene: {
    version: 3,
    camera: { perspective: 1400, x: -240, rotateY: 38 },
    focus: { distance: 1000, fStop: 8, focalLength: 100, maxBlur: 6 },
    nodes: [{ id: "host" }],
  },
  motion: {
    durationMs: 6000,
    speed: 0.5,
    tracks: [
      { target: { kind: "camera" }, property: "y", keyframes: [{ timeMs: 0, value: -50 }, { timeMs: 6000, value: 70 }] },
    ],
  },
};

const bridge = () => (window as typeof window & { __SEENE_CAPTURE__: CaptureBridge }).__SEENE_CAPTURE__;
const stage = () => document.querySelector<HTMLElement>("[data-seene-stage]")!;
const surface = () => document.querySelector<HTMLElement>("[data-seene-id]")!;
const slider = () => screen.getByRole("slider", { name: "Scene time" }) as HTMLInputElement;

function renderPreview(props: { presentation?: string; onPresentationChange?: (id: string) => void } = {}) {
  return render(
    <ScenePreview definition={definition} title="Test application" hot={undefined} {...props}>
      <Surface id="host" style={{ width: 800, height: 400 }}>
        <button>Host action</button>
      </Surface>
    </ScenePreview>,
  );
}

import { installLayoutStubs } from "../helpers/layout";

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("presentation switching in the preview", () => {
  it("offers every treatment, marks the active one and explains it", async () => {
    renderPreview({ presentation: "depth", onPresentationChange: vi.fn() });
    const group = screen.getByRole("group", { name: "Presentation" });
    const authored = within(group).getByRole("button", { name: "Authored" });
    expect(within(group).getAllByRole("button")).toHaveLength(PRESENTATIONS.length + 1);
    for (const item of PRESENTATIONS) {
      expect(within(group).getByRole("button", { name: item.label })).toBeTruthy();
    }
    expect(within(group).getByRole("button", { name: "Depth" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "Cinematic" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(group).getByRole("button", { name: "Cinematic" }).getAttribute("title")).toBe(
      presentationSummary("cinematic"),
    );
    expect(screen.getByText(presentationSummary("depth"))).toBeTruthy();
    expect(authored.getAttribute("aria-pressed")).toBe("false");
  });

  it("presents the same scene with the chosen camera and keeps the host surface", async () => {
    const { rerender } = renderPreview({ presentation: "clean", onPresentationChange: vi.fn() });
    const cleanPerspective = stage().parentElement!.style.perspective;
    const cleanTransform = stage().style.transform;
    expect(screen.getByRole("button", { name: "Host action" })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Presentation" })).getByRole("button", { name: "Clean" })).toBeTruthy();

    rerender(
      <ScenePreview definition={definition} title="Test application" presentation="cinematic" onPresentationChange={vi.fn()}>
        <Surface id="host" style={{ width: 800, height: 400 }}>
          <button>Host action</button>
        </Surface>
      </ScenePreview>,
    );
    await waitFor(() => expect(stage().style.transform).not.toBe(cleanTransform));
    expect(stage().parentElement!.style.perspective).not.toBe(cleanPerspective);
    expect(stage().style.transform).toContain("rotateY(-22deg)");
    expect(screen.getByRole("button", { name: "Host action" })).toBeTruthy();
    expect(document.querySelectorAll('[data-seene-id="host"]')).toHaveLength(1);
  });

  it("reports the choice so the host can persist it in the URL for recording", async () => {
    const onChange = vi.fn();
    renderPreview({ presentation: "clean", onPresentationChange: onChange });
    const group = screen.getByRole("group", { name: "Presentation" });
    fireEvent.click(within(group).getByRole("button", { name: "Showcase" }));
    expect(onChange).toHaveBeenCalledWith("showcase");
    fireEvent.click(within(group).getByRole("button", { name: "Authored" }));
    expect(onChange).toHaveBeenLastCalledWith("authored");
  });

  it("gives preview and capture the same duration and the same moving scene", async () => {
    renderPreview({ presentation: "clean", onPresentationChange: vi.fn() });
    const expected = presentation("clean").durationMs;
    await waitFor(() => expect(slider().max).toBe(String(expected)));
    expect(bridge()?.durationMs).toBe(expected);

    const startTransform = stage().style.transform;
    const startTime = slider().value;
    act(() => {
      bridge()!.seek(Math.round(expected / 2));
    });
    expect(stage().style.transform).not.toBe(startTransform);
    expect(Number(slider().value)).toBeGreaterThan(Number(startTime));

    act(() => {
      bridge()!.seek(expected);
    });
    expect(surface().dataset.seeneDepth).toBeDefined();
    expect(document.querySelector('[data-seene-capture="scene"]')?.getAttribute("data-seene-valid")).toBe("true");
  });

  it("keeps the authored composition when no presentation is selected", () => {
    renderPreview();
    expect(document.querySelector('[role="group"][aria-label="Presentation"]')).toBeNull();
    expect(stage().style.transform).toContain("rotateY(38deg)");
    expect(stage().parentElement!.style.perspective).toBe("1400px");
  });
});

function presentationSummary(id: string) {
  return PRESENTATIONS.find((item) => item.id === id)!.summary;
}
