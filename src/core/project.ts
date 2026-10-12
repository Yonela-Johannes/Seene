import { z } from "zod";

export const InitProjectSchema = z.strictObject({
  packageSource: z.string().min(1).optional(),
  adapter: z.enum(["auto", "react"]).optional(),
  hostPath: z.string().min(1).optional(),
});
export const SyncProjectSchema = z.strictObject({});
export const LoadProjectSchema = z.strictObject({});
export const ValidateProjectSchema = z.strictObject({});
export const OpenPreviewSchema = z.strictObject({
  url: z.url().regex(
    /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?\/?$/,
    "Use an HTTP loopback dev-server origin, for example http://127.0.0.1:5173.",
  ),
  launch: z.boolean().default(true),
});
export const ProjectStateSchema = z.strictObject({
  version: z.literal(1),
  projectId: z.uuid(),
  entry: z.string().min(1),
  packageManager: z.enum(["npm", "pnpm", "yarn", "bun"]),
  adapter: z.enum(["next-app", "next-pages", "react"]).optional(),
});
export const ProjectResultSchema = z.discriminatedUnion("success", [
  z.strictObject({success:z.literal(true),data:z.strictObject({
    project:ProjectStateSchema.optional(),url:z.string().optional(),changed:z.boolean().optional(),
    integration:z.strictObject({kind:z.string(),component:z.string(),route:z.string().optional(),instructions:z.string()}).optional(),
    handoff:z.strictObject({
      path:z.literal("SEENE.md"), guideCommand: z.string().min(1),
      guideVersion:z.number().int().positive(), prompt:z.string().min(1),
    }).optional(),
  })}),
  z.strictObject({success:z.literal(false),issues:z.array(z.strictObject({
    code:z.string(),message:z.string(),path:z.string().optional(),
  }))}),
]);
export type ProjectState = z.output<typeof ProjectStateSchema>;
export type ProjectResult = z.output<typeof ProjectResultSchema>;
