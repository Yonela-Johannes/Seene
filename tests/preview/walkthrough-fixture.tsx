import { createRoot } from "react-dom/client";
import { useLayoutEffect, useState, type CSSProperties } from "react";
import "../../src/index.css";
import { ScenePreview } from "../../src/preview";
import { Surface, type PreviewDefinitionInput } from "../../src";
import { DEFAULT_RAIL, FrameSection, SiteHeader } from "../../src/platform/site";
import { FOUNDER_STORY_SCREENS } from "../../src/platform/founder-story";

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
  motion: { durationMs: 20000, speed: 1, tracks: [] },
};

function Page() {
  return (
    <Surface id="host" style={{ width: "100%", height: "auto", minHeight: "100vh" }}>
      <main className="demo-founder-story-page" data-testid="walkthrough-page" style={{ height: "500vh" }}>
        {FOUNDER_STORY_SCREENS.map((screen, index) => (
          <section
            key={screen.label}
            className="demo-founder-story-screen demo-founder-story-screen-full"
            data-testid={`walkthrough-section-${index}`}
            data-section-id={screen.label}
            data-screen-number={String(index + 1).padStart(2, "0")}
            style={{ height: "100vh", boxSizing: "border-box" }}
          >
            <FrameSection label={screen.label} edge="both" rails={DEFAULT_RAIL}>
              <div className="demo-founder-story-content">
                <p className="demo-founder-story-kicker">{screen.label}</p>
                <h1 className="demo-founder-story-title">{screen.title}</h1>
                <p className="demo-founder-story-copy">{screen.body}</p>
                <div className="demo-founder-story-progress" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span className="demo-founder-story-progress-line" />
                  <span>05</span>
                </div>
                {index === FOUNDER_STORY_SCREENS.length - 1 ? (
                  <a className="demo-founder-story-cta" href="/#install">
                    Experience Seene <span aria-hidden="true" style={{ marginLeft: 8 }}>→</span>
                  </a>
                ) : null}
              </div>
            </FrameSection>
          </section>
        ))}
      </main>
    </Surface>
  );
}

function BrowserFixture() {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [sceneDefinition, setSceneDefinition] = useState<PreviewDefinitionInput>(() => {
    const saved = localStorage.getItem("walkthrough-fixture-definition");
    return saved ? JSON.parse(saved) as PreviewDefinitionInput : definition;
  });
  const [presentation, setPresentation] = useState<string | undefined>(() => new URL(window.location.href).searchParams.get("seene-preset") ?? undefined);
  useLayoutEffect(() => {
    let viewport: HTMLDivElement | null = null;
    let resizeObserver: ResizeObserver;
    function measure() {
      const nextViewport = document.querySelector<HTMLDivElement>(".website-walkthrough-viewport");
      if (!nextViewport) return;
      if (viewport !== nextViewport) {
        if (viewport) resizeObserver.unobserve(viewport);
        viewport = nextViewport;
        resizeObserver.observe(viewport);
      }
      setScrollbarWidth(viewport.offsetWidth - viewport.clientWidth);
    }
    resizeObserver = new ResizeObserver(measure);
    measure();
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);
  const changePresentation = (value: string) => {
    const next = value === "authored" ? undefined : value;
    setPresentation(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("seene-preset", next);
    else url.searchParams.delete("seene-preset");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  };
  return (
    <div className="demo-fixture-shell" style={{ "--demo-story-scrollbar-width": `${scrollbarWidth}px` } as CSSProperties}>
      <SiteHeader onPalette={() => {}} homeHref="/#/" installHref="/#install" />
      <ScenePreview
        definition={sceneDefinition}
        title="Why I Built Seene"
        presentation={presentation}
        onPresentationChange={changePresentation}
        onSaveDefinition={updated => {
          setSceneDefinition(updated);
          localStorage.setItem("walkthrough-fixture-definition", JSON.stringify(updated));
        }}
      >
        <Page />
      </ScenePreview>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<BrowserFixture />);