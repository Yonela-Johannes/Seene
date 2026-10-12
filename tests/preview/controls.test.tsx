// @vitest-environment jsdom
import { createContext, useContext, useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Surface, type PreviewDefinitionInput } from "../../src";
import { ScenePreview } from "../../src/preview";
import type { CaptureBridge } from "../../src/core/export";

const definition: PreviewDefinitionInput = {
  width: 1000, height: 600,
  scene: { version: 3, camera: {}, focus: {}, nodes: [{id: "host"}] },
  motion: {durationMs: 4000, tracks: [
    {target: {kind: "camera"}, property: "x", keyframes: [{timeMs: 0, value: 0}, {timeMs: 4000, value: 100}]},
  ]},
};
import { installLayoutStubs } from "../helpers/layout";

const bridge = () => (window as typeof window & {__SEENE_CAPTURE__: CaptureBridge}).__SEENE_CAPTURE__;
const controls = () => screen.getByRole("contentinfo", {name: "Scene controls"});
beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
  installLayoutStubs();
});
afterEach(() => {
  cleanup();
});

it("keeps every preview action in the bottom region and preserves host context, state, registration and capture across source recovery", async () => {
  const TestContext = createContext("tenant-a");
  function TestHost() {
    const tenant = useContext(TestContext);
    const [count, setCount] = useState(0);
    return (
      <Surface id="host" style={{width: 800, height: 400}}>
        <div>
          <span>Tenant: {tenant}</span>
          <button onClick={() => setCount(c => c + 1)}>Increment {count}</button>
        </div>
      </Surface>
    );
  }
  const { rerender } = render(
    <TestContext.Provider value="tenant-b">
      <ScenePreview definition={definition} title="Test application">
        <TestHost />
      </ScenePreview>
    </TestContext.Provider>,
  );
  expect(screen.getByText("Tenant: tenant-b")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Increment 0"}));
  expect(screen.getByRole("button", {name: "Increment 1"})).toBeTruthy();
  const c = controls();
  expect(within(c).getByRole("button", {name: "Play"})).toBeTruthy();
  expect(within(c).getByRole("button", {name: "Restart"})).toBeTruthy();
  expect(within(c).getByRole("slider", {name: "Scene time"})).toBeTruthy();
  const exportDetails = c.querySelector("details.seene-export");
  expect(exportDetails).toBeTruthy();
  expect(exportDetails?.querySelector("summary")?.textContent).toContain("Export");
  expect(within(c).queryByRole("button", {name: "Export"})).toBeNull();
  expect(bridge()).toBeDefined();
  rerender(
    <TestContext.Provider value="tenant-c">
      <ScenePreview definition={definition} title="Test application" revision={2}>
        <TestHost />
      </ScenePreview>
    </TestContext.Provider>,
  );
  expect(screen.getByText("Tenant: tenant-c")).toBeTruthy();
  expect(screen.getByRole("button", {name: "Increment 1"})).toBeTruthy();
  expect(bridge()).toBeDefined();
});

it("shows quality selector in the export panel", async () => {
  render(<ScenePreview definition={definition} title="Test app"><Surface id="host" style={{width:800,height:400}}><button>Host</button></Surface></ScenePreview>);
  const summary = screen.getByText("Export", {exact: false}).closest("details")!;
  fireEvent.click(summary.querySelector("summary")!);
  await waitFor(() => expect(document.querySelector(".seene-export-panel")).toBeTruthy());
  expect(document.querySelector<HTMLElement>("select[aria-label='Export quality (CRF)']")).toBeTruthy();
  expect(document.querySelector<HTMLElement>(".seene-export-panel code")?.textContent).toContain("--quality");
});

it("reports duplicate rendered surface IDs in an accessible diagnostic", () => {
  const valid: PreviewDefinitionInput = {
    width: 800, height: 600,
    scene: { version: 3, camera: {}, focus: {}, nodes: [{id: "host"}] },
  };
  render(
    <ScenePreview definition={valid} title="Broken app">
      <>
        <Surface id="host"><div /></Surface>
        <Surface id="host"><div /></Surface>
      </>
    </ScenePreview>,
  );
  const errorRegion = screen.getByRole("alert");
  expect(errorRegion.textContent).toContain("Duplicate surface ID: host");
});
