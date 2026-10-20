import { z } from "zod";
import { CameraSchema, FocusSchema } from "./scene";
import { MotionSchema, MotionTrackSchema, type MotionTrack } from "./motion";
import { CascadeSchema, createCascadeTracks, type CascadeInput } from "./choreography";
import { subjectFocusDistance, type PreviewDefinitionInput } from "./preview";

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
    // Focus tracks the subject through the entrance animation and camera move.
    focusTrack("distance", [[0, 1550], [2500, 1559], [5000, 1400], [7500, 1241], [10000, 1200]]),
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
    focusTrack("distance", [[0, 1740], [2250, 1676], [4500, 1200], [6750, 724], [9000, 600]]),
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
    focusTrack("distance", [[0, 1460], [3000, 1500], [6000, 1500], [9000, 1500], [12000, 1500]]),
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
    focusTrack("distance", [[0, 1970], [2000, 1979], [4000, 1900], [6000, 1821], [8000, 1800]]),
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
    // Focus follows the subject as it recedes: (perspective + z - entrance depth).
    focusTrack("distance", [[0, 1150], [2250, 1236], [4500, 1300], [6750, 1363], [9000, 1380]]),
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
    focusTrack("distance", [[0, 720], [1750, 884], [3500, 1340], [5250, 1768], [7000, 1880]]),
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
    focusTrack("distance", [[0, 480], [1000, 525], [6000, 1200]]),
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
    focusTrack("distance", [[0, 1510], [1200, 1513], [5000, 1150]]),
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
    focusTrack("distance", [[0, 1330], [1750, 1374], [3500, 1280], [5250, 1185], [7000, 1160]]),
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
    focusTrack("distance", [[0, 1120], [2000, 1158], [4000, 1030], [6000, 895], [8000, 860]]),
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
    focusTrack("distance", [[0, 1940], [1800, 2000], [7000, 2000]]),
  ],
  entrance: { depth: 60, depthStep: 8, staggerMs: 140, entranceMs: 1800 },
};

const focus: Presentation = {
  id: "focus",
  label: "Focus",
  summary: "A single focal plane that racks sharp while the surroundings fall away.",
  camera: { perspective: 1800, x: 0, y: 0, z: 0, rotateX: 4, rotateY: -10, rotateZ: 0 },
  focus: { distance: 1800, fStop: 4, focalLength: 50, maxBlur: 6 },
  durationMs: 6000,
  tracks: [
    cameraTrack("x", [[0, 0], [6000, -40]]),
    focusTrack("distance", [[0, 1750], [2400, 1800], [6000, 1800]]),
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
    // The surface starts distant (1340) and settles on the lens as z reaches 0.
    focusTrack("distance", [[0, 1270], [2000, 1378], [7000, 1600]]),
  ],
  entrance: { depth: 70, depthStep: 10, staggerMs: 150, entranceMs: 2000 },
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
  [clean, depth, cinematic, floating, focus, showcase, minimal, orbit, reveal, productTour, editorial, parallax, dramaticPush, overview, detailFocus].map((value) => {
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


function flatWalkthroughPresentation(definition: PreviewDefinitionInput): PreviewDefinitionInput {
  if (definition.compositionType !== "walkthrough") return definition;
  return {
    ...definition,
    scene: {
      ...definition.scene,
      camera: {
        ...definition.scene.camera,
        perspective: Math.max(2000, definition.scene.camera?.perspective ?? 2000),
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
      },
    },
  };
}

export function resolvePresentation(
  definition: PreviewDefinitionInput,
  id: string | undefined,
): PreviewDefinitionInput {
  if (id && isPresentationId(id)) return applyPresentation(definition, id);
  return flatWalkthroughPresentation(definition);
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