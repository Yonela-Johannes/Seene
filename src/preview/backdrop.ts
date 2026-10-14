import { useEffect, useState } from "react";

export type BackdropMode = "site" | "transparent" | string;

const FALLBACK_LIGHT = "#ffffff";
const FALLBACK_DARK = "#000000";

const COLOR_INPUT_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function parseBackdropMode(backdrop: string | undefined): {
  mode: "site" | "transparent" | "custom";
  color: string | undefined;
} {
  if (!backdrop || backdrop === "site") return { mode: "site", color: undefined };
  if (backdrop === "transparent") return { mode: "transparent", color: undefined };
  return { mode: "custom", color: backdrop };
}

function isTransparentComputed(value: string | null): boolean {
  if (!value || value === "transparent") return true;
  const matched = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i.exec(value);
  if (matched) {
    const alpha = matched[4] !== undefined ? parseFloat(matched[4]) : 1;
    if (alpha < 0.01) return true;
  }
  return false;
}

function isValidCssColor(value: string): boolean {
  if (COLOR_INPUT_RE.test(value)) return true;
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  const probe = document.createElement("div");
  probe.style.color = value;
  return probe.style.color !== "";
}

export function resolveHostBackdropColor(startingNode?: HTMLElement | null): string {
  if (typeof window === "undefined" || typeof document === "undefined") return FALLBACK_LIGHT;
  const root = document.documentElement;
  let element: HTMLElement | null = startingNode || document.body;
  while (element && element !== root) {
    let computed: string | null = null;
    let varVal: string | null = null;
    try {
      varVal = element.style?.getPropertyValue("--seene-scene-backdrop")?.trim()
        || window.getComputedStyle(element)?.getPropertyValue("--seene-scene-backdrop")?.trim()
        || null;
      computed = window.getComputedStyle(element)?.backgroundColor;
    } catch {
      computed = null;
    }
    if (varVal && isValidCssColor(varVal)) return varVal;
    if (computed && !isTransparentComputed(computed)) return computed;
    element = element.parentElement;
  }
  const rootVar = root.style?.getPropertyValue("--seene-scene-backdrop")?.trim()
    || window.getComputedStyle(root)?.getPropertyValue("--seene-scene-backdrop")?.trim();
  if (rootVar && isValidCssColor(rootVar)) return rootVar;
  if (root.classList.contains("dark")) return FALLBACK_DARK;
  if (root.classList.contains("light")) return FALLBACK_LIGHT;
  const theme = root.getAttribute("data-theme");
  if (theme === "dark") return FALLBACK_DARK;
  if (theme === "light") return FALLBACK_LIGHT;
  if (typeof window.matchMedia === "function") {
    try {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) return FALLBACK_DARK;
    } catch {
      // fall through
    }
  }
  return FALLBACK_LIGHT;
}

export function resolveBackdrop(backdrop: string | undefined, node?: HTMLElement | null): string {
  const { mode, color } = parseBackdropMode(backdrop);
  if (mode === "transparent") return "transparent";
  if (mode === "custom") return isValidCssColor(color ?? "") ? color! : resolveHostBackdropColor(node);
  return resolveHostBackdropColor(node);
}

const OBSERVED_ATTRIBUTES = ["class", "style", "data-theme"];

export function useSceneBackdrop(backdrop: string | undefined, node?: HTMLElement | null): string {
  const [color, setColor] = useState<string>(() => resolveBackdrop(backdrop, node));

  useEffect(() => {
    setColor(resolveBackdrop(backdrop, node));
  }, [backdrop, node]);

  useEffect(() => {
    const isSite = !backdrop || backdrop === "site";
    if (!isSite) return;

    const recompute = () => setColor(resolveHostBackdropColor());
    const root = document.documentElement;
    if (!root) return;

    const observer = new MutationObserver(recompute);
    observer.observe(root, { attributes: true, attributeFilter: OBSERVED_ATTRIBUTES, subtree: false });

    const body = document.body;
    if (body) observer.observe(body, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });

    let mediaQuery: MediaQueryList | undefined;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      try {
        mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        mediaQuery.addEventListener("change", recompute);
      } catch {
        // prefers-color-scheme not supported
      }
    }

    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener("change", recompute);
    };
  }, [backdrop]);

  return color;
}
