import { useState, type ReactNode } from "react";
import { Scene } from "../react";

export type ProjectPreviewProps = {
  children?: ReactNode;
  projectId: string;
  enabled: boolean;
  active?: boolean;
  sceneModules?: Record<string, any>;
  createSceneEndpoint?: string;
};

export function ProjectPreview({
  children,
  projectId,
  enabled,
  active = false,
  sceneModules,
  createSceneEndpoint,
}: ProjectPreviewProps): ReactNode {
  const [isPlaying, setIsPlaying] = useState(false);

  const timeLabel = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

  return (
    <div className="seene-preview-container" style={{ position: "relative", width: "100%", height: "100%" }}>
      <div className="seene-preview-stage" style={{ position: "relative", width: "100%", height: "100%" }}>
        <Scene
          timeMs={0}
          className="seene-scene-container"
          style={{ width: "100%", height: "100%" }}
        >
          {children}
        </Scene>

        {enabled && (
          <div className="seene-transport-controls" style={{ 
            position: "absolute", 
            bottom: 0, 
            left: 0, 
            width: "100%", 
            height: "60px", 
            background: "var(--seene-bg)", 
            borderTop: "1px solid var(--seene-border)",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: "20px",
            zIndex: 20
          }}>
            <span style={{ fontSize: "12px", color: "var(--seene-text-muted)" }}>{timeLabel(0)} / {timeLabel(30000)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
