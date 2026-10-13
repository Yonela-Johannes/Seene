import { afterEach, expect, it, vi } from "vitest";
import { parseBackdropMode, resolveBackdrop } from "../../src/preview/backdrop";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("parses the site (default) backdrop", () => {
  expect(parseBackdropMode(undefined)).toEqual({ mode: "site", color: undefined });
  expect(parseBackdropMode("site")).toEqual({ mode: "site", color: undefined });
});

it("parses the transparent backdrop", () => {
  expect(parseBackdropMode("transparent")).toEqual({ mode: "transparent", color: undefined });
});

it("parses a custom color backdrop", () => {
  expect(parseBackdropMode("#ff0000")).toEqual({ mode: "custom", color: "#ff0000" });
  expect(parseBackdropMode("#fff")).toEqual({ mode: "custom", color: "#fff" });
  expect(parseBackdropMode("  #abcdef")).toEqual({ mode: "custom", color: "  #abcdef" });
});

it("resolves transparent to a transparent token", () => {
  expect(resolveBackdrop("transparent")).toBe("transparent");
});

it("resolves a valid custom color", () => {
  expect(resolveBackdrop("#ff0000")).toBe("#ff0000");
});

it("falls back to the host background color for invalid custom values and the site preset", () => {
  // In a non-browser (node) environment there is no host color, so the light fallback applies.
  expect(resolveBackdrop("not-a-color")).toBe("#ffffff");
  expect(resolveBackdrop(undefined)).toBe("#ffffff");
});
