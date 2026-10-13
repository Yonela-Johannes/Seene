import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SEENE_PREVIEW_QUERY_PARAMS, isAllowedDevOrigin } from "../core/platform";

export type ApplicationIssue = {
  message: string;
  source?: string;
  stack?: string;
};

export type ApplicationPreviewProps = {
  route?: string;
  title?: string;
  onIssue?: (issue: ApplicationIssue) => void;
  className?: string;
  style?: CSSProperties;
};

export function applicationDocumentUrl(href: string, route?: string): string {
  const current = new URL(href);
  for (const name of SEENE_PREVIEW_QUERY_PARAMS) current.searchParams.delete(name);
  if (route) {
    const target = new URL(route, current.origin);
    for (const name of SEENE_PREVIEW_QUERY_PARAMS) target.searchParams.delete(name);
    return target.href;
  }
  if (/\/seene\/?$/.test(current.pathname)) return new URL("/", current.origin).href;
  return current.href;
}

const documentElements = new Set(["html", "body"]);

export function containsDocumentContent(node: ReactNode, depth = 8): boolean {
  if (depth <= 0 || node === null || node === undefined || typeof node === "boolean") return false;
  if (typeof node === "string" || typeof node === "number") return false;
  if (Array.isArray(node)) return node.some(child => containsDocumentContent(child, depth - 1));
  if (typeof node !== "object" || !("type" in node) || !("props" in node)) return false;
  const element = node as { type: unknown; props?: { children?: ReactNode } | null };
  const type = element.type;
  if (typeof type === "string" && documentElements.has(type)) return true;
  if (typeof type === "function" && /rootlayout$/i.test(type.name || "")) return true;
  return containsDocumentContent(element.props?.children, depth - 1);
}

export function ApplicationPreview({ route, title = "Application", onIssue, className, style }: ApplicationPreviewProps) {
  const source = useMemo(() => (typeof window === "undefined" ? "" : applicationDocumentUrl(window.location.href, route)), [route]);
  const [status, setStatus] = useState<"loading" | "loaded" | "unavailable">("loading");
  const frame = useRef<HTMLIFrameElement>(null);
  const observed = useRef<{ target: Window; release: () => void } | null>(null);
  const reported = useRef(new Set<string>());
  const report = useCallback((issue: ApplicationIssue) => {
    if (!issue.message || reported.current.has(issue.message)) return;
    reported.current.add(issue.message);
    onIssue?.(issue);
  }, [onIssue]);
  const release = useCallback(() => {
    observed.current?.release();
    observed.current = null;
  }, []);
  const allowed = useMemo(() => {
    if (!source) return false;
    try { return isAllowedDevOrigin(new URL(source).origin); } catch { return false; }
  }, [source]);
  const observe = useCallback(() => {
    const element = frame.current;
    if (!element) return;
    let target: Window | null = null;
    try { target = element.contentWindow; } catch { target = null; }
    if (!target || observed.current?.target === target) return;
    release();
    const onError = (event: Event) => {
      const failure = event as ErrorEvent;
      report({
        message: failure.message || "The application reported a runtime error.",
        ...(typeof failure.filename === "string" && failure.filename ? { source: failure.filename } : {}),
        ...(failure.error instanceof Error && failure.error.stack ? { stack: failure.error.stack } : {}),
      });
    };
    const onRejection = (event: Event) => {
      const reason = (event as PromiseRejectionEvent).reason as unknown;
      report({
        message: reason instanceof Error ? reason.message : typeof reason === "string" && reason ? reason : "The application reported a rejected promise.",
        ...(reason instanceof Error && reason.stack ? { stack: reason.stack } : {}),
      });
    };
    target.addEventListener("error", onError);
    target.addEventListener("unhandledrejection", onRejection);
    observed.current = {
      target,
      release: () => {
        target.removeEventListener("error", onError);
        target.removeEventListener("unhandledrejection", onRejection);
      },
    };
  }, [release, report]);
  useEffect(() => {
    if (!allowed) setStatus("unavailable");
  }, [allowed]);
  useEffect(() => {
    observe();
    return release;
  }, [observe, release, source]);
  return (
    <div data-seene-application="" className={className} style={{ width: "100%", height: "100%", ...style }}>
      {status === "unavailable" && (
        <div className="seene-message seene-chrome" data-seene-error="" role="alert">
          <strong>The application document could not be loaded.</strong>
          <p>{source}</p>
          <p>Start this project's own development server at this address, then retry.</p>
        </div>
      )}
      <iframe
        ref={frame}
        data-seene-application-frame=""
        title={title}
        src={source}
        onLoad={() => { setStatus("loaded"); observe(); }}
        onError={() => {
          setStatus("unavailable");
          report({ message: `The application document at ${source} could not be loaded.` });
        }}
        style={{ width: "100%", height: "100%", border: 0, display: "block", background: "var(--seene-bg)" }}
      />
    </div>
  );
}
