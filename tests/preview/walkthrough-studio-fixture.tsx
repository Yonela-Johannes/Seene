import { createRoot } from "react-dom/client";
import { useState } from "react";
import "../../src/index.css";
import { ScenePreview } from "../../src/preview";
import {
  Surface,
  compileWalkthrough,
  createWalkthroughDocument,
  createWalkthroughNode,
  insertWalkthroughNode,
  type PreviewDefinitionInput,
  type WalkthroughDocument,
} from "../../src";

/**
 * Build a walkthrough that scrolls between two tagged sections, highlights the first, then clicks a
 * real button and waits for the revealed state before showing a caption.
 */
function buildWalkthrough(): WalkthroughDocument {
  let document = createWalkthroughDocument({
    title: "Studio tour",
    targets: [
      { title: "Hero", target: { kind: "section", sectionId: "hero" } },
      { title: "Features", target: { kind: "section", sectionId: "features" } },
    ],
  });
  document = insertWalkthroughNode(document, createWalkthroughNode("highlight", {
    id: "highlight-hero",
    title: "Highlight hero",
    target: { kind: "section", sectionId: "hero" },
    highlight: { style: "outline", paddingPx: 12 },
  }), "show-1").document;
  document = insertWalkthroughNode(document, createWalkthroughNode("click", {
    id: "click-reveal",
    title: "Reveal answer",
    target: { kind: "element", selector: "[data-reveal]" },
    action: { expect: { selector: "[data-revealed]", state: "visible" }, timeoutMs: 3000, required: true },
  }), "show-2").document;
  document = insertWalkthroughNode(document, createWalkthroughNode("caption", {
    id: "caption-done",
    title: "Wrap up",
    caption: { text: "You completed the tour", position: "bottom" },
  }), "click-reveal").document;
  return document;
}

const walkthrough = buildWalkthrough();

const definition: PreviewDefinitionInput = {
  width: walkthrough.settings.width,
  height: walkthrough.settings.height,
  compositionType: "walkthrough",
  sizingMode: "viewport",
  minHeight: "100vh",
  scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
  motion: compileWalkthrough(walkthrough)!.motion,
  walkthrough,
};

function Page() {
  const [revealed, setRevealed] = useState(false);
  return (
    <Surface id="host" style={{ width: "100%", height: "auto" }}>
      <main data-testid="tour-page" style={{ minHeight: "300vh" }}>
        <section
          data-section-id="hero"
          data-testid="tour-hero"
          style={{ height: "100vh", background: "#0f172a", color: "#fff", padding: 32, boxSizing: "border-box" }}
        >
          <h1>Studio tour</h1>
        </section>
        <section
          data-section-id="features"
          data-testid="tour-features"
          style={{ height: "100vh", background: "#1e293b", color: "#fff", padding: 32, boxSizing: "border-box" }}
        >
          <h2>Features</h2>
          <button type="button" data-reveal onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
          {revealed ? <p data-revealed data-testid="tour-revealed">Answer shown</p> : null}
        </section>
        <section
          data-section-id="closing"
          data-testid="tour-closing"
          style={{ height: "100vh", background: "#065f46", color: "#fff", padding: 32, boxSizing: "border-box" }}
        >
          <h2>Closing</h2>
        </section>
      </main>
    </Surface>
  );
}

function BrowserFixture() {
  const [sceneDefinition, setSceneDefinition] = useState<PreviewDefinitionInput>(definition);
  return (
    <ScenePreview
      definition={sceneDefinition}
      title="Studio tour"
      createSceneEndpoint="/__seene/create-scene"
      onSaveDefinition={(updated, sections) => {
        setSceneDefinition(updated);
        void sections;
      }}
    >
      <Page />
    </ScenePreview>
  );
}

createRoot(document.getElementById("root")!).render(<BrowserFixture />);
