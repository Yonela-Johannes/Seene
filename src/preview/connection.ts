import { useCallback, useEffect, useRef, useState } from "react";
import { SEENE_PROTOCOL_VERSION } from "../core/platform";
import type { ApplicationIssue } from "./application";

export type PreviewHot = {
  on(event: string, listener: (payload: any) => void): void;
  off(event: string, listener: (payload: any) => void): void;
};

export function useSeeneClientBridge(projectId?: string) {
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const studio = useRef<Window | null>(null);

  const reportApplicationIssue = useCallback((issue: ApplicationIssue) => {
    const target = studio.current;
    if (!target) return;
    try {
      target.postMessage({
        type: "SEENE_CLIENT_APPLICATION_ERROR",
        version: SEENE_PROTOCOL_VERSION,
        projectId,
        message: issue.message,
        source: issue.source,
        stack: issue.stack,
        href: typeof window === "undefined" ? undefined : window.location.href,
      }, "*");
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    studio.current = window.parent;

    const postToStudio = (msg: unknown) => {
      try {
        window.parent.postMessage(msg, "*");
      } catch {}
    };

    const hello = () => {
      postToStudio({
        type: "SEENE_CLIENT_HELLO",
        version: SEENE_PROTOCOL_VERSION,
        projectId,
        href: window.location.href,
      });
    };

    let acked = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const startRetry = () => {
      retry = setTimeout(() => {
        if (!acked) {
          hello();
          startRetry();
        }
      }, 2000);
    };

    const startKeepAlive = () => {
      heartbeat = setInterval(hello, 12000);
    };

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: unknown };
      if (data.type === "SEENE_STUDIO_ACK" || data.type === "SEENE_STUDIO_PING") {
        setBridgeConnected(true);
        if (!acked) {
          acked = true;
          if (retry) clearTimeout(retry);
          startKeepAlive();
        }
        postToStudio({
          type: "SEENE_CLIENT_READY",
          version: SEENE_PROTOCOL_VERSION,
          projectId,
        });
      }
    };

    hello();
    startRetry();

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (retry) clearTimeout(retry);
      if (heartbeat) clearInterval(heartbeat);
      studio.current = null;
    };
  }, [projectId]);

  return { bridgeConnected, reportApplicationIssue };
}

export function usePreviewConnection(hot: PreviewHot | undefined, pause: () => void) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState({connected: true, updating: false, error: ""});
  useEffect(() => {
    if (!hot) return;
    const handlers: Record<string, (payload: any) => void> = {
      "vite:ws:disconnect": () => { pause(); setState({connected: false, updating: false, error: ""}); },
      "vite:ws:connect": () => setState({connected: true, updating: false, error: ""}),
      "vite:beforeUpdate": () => { pause(); setState({connected: true, updating: true, error: ""}); },
      "vite:afterUpdate": () => {setState({connected: true, updating: false, error: ""});setGeneration(value => value + 1);},
      "vite:error": payload => { pause(); setState({connected: true, updating: false,
        error: typeof payload?.err?.message === "string" ? payload.err.message : "The source could not be updated."}); },
    };
    for (const [event, callback] of Object.entries(handlers)) hot.on(event, callback);
    return () => { for (const [event, callback] of Object.entries(handlers)) hot.off(event, callback); };
  }, [hot, pause]);
  return {...state, generation};
}
