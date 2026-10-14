// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React, { useState, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSceneCapture } from "../../src/react/capture";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", function () {
    return { observe() {}, disconnect() {} };
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function MockWhileInViewComponent() {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    });

    const target = document.querySelector("#in-view-target");
    if (target) observer.observe(target);

    return () => observer.disconnect();
  }, []);

  return (
    <div id="in-view-target" data-seene-capture="scene" data-in-view={isInView ? "true" : "false"}>
      {isInView ? "Visible In View Content" : "Hidden Before Scroll"}
    </div>
  );
}

function CaptureHarness({ seek }: { seek: (ms: number) => void }) {
  useSceneCapture({ durationMs: 5000, seek });
  return <MockWhileInViewComponent />;
}

describe("Item 6: In-View Animations (BUG-6) Capture Tests", () => {
  it("forces IntersectionObserver / whileInView content isIntersecting: true during capture", () => {
    const seek = vi.fn();
    render(<CaptureHarness seek={seek} />);

    const target = document.querySelector("#in-view-target");
    expect(target).not.toBeNull();
    expect(target?.getAttribute("data-in-view")).toBe("true");
    expect(screen.getByText("Visible In View Content")).toBeTruthy();

    // Verify window.__SEENE_CAPTURE__ bridge is active
    const host = window as unknown as { __SEENE_CAPTURE__?: { seek: (ms: number) => void } };
    expect(host.__SEENE_CAPTURE__).toBeDefined();
    host.__SEENE_CAPTURE__?.seek(1000);
    expect(seek).toHaveBeenCalledWith(1000);
  });
});
