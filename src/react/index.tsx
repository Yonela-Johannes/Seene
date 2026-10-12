import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  RESOURCES,
  SCENE_BACKGROUND,
  cameraToCss,
  transformToCss,
  motionTime,
  type CameraInput,
  type EvaluatedNode,
  type FocusInput,
  type Measurements,
  type SceneIssue,
  type Transform,
  type TransformInput,
} from "../core";
import { type MotionInput } from "../core/motion";
import { SCENE_PRESENTATION_SURFACE } from "../core/platform";
import { createRegistry, type Registry } from "./registry";

type SceneContextValue = {
  registry: Registry;
  nodes: Map<string, EvaluatedNode>;
  transforms: Map<string, Transform>;
  opacities: Map<string, number>;
  timeMs: number;
};
const SceneContext = createContext<SceneContextValue | null>(null);
const ParentContext = createContext<symbol | undefined>(undefined);
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
export type SceneProps = {
  motion?: MotionInput;
  timeMs?: number;
  children?: ReactNode;
  camera?: CameraInput;
  focus?: FocusInput;
  recipeNodes?: { id: string; parentId?: string }[];
  className?: string;
  style?: CSSProperties;
  onDiagnostics?: (issues: SceneIssue[]) => void;
};
export type SurfaceProps = {
  id: string;
  transform?: TransformInput;
  children?: ReactNode;
  content?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Scene({
  children,
  camera,
  focus,
  motion,
  recipeNodes,
  timeMs = 0,
  className,
  style,
  onDiagnostics,
}: SceneProps) {
  const [registry] = useState(createRegistry);
  const revision = useSyncExternalStore(
    registry.subscribe,
    registry.snapshot,
    registry.snapshot,
  );
  const stage = useRef<HTMLDivElement>(null);
  useLayout(() => registry.mount(stage.current!), [registry]);
  useLayout(() => {
    registry.refresh();
  });
  const result = useMemo(() => {
    const bindings = Array.from(registry.entries.values());
    const state = motion
      ? RESOURCES["evaluate-motion"](motion, timeMs)
      : { surfaces: {}, camera: {}, focus: {}, issues: [] };
    const input = {
      camera: { ...camera, ...state.camera },
      focus: { ...focus, ...state.focus },
      nodes: bindings.map((binding) => ({
        id: binding.id,
        parentId: binding.parent
          ? registry.entries.get(binding.parent)?.id
          : undefined,
        transform: {
          ...binding.transform,
          ...Object.fromEntries(
            Object.entries(state.surfaces[binding.id] ?? {}).filter(
              ([key]) => key !== "opacity",
            ),
          ),
        },
      })),
    };
    const validated = RESOURCES["validate-definition"](input);
    const measurements: Measurements = Object.fromEntries(
      bindings.flatMap((binding) => {
        const measurement = registry.measurements.get(binding.token);
        return measurement ? [[binding.id, measurement] as const] : [];
      }),
    );
    const evaluation = RESOURCES["evaluate-spatial"](input, measurements);
    const ids = new Set(bindings.map((b) => b.id));
    const declaredNodes = recipeNodes ?? (validated.success ? validated.data.nodes : []);
    const declaredIds = new Set(declaredNodes.map((n) => n.id));

    // Mismatch diagnostics: Recipe nodes missing mounted Surfaces, or mounted Surfaces missing from Recipe
    const nodeMismatchIssues: SceneIssue[] = [];
    if (recipeNodes || validated.success) {
      for (const node of declaredNodes) {
        if (node.id === SCENE_PRESENTATION_SURFACE) continue;
        if (!ids.has(node.id)) {
          nodeMismatchIssues.push({
            path: "nodes." + node.id,
            message: `Recipe node '${node.id}' has no mounted Surface component in scene.`,
          });
        }
      }
      for (const b of bindings) {
        if (b.id === SCENE_PRESENTATION_SURFACE) continue;
        if (!declaredIds.has(b.id)) {
          nodeMismatchIssues.push({
            path: "surface." + b.id,
            message: `Mounted Surface '${b.id}' has no recipe node declaration in definition.scene.nodes.`,
          });
        }
      }
    }

    evaluation.issues.push(
      ...state.issues,
      ...nodeMismatchIssues,
      ...registry.coverageIssues,
      ...Object.keys(state.surfaces)
        .filter((id) => !ids.has(id))
        .map((id) => ({
          path: "motion." + id,
          message: "Motion target is not registered: " + id,
        })),
    );
    if (!Number.isFinite(timeMs))
      evaluation.issues.push({
        path: "timeMs",
        message: "Scene time must be finite.",
      });
    return { evaluation, validated, state };
  }, [registry, revision, camera, focus, motion, timeMs]);
  const context = useMemo(
    () => ({
      registry,
      timeMs: motion ? motionTime(motion, timeMs) : Number.isFinite(timeMs) ? timeMs : 0,
      opacities: new Map(
        Object.entries(result.state.surfaces).map(([id, s]) => [
          id,
          s.opacity ?? 1,
        ]),
      ),
      nodes: new Map(result.evaluation.nodes.map((node) => [node.id, node])),
      transforms: new Map(
        result.validated.success
          ? result.validated.data.nodes.filter(node => node.transform).map((node) => [node.id, node.transform!])
          : [],
      ),
    }),
    [registry, result, timeMs, motion],
  );

  const callback = useRef(onDiagnostics);
  callback.current = onDiagnostics;
  const issueKey = JSON.stringify(result.evaluation.issues);
  const lastReported = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastReported.current !== issueKey) {
      lastReported.current = issueKey;
      callback.current?.(JSON.parse(issueKey) as SceneIssue[]);
    }
  }, [issueKey]);
  const validCamera = result.validated.success
    ? result.validated.data.camera
    : undefined;
  return (
    <SceneContext.Provider value={context}>
      <ParentContext.Provider value={undefined}>
        <div
          className={className}
          data-seene-scene=""
          data-seene-valid={result.evaluation.issues.length===0 ? "true" : "false"}
          style={{
            ...style,
            background: SCENE_BACKGROUND,
            backgroundColor: SCENE_BACKGROUND,
            backgroundImage: "none",
            position: style?.position ?? "relative",
            pointerEvents: "none",
            perspective: validCamera?.perspective ?? 1400,
            perspectiveOrigin: "50% 50%",
            transformStyle: "flat",
          }}
        >
          <div
            ref={stage}
            data-seene-stage=""
            style={{
              position: "relative",
              pointerEvents: "none",
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
              transformOrigin: "50% 50%",
              transform: cameraToCss(validCamera),
            }}
          >
            {children}
          </div>
        </div>
        {result.evaluation.issues.length > 0 && (
          <div role="alert" data-seene-diagnostics="">
            <strong>Seene scene needs a correction.</strong>
            <ul>
              {result.evaluation.issues.map((issue, index) => (
                <li key={index}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
            <p>
              Correct the scene props or registered IDs; the scene updates
              automatically.
            </p>
          </div>
        )}
      </ParentContext.Provider>
    </SceneContext.Provider>
  );
}

export function Surface({
  id,
  transform,
  children,
  content,
  className,
  style,
}: SurfaceProps) {
  const context = useContext(SceneContext);
  const parent = useContext(ParentContext);
  const [token] = useState(() => Symbol("seene-binding"));
  const element = useRef<HTMLDivElement>(null);
  if (!context)
    throw new Error(
      "Surface and Motion must be rendered inside a Seene Scene.",
    );
  const { registry, nodes, transforms } = context;
  useLayout(() => {
    registry.upsert({
      token,
      id,
      parent,
      element: element.current!,
      transform,
    });
  });
  useLayout(() => () => registry.remove(token), [registry, token]);
  const node = nodes.get(id);
  const grouped = Array.from(registry.entries.values()).some(
    (binding) => binding.parent === token,
  );
  const blur = node?.blur ?? 0;
  const hasDepth = node && node.width > 0 && node.height > 0 && node.focus.maxBlur > 0;
  const contentLeaf = content !== undefined || !grouped;
  const clampedBlur = Math.min(blur, 60);
  const applyBlur = hasDepth && contentLeaf && clampedBlur > 0;
  const leafStyle: CSSProperties = {
    pointerEvents: style?.pointerEvents ?? "auto",
    opacity: context.opacities.get(id) ?? 1,
    ...(applyBlur ? { filter: `blur(${clampedBlur}px)` } : {}),
  };
  return (
    <ParentContext.Provider value={token}>
      <div
        ref={element}
        className={className}
        data-seene-id={id}
        data-seene-blur={blur}
        data-seene-depth={node?.worldPosition.z ?? 0}
        style={{
          ...style,
          position: style?.position ?? "relative",
          transform: transformToCss(transforms.get(id)),
          transformOrigin: "50% 50%",
          transformStyle: "preserve-3d",
          opacity: 1,
          overflow: "visible",
          pointerEvents: "none",
          filter: style?.filter ?? "none",
        }}
      >
        {content !== undefined && (
          <div data-seene-content="" style={leafStyle}>
            {content}
          </div>
        )}
        <div
          data-seene-content={
            content === undefined && !grouped ? "" : undefined
          }
          style={{
            transformStyle: "preserve-3d",
            ...(content === undefined && !grouped
              ? leafStyle
              : { pointerEvents: "none", filter: "none" }),
          }}
        >
          {children}
        </div>
      </div>
    </ParentContext.Provider>
  );
}

export function useSceneTime(): number {
  const context = useContext(SceneContext);
  if (!context) throw new Error("useSceneTime requires a Seene Scene.");
  return context.timeMs;
}
export const Motion = Surface;

export type SceneErrorBoundaryProps = {
  children?: ReactNode;
  resetKey?: unknown;
  onError?: (error: unknown) => void;
  onReset?: () => void;
};

export function SceneErrorBoundary({ children, resetKey, onError, onReset }: SceneErrorBoundaryProps) {
  return (
    <ErrorBoundary FallbackComponent={SceneErrorFallback} resetKeys={[resetKey]} onError={onError} onReset={onReset}>
      {children}
    </ErrorBoundary>
  );
}

function SceneErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return (
    <div role="alert" data-seene-error="" style={{ padding: 24, maxWidth: 640, background: "#1c1917", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: 16, color: "#fca5a5", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
      <strong style={{ fontSize: 14, fontWeight: 600, color: "#f87171", display: "block", marginBottom: 8 }}>Unable to render the Seene scene.</strong>
      <p style={{ fontFamily: "monospace", color: "#fca5a5", background: "rgba(0,0,0,0.5)", padding: 12, borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", marginBottom: 12 }}>{message}</p>
      {stack && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", color: "#f87171", fontWeight: 500, marginBottom: 4 }}>View call stack</summary>
          <pre style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(252, 165, 165, 0.8)", background: "rgba(0,0,0,0.7)", padding: 12, borderRadius: 8, overflowX: "auto", maxHeight: 200, whiteSpace: "pre-wrap" }}>{stack}</pre>
        </details>
      )}
      <p style={{ color: "rgba(252, 165, 165, 0.7)", marginBottom: 16 }}>Correct the component or scene configuration, then retry.</p>
      <button type="button" onClick={resetErrorBoundary} style={{ padding: "8px 16px", borderRadius: 8, background: "#dc2626", color: "#ffffff", fontWeight: 500, border: "none", cursor: "pointer" }}>
        Retry scene
      </button>
    </div>
  );
}

export { useSceneCapture } from "./capture";
