// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingView } from "../../src/platform/LandingView";
import { createHref } from "../../src/platform/api";
import { installLayoutStubs } from "../helpers/layout";

beforeEach(() => {
  window.location.hash = "";
  installLayoutStubs();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("landing website URL entry", () => {
  it("offers a prominent website URL call to action and explains both entry paths", () => {
    render(<LandingView />);

    expect(screen.getAllByText("Start with a website URL").length).toBeGreaterThan(0);
    expect(screen.getByText(/Path 01 · Website URL/)).toBeTruthy();
    expect(screen.getByText(/Path 02 · React app/)).toBeTruthy();
    expect(screen.getByText(/No npm package installation required/)).toBeTruthy();
  });

  it("normalizes the URL and carries it into the import flow", () => {
    render(<LandingView />);

    fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Start with a website URL/ }));

    expect(window.location.hash).toBe(createHref("walkthrough", undefined, "https://example.com/"));
  });

  it("explains invalid URLs instead of navigating", () => {
    render(<LandingView />);

    fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: /Start with a website URL/ }));

    expect(screen.getByRole("alert").textContent).toMatch(/not supported/i);
    expect(window.location.hash).toBe("");
  });
});
