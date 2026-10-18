// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Surface, compileWalkthrough, createWalkthroughDocument, type PreviewDefinitionInput } from "../../src";
import { ScenePreview } from "../../src/preview";
import { installLayoutStubs } from "../helpers/layout";

function walkthroughDefinition(): PreviewDefinitionInput {
  const document_ = createWalkthroughDocument({
    title: "Product tour",
    targets: [
      { title: "Hero", target: { kind: "section", sectionId: "hero" } },
      { title: "Footer", target: { kind: "section", sectionId: "footer" } },
    ],
  });
  return {
    width: document_.settings.width,
    height: document_.settings.height,
    scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
    motion: compileWalkthrough(document_)!.motion,
    compositionType: "walkthrough",
    sizingMode: "viewport",
    minHeight: "100vh",
    walkthrough: document_,
  };
}

function renderStudio(onSaveDefinition = vi.fn(async (_definition: PreviewDefinitionInput, _sections?: Array<{ file: string; export?: string; title?: string }>) => undefined)) {
  const result = render(
    <ScenePreview definition={walkthroughDefinition()} title="Product tour" onSaveDefinition={onSaveDefinition}>
      <Surface id="host" style={{ width: 800, height: 600 }}>
        <div data-section-id="hero" style={{ height: 400 }}>
          Hero section
        </div>
        <div data-section-id="footer" style={{ height: 400 }}>
          Footer section
        </div>
      </Surface>
    </ScenePreview>,
  );
  return { ...result, onSaveDefinition };
}

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
  installLayoutStubs();
});
afterEach(() => {
  cleanup();
});

describe("walkthrough studio", () => {
it("renders the walkthrough studio with a connected sequence, timeline and inspector", () => {
  const { container } = renderStudio();
  expect(screen.getByLabelText("Walkthrough sequence")).toBeTruthy();
  expect(container.querySelectorAll(".seene-studio-node")).toHaveLength(4);
  const labels = [...container.querySelectorAll(".seene-studio-node-title")].map(node => node.textContent);
  expect(labels).toEqual(["Start", "Hero", "Footer", "End"]);
  expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  expect(screen.getByRole("slider", { name: "Walkthrough time" })).toBeTruthy();
  expect(screen.getByLabelText("Walkthrough inspector")).toBeTruthy();
  expect(container.querySelector('[data-seene-capture="scene"][data-seene-valid="true"]')).toBeTruthy();
});

it("adds a step, edits it through the inspector and undoes the change", async () => {
  const { container } = renderStudio();
  fireEvent.click(screen.getByRole("button", { name: "+ focus" }));
  expect(container.querySelectorAll(".seene-studio-node")).toHaveLength(5);

  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(container.querySelectorAll(".seene-studio-node")).toHaveLength(4);

  fireEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect(container.querySelectorAll(".seene-studio-node")).toHaveLength(5);

  const duration = screen.getByLabelText("Duration ms") as HTMLInputElement;
  fireEvent.change(duration, { target: { value: "100" } });
  await waitFor(() => expect((screen.getByLabelText("Duration ms") as HTMLInputElement).value).toBe("100"));
});

it("removes a step through a confirmation dialog", async () => {
  const { container } = renderStudio();
  fireEvent.click(screen.getByRole("button", { name: "Remove Hero" }));
  const dialog = await screen.findByRole("dialog", { name: "Remove step" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove step" }));
  await waitFor(() => expect(container.querySelectorAll(".seene-studio-node")).toHaveLength(3));
});

it("saves the walkthrough document with component sections", async () => {
  const { onSaveDefinition } = renderStudio();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSaveDefinition).toHaveBeenCalled());
  const [definition, sections] = onSaveDefinition.mock.calls[0];
  expect(definition.walkthrough?.nodes.length).toBe(4);
  expect(Array.isArray(sections)).toBe(true);
});

it("surfaces validation issues for a broken connection", async () => {
  const { container } = renderStudio();
  fireEvent.click(screen.getByRole("button", { name: "Disconnect Hero" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByRole("alert").textContent).toContain("Walkthrough needs attention");
  expect(container.querySelectorAll(".seene-studio-node").length).toBeLessThanOrEqual(4);
});
}, 20000);
