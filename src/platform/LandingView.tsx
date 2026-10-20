import { useState, type ReactNode } from "react";
import {
  SEENE_BRAND,
  SEENE_INIT_COMMAND,
  SEENE_INSTALL_COMMAND,
  SEENE_NPM_INSTALL_COMMAND,
} from "../core/branding";
import { FrameSection, Kbd } from "./site";
import { StudioPreviewDemo } from "./StudioPreviewDemo";
import { createHref, PROJECTS_ROUTE, WALKTHROUGH_DEMO_URL } from "./api";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const CAPABILITIES = [
  {
    title: "Focused scenes",
    body: "Frame one real component or a group of sections on a virtual canvas with a camera, perspective and a chosen aspect ratio.",
    icon: (
      <Glyph>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M9 4l-2 5M15 4l-2 5" />
      </Glyph>
    ),
  },
  {
    title: "Website walkthroughs",
    body: "Chain components, pages, scrolls and interactions into one ordered sequence that drives the live site as a single timeline.",
    icon: (
      <Glyph>
        <path d="M4 5h16M4 12h16M4 19h9" />
        <circle cx="19" cy="19" r="2" />
      </Glyph>
    ),
  },
  {
    title: "Camera, focus and depth",
    body: "Move the camera in 3D and tune f-stop, focal length and focus distance to get real depth of field on your own markup.",
    icon: (
      <Glyph>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" />
      </Glyph>
    ),
  },
  {
    title: "Seekable motion timeline",
    body: "Keyframe camera, focus and surface properties on one millisecond timeline, then seek, step and replay it deterministically.",
    icon: (
      <Glyph>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </Glyph>
    ),
  },
  {
    title: "Your existing React UI",
    body: "Scene previews render inside your app, with its providers, router, data, fonts and responsive styles still in charge.",
    icon: (
      <Glyph>
        <circle cx="12" cy="12" r="2" />
        <path d="M12 4c3.5 0 6 3.6 6 8s-2.5 8-6 8-6-3.6-6-8 2.5-8 6-8Z" />
        <path d="M5.5 8c3-1.7 6.7-1.7 9.7 0" />
        <path d="M5.5 16c3 1.7 6.7 1.7 9.7 0" />
      </Glyph>
    ),
  },
  {
    title: "Local MP4 export",
    body: "Capture the rendered sequence with Chromium and encode one continuous MP4 on your machine at 30, 60 or 120 fps.",
    icon: (
      <Glyph>
        <path d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5" />
        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </Glyph>
    ),
  },
];

const RECIPE_EXAMPLE = `{
  "version": 1,
  "id": "hero-showcase",
  "title": "Hero Showcase",
  "compositionType": "scene",
  "definition": {
    "scene": {
      "camera": { "perspective": 1600, "z": 120, "rotateY": -6 },
      "focus": { "distance": 1280, "fStop": 2.8, "maxBlur": 8 },
      "nodes": [{ "id": "host" }]
    },
    "motion": {
      "durationMs": 5000,
      "speed": 1,
      "tracks": [{
        "target": { "kind": "camera" },
        "property": "z",
        "keyframes": [
          { "timeMs": 0, "value": 120, "easing": "easeInOut" },
          { "timeMs": 5000, "value": 20, "easing": "easeInOut" }
        ]
      }]
    }
  }
}`;

const COMPONENT_EXAMPLE = `import { Scene, Surface } from "@thatg33k/seene";
import HeroSection from "@/components/HeroSection";
import recipe from "./hero-showcase.scene.json";

export default function HeroScene() {
  return (
    <Scene
      camera={recipe.definition.scene.camera}
      focus={recipe.definition.scene.focus}
      motion={recipe.definition.motion}
      recipeNodes={recipe.definition.scene.nodes}
    >
      <Surface id="host">
        <HeroSection />
      </Surface>
    </Scene>
  );
}`;

function ExternalLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
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
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  );
}

function CommandLine({
  value,
  copy = true,
}: {
  value: string;
  copy?: boolean;
}) {
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
  return <StudioPreviewDemo />;
}

const WORKFLOW = [
  {
    title: "Choose what to create",
    body: "Start a Scene for one composition, or a Walkthrough for a connected sequence of sections.",
  },
  {
    title: "Point Seene at your application",
    body: "Register the project folder or browse to it. Seene finds the framework, routes and components.",
  },
  {
    title: "Pick real components",
    body: "Search the pages, sections and components it discovered and choose the ones to present.",
  },
  {
    title: "Compose, preview and export",
    body: "Fine-tune camera, focus and motion on the timeline, then export one continuous MP4.",
  },
];

export function LandingView() {
  return (
    <>
      {/* Hero Section */}
      <FrameSection
        label="Overview"
        edge="bottom"
        rails={[
          { kind: "solid", flex: 2 },
          { kind: "dashed", flex: 3 },
          { kind: "solid", flex: 4 },
        ]}
      >
        <div className="relative py-14 text-center sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--seene-border)] bg-[var(--seene-surface)] px-4 py-1.5 font-mono text-xs text-[var(--seene-text-muted)] shadow-sm">
            <span
              className="h-2 w-2 rounded-full bg-[var(--seene-accent)]"
              aria-hidden="true"
            />
            {SEENE_BRAND.packageName} · {SEENE_BRAND.license} licensed
          </p>

          <h1 className="seene-hero-rise mx-auto mt-6 max-w-4xl text-balance text-[2.15rem] font-semibold tracking-tight leading-[1.08] sm:text-6xl lg:text-7xl">
            Present your React interfaces as cinematic scenes.
          </h1>

          <p className="seene-hero-rise mx-auto mt-6 max-w-2xl text-pretty text-base sm:text-lg leading-relaxed text-[var(--seene-text-muted)]">
            Seene is a cinematic presentation studio for real React
            applications. Keep your components, providers and styles, then layer
            on camera movement, depth of field, motion timelines and local video
            export.
          </p>

          <div className="mx-auto mt-8 max-w-2xl space-y-2">
            <CommandLine value={SEENE_NPM_INSTALL_COMMAND} />
            <CommandLine value={SEENE_INIT_COMMAND} />
            <p className="font-mono text-xs text-[var(--seene-text-muted)]">
              Requires Node 22.12+ and React 18.2+ or 19. Installs as{" "}
              {SEENE_BRAND.packageName}.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              className="seene-btn seene-btn-primary seene-btn-cta"
              href={PROJECTS_ROUTE}
            >
              Open the studio
            </a>
            <a
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href="#demo"
            >
              Try the demo <Kbd>D</Kbd>
            </a>
            <a
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href={WALKTHROUGH_DEMO_URL}
            >
              Watch the walkthrough
            </a>
            <ExternalLink
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href={SEENE_BRAND.repository}
            >
              View on GitHub
            </ExternalLink>
          </div>

          {/* Interactive Demonstration */}
          <InteractiveDemoCard />
        </div>
      </FrameSection>

      {/* Capabilities Section */}
      <FrameSection
        label="Capabilities"
        edge="both"
        rails={[
          { kind: "dashed", flex: 2 },
          { kind: "solid", flex: 4 },
          { kind: "dashed", flex: 1 },
        ]}
      >
        <div className="py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="seene-h2 text-3xl sm:text-4xl">
              Built for Real React Applications
            </h2>
            <p className="mt-3 text-sm text-[var(--seene-text-muted)]">
              Seene connects directly to your existing React codebase without
              requiring mock setups or separate renderer engines.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6 hover:border-[var(--seene-border-text)] transition-colors"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface-2)] text-[var(--seene-accent)]">
                  {item.icon}
                </div>
                <h3 className="text-base font-semibold text-[var(--seene-text)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--seene-text-muted)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </FrameSection>

      {/* Create Section */}
      <FrameSection
        label="Create"
        edge="both"
        rails={[
          { kind: "solid", flex: 3 },
          { kind: "solid", flex: 2 },
          { kind: "dashed", flex: 3 },
        ]}
      >
        <div className="py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="seene-h2 text-3xl sm:text-4xl">
              Projects, Scenes and Walkthroughs
            </h2>
            <p className="mt-3 text-sm text-[var(--seene-text-muted)]">
              One workflow creates all three. Point Seene at a React
              application, pick the real pages and components to present, then
              open the matching editor.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Project",
                body: "The React application and its discovery context: the routes, sections and components Seene can read.",
              },
              {
                title: "Scene",
                body: "A standalone cinematic composition: one component or a group of sections with camera, focus and motion.",
              },
              {
                title: "Walkthrough",
                body: "A connected sequence of components, navigation, scrolls and interactions that plays as one video.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6"
              >
                <h3 className="text-base font-semibold text-[var(--seene-text)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--seene-text-muted)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <ol className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
            {WORKFLOW.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-3 rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-5"
              >
                <span className="font-mono text-xs font-semibold text-[var(--seene-accent)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong className="block text-sm font-medium text-[var(--seene-text)]">
                    {step.title}
                  </strong>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--seene-text-muted)]">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              className="seene-btn seene-btn-primary seene-btn-cta"
              href={PROJECTS_ROUTE}
            >
              Open the studio
            </a>
            <a
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href={createHref("scene")}
            >
              Create a scene
            </a>
            <a
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href={createHref("walkthrough")}
            >
              Create a walkthrough
            </a>
          </div>
        </div>
      </FrameSection>

      {/* Onboarding & Workflow Section */}
      <FrameSection
        label="Workflow"
        edge="both"
        texture
        rails={[
          { kind: "solid", flex: 4 },
          { kind: "dashed", flex: 2 },
          { kind: "solid", flex: 2 },
        ]}
      >
        <div id="install" className="py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="seene-h2 text-3xl sm:text-4xl">
              Simple Setup in Minutes
            </h2>
            <p className="mt-3 text-sm text-[var(--seene-text-muted)]">
              Vite and Next.js App/Pages Router connect automatically. Other
              React DOM hosts use a generated wrapper that you mount yourself.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl text-left space-y-10">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--seene-accent)] bg-[var(--seene-surface-2)] border border-[var(--seene-border)] px-2.5 py-1 rounded-md">
                  STEP 01
                </span>
                <h3 className="text-base font-semibold text-[var(--seene-text)]">
                  Install and Initialize Seene
                </h3>
              </div>
              <p className="text-sm text-[var(--seene-text-muted)] leading-relaxed">
                From your application root, install the package with npm, then
                run init. Init connects the host and writes instructions to{" "}
                <code className="font-mono text-xs bg-[var(--seene-surface-2)] px-1.5 py-0.5 rounded">
                  SEENE.md
                </code>
                . Do not fetch Seene with npx: the project should depend on the
                installed version.
              </p>
              <CommandLine value={SEENE_NPM_INSTALL_COMMAND} />
              <CommandLine value={SEENE_INIT_COMMAND} />
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--seene-accent)] bg-[var(--seene-surface-2)] border border-[var(--seene-border)] px-2.5 py-1 rounded-md">
                  STEP 02
                </span>
                <h3 className="text-base font-semibold text-[var(--seene-text)]">
                  Author a Recipe and Component
                </h3>
              </div>
              <p className="text-sm text-[var(--seene-text-muted)] leading-relaxed">
                Create a matching recipe and component in{" "}
                <code className="font-mono text-xs bg-[var(--seene-surface-2)] px-1.5 py-0.5 rounded">
                  src/seene/scenes/
                </code>
                . Choose Website Walkthrough in Create Scene to select and order
                real project components; the recipe defines surfaces and
                optional keyframes.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="min-w-0">
                  <p
                    className="mb-2 font-mono text-xs text-[var(--seene-text-muted)]"
                    data-seene-example="recipe"
                  >
                    hero-showcase.scene.json
                  </p>
                  <pre className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-4 font-mono text-xs leading-relaxed text-[var(--seene-text)]">
                    <code>{RECIPE_EXAMPLE}</code>
                  </pre>
                </div>
                <div className="min-w-0">
                  <p
                    className="mb-2 font-mono text-xs text-[var(--seene-text-muted)]"
                    data-seene-example="component"
                  >
                    hero-showcase.tsx
                  </p>
                  <pre className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-4 font-mono text-xs leading-relaxed text-[var(--seene-text)]">
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
                <h3 className="text-base font-semibold text-[var(--seene-text)]">
                  Open Studio & Compose Motion
                </h3>
              </div>
              <p className="text-sm text-[var(--seene-text-muted)] leading-relaxed">
                Start your app dev server as usual, then launch the studio
                preview to inspect camera angles, adjust focal depth, and export
                video.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CommandLine value="npx seene open --url http://localhost:3000" />
                <CommandLine value="npx seene open --url http://localhost:5173" />
              </div>
              <p className="text-sm text-[var(--seene-text-muted)] leading-relaxed">
                Vite scene creation and file changes require{" "}
                <code className="font-mono text-xs">
                  seeneCreateScenePlugin()
                </code>{" "}
                from{" "}
                <code className="font-mono text-xs">@thatg33k/seene/vite</code>.
                Next.js initialization creates its scene API route. Other React
                DOM hosts need the generated preview wrapper mounted manually.
              </p>
            </div>
          </div>
        </div>
      </FrameSection>

      {/* Open Source & Credits */}
      <FrameSection
        label="Open source"
        edge="both"
        texture
        rails={[
          { kind: "dashed", flex: 3 },
          { kind: "solid", flex: 3 },
          { kind: "dashed", flex: 3 },
        ]}
      >
        <div className="mx-auto max-w-2xl py-16 text-center">
          <h2 className="seene-h2 text-3xl font-semibold">
            Local, Private & Open Source
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--seene-text-muted)]">
            Seene runs 100% locally on your development machine. No sign-up
            required, no cloud services, and zero telemetry.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <ExternalLink
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href={SEENE_BRAND.repository}
            >
              Source Code
            </ExternalLink>
            <ExternalLink
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href={SEENE_BRAND.examples}
            >
              Examples
            </ExternalLink>
            <ExternalLink
              className="seene-btn seene-btn-secondary seene-btn-cta"
              href={SEENE_BRAND.issues}
            >
              Report Issue
            </ExternalLink>
          </div>

          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-[var(--seene-border)] bg-[var(--seene-surface)] p-6 text-left space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--seene-text-muted)]">
              Project Credits
            </p>
            <p className="text-sm leading-relaxed text-[var(--seene-text)]">
              Seene is created and maintained by{" "}
              <ExternalLink
                className="font-medium underline underline-offset-2"
                href={SEENE_BRAND.maintainerProfile}
              >
                {SEENE_BRAND.maintainer}
              </ExternalLink>
            </p>
            <p className="text-xs text-[var(--seene-text-muted)]">
              Released under the{" "}
              <ExternalLink
                className="underline underline-offset-2"
                href={`${SEENE_BRAND.repository}/blob/main/LICENSE`}
              >
                {SEENE_BRAND.license} License
              </ExternalLink>
              .
            </p>
          </div>
        </div>
      </FrameSection>

      <FrameSection
        label="Founder story"
        edge="both"
        rails={[
          { kind: "solid", flex: 2 },
          { kind: "dashed", flex: 3 },
          { kind: "solid", flex: 2 },
        ]}
      >
        <div className="founder-story-teaser mx-auto flex max-w-4xl flex-col gap-4 py-10 sm:py-12">
          <p className="home-story-kicker">A NOTE FROM THE FOUNDER</p>
          <h2 className="seene-h2 text-left text-2xl sm:text-3xl">
            Why I built Seene
          </h2>
          <blockquote className="max-w-3xl text-base leading-relaxed text-[var(--seene-text-muted)] sm:text-lg">
            “I got tired of manually recording websites, scrolling from top to
            bottom, and repeating the process every time I wanted to showcase a
            project. I wanted a better way to do it — so I built Seene.”
          </blockquote>
          <a
            className="seene-btn seene-btn-secondary seene-btn-cta mt-1 self-start"
            href={WALKTHROUGH_DEMO_URL}
          >
            Watch the demo <span aria-hidden="true">→</span>
          </a>
        </div>
      </FrameSection>

      {/* Footer */}
      <FrameSection label="Footer" edge="top">
        <footer className="flex flex-col gap-6 py-10 text-xs sm:text-sm text-[var(--seene-text-muted)] sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-2">
            <p className="text-base font-semibold tracking-tight text-[var(--seene-text)]">
              {SEENE_BRAND.name}
            </p>
            <p>{SEENE_BRAND.tagline}</p>
            <p className="text-xs text-[var(--seene-text-muted)]">
              Built by{" "}
              <ExternalLink
                className="underline underline-offset-2"
                href={SEENE_BRAND.maintainerProfile}
              >
                {SEENE_BRAND.maintainer}
              </ExternalLink>{" "}
              · {SEENE_BRAND.creator}
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="grid gap-2 sm:grid-cols-2 sm:gap-x-10 text-xs"
          >
            <ExternalLink
              className="hover:text-[var(--seene-text)] transition-colors"
              href={SEENE_BRAND.repository}
            >
              GitHub Repository
            </ExternalLink>
            <ExternalLink
              className="hover:text-[var(--seene-text)] transition-colors"
              href={SEENE_BRAND.npm}
            >
              npm Package
            </ExternalLink>
            <ExternalLink
              className="hover:text-[var(--seene-text)] transition-colors"
              href={SEENE_BRAND.docs}
            >
              Documentation
            </ExternalLink>
            <ExternalLink
              className="hover:text-[var(--seene-text)] transition-colors"
              href={SEENE_BRAND.examples}
            >
              Examples
            </ExternalLink>
            <ExternalLink
              className="hover:text-[var(--seene-text)] transition-colors"
              href={SEENE_BRAND.issues}
            >
              Issues & Feedback
            </ExternalLink>
            <ExternalLink
              className="hover:text-[var(--seene-text)] transition-colors"
              href={`${SEENE_BRAND.repository}/blob/main/LICENSE`}
            >
              MIT License
            </ExternalLink>
          </nav>
        </footer>
      </FrameSection>
    </>
  );
}
