import { ProjectPreview } from "@thatg33k/seene/preview";
import "@thatg33k/seene/style.css";
import type { ComponentProps } from "react";

const sceneModules = import.meta.env.DEV ? import.meta.glob("/src/seene/scenes/*.{scene.json,tsx,jsx}") : undefined;

export function SeeneProjectPreview(props: Omit<ComponentProps<typeof ProjectPreview>, "sceneModules" | "hot">) {
  if (!import.meta.env.DEV) return props.children;
  return <ProjectPreview {...props} sceneModules={sceneModules} hot={import.meta.hot} />;
}
