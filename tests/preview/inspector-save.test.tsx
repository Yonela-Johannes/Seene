// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { SceneInspector } from "../../src/preview/SceneInspector";
import type { PreviewDefinitionInput } from "../../src/core/preview";

const baseDefinition: PreviewDefinitionInput = {
  scene: { version: 3, nodes: [{ id: "host" }] },
};

function StatefulInspector({
  definition: initial,
  onSaveDefinition,
}: {
  definition: PreviewDefinitionInput;
  onSaveDefinition?: (definition: PreviewDefinitionInput) => void;
}) {
  const [definition, setDefinition] = useState(initial);
  return (
    <SceneInspector
      definition={definition}
      onChange={setDefinition}
      onSaveDefinition={onSaveDefinition}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("emits the current definition to onSaveDefinition when Save Backdrop is clicked", () => {
  const onSaveDefinition = vi.fn();
  render(<StatefulInspector definition={baseDefinition} onSaveDefinition={onSaveDefinition} />);
  fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
  fireEvent.click(screen.getByTestId("seene-inspector-save"));
  expect(onSaveDefinition).toHaveBeenCalledTimes(1);
  expect(onSaveDefinition).toHaveBeenCalledWith(baseDefinition);
});

it("disables the Save Backdrop button when no onSaveDefinition is provided", () => {
  render(<StatefulInspector definition={baseDefinition} />);
  fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
  expect((screen.getByTestId("seene-inspector-save") as HTMLButtonElement).disabled).toBe(true);
});

it("reports transparent backdrop via onChange", () => {
  const onChange = vi.fn();
  render(<SceneInspector definition={baseDefinition} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
  const transparent = document.querySelector<HTMLInputElement>('input[name="seene-backdrop"][value="transparent"]')!;
  fireEvent.click(transparent);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ backdrop: "transparent" }));
});

it("reports a custom color to onChange", () => {
  render(<StatefulInspector definition={baseDefinition} />);
  fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
  const custom = document.querySelector<HTMLInputElement>('input[name="seene-backdrop"][value="custom"]')!;
  fireEvent.click(custom);
  const colorInput = document.querySelector<HTMLInputElement>('input[type="color"]')!;
  fireEvent.change(colorInput, { target: { value: "#123456" } });
  expect(colorInput.value).toBe("#123456");
});

it("clears the backdrop when site is selected from a custom color", () => {
  const onChange = vi.fn();
  const withColor: PreviewDefinitionInput = { ...baseDefinition, backdrop: "#abcdef" };
  render(<SceneInspector definition={withColor} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Scene Inspector" }));
  const site = document.querySelector<HTMLInputElement>('input[name="seene-backdrop"][value="site"]')!;
  fireEvent.click(site);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ backdrop: undefined }));
});
