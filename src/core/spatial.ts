import {
  TransformSchema,
  validateScene,
  type Transform,
  type TransformInput,
  type SceneIssue,
  CameraSchema,
  type CameraInput,
  type SceneDefinition,
  FocusSchema,
} from "./scene";

export type Matrix = readonly number[];
export type Measurement = {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
};
export type Measurements = Record<string, Measurement>;
export type EvaluatedNode = {
  id: string;
  parentId?: string;
  worldPosition: { x: number; y: number; z: number };
  width: number;
  height: number;
  blur: number;
  opacity: number;
  focus: { depth: number; distance: number; span: number; maxBlur: number; scale: number; fStop: number; focalLength: number };
};
export type Evaluation = {
  nodes: EvaluatedNode[];
  focusDepth: number;
  issues: SceneIssue[];
};
const rad = Math.PI / 180;
export const FOCUS_BANDS = 4;
export function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = 0; i < 4; i++) sum += a[r * 4 + i] * b[i * 4 + c];
      out[r * 4 + c] = sum;
    }
  }
  return out;
}
export function matrixFor(input: TransformInput = {}): Matrix {
  const t = TransformSchema.parse(input);
  const cx = Math.cos(t.rotateX * rad), sx = Math.sin(t.rotateX * rad);
  const cy = Math.cos(t.rotateY * rad), sy = Math.sin(t.rotateY * rad);
  const cz = Math.cos(t.rotateZ * rad), sz = Math.sin(t.rotateZ * rad);
  const translate = [1, 0, 0, t.x, 0, 1, 0, t.y, 0, 0, 1, t.z, 0, 0, 0, 1];
  const rx = [1, 0, 0, 0, 0, cx, -sx, 0, 0, sx, cx, 0, 0, 0, 0, 1];
  const ry = [cy, 0, sy, 0, 0, 1, 0, 0, -sy, 0, cy, 0, 0, 0, 0, 1];
  const rz = [cz, -sz, 0, 0, sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const scale = [
    t.scale, 0, 0, 0,
    0, t.scale, 0, 0,
    0, 0, t.scale, 0,
    0, 0, 0, 1,
  ];
  return [rx, ry, rz, scale].reduce(multiply, translate);
}
export function transformToCss(input: TransformInput = {}): string {
  const t = TransformSchema.parse(input);
  return `translate3d(${t.x}px, ${t.y}px, ${t.z}px) rotateX(${t.rotateX}deg) rotateY(${t.rotateY}deg) rotateZ(${t.rotateZ}deg) scale(${t.scale})`;
}
export function evaluateScene(
  input: unknown,
  measurements: Measurements = {},
): Evaluation {
  const parsed = validateScene(input);
  if (!parsed.success)
    return {
      nodes: [],
      focusDepth: 0,
      issues: parsed.error.issues.map((err: any) => ({
        path: err.path.join("."),
        message: err.message,
      })),
    };
  const scene = parsed.data;
  const nodeMap = new Map(scene.nodes.map((node) => [node.id, node]));
  const cache = new Map<string, Matrix>();
  const issues: SceneIssue[] = [];
  const camera = multiply(
    matrixFor({ rotateX: scene.camera?.rotateX ?? 0, rotateY: scene.camera?.rotateY ?? 0, rotateZ: scene.camera?.rotateZ ?? 0 }),
    matrixFor({ x: -(scene.camera?.x ?? 0), y: -(scene.camera?.y ?? 0), z: -(scene.camera?.z ?? 0) }),
  );
  const getWorld = (id: string): Matrix => {
    if (cache.has(id)) return cache.get(id)!;
    const node = nodeMap.get(id);
    if (!node) return camera;
    const size = measurements[id];
    const offsetX = size?.offsetX ?? 0,
      offsetY = size?.offsetY ?? 0;
    const validOffset = Number.isFinite(offsetX) && Number.isFinite(offsetY);
    if (!validOffset)
      issues.push({
        path: id,
        message: "Invalid layout measurement for " + id,
      });
    const local = matrixFor({
      ...node.transform,
      x: (node.transform?.x ?? 0) + (validOffset ? offsetX : 0),
      y: (node.transform?.y ?? 0) + (validOffset ? offsetY : 0),
    });
    const world = multiply(
      node.parentId ? getWorld(node.parentId) : camera,
      local,
    );
    cache.set(id, world);
    return world;
  };
  for (const node of scene.nodes) {
    if (!getWorld(node.id).every(Number.isFinite)) {
      issues.push({
        path: node.id,
        message: "Composed transform exceeds safe numeric limits.",
      });
      return { nodes: [], focusDepth: 0, issues };
    }
  }
  const defaultCamera = CameraSchema.parse({});
  const focusCamera = scene.camera ?? defaultCamera;
  const focusDepth = -focusCamera.z;
  const perspective = focusCamera.perspective ?? 1400;
  const evaluatedNodes: EvaluatedNode[] = scene.nodes.map((node) => {
    const world = getWorld(node.id);
    const worldPosition = { x: world[3], y: world[7], z: world[11] };
    const size = measurements[node.id] ?? { width: 1, height: 1 };
    const depth = worldPosition.z;
    const nodeDistance = perspective - depth;
    const distance = Math.abs(nodeDistance - (scene.focus.distance ?? perspective));
    const span = Math.max(size.width, size.height, 1);
    const scale = Math.hypot(world[0], world[1], world[2]) || 1;
    const focusObj = { depth, distance, span, maxBlur: scene.focus.maxBlur, scale, fStop: scene.focus.fStop, focalLength: scene.focus.focalLength };
    const blur = (uniformFocusBlur(focusObj, span) ?? 0) as number;
    return {
      id: node.id,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      worldPosition,
      width: size.width,
      height: size.height,
      blur,
      opacity: 1,
      focus: focusObj,
    };
  });
  return { nodes: evaluatedNodes, focusDepth, issues };
}
export function cameraToCss(input: CameraInput = {}): string {
  const c = CameraSchema.parse(input);
  return `rotateX(${c.rotateX}deg) rotateY(${c.rotateY}deg) rotateZ(${c.rotateZ}deg) translate3d(${-c.x}px, ${-c.y}px, ${-c.z}px)`;
}
export type CameraPose = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  perspective: number;
};
export function cameraFromPose(pose: CameraPose): CameraInput {
  const dx = pose.target.x - pose.position.x;
  const dy = pose.target.y - pose.position.y;
  const dz = pose.target.z - pose.position.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist === 0) {
    return { x: pose.position.x, y: pose.position.y, z: pose.position.z, perspective: pose.perspective };
  }
  const fx = dx / dist;
  const fy = dy / dist;
  const fz = dz / dist;
  const yaw = Math.atan2(fx, -fz) / rad;
  const pitch = -Math.atan2(fy, Math.sqrt(fx * fx + fz * fz)) / rad;
  return {
    x: pose.position.x,
    y: pose.position.y,
    z: pose.position.z,
    rotateX: Number(pitch.toFixed(4)),
    rotateY: Number(yaw.toFixed(4)),
    rotateZ: 0,
    perspective: pose.perspective,
  };
}
export function focusForSurface(transform: TransformInput | Matrix = {}, focusInput: unknown = {}): { depth: number; distance: number; span: number; maxBlur: number; scale: number; fStop: number; focalLength: number } {
  const f = FocusSchema.parse(focusInput);
  const matrix = Array.isArray(transform) ? transform : matrixFor(transform as TransformInput);
  const depth = matrix[11];
  const scale = Math.hypot(matrix[0], matrix[1], matrix[2]) || 1;
  return { depth, distance: f.distance, span: 100, maxBlur: f.maxBlur, scale, fStop: f.fStop, focalLength: f.focalLength };
}
export function sampleFocus(
  focus: { depth: number; distance: number; span: number; maxBlur?: number; scale?: number },
  _x: number,
  _y: number,
): number {
  return Math.abs(focus.depth - focus.distance);
}
export function focusMask(_focus: unknown, _width: number, _height: number, band: number) {
  const stops = Array.from({length: FOCUS_BANDS + 1}, (_, i) => i === band ? 1 : 0);
  return { stops, xWeight: 0.5, yWeight: 0.5, reverseX: false, reverseY: false };
}
export function uniformFocusBlur(
  distanceOrFocus: number | { depth: number; distance: number; span: number; maxBlur?: number; scale?: number; fStop?: number; focalLength?: number },
  span: number,
  focusInputOrMaxBlur?: unknown,
): number | undefined {
  if (typeof distanceOrFocus === "object" && distanceOrFocus !== null) {
    const f = distanceOrFocus;
    const diff = Math.abs(f.distance);
    const maxBlur = typeof focusInputOrMaxBlur === "number" ? focusInputOrMaxBlur : (f.maxBlur ?? 6);
    const fStop = f.fStop ?? 8;
    const focalLength = f.focalLength ?? 50;
    const scale = f.scale ?? 1;
    return circleOfOccurrence(diff, maxBlur, fStop, focalLength, span, scale);
  }
  const diff = distanceOrFocus;
  const parsedFocus = FocusSchema.safeParse(focusInputOrMaxBlur);
  const maxBlur = parsedFocus.success ? parsedFocus.data.maxBlur : (typeof focusInputOrMaxBlur === "number" ? focusInputOrMaxBlur : 6);
  const fStop = parsedFocus.success ? parsedFocus.data.fStop : 8;
  const focalLength = parsedFocus.success ? parsedFocus.data.focalLength : 50;
  return circleOfOccurrence(diff, maxBlur, fStop, focalLength, span, 1);
}

function circleOfOccurrence(
  defocus: number,
  maxBlur: number,
  fStop: number,
  _focalLength: number,
  _span: number,
  _scale: number,
): number {
  if (defocus === 0 || maxBlur === 0) return 0;
  const apertureFactor = Math.min(2, Math.max(0.25, 8 / fStop));
  const spread = 100;
  const ratio = defocus / spread;
  const normalized = 1 - Math.exp(-ratio * ratio / 2);
  const blur = normalized * maxBlur * apertureFactor;
  return Number(Math.min(maxBlur, blur).toFixed(2));
}
