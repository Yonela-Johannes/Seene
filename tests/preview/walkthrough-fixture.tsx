import { createRoot } from "react-dom/client";
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
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

/** Follow the walkthrough scroll container so the story can show real progress. */
function useStoryScroll(): { progress: number; started: boolean } {
  const [state, setState] = useState({ progress: 0, started: false });
  useEffect(() => {
    let element: HTMLElement | null = null;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!element) return;
      const max = element.scrollHeight - element.clientHeight;
      setState({ progress: max > 0 ? Math.min(1, Math.max(0, element.scrollTop / max)) : 0, started: element.scrollTop > 24 });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const attach = () => {
      const next = document.querySelector<HTMLElement>(".website-walkthrough-viewport");
      if (!next || next === element) return;
      element?.removeEventListener("scroll", onScroll);
      element = next;
      element.addEventListener("scroll", onScroll, { passive: true });
      update();
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      element?.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return state;
}

function Page({ started }: { started: boolean }) {
  const lastIndex = FOUNDER_STORY_SCREENS.length - 1;
  return (
    <Surface id="host" style={{ width: "100%", height: "auto", minHeight: "100vh" }}>
      <main className="demo-founder-story-page" data-testid="walkthrough-page" style={{ height: `${FOUNDER_STORY_SCREENS.length * 100}vh` }}>
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
                <h2 className="demo-founder-story-title">{screen.title}</h2>
                <p className="demo-founder-story-copy">{screen.body}</p>
                <div className="demo-founder-story-steps" aria-hidden="true">
                  {FOUNDER_STORY_SCREENS.map((step, stepIndex) => (
                    <span
                      key={step.label}
                      className="demo-founder-story-step"
                      data-active={stepIndex === index ? "true" : undefined}
                    />
                  ))}
                  <span className="demo-founder-story-step-count">
                    {String(index + 1).padStart(2, "0")} / {String(FOUNDER_STORY_SCREENS.length).padStart(2, "0")}
                  </span>
                </div>
                {index === 0 && !started ? (
                  <p className="demo-founder-story-hint">
                    <i aria-hidden="true">↓</i> Scroll to continue
                  </p>
                ) : null}
                {index === lastIndex ? (
                  <>
                    <a className="demo-founder-story-cta" href={`${import.meta.env.BASE_URL}#install`}>
                      Experience Seene <span aria-hidden="true" style={{ marginLeft: 8 }}>→</span>
                    </a>
                    <a className="demo-founder-story-cta-quiet" href={`${import.meta.env.BASE_URL}#/projects`}>
                      Open the studio
                    </a>
                  </>
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
  const story = useStoryScroll();
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
      <SiteHeader onPalette={() => {}} homeHref={`${import.meta.env.BASE_URL}#/`} installHref={`${import.meta.env.BASE_URL}#install`} />
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
        <Page started={story.started} />
      </ScenePreview>
      <div className="demo-story-progress" aria-hidden="true" style={{ "--demo-story-progress": String(story.progress) } as CSSProperties}>
        <i />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<BrowserFixture />);