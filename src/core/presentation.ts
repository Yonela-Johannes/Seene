import { z } from "zod";
import { CameraSchema, FocusSchema } from "./scene";
import { MotionSchema, MotionTrackSchema, type MotionTrack } from "./motion";
import { CascadeSchema, createCascadeTracks, type CascadeInput } from "./choreography";
import type { PreviewDefinitionInput } from "./preview";

type Keyframes = readonly (readonly [number, number])[];

const cameraTrack = (
  property: "x" | "y" | "z" | "rotateX" | "rotateY" | "rotateZ" | "perspective",
  keyframes: Keyframes,
): MotionTrack =>
  MotionTrackSchema.parse({
    target: { kind: "camera" },
    property,
    keyframes: keyframes.map(([timeMs, value]) => ({ timeMs, value })),
  });

const focusTrack = (
  property: "distance" | "fStop" | "focalLength" | "maxBlur",
  keyframes: Keyframes,
): MotionTrack =>
  MotionTrackSchema.parse({
    target: { kind: "focus" },
    property,
    keyframes: keyframes.map(([timeMs, value]) => ({ timeMs, value })),
  });

export const PresentationIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase presentation slug.");

export type PresentationEntrance = Omit<Partial<CascadeInput>, "items">;

export const PresentationSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1).max(40),
  summary: z.string().min(1).max(140),
  camera: CameraSchema,
  focus: FocusSchema,
  durationMs: z.number().int().positive().max(120_000),
  tracks: z.array(MotionTrackSchema),
  entrance: z.custom<PresentationEntrance>().optional(),
});
export type Presentation = z.output<typeof PresentationSchema>;
export type PresentationId = z.infer<typeof PresentationIdSchema>;

const assertEntrance = (value: Presentation) => {
  if (!value.entrance) return;
  const parsed = CascadeSchema.safeParse({ ...value.entrance, items: [{ id: "probe" }] });
  if (!parsed.success) {
    throw new Error(`Presentation ${value.id} has an invalid entrance: ${parsed.error.issues[0]?.message}`);
  }
};

export const AUTHORED_PRESENTATION = "authored";

const clean: Presentation = {
  id: "clean",
  label: "Clean",
  summary: "Centered product framing with a slow, steady drift.",
  camera: { perspective: 2200, x: 0, y: 0, z: 0, rotateX: 3, rotateY: -6, rotateZ: 0 },
  focus: { distance: 2200, fStop: 8, focalLength: 50, maxBlur: 0 },
  durationMs: 6000,
  tracks: [cameraTrack("x", [[0, 0], [6000, -70]])],
};

const orbit: Presentation = {
  id: "orbit",
  label: "Orbit",
  summary: "A slow orbital sweep around the product with stable depth and evolving focus.",
  camera: { perspective: 1600, x: 0, y: 0, z: 0, rotateX: 5, rotateY: -15, rotateZ: 0 },
  focus: { distance: 1600, fStop: 4, focalLength: 50, maxBlur: 4 },
  durationMs: 10000,
  tracks: [
    cameraTrack("rotateY", [[0, -15], [10000, -165]]),
    cameraTrack("perspective", [[0, 1600], [10000, 1200]]),
    focusTrack("distance", [[0, 1600], [10000, 800]]),
  ],
  entrance: { depth: 50, depthStep: 8, staggerMs: 180, entranceMs: 2000 },
};

const reveal: Presentation = {
  id: "reveal",
  label: "Reveal",
  summary: "A dramatic zoom into the interface with escalating depth and focus.",
  camera: { perspective: 1800, x: 0, y: 0, z: 0, rotateX: 3, rotateY: -12, rotateZ: 0 },
  focus: { distance: 1800, fStop: 2, focalLength: 50, maxBlur: 8 },
  durationMs: 9000,
  tracks: [
    cameraTrack("perspective", [[0, 1800], [9000, 600]]),
    focusTrack("distance", [[0, 1800], [9000, 900]]),
    focusTrack("fStop", [[0, 2], [9000, 0.8]]),
  ],
  entrance: { depth: 60, depthStep: 10, staggerMs: 150, entranceMs: 2200 },
};

const productTour: Presentation = {
  id: "product-tour",
  label: "Product Tour",
  summary: "A systematic pan across the product interface with controlled focus shifts.",
  camera: { perspective: 1500, x: 0, y: 0, z: 0, rotateX: 4, rotateY: -18, rotateZ: 0 },
  focus: { distance: 1500, fStop: 5.6, focalLength: 50, maxBlur: 5 },
  durationMs: 12000,
  tracks: [
    cameraTrack("x", [[0, -80], [12000, 80]]),
    cameraTrack("rotateY", [[0, -18], [12000, -18]]),
    focusTrack("distance", [[0, 1500], [12000, 1200]]),
  ],
  entrance: { depth: 40, depthStep: 6, staggerMs: 120, entranceMs: 1800 },
};

const editorial: Presentation = {
  id: "editorial",
  label: "Editorial",
  summary: "A clean, level composition with subtle depth and restrained motion.",
  camera: { perspective: 2000, x: 0, y: 0, z: 0, rotateX: 2, rotateY: -4, rotateZ: 0 },
  focus: { distance: 2000, fStop: 8, focalLength: 50, maxBlur: 2 },
  durationMs: 8000,
  tracks: [
    cameraTrack("y", [[0, -20], [8000, 20]]),
    cameraTrack("perspective", [[0, 2000], [8000, 1800]]),
    focusTrack("fStop", [[0, 8], [8000, 10]]),
  ],
  entrance: { depth: 30, depthStep: 5, staggerMs: 100, entranceMs: 1500 },
};

const parallax: Presentation = {
  id: "parallax",
  label: "Parallax",
  summary: "Layered depth separation with varying surface recession and focus transitions.",
  camera: { perspective: 1400, x: 0, y: 0, z: 0, rotateX: 6, rotateY: -14, rotateZ: 0 },
  focus: { distance: 1400, fStop: 4, focalLength: 50, maxBlur: 6 },
  durationMs: 9000,
  tracks: [
    cameraTrack("z", [[0, -180], [9000, -220]]),
    cameraTrack("perspective", [[0, 1400], [9000, 1600]]),
    focusTrack("distance", [[0, 1400], [9000, 1000]]),
  ],
  entrance: { depth: 70, depthStep: 15, staggerMs: 200, entranceMs: 2500 },
};

const dramaticPush: Presentation = {
  id: "dramatic-push",
  label: "Dramatic Push",
  summary: "An aggressive forward push with converging surfaces and intense focus.",
  camera: { perspective: 1200, x: 0, y: 0, z: 0, rotateX: 10, rotateY: -20, rotateZ: 0 },
  focus: { distance: 1200, fStop: 1.4, focalLength: 50, maxBlur: 12 },
  durationMs: 7000,
  tracks: [
    cameraTrack("z", [[0, -400], [7000, -120]]),
    cameraTrack("perspective", [[0, 1200], [7000, 2000]]),
    cameraTrack("rotateY", [[0, -20], [7000, -20]]),
    focusTrack("distance", [[0, 1200], [7000, 1500]]),
    focusTrack("fStop", [[0, 1.4], [7000, 5]]),
  ],
  entrance: { depth: 80, depthStep: 20, staggerMs: 250, entranceMs: 3000 },
};

const overview: Presentation = {
  id: "overview",
  label: "Overview",
  summary: "A wide establishing shot with expanded perspective and minimal focus.",
  camera: { perspective: 800, x: 0, y: 0, z: 0, rotateX: 2, rotateY: -6, rotateZ: 0 },
  focus: { distance: 800, fStop: 16, focalLength: 35, maxBlur: 2 },
  durationMs: 6000,
  tracks: [
    cameraTrack("z", [[0, -300], [6000, 0]]),
    cameraTrack("perspective", [[0, 800], [6000, 1200]]),
    cameraTrack("rotateY", [[0, -6], [6000, -6]]),
    focusTrack("fStop", [[0, 16], [6000, 20]]),
  ],
  entrance: { depth: 20, depthStep: 4, staggerMs: 80, entranceMs: 1000 },
};

const detailFocus: Presentation = {
  id: "detail-focus",
  label: "Detail Focus",
  summary: "An extreme close-up focusing on fine details with shallow depth of field.",
  camera: { perspective: 1800, x: 0, y: 0, z: 0, rotateX: 1, rotateY: -3, rotateZ: 0 },
  focus: { distance: 1800, fStop: 1.8, focalLength: 85, maxBlur: 15 },
  durationMs: 5000,
  tracks: [
    cameraTrack("perspective", [[0, 1800], [5000, 1200]]),
    cameraTrack("z", [[0, -250], [5000, -50]]),
    cameraTrack("rotateY", [[0, -3], [5000, -3]]),
    focusTrack("fStop", [[0, 1.8], [5000, 2.8]]),
    focusTrack("focalLength", [[0, 85], [5000, 100]]),
  ],
  entrance: { depth: 40, depthStep: 8, staggerMs: 120, entranceMs: 1200 },
};

const depth: Presentation = {
  id: "depth",
  label: "Depth",
  summary: "A converging dolly that keeps the interface sharp as space builds around it.",
  camera: { perspective: 1400, x: 0, y: 0, z: 0, rotateX: 6, rotateY: -16, rotateZ: 0 },
  focus: { distance: 1400, fStop: 5.6, focalLength: 50, maxBlur: 5 },
  durationMs: 7000,
  tracks: [
    cameraTrack("z", [[0, 0], [7000, -240]]),
    focusTrack("distance", [[0, 1400], [7000, 1160]]),
  ],
  entrance: { depth: 70, depthStep: 10, staggerMs: 160, entranceMs: 2000 },
};

const cinematic: Presentation = {
  id: "cinematic",
  label: "Cinematic",
  summary: "A slow push-in that settles into an angled hero frame.",
  camera: { perspective: 1200, x: 0, y: 0, z: 0, rotateX: 8, rotateY: -22, rotateZ: 0 },
  focus: { distance: 1200, fStop: 5.6, focalLength: 50, maxBlur: 5 },
  durationMs: 8000,
  tracks: [
    cameraTrack("z", [[0, 0], [8000, -340]]),
    cameraTrack("rotateY", [[0, -22], [8000, -14]]),
    focusTrack("distance", [[0, 1200], [8000, 860]]),
  ],
  entrance: { depth: 80, depthStep: 12, staggerMs: 200, entranceMs: 2600 },
};

const floating: Presentation = {
  id: "floating",
  label: "Floating",
  summary: "A suspended plane that rises and tilts as if held in space.",
  camera: { perspective: 2000, x: 0, y: 0, z: 0, rotateX: 7, rotateY: -10, rotateZ: 0 },
  focus: { distance: 2000, fStop: 5.6, focalLength: 50, maxBlur: 4 },
  durationMs: 7000,
  tracks: [
    cameraTrack("y", [[0, -40], [7000, 40]]),
    cameraTrack("rotateX", [[0, 7], [7000, 4]]),
  ],
  entrance: { depth: 60, depthStep: 8, staggerMs: 140, entranceMs: 1800 },
};

const focus: Presentation = {
  id: "focus",
  label: "Focus",
  summary: "A single focal plane that racks sharp while the surroundings fall away.",
  camera: { perspective: 1800, x: 0, y: 0, z: 0, rotateX: 4, rotateY: -10, rotateZ: 0 },
  focus: { distance: 1830, fStop: 4, focalLength: 50, maxBlur: 6 },
  durationMs: 6000,
  tracks: [
    cameraTrack("x", [[0, 0], [6000, -40]]),
    focusTrack("distance", [[0, 1830], [6000, 1800]]),
  ],
  entrance: { depth: 50, depthStep: 10, staggerMs: 180, entranceMs: 2400 },
};

const showcase: Presentation = {
  id: "showcase",
  label: "Showcase",
  summary: "A revealed hero shot that pulls back to present the whole product.",
  camera: { perspective: 1600, x: 0, y: 0, z: 0, rotateX: 5, rotateY: -18, rotateZ: 0 },
  focus: { distance: 1340, fStop: 5.6, focalLength: 50, maxBlur: 4 },
  durationMs: 7000,
  tracks: [
    cameraTrack("z", [[0, -260], [7000, 0]]),
    focusTrack("distance", [[0, 1340], [7000, 1600]]),
  ],
  entrance: { depth: 70, depthStep: 10, staggerMs: 150, entranceMs: 2000 },
};

const authored: Presentation = {
  id: "authored",
  label: "Authored",
  summary: "Custom scene defined by the creator.",
  camera: { perspective: 1400, x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 },
  focus: { distance: 1400, fStop: 8, focalLength: 50, maxBlur: 6 },
  durationMs: 6000,
  tracks: [],
};

const minimal: Presentation = {
  id: "minimal",
  label: "Minimal",
  summary: "Almost editorial: a level plane and one deliberate rise.",
  camera: { perspective: 2600, x: 0, y: 0, z: 0, rotateX: 2, rotateY: -4, rotateZ: 0 },
  focus: { distance: 2600, fStop: 8, focalLength: 50, maxBlur: 0 },
  durationMs: 5000,
  tracks: [cameraTrack("y", [[0, 0], [5000, -24]])],
};

export const PRESENTATIONS: readonly Presentation[] = Object.freeze(
  [clean, depth, cinematic, floating, focus, showcase, minimal, orbit, reveal, productTour, editorial, parallax, dramaticPush, overview, detailFocus, authored].map((value) => {
    const parsed = PresentationSchema.parse(value);
    assertEntrance(parsed);
    return parsed;
  }),
);

export const DEFAULT_PRESENTATION = "orbit";

export function isPresentationId(value: unknown): value is string {
  return typeof value === "string" && PRESENTATIONS.some((item) => item.id === value);
}

export function presentation(id: string): Presentation {
  const found = PRESENTATIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown Seene presentation: ${id}`);
  return found;
}

function entranceTracks(treatment: Presentation, nodeIds: string[]): MotionTrack[] {
  if (!treatment.entrance || !nodeIds.length) return [];
  const options = CascadeSchema.parse({ ...treatment.entrance, items: nodeIds.map((id) => ({ id })) });
  if (options.entranceMs <= 0 || options.depth <= 0) return [];
  const gaps = Math.max(1, nodeIds.length - 1);
  const budget = Math.max(0, treatment.durationMs - options.entranceMs);
  return createCascadeTracks({ ...options, staggerMs: Math.min(options.staggerMs, Math.floor(budget / gaps)) });
}

export function applyPresentation(
  definition: PreviewDefinitionInput,
  id: string,
): PreviewDefinitionInput {
  const treatment = presentation(id);
  const nodeIds = definition.scene.nodes.map((node) => node.id);
  return {
    ...definition,
    scene: { ...definition.scene, camera: treatment.camera, focus: treatment.focus },
    motion: MotionSchema.parse({
      durationMs: treatment.durationMs,
      speed: 1,
      tracks: [...treatment.tracks, ...entranceTracks(treatment, nodeIds)],
    }),
  };
}

export function resolvePresentation(
  definition: PreviewDefinitionInput,
  id: string | undefined,
): PreviewDefinitionInput {
  return id && isPresentationId(id) ? applyPresentation(definition, id) : definition;
}

export const PresentationListSchema = z.strictObject({
  active: z.string(),
  options: z.array(
    z.strictObject({ id: z.string(), label: z.string(), summary: z.string() }),
  ),
});
export type PresentationList = z.output<typeof PresentationListSchema>;

export function listPresentations(): PresentationList {
  return PresentationListSchema.parse({
    active: DEFAULT_PRESENTATION,
    options: PRESENTATIONS.map(({ id, label, summary }) => ({ id, label, summary })),
  });
}