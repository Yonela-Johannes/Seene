import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ScenePreview } from "../../src/preview";
import { Surface, type PreviewDefinitionInput } from "../../src";

const definition: PreviewDefinitionInput = {
  width: 1440,
  height: 1000,
  compositionType: "walkthrough",
  sizingMode: "viewport",
  minHeight: "100vh",
  scene: {
    version: 3,
    camera: { perspective: 800, x: 0, y: 0, z: 300, rotateX: 2, rotateY: -6, rotateZ: 0 },
    focus: { distance: 608, fStop: 2, focalLength: 50, maxBlur: 12 },
    nodes: [{ id: "host" }],
  },
  motion: { durationMs: 60000, speed: 1, tracks: [] },
};

function Page() {
  return (
    <Surface id="host" style={{ width: "100%", height: "auto", minHeight: "100vh" }}>
      <main data-testid="walkthrough-page" style={{ height: "500vh", color: "#18212b", background: "#f3f1e8" }}>
        {[
          ["01 / Opening", "A clear beginning."],
          ["02 / Detail", "The story continues."],
          ["03 / Proof", "A middle frame with room to breathe."],
          ["04 / Craft", "Small details, carefully made."],
          ["05 / Closing", "The final section is reachable."],
        ].map(([label, title], index) => (
          <section
            key={label}
            data-testid={`walkthrough-section-${index}`}
            data-section-id={label}
            style={{ height: "100vh", boxSizing: "border-box", padding: "10vh 10vw", background: index % 2 ? "#d5e4e1" : "#f3f1e8" }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase" }}>{label}</p>
            <h1 style={{ maxWidth: 700, fontSize: 64, lineHeight: 1.05 }}>{title}</h1>
          </section>
        ))}
      </main>
    </Surface>
  );
}

function BrowserFixture() {
  const [sceneDefinition, setSceneDefinition] = useState<PreviewDefinitionInput>(() => {
    const saved = localStorage.getItem("walkthrough-fixture-definition");
    return saved ? JSON.parse(saved) as PreviewDefinitionInput : definition;
  });
  const [presentation, setPresentation] = useState<string | undefined>(() => new URL(window.location.href).searchParams.get("seene-preset") ?? undefined);
  const changePresentation = (value: string) => {
    const next = value === "authored" ? undefined : value;
    setPresentation(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("seene-preset", next);
    else url.searchParams.delete("seene-preset");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  };
  return (
    <ScenePreview
      definition={sceneDefinition}
      title="Walkthrough fixture"
      presentation={presentation}
      onPresentationChange={changePresentation}
      onSaveDefinition={updated => {
        setSceneDefinition(updated);
        localStorage.setItem("walkthrough-fixture-definition", JSON.stringify(updated));
      }}
    >
      <Page />
    </ScenePreview>
  );
}

createRoot(document.getElementById("root")!).render(<BrowserFixture />);