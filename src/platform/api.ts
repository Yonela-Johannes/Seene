import { useEffect, useRef, useState } from "react";
import {
  PLATFORM_API_PREFIX, SEENE_PROTOCOL_VERSION, isAllowedDevOrigin, type PlatformBrowseResponse, type PlatformCatalog,
  type PlatformContent, type PlatformProject, type PlatformSourcesResponse, type PlatformStatus,
} from "../core/platform";

export type ProjectsResponse = { home: string; projects: PlatformProject[] };
export type CatalogResponse = { project: PlatformProject; catalog: PlatformCatalog };
export type ContentResponse = { project: PlatformProject; content: PlatformContent };
export type SceneResponse = { project: PlatformProject; scene: PlatformCatalog["scenes"][number]; catalog: PlatformCatalog };
export type SourceInspectResponse = PlatformSourcesResponse;
export type BrowseResponse = PlatformBrowseResponse;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, init); }
  catch { throw new Error("The Seene platform server is not answering. Restart pnpm run dev and retry."); }
  const payload = await response.json().catch(() => undefined) as { error?: string } | undefined;
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `The platform request failed (${response.status}).`);
  return payload as T;
}

function body(value: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) };
}

export const platformApi = {
  projects: () => request<ProjectsResponse>(`${PLATFORM_API_PREFIX}/projects`),
  addProject: (target: string) => request<ProjectsResponse>(`${PLATFORM_API_PREFIX}/projects`, body({ path: target })),
  removeProject: (target: string) => request<ProjectsResponse>(`${PLATFORM_API_PREFIX}/projects`, { ...body({ path: target }), method: "DELETE" }),
  catalog: (target: string) => request<CatalogResponse>(`${PLATFORM_API_PREFIX}/projects/scenes?path=${encodeURIComponent(target)}`),
  content: (target: string, filters?: { query?: string; kinds?: Array<"page" | "section" | "component"> }) => {
    const params = new URLSearchParams({ path: target });
    if (filters?.query) params.set("q", filters.query);
    if (filters?.kinds?.length) params.set("kind", filters.kinds.join(","));
    return request<ContentResponse>(`${PLATFORM_API_PREFIX}/projects/content?${params.toString()}`);
  },
  inspectSource: (target: string) => request<SourceInspectResponse>(`${PLATFORM_API_PREFIX}/projects/sources/inspect`, body({ path: target })),
  browseSource: (target?: string) =>
    request<BrowseResponse>(`${PLATFORM_API_PREFIX}/projects/sources/browse${target ? `?path=${encodeURIComponent(target)}` : ""}`),
  status: (target: string, origin: string) => request<PlatformStatus>(`${PLATFORM_API_PREFIX}/projects/status?path=${encodeURIComponent(target)}&origin=${encodeURIComponent(origin)}`),
  createScene: (draft: {
    path: string;
    id: string;
    title: string;
    description?: string;
    compositionType?: "scene" | "walkthrough";
    content?: { file: string; export?: string };
    sections?: Array<{ file: string; export?: string; id?: string; title?: string }>;
    width?: number;
    height?: number;
  }) => request<SceneResponse>(`${PLATFORM_API_PREFIX}/projects/scenes`, body(draft)),
  duplicateScene: (target: string, id: string, newId: string) =>
    request<CatalogResponse>(`${PLATFORM_API_PREFIX}/projects/scenes/duplicate`, body({ path: target, id, newId })),
  removeScene: (target: string, id: string) => request<CatalogResponse>(`${PLATFORM_API_PREFIX}/projects/scenes`, { ...body({ path: target, id }), method: "DELETE" }),
};

export type CompositionKind = "scene" | "walkthrough";

export type Route =
  | { view: "home" }
  | { view: "projects" }
  | { view: "create"; kind?: CompositionKind; project?: string }
  | { view: "studio"; project: string; scene?: string }
  | { view: "settings"; project: string }
  | { view: "present"; project: string; scene: string };

export const HOME_ROUTE = "#/";
export const PROJECTS_ROUTE = "#/projects";
export const CREATE_ROUTE = "#/create";
export const WALKTHROUGH_DEMO_URL = `${import.meta.env.BASE_URL}tests/preview/walkthrough-fixture.html?seene-mode=scroll`;
export function studioHref(project: string, scene?: string): string {
  const base = `#/projects/${encodeURIComponent(project)}`;
  return scene ? `${base}?scene=${encodeURIComponent(scene)}` : base;
}
export function settingsHref(project: string): string { return `${studioHref(project)}/settings`; }
export function presentHref(project: string, scene: string): string { return `#/present/${encodeURIComponent(project)}/${encodeURIComponent(scene)}`; }
export function createHref(kind?: CompositionKind, project?: string): string {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (project) params.set("project", project);
  const query = params.toString();
  return query ? `${CREATE_ROUTE}?${query}` : CREATE_ROUTE;
}

function splitHash(hash: string): { segments: string[]; params: URLSearchParams } {
  const withoutHash = hash.replace(/^#/, "");
  const [pathPart = "", query = ""] = withoutHash.split("?");
  return { segments: pathPart.replace(/^\/+/, "").split("/"), params: new URLSearchParams(query) };
}

export function readRoute(hash: string): Route {
  const { segments: parts, params } = splitHash(hash);
  const [head] = parts;
  if (!head) return { view: "home" };
  if (head === "create") {
    const kindParam = params.get("kind");
    const kind = kindParam === "scene" || kindParam === "walkthrough" ? kindParam : undefined;
    const project = params.get("project") ?? parts[1];
    return { view: "create", ...(kind ? { kind } : {}), ...(project ? { project: decodeURIComponent(project) } : {}) };
  }
  if (head === "projects") {
    if (typeof parts[1] === "string" && parts[1]) {
      const project = decodeURIComponent(parts[1]);
      if (parts[2] === "settings") return { view: "settings", project };
      const scene = params.get("scene");
      return { view: "studio", project, ...(scene ? { scene: decodeURIComponent(scene) } : {}) };
    }
    return { view: "projects" };
  }
  if (head === "present" && parts[1] && parts[2]) return { view: "present", project: decodeURIComponent(parts[1]), scene: decodeURIComponent(parts[2]) };
  // Any removed or unknown route falls back to the public home rather than an error screen.
  return { view: "home" };
}

export type StudioApplicationError = { message: string; source?: string; stack?: string; href?: string };

export function useStudioBridge(projectPath: string | undefined, active: boolean) {
  const [liveConnected, setLiveConnected] = useState(false);
  const [clientMeta, setClientInfo] = useState<{ projectId?: string; href?: string } | null>(null);
  const [applicationError, setApplicationError] = useState<StudioApplicationError | null>(null);
  const lastHeartbeat = useRef<number>(0);
  const clientWindow = useRef<Window | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !active) {
      setLiveConnected(false);
      return;
    }

    setLiveConnected(false);
    setClientInfo(null);
    setApplicationError(null);
    clientWindow.current = null;

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: string; version?: number; projectId?: string; href?: string; message?: string; source?: string; stack?: string };
      if (!data.type || !data.type.startsWith("SEENE_CLIENT_")) return;

      if (!isAllowedDevOrigin(event.origin)) return;

      lastHeartbeat.current = Date.now();
      setLiveConnected(true);
      setClientInfo({ projectId: data.projectId, href: data.href });
      if (event.source && "postMessage" in event.source) {
        clientWindow.current = event.source as Window;
      }

      if (data.type === "SEENE_CLIENT_APPLICATION_ERROR" && typeof data.message === "string" && data.message) {
        setApplicationError({
          message: data.message,
          ...(typeof data.source === "string" ? { source: data.source } : {}),
          ...(typeof data.stack === "string" ? { stack: data.stack } : {}),
          ...(typeof data.href === "string" ? { href: data.href } : {}),
        });
      }

      if (data.type === "SEENE_CLIENT_HELLO" && clientWindow.current) {
        try {
          clientWindow.current.postMessage(
            { type: "SEENE_STUDIO_ACK", version: SEENE_PROTOCOL_VERSION, projectId: projectPath },
            "*"
          );
        } catch {}
      }

      if (data.type === "SEENE_CLIENT_CREATE_SCENE" && (data as any).draft && projectPath) {
        const draft = (data as any).draft;
        void platformApi.createScene({
          path: projectPath,
          id: draft.id,
          title: draft.title,
          description: draft.description,
          compositionType: draft.compositionType,
          content: draft.content,
          sections: draft.sections,
          width: draft.width,
          height: draft.height,
        }).then(() => {
          if (event.source && "postMessage" in event.source) {
            (event.source as Window).postMessage(
              { type: "SEENE_STUDIO_SCENE_CREATED", version: SEENE_PROTOCOL_VERSION, id: draft.id, success: true },
              "*"
            );
          }
        }).catch(err => {
          if (event.source && "postMessage" in event.source) {
            (event.source as Window).postMessage(
              { type: "SEENE_STUDIO_SCENE_CREATED", version: SEENE_PROTOCOL_VERSION, id: draft.id, success: false, error: err?.message },
              "*"
            );
          }
        });
      }

      if (data.type === "SEENE_CLIENT_REMOVE_SCENE" && (data as any).draft && projectPath) {
        const draft = (data as any).draft;
        void platformApi.removeScene(projectPath, draft.id).then(() => {
          if (event.source && "postMessage" in event.source) {
            (event.source as Window).postMessage(
              { type: "SEENE_STUDIO_SCENE_REMOVED", version: SEENE_PROTOCOL_VERSION, id: draft.id, success: true },
              "*"
            );
          }
        }).catch(err => {
          if (event.source && "postMessage" in event.source) {
            (event.source as Window).postMessage(
              { type: "SEENE_STUDIO_SCENE_REMOVED", version: SEENE_PROTOCOL_VERSION, id: draft.id, success: false, error: err?.message },
              "*"
            );
          }
        });
      }
    };

    window.addEventListener("message", handleMessage);

    const timer = setInterval(() => {
      if (lastHeartbeat.current > 0 && Date.now() - lastHeartbeat.current > 15000) {
        setLiveConnected(false);
      }
    }, 5000);

    const pingInterval = setInterval(() => {
      if (clientWindow.current && lastHeartbeat.current > 0) {
        try {
          clientWindow.current.postMessage(
            { type: "SEENE_STUDIO_PING", version: SEENE_PROTOCOL_VERSION, projectId: projectPath },
            "*"
          );
        } catch {}
      }
    }, 10000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(timer);
      clearInterval(pingInterval);
    };
  }, [projectPath, active]);

  return { liveConnected, clientMeta, applicationError };
}
