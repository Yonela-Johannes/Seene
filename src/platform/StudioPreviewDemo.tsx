/** SOURCE OF TRUTH: Seene landing-page studio demo.
 * WHAT: a small, real reproduction of the studio chrome that the visitor can actually drive:
 * a camera keyframe timeline, a component orbit, presentation presets, an editable camera
 * readout and the founder-story walkthrough — all running with local state, no project needed.
 * WHY: the homepage should demonstrate the product instead of illustrating a fake window.
 * WHERE: LandingView renders it as the `#demo` section.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROJECTS_ROUTE, WALKTHROUGH_DEMO_URL } from "./api";
import { FOUNDER_STORY_SCREENS } from "./founder-story";

type Camera = {
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
  perspective: number;
  focus: number;
  fStop: number;
};

type Keyframe = { label: string; camera: Camera };

const DURATION = 6000;

const MOTION: Keyframe[] = [
  { label: "Hold", camera: { x: 0, y: 0, z: 90, rotateX: 6, rotateY: -10, perspective: 1500, focus: 620, fStop: 2.8 } },
  { label: "Push in", camera: { x: -14, y: -8, z: 190, rotateX: 3, rotateY: 7, perspective: 1200, focus: 430, fStop: 2.0 } },
  { label: "Orbit", camera: { x: 22, y: 12, z: 120, rotateX: -7, rotateY: 19, perspective: 1350, focus: 520, fStop: 2.6 } },
  { label: "Settle", camera: { x: 0, y: 6, z: 40, rotateX: 4, rotateY: 2, perspective: 1700, focus: 780, fStop: 5.6 } },
];

const PRESETS: Array<{ id: string; label: string; camera: Partial<Camera> }> = [
  { id: "authored", label: "Authored", camera: {} },
  { id: "wide", label: "Wide", camera: { z: 0, perspective: 2000, focus: 940, fStop: 8 } },
  { id: "depth", label: "Depth", camera: { z: 200, y: -16, rotateX: 10, rotateY: 0, perspective: 950, focus: 380, fStop: 1.8 } },
  { id: "overview", label: "Overview", camera: { z: -160, y: 26, rotateX: -8, rotateY: 16, perspective: 1800, focus: 1200, fStop: 11 } },
];

const FIELD_ORDER: Array<{ key: keyof Camera; label: string; suffix?: string }> = [
  { key: "x", label: "Camera X" },
  { key: "y", label: "Camera Y" },
  { key: "z", label: "Camera Z" },
  { key: "rotateX", label: "Rotate X", suffix: "°" },
  { key: "rotateY", label: "Rotate Y", suffix: "°" },
  { key: "perspective", label: "Perspective" },
  { key: "focus", label: "Focus" },
  { key: "fStop", label: "ƒ /", suffix: "" },
];

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

function interpolate(time: number): Camera {
  const ratio = Math.min(1, Math.max(0, time / DURATION));
  const scaled = ratio * (MOTION.length - 1);
  const index = Math.min(MOTION.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = MOTION[index].camera;
  const to = MOTION[index + 1].camera;
  return {
    x: lerp(from.x, to.x, local), y: lerp(from.y, to.y, local), z: lerp(from.z, to.z, local),
    rotateX: lerp(from.rotateX, to.rotateX, local), rotateY: lerp(from.rotateY, to.rotateY, local),
    perspective: lerp(from.perspective, to.perspective, local), focus: lerp(from.focus, to.focus, local),
    fStop: lerp(from.fStop, to.fStop, local),
  };
}

function formatTime(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing
    ? <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
    : <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>;
}

/** A real, driveable miniature of the studio: the same timeline, sequence, presets and
 * camera controls, wired to local state so every control on the homepage actually does something. */
export function StudioPreviewDemo() {
  const [mode, setMode] = useState<"scene" | "scroll">("scene");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [preset, setPreset] = useState("authored");
  const [edits, setEdits] = useState<Partial<Camera>>({});
  const [orbit, setOrbit] = useState({ x: 0, y: 0 });
  const [storyIndex, setStoryIndex] = useState(0);
  const storyRef = useRef<HTMLDivElement | null>(null);
  const programmatic = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!playing) return;
    const started = performance.now() - time;
    let frame = 0;
    const step = (now: number) => {
      const next = now - started;
      if (next >= DURATION) { setTime(DURATION); setPlaying(false); return; }
      setTime(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `time` intentionally not a dependency: the animation owns it while playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const camera = useMemo<Camera>(() => {
    const presetValues = PRESETS.find(item => item.id === preset)?.camera ?? {};
    return { ...interpolate(time), ...presetValues, ...edits };
  }, [time, preset, edits]);

  const storyStops = FOUNDER_STORY_SCREENS.length;
  const activeStep = mode === "scene"
    ? Math.min(MOTION.length - 1, Math.floor((time / DURATION) * MOTION.length))
    : Math.min(storyStops - 1, Math.round((time / DURATION) * (storyStops - 1)));

  // Walkthrough mode: the timeline and the scroll position are two views of the same progress.
  useEffect(() => {
    if (mode !== "scroll") return;
    const element = storyRef.current;
    if (!element) return;
    const max = element.scrollHeight - element.clientHeight;
    const target = (time / DURATION) * max;
    if (Math.abs(element.scrollTop - target) > 2) {
      programmatic.current = true;
      element.scrollTop = target;
      const release = requestAnimationFrame(() => { programmatic.current = false; });
      return () => cancelAnimationFrame(release);
    }
  }, [time, mode]);

  const onStoryScroll = useCallback(() => {
    if (programmatic.current) return;
    const element = storyRef.current;
    if (!element) return;
    const max = element.scrollHeight - element.clientHeight;
    setTime(max > 0 ? (element.scrollTop / max) * DURATION : 0);
    const step = element.clientHeight || 1;
    setStoryIndex(Math.min(storyStops - 1, Math.round(element.scrollTop / step)));
  }, [storyStops]);

  useEffect(() => {
    if (mode !== "scroll") return;
    setTime((storyIndex / Math.max(1, storyStops - 1)) * DURATION);
    const element = storyRef.current;
    if (element && !playing) element.scrollTo({ top: storyIndex * element.clientHeight, behavior: reduced.current ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIndex, mode]);

  const seek = (next: number) => setTime(Math.min(DURATION, Math.max(0, next)));

  const selectMode = (next: "scene" | "scroll") => {
    setMode(next);
    setTime(0);
    setEdits({});
    setPreset("authored");
    setStoryIndex(0);
  };

  const onPointer = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "scene") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setOrbit({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 16,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * -12,
    });
  };

  const transform = `perspective(${Math.round(camera.perspective)}px) translate3d(${Math.round(camera.x)}px, ${Math.round(camera.y)}px, ${Math.round(camera.z)}px) rotateX(${(camera.rotateX + orbit.y).toFixed(2)}deg) rotateY(${(camera.rotateY + orbit.x).toFixed(2)}deg)`;
  const blur = Math.max(0, (8 - camera.fStop) * 1.6);

  return (
    <div id="demo" data-testid="studio-demo" className="seene-demo scroll-mt-20 mx-auto mt-12 max-w-5xl">
      <div className="seene-demo-topbar">
        <div className="seene-demo-topbar-group">
          <span className="seene-demo-badge">Studio</span>
          <span className="seene-demo-title">
            {mode === "scene" ? "hero.scene.json" : "founder-story.walkthrough.json"}
          </span>
          <span className="seene-demo-status">
            <span aria-hidden="true" className="seene-demo-dot" /> Live demo · runs on this page
          </span>
        </div>
        <div className="seene-demo-topbar-group">
          <div className="seene-demo-tabs" role="group" aria-label="Composition mode">
            <button type="button" aria-pressed={mode === "scene"} onClick={() => selectMode("scene")}>Focused Scene</button>
            <button type="button" aria-pressed={mode === "scroll"} onClick={() => selectMode("scroll")}>Website Walkthrough</button>
          </div>
          <a className="seene-btn seene-btn-secondary seene-btn-nav" href={PROJECTS_ROUTE}>Open the studio →</a>
        </div>
      </div>

      <div className="seene-demo-body">
        <aside className="seene-demo-sequence" aria-label="Sequence">
          <p className="seene-demo-panel-title">{mode === "scene" ? "Motion track" : "Screens"}</p>
          <ul>
            {(mode === "scene"
              ? MOTION.map((keyframe, index) => ({ key: keyframe.label, label: keyframe.label, meta: formatTime((index / MOTION.length) * DURATION), index }))
              : FOUNDER_STORY_SCREENS.map((screen, index) => ({ key: screen.label, label: screen.label.replace(/^\d+\s*\/\s*/, ""), meta: String(index + 1).padStart(2, "0"), index }))
            ).map(item => (
              <li key={item.key}>
                <button
                  type="button"
                  className="seene-demo-node"
                  data-active={activeStep === item.index ? "true" : undefined}
                  onClick={() => { setPlaying(false); if (mode === "scene") seek((item.index / MOTION.length) * DURATION); else setStoryIndex(item.index); }}
                >
                  <span className="seene-demo-node-label">{item.label}</span>
                  <small>{item.meta}</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="seene-demo-main">
          <div
            className="seene-demo-stage"
            data-mode={mode}
            onMouseMove={onPointer}
            onMouseLeave={() => setOrbit({ x: 0, y: 0 })}
          >
            {mode === "scene" ? (
              <>
                <div className="seene-demo-depth" aria-hidden="true" />
                <div
                  className="seene-demo-blur"
                  aria-hidden="true"
                  style={{ backdropFilter: `blur(${blur.toFixed(1)}px)`, WebkitBackdropFilter: `blur(${blur.toFixed(1)}px)` }}
                />
                <div className="seene-demo-card" style={{ transform }}>
                  <div className="seene-demo-card-head">
                    <span className="seene-demo-file">HeroComponent.tsx</span>
                    <span className="seene-demo-chip">ƒ/{camera.fStop.toFixed(1)}</span>
                  </div>
                  <h3>Interactive Product Showcase</h3>
                  <p>Move the pointer to orbit the camera. Scrub the timeline to play the motion track.</p>
                  <div className="seene-demo-card-actions">
                    <span className="seene-demo-cta">Get Started</span>
                    <span className="seene-demo-cta-quiet">Documentation</span>
                  </div>
                </div>
                <p className="seene-demo-caption">
                  Camera X {Math.round(camera.x)} · Y {Math.round(camera.y)} · Z {Math.round(camera.z)} · Rotate {camera.rotateX.toFixed(0)}° / {camera.rotateY.toFixed(0)}°
                </p>
              </>
            ) : (
              <div className="seene-demo-story" ref={storyRef} onScroll={onStoryScroll} tabIndex={0} role="region" aria-label="Founder story preview">
                {FOUNDER_STORY_SCREENS.map((screen, index) => (
                  <section
                    className="demo-founder-story-screen demo-founder-story-screen-card"
                    key={screen.label}
                    data-testid={`home-demo-story-${index}`}
                    data-screen-number={String(index + 1).padStart(2, "0")}
                  >
                    <div className="demo-founder-story-content">
                      <p className="demo-founder-story-kicker">{screen.label}</p>
                      <h4 className="demo-founder-story-title">{screen.title}</h4>
                      <p className="demo-founder-story-copy">{screen.body}</p>
                      <div className="demo-founder-story-progress" aria-hidden="true">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <span className="demo-founder-story-progress-line" />
                        <span>05</span>
                      </div>
                      {index === FOUNDER_STORY_SCREENS.length - 1 ? (
                        <a className="demo-founder-story-cta" href="#install">Experience Seene <span aria-hidden="true">→</span></a>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="seene-demo-timeline">
            <div className="seene-demo-transport">
              <button
                type="button"
                className="seene-demo-play"
                aria-label={playing ? "Pause the demo" : "Play the demo"}
                onClick={() => { if (time >= DURATION) setTime(0); setPlaying(current => !current); }}
              >
                <PlayIcon playing={playing} />
                <span>{playing ? "Pause" : "Play"}</span>
              </button>
              <span className="seene-demo-time">{formatTime(time)} / {formatTime(DURATION)}</span>
            </div>
            <div className="seene-demo-track" aria-hidden="true">
              {(mode === "scene" ? MOTION : FOUNDER_STORY_SCREENS).map((item, index, all) => (
                <button
                  key={item.label}
                  type="button"
                  tabIndex={-1}
                  className="seene-demo-seg"
                  data-active={activeStep === index ? "true" : undefined}
                  style={{ flex: 1 }}
                  onClick={() => { setPlaying(false); if (mode === "scene") seek((index / all.length) * DURATION); else setStoryIndex(index); }}
                >
                  {mode === "scene" ? item.label : `Screen ${index + 1}`}
                </button>
              ))}
              <span className="seene-demo-playhead" style={{ left: `${(time / DURATION) * 100}%` }} />
            </div>
            <input
              className="seene-demo-scrub"
              type="range"
              min={0}
              max={DURATION}
              step={10}
              value={Math.round(time)}
              aria-label="Timeline position"
              onChange={event => { setPlaying(false); seek(Number(event.target.value)); if (mode === "scroll") setStoryIndex(Math.round((Number(event.target.value) / DURATION) * (storyStops - 1))); }}
            />
          </div>
        </div>

        <aside className="seene-demo-inspector" aria-label="Composition settings">
          {mode === "scene" ? (
            <>
              <div className="seene-demo-group">
                <p className="seene-demo-panel-title">Presentation</p>
                <div className="seene-demo-presets">
                  {PRESETS.map(item => (
                    <button key={item.id} type="button" aria-pressed={preset === item.id} onClick={() => { setPreset(item.id); setEdits({}); }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="seene-demo-group seene-demo-camera">
                <p className="seene-demo-panel-title">Camera</p>
                <div className="seene-demo-fields">
                  {FIELD_ORDER.map(field => (
                    <label key={field.key} className="seene-demo-field">
                      <span>{field.label}{field.suffix ?? ""}</span>
                      <input
                        type="number"
                        value={Number(camera[field.key].toFixed(1))}
                        step={field.key === "fStop" ? 0.1 : 1}
                        onChange={event => setEdits(current => ({ ...current, [field.key]: Number(event.target.value) }))}
                      />
                    </label>
                  ))}
                </div>
                <button type="button" className="seene-demo-reset" onClick={() => { setEdits({}); setPreset("authored"); setOrbit({ x: 0, y: 0 }); }}>
                  Reset camera
                </button>
                <p className="seene-demo-hint">Editing a value overrides the motion track for this preview.</p>
              </div>
            </>
          ) : (
            <>
              <p className="seene-demo-panel-title">Walkthrough</p>
              <label className="seene-demo-field seene-demo-field-wide">
                <span>Screen</span>
                <select
                  value={storyIndex}
                  onChange={event => { setPlaying(false); setStoryIndex(Number(event.target.value)); }}
                >
                  {FOUNDER_STORY_SCREENS.map((screen, index) => (
                    <option key={screen.label} value={index}>
                      {String(index + 1).padStart(2, "0")} · {screen.label.replace(/^\d+\s*\/\s*/, "")}
                    </option>
                  ))}
                </select>
              </label>
              <dl className="seene-demo-facts">
                <div><dt>Screens</dt><dd>{storyStops}</dd></div>
                <div><dt>Duration</dt><dd>{formatTime(DURATION)}</dd></div>
                <div><dt>Driver</dt><dd>{playing ? "Auto" : "Scroll"}</dd></div>
                <div><dt>Progress</dt><dd>{Math.round((time / DURATION) * 100)}%</dd></div>
              </dl>
              <p className="seene-demo-hint">Scroll the story or drag the timeline — both move the same playhead.</p>
            </>
          )}
        </aside>
      </div>

      <div className="seene-demo-footer">
        <p>
          {mode === "scene"
            ? "A working reproduction of the studio: real camera keyframes, presets and timeline."
            : "The founder walkthrough playing in the studio viewport."}{" "}
          Seene reads your own project when you open the studio.
        </p>
        <div className="seene-demo-footer-actions">
          <a className="seene-btn seene-btn-secondary seene-btn-nav" href={WALKTHROUGH_DEMO_URL}>Open the live demo →</a>
          <a className="seene-btn seene-btn-ghost seene-btn-nav" href="#install">Install Seene</a>
        </div>
      </div>
    </div>
  );
}
