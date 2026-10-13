import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { SceneIssue } from "../core";
import type { ApplicationIssue } from "./application";
import { SceneLibrary } from "./SceneLibrary";
import { usePreviewConnection, type PreviewHot } from "./connection";
import type { TransitionPresetName } from "../core/preview";

export type SceneModules = Record<string, () => Promise<unknown>>;
const pause = () => {};
export function SceneModuleLibrary({
  modules,
  hot,
  backHref,
  hostContent,
  applicationRoute,
  createSceneEndpoint,
  onApplicationIssue,
  transition,
  onTransitionChange,
}: {
  modules: SceneModules;
  hot?: PreviewHot;
  backHref?: string;
  hostContent?: ReactNode;
  applicationRoute?: string;
  createSceneEndpoint?: string;
  onApplicationIssue?: (issue: ApplicationIssue) => void;
  transition?: TransitionPresetName;
  onTransitionChange?: (value: TransitionPresetName | undefined) => void;
}) {
  const connection = usePreviewConnection(hot, pause);
  const [state, setState] = useState<{
    sources: Record<string, unknown>;
    bindings: Record<string, ComponentType<{ children?: ReactNode }>>;
    issues: SceneIssue[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const sources: Record<string, unknown> = {};
      const bindings: Record<string, ComponentType<{ children?: ReactNode }>> = {};
      const issues: SceneIssue[] = [];
      const entries = Object.entries(modules);
      if (entries.length > 256) {
        if (active)
          setState({
            sources,
            bindings,
            issues: [
              {
                path: "catalog",
                message: "Keep this library at or below 128 scene/component pairs.",
              },
            ],
          });
        return;
      }
      await Promise.all(
        entries.map(async ([path, loader]) => {
          const normalized = path.replace(/^\//, "");
          try {
            const value = await loader();
            const item =
              value && typeof value === "object" && "default" in value
                ? value.default
                : undefined;
            if (path.endsWith(".scene.json")) {
              if (item === undefined) {
                issues.push({
                  path: normalized,
                  message: "Recipe module has no default export.",
                });
              } else {
                sources[normalized] = item;
              }
            } else if (/\.[jt]sx$/.test(path)) {
              if (
                typeof item === "function" ||
                (typeof item === "object" && item !== null)
              ) {
                bindings[normalized] = item as ComponentType<{ children?: ReactNode }>;
              } else {
                issues.push({
                  path: normalized,
                  message: "Scene component module must default-export a React component.",
                });
              }
            }
          } catch (error) {
            issues.push({
              path: normalized,
              message:
                error instanceof Error
                  ? error.message
                  : "Scene module could not be loaded.",
            });
          }
        }),
      );
      if (active) setState({ sources, bindings, issues });
    };
    void load();
    return () => {
      active = false;
    };
  }, [modules, connection.generation]);
  if (!state)
    return (
      <div
        role="status"
        style={{ padding: 40, color: "var(--seene-text)", background: "var(--seene-bg)" }}
      >
        Loading your scenes…
      </div>
    );
  return (
    <SceneLibrary
      sources={state.sources}
      bindings={state.bindings}
      sourceIssues={state.issues}
      hostContent={hostContent}
      hot={hot}
      backHref={backHref}
      applicationRoute={applicationRoute}
       createSceneEndpoint={createSceneEndpoint}
       onApplicationIssue={onApplicationIssue}
       transition={transition}
       onTransitionChange={onTransitionChange}
     />
   );
 }
