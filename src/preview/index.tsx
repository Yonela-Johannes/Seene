import { useEffect, useMemo, useRef, useSyncExternalStore, useState, type ReactNode } from "react";
import { Surface } from "../react";
import { DEFAULT_PRESENTATION, defaultSceneDefinition } from "../core";
import {
  SCENE_PRESENTATION_SURFACE,
  SEENE_APPLICATION_QUERY_PARAM,
  SEENE_PREVIEW_QUERY_PARAM,
  SEENE_SCENE_QUERY_PARAM,
  sanitizeApplicationRoute,
} from "../core/platform";
import { ApplicationPreview, containsDocumentContent } from "./application";
import { ScenePreview } from "./ScenePreview";
import {SceneModuleLibrary,type SceneModules} from "./modules";
export {SceneLibrary} from "./SceneLibrary";
export type {SceneLibraryProps} from "./SceneLibrary";
export {SceneModuleLibrary} from "./modules";
export type {SceneModules} from "./modules";
import { usePreviewConnection, useSeeneClientBridge, type PreviewHot } from "./connection";
import { TRANSITION_PRESETS, type TransitionPresetName } from "../core/preview";
export { ScenePreview } from "./ScenePreview";
export type { ScenePreviewProps } from "./ScenePreview";
export type { PreviewHot } from "./connection";
export { ApplicationPreview, applicationDocumentUrl, containsDocumentContent } from "./application";
export type { ApplicationIssue, ApplicationPreviewProps } from "./application";

export type ProjectPreviewProps = {children?: ReactNode; projectId: string; enabled: boolean; active?: boolean; hot?: PreviewHot; sceneModules?: SceneModules; applicationRoute?: string; createSceneEndpoint?: string; transition?: TransitionPresetName; onTransitionChange?: (value: TransitionPresetName | undefined) => void;};
export function ProjectPreview({children, projectId, enabled, active, hot, sceneModules, applicationRoute, createSceneEndpoint, transition, onTransitionChange}: ProjectPreviewProps): ReactNode {
  const { reportApplicationIssue } = useSeeneClientBridge(projectId);
  const [locationAtMount] = useState(() => typeof window === "undefined" ? "" : window.location.href);
  const location = useSyncExternalStore(() => () => {}, () => locationAtMount, () => "");
  const entry = useMemo(() => {
    if (!location) return null;
    const url = new URL(location);
    const requested = url.searchParams.get(SEENE_PREVIEW_QUERY_PARAM) === "1" || url.searchParams.has(SEENE_SCENE_QUERY_PARAM);
    const route = sanitizeApplicationRoute(url.searchParams.get(SEENE_APPLICATION_QUERY_PARAM) ?? "")
      ?? sanitizeApplicationRoute(applicationRoute ?? "");
    url.searchParams.delete(SEENE_PREVIEW_QUERY_PARAM);
    url.searchParams.delete(SEENE_SCENE_QUERY_PARAM);
    url.searchParams.delete(SEENE_APPLICATION_QUERY_PARAM);
    return {requested, back: url.pathname + url.search + url.hash, route};
  }, [location, applicationRoute]);
  const documentChildren = useMemo(() => containsDocumentContent(children), [children]);
  const documentApplication = children === undefined || documentChildren;
  const route = entry?.route ?? (documentApplication ? "/" : undefined);
  const reportedDocument = useRef(false);
  useEffect(() => {
    if (!documentChildren || children === undefined || reportedDocument.current) return;
    reportedDocument.current = true;
    reportApplicationIssue({ message: "This application renders its own document (html/body) inside the Seene preview. Seene presents the running application document instead; move the preview wrapper inside the document root." });
  }, [documentChildren, children, reportApplicationIssue]);
  const content = useMemo(() => <Surface id={SCENE_PRESENTATION_SURFACE} style={{width:"100%",minHeight:980}}>{children}</Surface>, [children]);
  if (!enabled || !(active ?? entry?.requested)) return children;
  if(sceneModules) return <div data-seene-project={projectId}><SceneModuleLibrary modules={sceneModules} hot={hot} backHref={entry?.back} applicationRoute={entry?.route} createSceneEndpoint={createSceneEndpoint} onApplicationIssue={reportApplicationIssue}/></div>;
  return <div data-seene-project={projectId}><ScenePreview title="Your application" definition={defaultSceneDefinition()} backHref={entry?.back} hot={hot}>
    {route
      ? <Surface id={SCENE_PRESENTATION_SURFACE} style={{width:"100%",minHeight:980}}>
          <ApplicationPreview route={route} onIssue={reportApplicationIssue}/>
        </Surface>
      : content}
  </ScenePreview></div>;
}
