import { useMemo, useState, type ReactNode } from "react";
import { defaultSceneDefinition } from "../core";
import {
  SCENE_PRESENTATION_HEIGHT,
  SCENE_PRESENTATION_SURFACE,
  SCENE_PRESENTATION_WIDTH,
  SEENE_PREVIEW_QUERY_PARAM,
} from "../core/platform";
import { Surface } from "../react";
import { ApplicationPreview, type ApplicationIssue, applicationDocumentUrl, containsDocumentContent } from "./application";
import { ScenePreview } from "./ScenePreview";
import { SceneModuleLibrary, type SceneModules } from "./modules";
import { type PreviewHot } from "./connection";
import { type TransitionPresetName } from "../core/preview";

export type ProjectPreviewProps = {
  children?: ReactNode;
  projectId: string;
  enabled: boolean;
  active?: boolean;
  sceneModules?: SceneModules;
  createSceneEndpoint?: string;
  hot?: PreviewHot;
  applicationRoute?: string;
  onApplicationIssue?: (issue: ApplicationIssue) => void;
  transition?: TransitionPresetName;
  onTransitionChange?: (value: TransitionPresetName | undefined) => void;
};

function previewQueryActive(): boolean {
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get(SEENE_PREVIEW_QUERY_PARAM) === "1";
}

export function ProjectPreview({
  children,
  projectId,
  enabled,
  active = false,
  sceneModules,
  createSceneEndpoint,
  hot,
  applicationRoute,
  onApplicationIssue,
  transition,
  onTransitionChange,
}: ProjectPreviewProps): ReactNode {
  const [previewActive] = useState(() => enabled && (active === true || previewQueryActive()));

  if (!previewActive) {
    return children;
  }

  const backHref = useMemo(() => applicationDocumentUrl(window.location.href), []);

  if (sceneModules !== undefined) {
    return (
      <div data-seene-project={projectId}>
        <SceneModuleLibrary
          modules={sceneModules}
          hot={hot}
          hostContent={children}
          applicationRoute={applicationRoute}
          createSceneEndpoint={createSceneEndpoint}
          onApplicationIssue={onApplicationIssue}
          transition={transition}
          onTransitionChange={onTransitionChange}
        />
      </div>
    );
  }

  const definition = useMemo(() => defaultSceneDefinition(), []);
  const hostContent = containsDocumentContent(children)
    ? <ApplicationPreview route="/" title={projectId} onIssue={onApplicationIssue} style={{ width: "100%", height: "100%" }} />
    : children;

  return (
    <div data-seene-project={projectId} style={{ position: "relative", width: "100%", height: "100%" }}>
      <ScenePreview
        definition={definition}
        title={projectId}
        backHref={backHref}
        hot={hot}
        transition={transition}
        onTransitionChange={onTransitionChange}
      >
        <Surface
          id={SCENE_PRESENTATION_SURFACE}
          style={{ width: SCENE_PRESENTATION_WIDTH, height: SCENE_PRESENTATION_HEIGHT }}
        >
          {hostContent}
        </Surface>
      </ScenePreview>
    </div>
  );
}
