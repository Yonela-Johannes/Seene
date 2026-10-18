import { z } from "zod";
import { CameraSchema, FocusSchema, type Camera, type Focus, type SceneIssue } from "./scene";
import { EasingTypeSchema, MotionSchema, evaluateMotion, type MotionDefinition } from "./motion";

export const WALKTHROUGH_DOCUMENT_VERSION = 1;
export const WALKTHROUGH_MAX_DURATION_MS = 120_000;

const finite = z.number().finite();
const NodeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/, "Use a stable alphanumeric node ID.");

export const WalkthroughNodeTypeSchema = z.enum([
  "start",
  "show",
  "scroll",
  "focus",
  "highlight",
  "click",
  "wait",
  "camera",
  "transition",
  "caption",
  "end",
]);
export type WalkthroughNodeType = z.infer<typeof WalkthroughNodeTypeSchema>;

export const WalkthroughTargetSchema = z.strictObject({
  kind: z.enum(["component", "section", "element"]).default("section"),
  sectionId: z.string().trim().min(1).max(160).optional(),
  selector: z.string().trim().min(1).max(240).optional(),
  file: z.string().trim().min(1).max(400).optional(),
  export: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(160).optional(),
});
export type WalkthroughTarget = z.output<typeof WalkthroughTargetSchema>;
export type WalkthroughTargetInput = z.input<typeof WalkthroughTargetSchema>;

export const WalkthroughTransitionTypeSchema = z.enum(["cut", "crossfade", "camera", "focus"]);
export type WalkthroughTransitionType = z.infer<typeof WalkthroughTransitionTypeSchema>;
export const WalkthroughTransitionSchema = z.strictObject({
  type: WalkthroughTransitionTypeSchema.default("crossfade"),
  durationMs: z.number().int().nonnegative().max(5000).default(300),
});
export type WalkthroughTransition = z.output<typeof WalkthroughTransitionSchema>;

const CameraOverrideSchema = z.strictObject({
  perspective: finite.min(100).max(50000).optional(),
  x: finite.optional(),
  y: finite.optional(),
  z: finite.optional(),
  rotateX: finite.optional(),
  rotateY: finite.optional(),
  rotateZ: finite.optional(),
});
const FocusOverrideSchema = z.strictObject({
  distance: finite.min(1).max(100000).optional(),
  fStop: finite.min(0.1).max(128).optional(),
  focalLength: finite.min(1).max(5000).optional(),
  maxBlur: finite.min(0).max(32).optional(),
});
export type WalkthroughCameraOverride = z.output<typeof CameraOverrideSchema>;
export type WalkthroughFocusOverride = z.output<typeof FocusOverrideSchema>;

export const WALKTHROUGH_CAMERA_PROPERTIES = Object.freeze([
  "perspective",
  "x",
  "y",
  "z",
  "rotateX",
  "rotateY",
  "rotateZ",
] as const);
export const WALKTHROUGH_FOCUS_PROPERTIES = Object.freeze([
  "distance",
  "fStop",
  "focalLength",
  "maxBlur",
] as const);

export const WalkthroughScrollSchema = z.strictObject({
  align: z.enum(["start", "center", "end"]).default("start"),
  offsetPx: finite.default(0),
});

export const WalkthroughHighlightSchema = z.strictObject({
  style: z.enum(["outline", "glow", "dim", "spotlight"]).default("outline"),
  color: z.string().trim().max(40).optional(),
  paddingPx: finite.min(0).max(240).default(8),
});

export const WalkthroughExpectationSchema = z.strictObject({
  sectionId: z.string().trim().min(1).max(160).optional(),
  selector: z.string().trim().min(1).max(240).optional(),
  state: z.enum(["visible", "hidden"]).default("visible"),
});
export type WalkthroughExpectation = z.output<typeof WalkthroughExpectationSchema>;

export const WalkthroughActionSchema = z.strictObject({
  expect: WalkthroughExpectationSchema.optional(),
  timeoutMs: z.number().int().nonnegative().max(60000).default(5000),
  required: z.boolean().default(true),
});

export const WalkthroughCaptionSchema = z.strictObject({
  text: z.string().trim().min(1).max(400),
  position: z.enum(["top", "bottom", "center"]).default("bottom"),
});

export const WalkthroughNodeSchema = z.strictObject({
  id: NodeIdSchema,
  type: WalkthroughNodeTypeSchema,
  title: z.string().trim().min(1).max(120),
  target: WalkthroughTargetSchema.optional(),
  next: NodeIdSchema.optional(),
  branches: z.record(NodeIdSchema, NodeIdSchema).optional(),
  durationMs: z.number().int().nonnegative().max(WALKTHROUGH_MAX_DURATION_MS).default(2400),
  delayMs: z.number().int().nonnegative().max(WALKTHROUGH_MAX_DURATION_MS).default(0),
  easing: EasingTypeSchema.default("cinematic"),
  transitionIn: WalkthroughTransitionSchema.optional(),
  camera: CameraOverrideSchema.optional(),
  focus: FocusOverrideSchema.optional(),
  scroll: WalkthroughScrollSchema.optional(),
  highlight: WalkthroughHighlightSchema.optional(),
  action: WalkthroughActionSchema.optional(),
  caption: WalkthroughCaptionSchema.optional(),
});
export type WalkthroughNode = z.output<typeof WalkthroughNodeSchema>;
export type WalkthroughNodeInput = z.input<typeof WalkthroughNodeSchema>;

export const WALKTHROUGH_DEFAULT_TRANSITION: WalkthroughTransition = { type: "crossfade", durationMs: 300 };

export const WalkthroughGlobalsSchema = z.strictObject({
  width: z.number().int().min(64).max(3840).default(1440),
  height: z.number().int().min(64).max(3840).default(900),
  frameRate: z.union([z.literal(30), z.literal(60), z.literal(120)]).default(60),
  defaultTransition: WalkthroughTransitionSchema.default(WALKTHROUGH_DEFAULT_TRANSITION),
  defaultEasing: EasingTypeSchema.default("cinematic"),
  defaultCamera: CameraOverrideSchema.optional(),
  defaultFocus: FocusOverrideSchema.optional(),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
});
export type WalkthroughGlobals = z.output<typeof WalkthroughGlobalsSchema>;
export type WalkthroughGlobalsInput = z.input<typeof WalkthroughGlobalsSchema>;

export const WALKTHROUGH_DEFAULT_GLOBALS: WalkthroughGlobals = {
  width: 1440,
  height: 900,
  frameRate: 60,
  defaultTransition: WALKTHROUGH_DEFAULT_TRANSITION,
  defaultEasing: "cinematic",
  autoplay: false,
  loop: false,
};

export const WalkthroughDocumentSchema = z.strictObject({
  version: z.literal(1).default(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  startId: NodeIdSchema.optional(),
  settings: WalkthroughGlobalsSchema.default(WALKTHROUGH_DEFAULT_GLOBALS),
  nodes: z.array(WalkthroughNodeSchema).min(1).max(512),
});
export type WalkthroughDocument = z.output<typeof WalkthroughDocumentSchema>;
export type WalkthroughDocumentInput = z.input<typeof WalkthroughDocumentSchema>;

const TARGET_REQUIRED: readonly WalkthroughNodeType[] = ["show", "scroll", "focus", "highlight", "click"];
const CAMERA_DEFAULTS = CameraSchema.parse({});
const FOCUS_DEFAULTS = FocusSchema.parse({});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function serializable(value: unknown, ancestors = new Set<unknown>()): boolean {
  if (value === undefined || value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const ok = Array.isArray(value)
    ? value.every(item => serializable(item, ancestors))
    : Object.values(value as Record<string, unknown>).every(entry => serializable(entry, ancestors));
  ancestors.delete(value);
  return ok;
}

export function walkthroughTargetKey(target: WalkthroughTarget | WalkthroughTargetInput | undefined): string {
  if (!target) return "";
  return [target.kind ?? "section", target.sectionId ?? "", target.selector ?? "", target.file ?? "", target.export ?? ""].join("|");
}

export function hasWalkthroughTarget(target: WalkthroughTarget | WalkthroughTargetInput | undefined): boolean {
  if (!target) return false;
  return Boolean(target.sectionId || target.selector || target.file);
}

function targetIssues(node: WalkthroughNode, path: string): SceneIssue[] {
  const issues: SceneIssue[] = [];
  if (TARGET_REQUIRED.includes(node.type)) {
    if (!node.target || !hasWalkthroughTarget(node.target))
      issues.push({ path: `${path}.target`, message: `A ${node.type} node needs a component, section or element target.` });
    else if (node.target.kind === "component" && !node.target.file)
      issues.push({ path: `${path}.target.file`, message: "A component target needs a source file." });
    else if (node.target.kind === "element" && !(node.target.selector || node.target.sectionId))
      issues.push({ path: `${path}.target`, message: "An element target needs a stable selector or section ID." });
  }
  if (node.type === "caption" && !node.caption)
    issues.push({ path: `${path}.caption`, message: "A caption node needs caption text." });
  return issues;
}

export type WalkthroughChain = {
  nodes: WalkthroughNode[];
  startId?: string;
  issues: SceneIssue[];
};

function byNodeId(document: WalkthroughDocument): Map<string, WalkthroughNode> {
  return new Map(document.nodes.map(node => [node.id, node]));
}

export function resolveWalkthroughChain(document: WalkthroughDocument): WalkthroughChain {
  const issues: SceneIssue[] = [];
  const byId = byNodeId(document);
  const ids = new Set<string>();
  for (const node of document.nodes) {
    if (ids.has(node.id)) issues.push({ path: `nodes.${node.id}`, message: `Duplicate node ID "${node.id}".` });
    ids.add(node.id);
  }
  const startNodes = document.nodes.filter(node => node.type === "start");
  let start: WalkthroughNode | undefined;
  if (document.startId) {
    start = byId.get(document.startId);
    if (!start) issues.push({ path: "startId", message: `Start node "${document.startId}" does not exist.` });
  } else if (startNodes.length === 1) {
    start = startNodes[0];
  } else if (startNodes.length === 0) {
    issues.push({ path: "nodes", message: "A walkthrough needs one start node." });
  } else {
    issues.push({ path: "nodes", message: "A walkthrough can only have one start node; remove the extras or set startId." });
  }
  const order: WalkthroughNode[] = [];
  const visited = new Set<string>();
  let current: WalkthroughNode | undefined = start;
  while (current) {
    if (visited.has(current.id)) {
      issues.push({ path: `nodes.${current.id}`, message: `Playback revisited "${current.id}", which would loop forever.` });
      break;
    }
    visited.add(current.id);
    order.push(current);
    for (const [branch, target] of Object.entries(current.branches ?? {})) {
      if (!byId.has(target)) issues.push({ path: `nodes.${current.id}.branches.${branch}`, message: `Branch "${branch}" points at missing node "${target}".` });
    }
    if (current.next === current.id) {
      issues.push({ path: `nodes.${current.id}.next`, message: `Node "${current.id}" cannot connect to itself.` });
      break;
    }
    if (current.next && !byId.has(current.next)) {
      issues.push({ path: `nodes.${current.id}.next`, message: `Node "${current.id}" connects to missing node "${current.next}".` });
      break;
    }
    current = current.next ? byId.get(current.next) : undefined;
  }
  const reached = new Set(order.map(node => node.id));
  for (const node of document.nodes)
    if (!reached.has(node.id)) issues.push({ path: `nodes.${node.id}`, message: `Node "${node.id}" is not connected from the start node.` });
  if (order.length > 0 && order[order.length - 1].type !== "end")
    issues.push({ path: `nodes.${order[order.length - 1].id}`, message: "The walkthrough does not finish at an end node." });
  if (!document.nodes.some(node => node.type === "end"))
    issues.push({ path: "nodes", message: "Add an end node to finish the walkthrough." });
  return { nodes: order, startId: start?.id, issues };
}

export type WalkthroughReview = {
  valid: boolean;
  document?: WalkthroughDocument;
  issues: SceneIssue[];
  advice: SceneIssue[];
};

/** Validate a walkthrough document: schema, connectivity, cycles, reachability and targets. */
export function validateWalkthrough(input: unknown): WalkthroughReview {
  if (!serializable(input))
    return { valid: false, issues: [{ path: "walkthrough", message: "Walkthroughs must contain JSON-serializable values." }], advice: [] };
  const parsed = WalkthroughDocumentSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      advice: [],
    };
  const document = parsed.data;
  const chain = resolveWalkthroughChain(document);
  const issues = [...chain.issues];
  const advice: SceneIssue[] = [];
  for (const node of document.nodes) issues.push(...targetIssues(node, `nodes.${node.id}`));
  for (const node of document.nodes) {
    if (node.type === "camera" && !node.camera && !document.settings.defaultCamera)
      advice.push({ path: `nodes.${node.id}.camera`, message: "This camera node has no camera override; it will hold the previous framing." });
  }
  const durationMs = walkthroughDuration(document);
  if (durationMs <= 0) issues.push({ path: "nodes", message: "The walkthrough has no duration; give its steps time." });
  if (durationMs > WALKTHROUGH_MAX_DURATION_MS)
    issues.push({ path: "nodes", message: `The walkthrough runs for ${Math.round(durationMs / 1000)}s, beyond the ${WALKTHROUGH_MAX_DURATION_MS / 1000}s export limit.` });
  return { valid: issues.length === 0, document, issues, advice };
}

export function getWalkthroughNode(document: WalkthroughDocument, id: string): WalkthroughNode | undefined {
  return document.nodes.find(node => node.id === id);
}

export function walkthroughChainNodes(document: WalkthroughDocument): WalkthroughNode[] {
  return resolveWalkthroughChain(document).nodes;
}

/** Total authored duration in milliseconds, following the connected chain from start. */
export function walkthroughDuration(document: WalkthroughDocument): number {
  const chain = resolveWalkthroughChain(document).nodes;
  let cursor = 0;
  for (const node of chain) cursor += node.delayMs + node.durationMs;
  return cursor;
}

export function nextWalkthroughId(document: WalkthroughDocument, base: string): string {
  const taken = new Set(document.nodes.map(node => node.id));
  const root = base.replace(/[^a-zA-Z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || "node";
  if (!taken.has(root)) return root;
  let index = 2;
  while (taken.has(`${root}-${index}`)) index += 1;
  return `${root}-${index}`;
}

const NODE_DEFAULTS: Record<WalkthroughNodeType, { title: string; durationMs: number }> = {
  start: { title: "Start", durationMs: 600 },
  show: { title: "Show section", durationMs: 2400 },
  scroll: { title: "Scroll to section", durationMs: 1200 },
  focus: { title: "Focus element", durationMs: 1400 },
  highlight: { title: "Highlight element", durationMs: 1400 },
  click: { title: "Click element", durationMs: 900 },
  wait: { title: "Wait", durationMs: 1000 },
  camera: { title: "Camera move", durationMs: 1500 },
  transition: { title: "Transition", durationMs: 300 },
  caption: { title: "Caption", durationMs: 1800 },
  end: { title: "End", durationMs: 800 },
};

/** Build a node input with type-appropriate defaults; the editor can then override fields. */
export function createWalkthroughNode(
  type: WalkthroughNodeType,
  init: { id: string; title?: string } & Partial<WalkthroughNodeInput>,
): WalkthroughNodeInput {
  const fallback = NODE_DEFAULTS[type];
  return {
    id: init.id,
    type,
    title: init.title ?? fallback.title,
    durationMs: init.durationMs ?? fallback.durationMs,
    ...(init.delayMs === undefined ? {} : { delayMs: init.delayMs }),
    ...(init.easing === undefined ? {} : { easing: init.easing }),
    ...(init.target === undefined ? {} : { target: init.target }),
    ...(init.next === undefined ? {} : { next: init.next }),
    ...(init.transitionIn === undefined ? {} : { transitionIn: init.transitionIn }),
    ...(init.camera === undefined ? {} : { camera: init.camera }),
    ...(init.focus === undefined ? {} : { focus: init.focus }),
    ...(init.scroll === undefined ? {} : { scroll: init.scroll }),
    ...(init.highlight === undefined ? {} : { highlight: init.highlight }),
    ...(init.action === undefined ? {} : { action: init.action }),
    ...(init.caption === undefined ? {} : { caption: init.caption }),
  };
}

/** Create a ready-to-edit walkthrough: start, one show step per target, and an end node. */
export function createWalkthroughDocument(input: {
  title: string;
  description?: string;
  targets?: Array<{ title?: string; target: WalkthroughTargetInput }>;
  settings?: WalkthroughGlobalsInput;
}): WalkthroughDocument {
  const targets = (input.targets ?? []).filter(entry => entry && entry.target);
  const nodes: WalkthroughNodeInput[] = [createWalkthroughNode("start", { id: "start" })];
  targets.forEach((entry, index) => {
    nodes.push(
      createWalkthroughNode("show", {
        id: `show-${index + 1}`,
        title: entry.title ?? entry.target.label ?? `Step ${index + 1}`,
        target: entry.target,
      }),
    );
  });
  nodes.push(createWalkthroughNode("end", { id: "end" }));
  nodes.forEach((node, index) => {
    node.next = index < nodes.length - 1 ? nodes[index + 1].id : undefined;
  });
  return WalkthroughDocumentSchema.parse({
    version: WALKTHROUGH_DOCUMENT_VERSION,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    settings: input.settings ?? {},
    nodes,
  });
}

/**
 * Build a walkthrough from selected application sections. Each section becomes a show step whose
 * target section ID is its own node ID, matching the tagged scaffold Seene generates so targets
 * resolve against the real rendered component.
 */
export function createWalkthroughFromSections(input: {
  title: string;
  description?: string;
  sections: Array<{ file: string; export?: string; title?: string }>;
  settings?: WalkthroughGlobalsInput;
}): WalkthroughDocument {
  const nodes: WalkthroughNodeInput[] = [createWalkthroughNode("start", { id: "start" })];
  input.sections.forEach((section, index) => {
    const id = `show-${index + 1}`;
    nodes.push(
      createWalkthroughNode("show", {
        id,
        title: section.title ?? section.export ?? section.file.split("/").pop() ?? `Step ${index + 1}`,
        target: {
          kind: "section",
          sectionId: id,
          file: section.file,
          ...(section.export ? { export: section.export } : {}),
          ...(section.title ? { label: section.title } : {}),
        },
      }),
    );
  });
  nodes.push(createWalkthroughNode("end", { id: "end" }));
  nodes.forEach((node, index) => {
    node.next = index < nodes.length - 1 ? nodes[index + 1].id : undefined;
  });
  return WalkthroughDocumentSchema.parse({
    version: WALKTHROUGH_DOCUMENT_VERSION,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    settings: input.settings ?? {},
    nodes,
  });
}

export type WalkthroughStep = {
  nodeId: string;
  index: number;
  type: WalkthroughNodeType;
  title: string;
  startTime: number;
  endTime: number;
  delayMs: number;
  durationMs: number;
  transitionStartTime: number;
  transitionDurationMs: number;
  transitionType: WalkthroughTransitionType;
  anchorIndex: number;
};

export type WalkthroughSchedule = {
  valid: boolean;
  issues: SceneIssue[];
  document: WalkthroughDocument | null;
  steps: WalkthroughStep[];
  durationMs: number;
};

function buildSteps(document: WalkthroughDocument, chain: WalkthroughNode[]): WalkthroughStep[] {
  const anchors: string[] = [];
  const steps: WalkthroughStep[] = [];
  let cursor = 0;
  let lastAnchor = 0;
  chain.forEach((node, index) => {
    const startTime = cursor + node.delayMs;
    const endTime = startTime + node.durationMs;
    const transition = node.transitionIn ?? document.settings.defaultTransition;
    const transitionDurationMs = index === 0 ? 0 : Math.min(transition.durationMs, startTime);
    const key = walkthroughTargetKey(node.target);
    if (key) {
      const found = anchors.indexOf(key);
      if (found === -1) {
        anchors.push(key);
        lastAnchor = anchors.length - 1;
      } else {
        lastAnchor = found;
      }
    }
    steps.push({
      nodeId: node.id,
      index,
      type: node.type,
      title: node.title,
      startTime,
      endTime,
      delayMs: node.delayMs,
      durationMs: node.durationMs,
      transitionStartTime: startTime - transitionDurationMs,
      transitionDurationMs,
      transitionType: transition.type,
      anchorIndex: key ? lastAnchor : index === 0 ? 0 : lastAnchor,
    });
    cursor = endTime;
  });
  return steps;
}

/** Resolve the authored node list into a linear timeline schedule. */
export function walkthroughSchedule(input: unknown): WalkthroughSchedule {
  const review = validateWalkthrough(input);
  if (!review.document) return { valid: false, issues: review.issues, document: null, steps: [], durationMs: 0 };
  const chain = resolveWalkthroughChain(review.document);
  const steps = buildSteps(review.document, chain.nodes);
  const durationMs = steps.length ? steps[steps.length - 1].endTime : 0;
  return { valid: review.valid, issues: review.issues, document: review.document, steps, durationMs };
}

export type WalkthroughCameraState = Partial<Camera>;
export type WalkthroughFocusState = Partial<Focus>;

export type WalkthroughCompilation = {
  document: WalkthroughDocument;
  steps: WalkthroughStep[];
  durationMs: number;
  motion: MotionDefinition;
  cameraBase: WalkthroughCameraState;
  focusBase: WalkthroughFocusState;
  issues: SceneIssue[];
};

type ResolvedOverride = { camera: Record<string, number>; focus: Record<string, number> };

function resolveOverrides(document: WalkthroughDocument, chain: WalkthroughNode[]): ResolvedOverride[] {
  let camera: Record<string, number> = { ...CAMERA_DEFAULTS, ...(document.settings.defaultCamera ?? {}) };
  let focus: Record<string, number> = { ...FOCUS_DEFAULTS, ...(document.settings.defaultFocus ?? {}) };
  return chain.map(node => {
    if (node.camera) camera = { ...camera, ...node.camera };
    if (node.focus) focus = { ...focus, ...node.focus };
    return { camera: { ...camera }, focus: { ...focus } };
  });
}

function dedupeKeyframes(frames: Array<{ timeMs: number; value: number; easing: string }>) {
  const byTime = new Map<number, { timeMs: number; value: number; easing: string }>();
  for (const frame of frames) byTime.set(frame.timeMs, frame);
  return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Compile the authored nodes into camera/focus motion tracks plus timeline steps. The tracks
 * reuse Seene's canonical motion evaluator so the walkthrough never grows a second engine.
 */
export function compileWalkthrough(input: unknown): WalkthroughCompilation | null {
  const review = validateWalkthrough(input);
  const document = review.document;
  if (!document) return null;
  const chain = resolveWalkthroughChain(document).nodes;
  const steps = buildSteps(document, chain);
  const durationMs = steps.length ? steps[steps.length - 1].endTime : 0;
  const resolved = resolveOverrides(document, chain);

  const cameraKeys = new Set<string>();
  const focusKeys = new Set<string>();
  chain.forEach(node => {
    for (const key of Object.keys(node.camera ?? {})) cameraKeys.add(key);
    for (const key of Object.keys(node.focus ?? {})) focusKeys.add(key);
  });
  for (const key of Object.keys(document.settings.defaultCamera ?? {})) cameraKeys.add(key);
  for (const key of Object.keys(document.settings.defaultFocus ?? {})) focusKeys.add(key);

  const tracks: Array<z.input<typeof MotionSchema>["tracks"][number]> = [];
  for (const key of cameraKeys) {
    if (!WALKTHROUGH_CAMERA_PROPERTIES.includes(key as (typeof WALKTHROUGH_CAMERA_PROPERTIES)[number])) continue;
    const frames = steps.map((step, index) => ({ timeMs: step.startTime, value: resolved[index].camera[key] ?? CAMERA_DEFAULTS[key as keyof Camera], easing: chain[index].easing }));
    tracks.push({ target: { kind: "camera" }, property: key, keyframes: dedupeKeyframes(frames) } as never);
  }
  for (const key of focusKeys) {
    if (!WALKTHROUGH_FOCUS_PROPERTIES.includes(key as (typeof WALKTHROUGH_FOCUS_PROPERTIES)[number])) continue;
    const frames = steps.map((step, index) => ({ timeMs: step.startTime, value: resolved[index].focus[key] ?? FOCUS_DEFAULTS[key as keyof Focus], easing: chain[index].easing }));
    tracks.push({ target: { kind: "focus" }, property: key, keyframes: dedupeKeyframes(frames) } as never);
  }

  const parsed = MotionSchema.safeParse({ durationMs: Math.max(durationMs, 1), speed: 1, tracks });
  const motion = parsed.success ? parsed.data : MotionSchema.parse({ durationMs: Math.max(durationMs, 1), speed: 1, tracks: [] });
  return {
    document,
    steps,
    durationMs,
    motion,
    cameraBase: { ...CAMERA_DEFAULTS, ...(document.settings.defaultCamera ?? {}) },
    focusBase: { ...FOCUS_DEFAULTS, ...(document.settings.defaultFocus ?? {}) },
    issues: review.issues,
  };
}

export type WalkthroughActionState = {
  nodeId: string;
  target: WalkthroughTarget;
  expect?: WalkthroughExpectation;
  timeoutMs: number;
  required: boolean;
  startTime: number;
  endTime: number;
  checkpointIndex: number;
};

export type WalkthroughFrame = {
  valid: boolean;
  issues: SceneIssue[];
  durationMs: number;
  timeMs: number;
  steps: WalkthroughStep[];
  activeIndex: number;
  activeNodeId: string | null;
  nodeLocalTimeMs: number;
  nodeProgress: number;
  transition: { fromNodeId: string; toNodeId: string; type: WalkthroughTransitionType; progress: number; durationMs: number } | null;
  camera: WalkthroughCameraState;
  focus: WalkthroughFocusState;
  scroll: { nodeId: string; target?: WalkthroughTarget; anchorIndex: number; progress: number } | null;
  highlight: { nodeId: string; target: WalkthroughTarget; style: string; color?: string; paddingPx: number; opacity: number } | null;
  caption: { nodeId: string; text: string; position: string } | null;
  action: WalkthroughActionState | null;
  checkpointIndex: number;
  completedClickNodeIds: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolve the complete walkthrough state at an arbitrary time. Pure and deterministic so preview,
 * scrubbing and MP4 frame sampling all agree on the same frame.
 */
export function resolveWalkthroughFrame(compilation: WalkthroughCompilation, timeMs: number): WalkthroughFrame {
  const { document, steps, durationMs, motion, cameraBase, focusBase } = compilation;
  const time = clamp(Number.isFinite(timeMs) ? timeMs : 0, 0, durationMs);
  let activeIndex = steps.findIndex(step => time < step.endTime);
  if (activeIndex === -1) activeIndex = steps.length - 1;
  if (activeIndex < 0) return emptyFrame(compilation.issues);
  const active = steps[activeIndex];
  const chain = resolveWalkthroughChain(document).nodes;
  const activeNode = chain[activeIndex];
  const nodeLocalTimeMs = Math.max(0, time - active.startTime);
  const nodeProgress = active.durationMs > 0 ? clamp(nodeLocalTimeMs / active.durationMs, 0, 1) : 1;

  let transition: WalkthroughFrame["transition"] = null;
  for (let index = 1; index < steps.length; index += 1) {
    const step = steps[index];
    if (step.transitionDurationMs > 0 && time >= step.transitionStartTime && time < step.startTime) {
      transition = {
        fromNodeId: steps[index - 1].nodeId,
        toNodeId: step.nodeId,
        type: step.transitionType,
        progress: (time - step.transitionStartTime) / step.transitionDurationMs,
        durationMs: step.transitionDurationMs,
      };
      break;
    }
  }

  const motionState = evaluateMotion(motion, time);
  const targetNode = transition ? chain[activeIndex] : activeNode;
  const scrollTarget = targetNode?.target ?? activeNode?.target;
  const scroll = steps.length
    ? { nodeId: targetNode?.id ?? active.nodeId, target: scrollTarget, anchorIndex: transition ? lerpAnchor(steps[activeIndex - 1] ?? active, active, transition.progress) : active.anchorIndex, progress: transition ? transition.progress : nodeProgress }
    : null;

  const highlight = resolveHighlight(chain, activeIndex, transition);
  const caption = resolveCaption(chain, activeIndex, transition);
  const clickIndex = steps.findIndex(step => step.type === "click" && time < step.endTime && time >= step.startTime);
  const action = clickIndex >= 0 ? actionFor(chain[clickIndex], steps[clickIndex]) : null;
  const completedClickNodeIds = steps.filter(step => step.type === "click" && step.startTime <= time).map(step => step.nodeId);

  return {
    valid: compilation.issues.length === 0,
    issues: compilation.issues,
    durationMs,
    timeMs: time,
    steps,
    activeIndex,
    activeNodeId: activeNode?.id ?? null,
    nodeLocalTimeMs,
    nodeProgress,
    transition,
    camera: { ...cameraBase, ...motionState.camera },
    focus: { ...focusBase, ...motionState.focus },
    scroll,
    highlight,
    caption,
    action,
    checkpointIndex: activeIndex,
    completedClickNodeIds,
  };
}

/** Compile then resolve a frame from raw walkthrough input. */
export function evaluateWalkthrough(input: unknown, timeMs: number): WalkthroughFrame {
  const compilation = compileWalkthrough(input);
  if (!compilation) return emptyFrame(validateWalkthrough(input).issues);
  return resolveWalkthroughFrame(compilation, timeMs);
}

function emptyFrame(issues: SceneIssue[]): WalkthroughFrame {
  return {
    valid: false,
    issues,
    durationMs: 0,
    timeMs: 0,
    steps: [],
    activeIndex: -1,
    activeNodeId: null,
    nodeLocalTimeMs: 0,
    nodeProgress: 0,
    transition: null,
    camera: {},
    focus: {},
    scroll: null,
    highlight: null,
    caption: null,
    action: null,
    checkpointIndex: -1,
    completedClickNodeIds: [],
  };
}

function lerpAnchor(from: WalkthroughStep, to: WalkthroughStep, progress: number): number {
  return from.anchorIndex + (to.anchorIndex - from.anchorIndex) * progress;
}

function resolveHighlight(chain: WalkthroughNode[], activeIndex: number, transition: WalkthroughFrame["transition"]): WalkthroughFrame["highlight"] {
  const candidate = (node: WalkthroughNode | undefined, opacity: number) => {
    if (!node) return null;
    const config = node.highlight ?? (node.type === "highlight" ? {} : null);
    if (!config || !node.target || !hasWalkthroughTarget(node.target)) return null;
    return {
      nodeId: node.id,
      target: node.target,
      style: "style" in config ? (config as { style?: string }).style ?? "outline" : "outline",
      ...(("color" in config && (config as { color?: string }).color) ? { color: (config as { color?: string }).color as string } : {}),
      paddingPx: "paddingPx" in config ? (config as { paddingPx?: number }).paddingPx ?? 8 : 8,
      opacity: clamp(opacity, 0, 1),
    };
  };
  if (!transition) return candidate(chain[activeIndex], 1);
  const to = candidate(chain[activeIndex], transition.progress);
  if (to) return to;
  return candidate(chain[activeIndex - 1], 1 - transition.progress);
}

function resolveCaption(chain: WalkthroughNode[], activeIndex: number, transition: WalkthroughFrame["transition"]): WalkthroughFrame["caption"] {
  const activeNode = chain[activeIndex];
  if (activeNode?.caption) return { nodeId: activeNode.id, text: activeNode.caption.text, position: activeNode.caption.position };
  if (transition && activeIndex > 0) {
    const previous = chain[activeIndex - 1];
    if (previous?.caption && transition.progress < 0.5)
      return { nodeId: previous.id, text: previous.caption.text, position: previous.caption.position };
  }
  return null;
}

function actionFor(node: WalkthroughNode, step: WalkthroughStep): WalkthroughActionState | null {
  if (!node.target || !hasWalkthroughTarget(node.target)) return null;
  return {
    nodeId: node.id,
    target: node.target,
    ...(node.action?.expect ? { expect: node.action.expect } : {}),
    timeoutMs: node.action?.timeoutMs ?? 5000,
    required: node.action?.required ?? true,
    startTime: step.startTime,
    endTime: step.endTime,
    checkpointIndex: step.index,
  };
}

export type WalkthroughEditResult = { document: WalkthroughDocument; issues: SceneIssue[] };

function parseWalkthrough(input: unknown, fallback: WalkthroughDocument): WalkthroughEditResult {
  const parsed = WalkthroughDocumentSchema.safeParse(input);
  if (parsed.success) return { document: parsed.data, issues: [] };
  return { document: fallback, issues: validateWalkthrough(input).issues };
}

function cloneNodes(document: WalkthroughDocument): WalkthroughNode[] {
  return document.nodes.map(node => ({ ...node }));
}

function chainIds(document: WalkthroughDocument): string[] {
  return resolveWalkthroughChain(document).nodes.map(node => node.id);
}

/**
 * Rebuild the document so the chain reachable from start is stored first with consistent `next`
 * pointers, followed by any disconnected nodes (kept, but reported by validation).
 */
function normalize(document: WalkthroughDocument): WalkthroughEditResult {
  const nodes = cloneNodes(document);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const start = (document.startId ? byId.get(document.startId) : undefined) ?? nodes.find(node => node.type === "start");
  const chain: WalkthroughNode[] = [];
  const seen = new Set<string>();
  let current = start;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.next ? byId.get(current.next) : undefined;
  }
  chain.forEach((node, index) => {
    node.next = index < chain.length - 1 ? chain[index + 1].id : undefined;
  });
  const rest = nodes.filter(node => !seen.has(node.id));
  for (const node of rest) if (node.next && !byId.has(node.next)) node.next = undefined;
  return parseWalkthrough({ ...document, nodes: [...chain, ...rest] }, document);
}

function applyOrder(document: WalkthroughDocument, order: string[]): WalkthroughEditResult {
  const nodes = cloneNodes(document);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const chained = order.map(id => byId.get(id)).filter(Boolean) as WalkthroughNode[];
  const linked: WalkthroughNode[] = chained.map((node, index) => ({
    ...node,
    next: index < chained.length - 1 ? chained[index + 1].id : undefined,
  }));
  for (const node of nodes) if (!order.includes(node.id)) linked.push({ ...node });
  return parseWalkthrough({ ...document, nodes: linked }, document);
}

/** Update one node's configuration, keeping the document schema-valid. */
export function updateWalkthroughNode(document: WalkthroughDocument, id: string, patch: Partial<WalkthroughNodeInput>): WalkthroughEditResult {
  const nodes = cloneNodes(document).map(node => (node.id === id ? { ...node, ...patch, id: node.id, type: node.type } : node));
  return parseWalkthrough({ ...document, nodes }, document);
}

/** Insert a node directly after an existing node (defaults to the end of the chain). */
export function insertWalkthroughNode(document: WalkthroughDocument, node: WalkthroughNodeInput, afterId?: string): WalkthroughEditResult {
  if (document.nodes.some(item => item.id === node.id))
    return { document, issues: [{ path: `nodes.${node.id}`, message: `Node "${node.id}" already exists.` }] };
  const order = chainIds(document);
  const anchor = afterId && order.includes(afterId) ? afterId : order[order.length - 1];
  const nodes = cloneNodes(document);
  const created = WalkthroughNodeSchema.parse(node);
  const anchorNode = anchor ? nodes.find(item => item.id === anchor) : undefined;
  if (anchorNode) {
    created.next = anchorNode.next;
    anchorNode.next = created.id;
  }
  nodes.push(created);
  return normalize({ ...document, nodes });
}

/** Remove a node from the document and heal the surrounding connection. */
export function removeWalkthroughNode(document: WalkthroughDocument, id: string): WalkthroughEditResult {
  const nodes = cloneNodes(document);
  const target = nodes.find(node => node.id === id);
  if (!target) return { document, issues: [{ path: `nodes.${id}`, message: `Node "${id}" does not exist.` }] };
  const predecessor = nodes.find(node => node.next === id);
  if (predecessor) predecessor.next = target.next;
  const remaining = nodes.filter(node => node.id !== id);
  if (remaining.length === 0) return { document, issues: [{ path: "nodes", message: "A walkthrough must keep at least one node." }] };
  return normalize({ ...document, nodes: remaining });
}

/** Move a node one position earlier or later in the linear sequence. */
export function moveWalkthroughNode(document: WalkthroughDocument, id: string, direction: -1 | 1): WalkthroughEditResult {
  const order = chainIds(document);
  const index = order.indexOf(id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= order.length) return { document, issues: [] };
  const [moved] = order.splice(index, 1);
  order.splice(target, 0, moved);
  return applyOrder(document, order);
}

/** Place a node at an explicit position in the linear sequence. */
export function reorderWalkthroughNode(document: WalkthroughDocument, id: string, position: number): WalkthroughEditResult {
  const order = chainIds(document);
  const index = order.indexOf(id);
  if (index === -1) return { document, issues: [{ path: `nodes.${id}`, message: `Node "${id}" is not in the sequence.` }] };
  const clamped = clamp(position, 0, order.length - 1);
  order.splice(index, 1);
  order.splice(clamped, 0, id);
  return applyOrder(document, order);
}

/** Connect one node's output to another. Refuses self-links and cycles. */
export function connectWalkthroughNodes(document: WalkthroughDocument, fromId: string, toId: string): WalkthroughEditResult {
  const order = chainIds(document);
  if (!order.includes(fromId)) return { document, issues: [{ path: `nodes.${fromId}`, message: `Node "${fromId}" is not in the sequence.` }] };
  if (!order.includes(toId)) return { document, issues: [{ path: `nodes.${toId}`, message: `Node "${toId}" is not in the sequence.` }] };
  if (fromId === toId) return { document, issues: [{ path: `nodes.${fromId}.next`, message: "A node cannot connect to itself." }] };
  const fromIndex = order.indexOf(fromId);
  const toIndex = order.indexOf(toId);
  if (toIndex <= fromIndex) return { document, issues: [{ path: `nodes.${fromId}.next`, message: "That connection would create a loop." }] };
  order.splice(toIndex, 1);
  order.splice(fromIndex + 1, 0, toId);
  return applyOrder(document, order);
}

/** Detach everything after a node, leaving the tail as disconnected work with a validation error. */
export function disconnectWalkthroughNodes(document: WalkthroughDocument, id: string): WalkthroughEditResult {
  const order = chainIds(document);
  if (!order.includes(id)) return { document, issues: [{ path: `nodes.${id}`, message: `Node "${id}" is not in the sequence.` }] };
  const nodes = cloneNodes(document);
  const node = nodes.find(item => item.id === id);
  if (node) node.next = undefined;
  return normalize({ ...document, nodes });
}

/** Duplicate a node directly after itself with a fresh ID. */
export function duplicateWalkthroughNode(document: WalkthroughDocument, id: string, newId?: string): WalkthroughEditResult & { createdId?: string } {
  const source = getWalkthroughNode(document, id);
  if (!source) return { document, issues: [{ path: `nodes.${id}`, message: `Node "${id}" does not exist.` }] };
  const resolvedId = newId ?? nextWalkthroughId(document, `${id}-copy`);
  const { id: _drop, next: _next, ...rest } = source;
  const created = WalkthroughNodeSchema.parse({ ...rest, id: resolvedId, title: `${source.title} copy` });
  const result = insertWalkthroughNode(document, created, id);
  return { ...result, createdId: resolvedId };
}

/**
 * Normalize a hand-edited or legacy document: repair `next` pointers for a linear chain, keep
 * disconnected nodes, and report anything that cannot be repaired.
 */
export function migrateWalkthrough(input: unknown): { document?: WalkthroughDocument; issues: SceneIssue[] } {
  const parsed = WalkthroughDocumentSchema.safeParse(input);
  if (!parsed.success) return { issues: validateWalkthrough(input).issues };
  const nodes = parsed.data.nodes;
  const linked = nodes.map((node, index) => ({
    ...node,
    next: index < nodes.length - 1 ? nodes[index + 1].id : undefined,
  }));
  const repaired = parseWalkthrough({ ...parsed.data, nodes: linked }, parsed.data);
  const review = validateWalkthrough(repaired.document);
  return { document: repaired.document, issues: review.issues.filter(issue => !issue.message.includes("not connected")) };
}
