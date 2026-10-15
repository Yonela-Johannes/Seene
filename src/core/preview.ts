import { z } from "zod";
import { SceneSchema, type SceneIssue } from "./scene";
import { MotionSchema } from "./motion";
import { reviewAuthoring } from "./authoring";
import { cameraFromPose, type CameraPose } from "./spatial";

export const SCENE_TRANSITION_DURATION = 300;
export const TransitionTypeSchema = z.enum(["crossfade", "camera", "focus"]);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;
export const SceneTransitionSchema = z.strictObject({
  type: TransitionTypeSchema.default("crossfade"),
  durationMs: z.number().int().nonnegative().max(5000).default(SCENE_TRANSITION_DURATION),
});
export type SceneTransition = z.output<typeof SceneTransitionSchema>;
export const TRANSITION_PRESETS = {
  crossfade: {
    name: "Crossfade",
    description: "Smooth opacity dissolve between scenes",
    type: "crossfade" as const,
    durationMs: 300,
  },
  camera: {
    name: "Camera Move",
    description: "Continuity of camera position across scenes",
    type: "camera" as const,
    durationMs: 600,
  },
  focus: {
    name: "Focus Pull",
    description: "Smooth focus transition between scenes",
    type: "focus" as const,
    durationMs: 400,
  },
} as const;
export type TransitionPresetName = keyof typeof TRANSITION_PRESETS;

export const WalkthroughSectionSchema = z.strictObject({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  file: z.string().trim().min(1).max(400),
  export: z.string().trim().min(1).max(120).optional(),
  durationMs: z.number().finite().nonnegative().optional(),
  pauseMs: z.number().finite().nonnegative().optional(),
});
export const WalkthroughSettingsSchema = z.strictObject({
  durationAuto: z.boolean().optional(),
  easing: z.enum(["linear", "ease-in-out"]).optional(),
  holdAtTopMs: z.number().finite().nonnegative().max(3600000).optional(),
  holdAtBottomMs: z.number().finite().nonnegative().max(3600000).optional(),
  startOffset: z.union([z.number().finite(), z.string().trim().max(120)]).optional(),
  endOffset: z.union([z.number().finite(), z.string().trim().max(120)]).optional(),
  autoplay: z.boolean().optional(),
});

export const PreviewDefinitionSchema = z.strictObject({
  scene: SceneSchema.refine(scene => scene.nodes.length > 0, {
    message: "Preview scenes must contain at least one surface node.",
  }),
  motion: MotionSchema.optional(),
  width: z.number().finite().positive().max(7680).default(1400),
  height: z.number().finite().positive().max(7680).default(980),
  sizingMode: z.enum(["fixed", "viewport", "content"]).optional(),
  minHeight: z.string().trim().min(1).max(64).optional(),
  backdrop: z.string().trim().min(1).max(64).optional(),
  compositionType: z.enum(["scene", "walkthrough"]).optional(),
  sections: z.array(WalkthroughSectionSchema).optional(),
  walkthroughSettings: WalkthroughSettingsSchema.optional(),
});
export type PreviewDefinitionInput = z.input<typeof PreviewDefinitionSchema>;
export type PreviewDefinition = z.output<typeof PreviewDefinitionSchema>;

export const PRESENTATION_PRESETS = {
  clean: {
    name: "Clean",
    description: "Minimal 3D offset, direct perspective, subtle framing",
    camera: { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, perspective: 1800 },
    focus: { distance: 1800, fStop: 16, focalLength: 50, maxBlur: 0 },
  },
  focus: {
    name: "Focus",
    description: "Shallow depth of field, sharp focus on hero surface, blurred background",
    camera: { x: 0, y: 0, z: 0, rotateX: 4, rotateY: -5, rotateZ: 0, perspective: 1600 },
    focus: { distance: 1600, fStop: 1.4, focalLength: 50, maxBlur: 16 },
  },
  depth: {
    name: "Depth",
    description: "Pronounced layer separation, camera Z offset and perspective",
    camera: { x: 0, y: 0, z: 120, rotateX: 6, rotateY: -10, rotateZ: 0, perspective: 1200 },
    focus: { distance: 1320, fStop: 5.6, focalLength: 50, maxBlur: 8 },
  },
  "soft-blur": {
    name: "Soft Blur",
    description: "Soft ambient lens blur, high perspective",
    camera: { x: 0, y: 0, z: 20, rotateX: 2, rotateY: -4, rotateZ: 0, perspective: 2000 },
    focus: { distance: 2000, fStop: 2.0, focalLength: 50, maxBlur: 10 },
  },
  cinematic: {
    name: "Cinematic",
    description: "Dramatic angles, rich depth of field and lens focal blur",
    camera: { x: -40, y: -20, z: 80, rotateX: 12, rotateY: -18, rotateZ: 3, perspective: 1500 },
    focus: { distance: 1500, fStop: 2.8, focalLength: 85, maxBlur: 12 },
  },
  product: {
    name: "Product",
    description: "Clean 3D product angle with balanced studio light perspective",
    camera: { x: 0, y: -15, z: 50, rotateX: 10, rotateY: -12, rotateZ: 0, perspective: 1600 },
    focus: { distance: 1600, fStop: 5.6, focalLength: 50, maxBlur: 6 },
  },
  hero: {
    name: "Hero",
    description: "Hero perspective angle with slight elevation",
    camera: { x: 20, y: -10, z: 60, rotateX: 8, rotateY: -15, rotateZ: 0, perspective: 1400 },
    focus: { distance: 1400, fStop: 4.0, focalLength: 50, maxBlur: 8 },
  },
  wide: {
    name: "Wide",
    description: "Wide dynamic perspective with minimal distortion",
    camera: { x: 0, y: 0, z: -100, rotateX: 5, rotateY: -8, rotateZ: 0, perspective: 800 },
    focus: { distance: 800, fStop: 8.0, focalLength: 35, maxBlur: 4 },
  },
  close: {
    name: "Close",
    description: "Tight focal crop for hero element inspection",
    camera: { x: 0, y: 0, z: 200, rotateX: 3, rotateY: -4, rotateZ: 0, perspective: 1800 },
    focus: { distance: 1800, fStop: 2.8, focalLength: 100, maxBlur: 14 },
  },
  dramatic: {
    name: "Dramatic",
    description: "Extreme angled perspective and high focal contrast",
    camera: { x: -60, y: -30, z: 100, rotateX: 18, rotateY: -25, rotateZ: 5, perspective: 1100 },
    focus: { distance: 1100, fStop: 2.0, focalLength: 85, maxBlur: 15 },
  },
} as const;

export type PresentationPresetName = keyof typeof PRESENTATION_PRESETS;

export function applyPresentationPreset(definition: PreviewDefinitionInput, presetName: PresentationPresetName): PreviewDefinitionInput {
  const preset = PRESENTATION_PRESETS[presetName];
  if (!preset) return definition;
  return {
    ...definition,
    scene: {
      ...definition.scene,
      camera: {
        ...definition.scene?.camera,
        ...preset.camera,
      },
      focus: {
        ...definition.scene?.focus,
        ...preset.focus,
      },
    },
  };
}

export function presentPreview(input: unknown):
  { valid: true; definition: PreviewDefinition; issues: SceneIssue[] } |
  { valid: false; issues: SceneIssue[] } {
  const parsed = PreviewDefinitionSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: parsed.error.issues.map(issue => ({
    path: issue.path.join("."), message: issue.message,
  })) };
  const review = reviewAuthoring({scene: parsed.data.scene,
    motion: parsed.data.motion ?? {durationMs: 0, tracks: []}});
  return review.valid ? {valid: true, definition: parsed.data, issues: []}
    : {valid: false, issues: review.issues};
}
