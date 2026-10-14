import { CaptureManifestSchema, type CaptureBridge } from "../core/export";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

function createCaptureObserverClass(OriginalObserver: typeof window.IntersectionObserver | undefined) {
  return class CaptureIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    private callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      if (options?.root) this.root = options.root;
    }

    observe(target: Element): void {
      const entry: IntersectionObserverEntry = {
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRatio: 1,
        intersectionRect: target.getBoundingClientRect(),
        isIntersecting: true,
        rootBounds: null,
        target,
        time: typeof performance !== "undefined" ? performance.now() : Date.now(),
      };
      try {
        this.callback([entry], this);
      } catch {
        // ignore
      }
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  };
}

export function useSceneCapture({durationMs,seek,selector='[data-seene-capture="scene"]'}:
  {durationMs:number;seek:(elapsedMs:number)=>void;selector?:string}) {
  const current=useRef(seek);
  current.current=seek;

  // Ensure IntersectionObserver is defined prior to child effects
  if (typeof window !== "undefined" && (!window.IntersectionObserver || !window.IntersectionObserver.name?.includes("Capture"))) {
    const Original = window.IntersectionObserver;
    window.IntersectionObserver = createCaptureObserverClass(Original);
  }

  useEffect(()=>{
    const host=window as typeof window & {__SEENE_CAPTURE__?:unknown};
    if(host.__SEENE_CAPTURE__) throw new Error("Only one capture viewport can be registered per page.");

    const bridge:CaptureBridge={...CaptureManifestSchema.parse({version:1,durationMs,selector}),seek:(elapsedMs:number)=>{
      if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>durationMs) throw new Error("Capture time is outside the scene.");
      flushSync(()=>current.current(elapsedMs));
      const viewport=document.querySelector(selector);
      if(viewport?.matches('[data-seene-valid="false"]') || viewport?.querySelector('[data-seene-valid="false"]'))
        throw new Error("Correct scene diagnostics before exporting; some content may bypass depth of field.");
    }};
    host.__SEENE_CAPTURE__=bridge;
    return ()=>{
      if(host.__SEENE_CAPTURE__===bridge) delete host.__SEENE_CAPTURE__;
    };
  },[durationMs,selector]);
}
