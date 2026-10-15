import { useState, type ReactNode } from "react";
import { SEENE_BRAND, SEENE_INSTALL_COMMAND } from "../core/branding";
import { FrameSection, Kbd } from "./site";

const CAPABILITIES = [
  {
    title: "Focused Scene Composition",
    body: "Position, rotate and frame real interface layers in 3D space with cinematic camera movement and focal depth.",
    icon: "🎥",
  },
  {
    title: "Full-Page Scroll Journey",
    body: "Animate page scroll progress continuously from hero to footer alongside camera tilt and perspective.",
    icon: "📜",
  },
  {
    title: "Thin-Lens Depth of Field",
    body: "Realistic focal distance and f-stop aperture blur non-focused surfaces naturally.",
    icon: "🔍",
  },
  {
    title: "Motion Timeline & Easing",
    body: "Keyframe tracks with cubic bezier and cinematic easing drive deterministic 60fps playback.",
    icon: "⏱️",
  },
  {
    title: "Real Application Components",
    body: "Renders your actual React components inside the providers, themes and CSS styles you already ship.",
    icon: "⚛️",
  },
  {
    title: "Deterministic Headless Export",
    body: "Capture real frames headlessly and render MP4 videos at 30, 60 or 120 FPS.",
    icon: "🎬",
  },
];

const RECIPE_EXAMPLE = `{
  "version": 1,
  "id": "hero-overview",
  "title": "Hero Showcase",
  "definition": {
    "scene": { "nodes": [{ "id": "host" }] },
    "motion": { "durationMs": 5000 }
  }
}`;

const COMPONENT_EXAMPLE = `import { Surface } from "@thatg33k/seene";
import HeroSection from "../components/HeroSection";

export default function HeroScene() {
  return (
    <Surface id="host">
      <HeroSection />
    </Surface>
  );
}`;

function ExternalLink({ href, className = "", children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="seene-btn seene-btn-secondary seene-btn-nav shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied!" : label ?? "Copy"}
    </button>
  );
}

function CommandLine({ value, copy = true }: { value: string; copy?: boolean }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-3.5 sm:flex-row sm:items-center justify-between">
      <div className="flex w-full min-w-0 items-center gap-2">
        <span className="text-[var(--seene-text-muted)] font-mono">$</span>
        <code className="min-w-0 max-w-full flex-1 overflow-x-auto whitespace-nowrap px-1 font-mono text-xs sm:text-sm text-[var(--seene-text)]">
          {value}
        </code>
      </div>
      {copy ? <CopyButton value={value} /> : null}
    </div>
  );
}

/** Interactive visual preview demonstration card for the landing page hero */
function InteractiveDemoCard() {
  const [activeTab, setActiveTab] = useState<"focused" | "scroll">("focused");
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const rotX = isHovered ? -mousePos.y * 18 : 6;
  const rotY = isHovered ? mousePos.x * 24 : -10;

  return (
    <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-surface-2)]/90 p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
      {/* Demo Header */}
      <div className="flex items-center justify-between border-b border-[var(--seene-border)] pb-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
          <span className="ml-2 font-mono text-xs text-[var(--seene-text-muted)]">seene-studio-preview</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--seene-border)] bg-[var(--seene-surface)] p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("focused")}
            className={`px-3 py-1 rounded-md transition-all font-medium ${
              activeTab === "focused" ? "bg-[var(--seene-surface-2)] text-[var(--seene-text)] shadow-sm" : "text-[var(--seene-text-muted)]"
            }`}
          >
            Focused Scene
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scroll")}
            className={`px-3 py-1 rounded-md transition-all font-medium ${
              activeTab === "scroll" ? "bg-[var(--seene-surface-2)] text-[var(--seene-text)] shadow-sm" : "text-[var(--seene-text-muted)]"
            }`}
          >
            Full-Page Scroll
          </button>
        </div>
      </div>

      {/* Demo Stage */}
      <div
        className="relative h-72 sm:h-80 w-full overflow-hidden rounded-xl border border-[var(--seene-border)] bg-gradient-to-b from-zinc-950 to-zinc-900 flex items-center justify-center p-6 cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setMousePos({ x: 0, y: 0 }); }}
        onMouseMove={handleMouseMove}
        style={{ perspective: 1200 }}
      >
        {activeTab === "focused" ? (
          <div
            className="w-full max-w-md rounded-xl border border-zinc-700/60 bg-zinc-900/90 p-6 shadow-2xl text-left space-y-4 transition-transform duration-200 ease-out"
            style={{
              transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(40px)`,
              transformStyle: "preserve-3d",
            }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="font-mono text-xs font-semibold text-indigo-400">HeroComponent.tsx</span>
              <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300 font-mono">Camera f/2.8</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Interactive Product Showcase</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Hover to tilt camera perspective. Thin-lens focus blurs background depth naturally.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <div className="h-8 rounded-lg bg-indigo-600 px-4 flex items-center text-xs font-medium text-white shadow-sm">
                Get Started
              </div>
              <div className="h-8 rounded-lg border border-zinc-700 px-4 flex items-center text-xs text-zinc-300">
                Documentation
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto space-y-4 text-left p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <div className="p-4 rounded-lg bg-zinc-800/80 border border-zinc-700">
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">01 · Hero Section</span>
              <h4 className="text-sm font-semibold text-white mt-1">Cinematic Webpage Journey</h4>
            </div>
            <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">02 · Product Features</span>
              <p className="text-xs text-zinc-400 mt-1">Smooth top-to-bottom scroll walkthrough synced with playback.</p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">03 · Footer</span>
              <p className="text-xs text-zinc-400 mt-1">Reaches bottom frame deterministically during video export.</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-[var(--seene-text-muted)] mt-3">
        Move cursor over preview to test live 3D camera response · Toggle composition modes above
      </p>
    </div>
  );
}

export function LandingView() {
  return (
    <>
      {/* Hero Section */}
      <FrameSection label="Overview" edge="bottom" rails={[{ kind: "solid", flex: 2 }, { kind: "dashed", flex: 3 }, { kind: "solid", flex: 4 }]}>
        <div className="relative py-16 text-center sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--seene-border)] bg-[var(--seene-surface)] px-4 py-1.5 font-mono text-xs text-[var(--seene-text-muted)] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[var(--seene-accent)]" aria-hidden="true" />
            {SEENE_BRAND.packageName} · {SEENE_BRAND.license} licensed
          </p>

          <h1 className="seene-hero-rise mx-auto mt-6 max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Present your React interfaces as cinematic scenes.
          </h1>

          <p className="seene-hero-rise mx-auto mt-6 max-w-2xl text-balance text-base sm:text-lg leading-relaxed text-[var(--seene-text-muted)]">
            Seene is a cinematic presentation studio for real React applications. Keep your components,
            providers, and styles, and add camera movement, depth of field, motion timelines, and video export.
          </p>

          <div className="mx-auto mt-8 max-w-2xl">
            <CommandLine value={SEENE_INSTALL_COMMAND} />
            <p className="mt-3 font-mono text-xs text-[var(--seene-text-muted)]">
              Requires Node 22.12+ and React 18.2+ or 19. Installs as {SEENE_BRAND.packageName}.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a className="seene-btn seene-btn-primary seene-btn-cta" href="#install">
              Get started <Kbd onPrimary>I</Kbd>
            </a>
            <ExternalLink className="seene-btn seene-btn-secondary seene-btn-cta" href={SEENE_BRAND.repository}>
              View on GitHub
            </ExternalLink>
            <ExternalLink className="seene-btn seene-btn-secondary seene-btn-cta" href={SEENE_BRAND.npm}>
              npm package
            </ExternalLink>
          </div>

          {/* Interactive Demonstration */}
          <InteractiveDemoCard />
        </div>
      </FrameSection>

      {/* Capabilities Section */}
      <FrameSection label="Capabilities" edge="both" rails={[{ kind: "dashed", flex: 2 }, { kind: "solid", flex: 4 }, { kind: "dashed", flex: 1 }]}>
        <div className="py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="seene-h2 text-3xl sm:text-4xl">Built for Real React Applications</h2>
            <p className="mt-3 text-sm text-[var(--seene-text-muted)]">
              Seene connects directly to your existing React codebase without requiring mock setups or separate renderer engines.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(item => (
              <article key={item.title} className="rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6 hover:border-[var(--seene-border-text)] transition-colors">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="text-base font-semibold text-[var(--seene-text)]">{item.title}</h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--seene-text-muted)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </FrameSection>

      {/* Onboarding & Workflow Section */}
      <FrameSection label="Workflow" edge="both" texture rails={[{ kind: "solid", flex: 4 }, { kind: "dashed", flex: 2 }, { kind: "solid", flex: 2 }]}>
        <div id="install" className="py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="seene-h2 text-3xl sm:text-4xl">Simple Setup in Minutes</h2>
            <p className="mt-3 text-sm text-[var(--seene-text-muted)]">
              Works seamlessly with standard Vite React projects, Next.js (App & Pages router), and custom React DOM renderers.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl text-left space-y-10">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--seene-accent)] bg-[var(--seene-surface-2)] border border-[var(--seene-border)] px-2.5 py-1 rounded-md">
                  STEP 01
                </span>
                <h3 className="text-base font-semibold text-[var(--seene-text)]">Initialize Seene in Your Project</h3>
              </div>
              <p className="text-sm text-[var(--seene-text-muted)] leading-relaxed">
                Run init from your application root. Seene installs the package and generates instructions in <code className="font-mono text-xs bg-[var(--seene-surface-2)] px-1.5 py-0.5 rounded">SEENE.md</code>.
              </p>
              <CommandLine value={SEENE_INSTALL_COMMAND} />
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--seene-accent)] bg-[var(--seene-surface-2)] border border-[var(--seene-border)] px-2.5 py-1 rounded-md">
                  STEP 02
                </span>
                <h3 className="text-base font-semibold text-[var(--seene-text)]">Author a Recipe and Component</h3>
              </div>
              <p className="text-sm text-[var(--seene-text-muted)] leading-relaxed">
                Create a scene pair in <code className="font-mono text-xs bg-[var(--seene-surface-2)] px-1.5 py-0.5 rounded">src/seene/scenes/</code>. The recipe defines camera keyframes while the component renders your UI.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-2 font-mono text-xs text-[var(--seene-text-muted)]">hero-showcase.scene.json</p>
                  <pre className="max-w-full overflow-x-auto rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-4 font-mono text-xs leading-relaxed text-[var(--seene-text)]">
                    <code>{RECIPE_EXAMPLE}</code>
                  </pre>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 font-mono text-xs text-[var(--seene-text-muted)]">hero-showcase.tsx</p>
                  <pre className="max-w-full overflow-x-auto rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-4 font-mono text-xs leading-relaxed text-[var(--seene-text)]">
                    <code>{COMPONENT_EXAMPLE}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--seene-accent)] bg-[var(--seene-surface-2)] border border-[var(--seene-border)] px-2.5 py-1 rounded-md">
                  STEP 03
                </span>
                <h3 className="text-base font-semibold text-[var(--seene-text)]">Open Studio & Compose Motion</h3>
              </div>
              <p className="text-sm text-[var(--seene-text-muted)] leading-relaxed">
                Start your app dev server as usual, then launch the studio preview to inspect camera angles, adjust focal depth, and export video.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CommandLine value="npx seene open --url http://localhost:3000" />
                <CommandLine value="npx seene open --url http://localhost:5173" />
              </div>
            </div>
          </div>
        </div>
      </FrameSection>

      {/* Open Source & Credits */}
      <FrameSection label="Open source" edge="both" texture rails={[{ kind: "dashed", flex: 3 }, { kind: "solid", flex: 3 }, { kind: "dashed", flex: 3 }]}>
        <div className="mx-auto max-w-2xl py-16 text-center">
          <h2 className="seene-h2 text-3xl font-semibold">Local, Private & Open Source</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--seene-text-muted)]">
            Seene runs 100% locally on your development machine. No sign-up required, no cloud services, and zero telemetry.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <ExternalLink className="seene-btn seene-btn-secondary seene-btn-cta" href={SEENE_BRAND.repository}>
              Source Code
            </ExternalLink>
            <ExternalLink className="seene-btn seene-btn-secondary seene-btn-cta" href={SEENE_BRAND.examples}>
              Examples
            </ExternalLink>
            <ExternalLink className="seene-btn seene-btn-secondary seene-btn-cta" href={SEENE_BRAND.issues}>
              Report Issue
            </ExternalLink>
          </div>

          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6 text-left space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--seene-text-muted)]">Project Credits</p>
            <p className="text-sm leading-relaxed text-[var(--seene-text)]">
              Seene is created and maintained by{" "}
              <ExternalLink className="font-medium underline underline-offset-2" href={SEENE_BRAND.maintainerProfile}>
                {SEENE_BRAND.maintainer}
              </ExternalLink>{" "}
              under{" "}
              <ExternalLink className="font-medium underline underline-offset-2" href={SEENE_BRAND.organization}>
                {SEENE_BRAND.creator}
              </ExternalLink>.
            </p>
            <p className="text-xs text-[var(--seene-text-muted)]">
              Released under the {SEENE_BRAND.license} License.
            </p>
          </div>
        </div>
      </FrameSection>

      {/* Footer */}
      <FrameSection label="Footer" edge="top">
        <footer className="flex flex-col gap-6 py-10 text-xs sm:text-sm text-[var(--seene-text-muted)] sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-2">
            <p className="text-base font-semibold tracking-tight text-[var(--seene-text)]">{SEENE_BRAND.name}</p>
            <p>{SEENE_BRAND.tagline}</p>
            <p className="text-xs text-[var(--seene-text-muted)]">
              Built by{" "}
              <ExternalLink className="underline underline-offset-2" href={SEENE_BRAND.maintainerProfile}>
                {SEENE_BRAND.maintainer}
              </ExternalLink>{" "}
              · {SEENE_BRAND.creator}
            </p>
          </div>
          <nav aria-label="Footer navigation" className="grid gap-2 sm:grid-cols-2 sm:gap-x-10 text-xs">
            <ExternalLink className="hover:text-[var(--seene-text)] transition-colors" href={SEENE_BRAND.repository}>
              GitHub Repository
            </ExternalLink>
            <ExternalLink className="hover:text-[var(--seene-text)] transition-colors" href={SEENE_BRAND.npm}>
              npm Package
            </ExternalLink>
            <ExternalLink className="hover:text-[var(--seene-text)] transition-colors" href={SEENE_BRAND.docs}>
              Documentation
            </ExternalLink>
            <ExternalLink className="hover:text-[var(--seene-text)] transition-colors" href={SEENE_BRAND.examples}>
              Examples
            </ExternalLink>
            <ExternalLink className="hover:text-[var(--seene-text)] transition-colors" href={SEENE_BRAND.issues}>
              Issues & Feedback
            </ExternalLink>
            <ExternalLink className="hover:text-[var(--seene-text)] transition-colors" href={`${SEENE_BRAND.repository}/blob/main/LICENSE`}>
              MIT License
            </ExternalLink>
          </nav>
        </footer>
      </FrameSection>
    </>
  );
}
