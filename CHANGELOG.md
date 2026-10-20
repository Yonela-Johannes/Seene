# Changelog
## Unreleased
- Repository moved to <https://github.com/Yonela-Johannes/Seene>; the published site is
  <https://yonela-johannes.github.io/Seene/seene/>. Every generated link, badge, canonical URL,
  npm `repository`/`homepage`/`bugs` field and the GitHub Pages base now point at the new home.
- Studio: a scene framed inside a fit-to-viewport pane is no longer pushed out of frame or blurred
  by default (the camera matrix used to rotate about the pane origin and inherit the overflowing
  pane size, which put every pixel at maximum defocus).
- Studio: the docked Inspector no longer clips its header, its radio labels are readable, and
  composition-mode buttons follow their selected state. Scenes without a save endpoint get an
  explicit explanation instead of a silently disabled save button.
- Studio: the project credits now sit at the bottom-right of the scene viewport as a floating
  pill in both Scene and Scroll modes, including the walkthrough workspace.
- Homepage: balanced capability grid, working demo and studio links, clearer install steps, and
  more accurate recipe/component examples.
- Aligned homepage examples and feature descriptions with the current scene creation, Website Walkthrough, Vite plugin and export contracts.
- Clarified that generated Website Walkthrough scaffolds do not automatically assign section timing or connect every section to the Scene timeline.
- Corrected the homepage sample recipe ID, motion shape and component-relative import.

## 0.1.6

### Scene transitions

- Added `SceneTransitionSchema` and `TRANSITION_PRESETS` to the core preview module, defining
  transition types (crossfade, camera, focus) with configurable durations.
- `ScenePreview` now cross-fades between scenes when the scene definition changes (detected via
  node signature), using `requestAnimationFrame` and an ease-in-out timing function. Presentation-only
  changes (same scene, different camera/focus) skip the transition to avoid visual disruption.
- Added `TransitionPicker` component and wired `transition`/`onTransitionChange` props through
  `SceneLibrary` → `SceneModuleLibrary` for UI-driven transition selection.
- Added `SCENE_TRANSITION_DURATION` constant (300ms) with CSS styling in `previewTheme`.

### Export quality

- Added `--quality`/`crf` flag to `seene export` for controlling video encoding quality (CRF 0–51,
  default 18 for high quality).
- Improved ffmpeg encoding: lanczos scaling filter for higher-quality downscaling, explicit `-preset
  medium` for consistent encode speed, and `-crf` for configurable quality/size tradeoff.
- Added quality selector (High/Standard/Compact) to the export panel in ScenePreview.

### Motion enhancements

- Camera perspective is now animatable via motion tracks. The `CameraMotionSchema` includes
  `perspective`, enabling cinematic zoom-in/zoom-out effects alongside position and rotation.
- Added a perspective-zoom authoring check in `reviewAuthoring` to warn about clipping risk
  when animating perspective.

### Default duration

- Extended default motion duration from 4000ms to 5000ms and added default speed of 0.8,
  providing a more cinematic timing baseline for new scenes.

### Inspector

- Added camera motion preset buttons (Dolly, Orbit, Push, Pull) to `SceneInspector` for one-click
  cinematic camera movement creation.
- Added quality selector (High/Standard/Compact) to the export panel in ScenePreview.
- Removed the `key` prop from `ScenePreview` in `SceneLibrary` rendering to enable proper
  cross-fade transitions between scenes without full component remounts.

### Depth/focus polish

- Clamped blur radius in `Surface` to a maximum of 60px to prevent surfaces from becoming
  completely unrecognizable when far from the focus plane.

## 0.1.5

### Fix: invalid-scenes regression test
- Added test confirming that an orphaned `.scene.json` recipe (without matching `.tsx`/`.jsx`) correctly produces `invalid-scenes`, and that adding the component resolves it. This clarifies the expected behavior for users who encounter stale recipe files.

## 0.1.4

### Publish metadata

- `homepage` now points at the deployed website, <https://thatg33k-t33.github.io/Seene/>, so
  npmjs.com shows the real site instead of the repository README.
- Bumped from `0.1.3` because npm metadata is immutable per version; this release carries the
  corrected `homepage` and `author` (Yonela Johannes, with THATG33K as contributor).

## 0.1.3

### Landing page

- The public home is now a static, server-free landing page (`src/platform/LandingView.tsx`) served
  from <https://thatg33k-t33.github.io/Seene/>. It renders the overview, capabilities, install,
  workflow and project credits without needing the local platform server.
- **Removed all authentication.** The Sign In / Sign Up forms, their CTAs, the `#/login` and
  `#/signup` routes and the `seene-account` localStorage state are gone. `AuthView.tsx` is deleted.
  Primary calls to action are now Get started, View on GitHub, npm package, Docs and Examples.
- Navigation and the command palette link to real destinations instead of placeholder hash routes.
- Replaced the duplicated marketing sections in the project console; `ProjectsView` is now only the
  local studio and explains itself when opened on a static host.
- Added SEO and Open Graph metadata, a canonical URL, a `<noscript>` fallback and a generated
  1200x630 social image, all static in `index.html`.
- Dark is now the default appearance with light kept as an explicit `prefers-color-scheme: light`
  opt-in, matching the project's cinematic direction.
- Removed the unused 1.7 MB `public/thatg33k.png`.

### Deployment

- Added `.github/workflows/pages.yml`: builds the static site on pushes to `main` and deploys it to
  GitHub Pages. It is fully separate from the npm publish workflow.
- Added `vite.pages.config.ts` and `pnpm build:pages`. The Pages build uses the `/Seene/` base path
  and excludes the dev-server-only platform plugin. Routing is hash-based, so no SPA rewrite or
  404 fallback is required.

### Identity and attribution

- `src/core/branding.ts` is the single source of truth for identity and links: product **Seene**,
  organization **THATG33K**, maintainer **Yonela Johannes**, plus canonical repository, npm, docs,
  examples and issues URLs.
- npm `author` is now **Yonela Johannes** (<https://github.com/Yonela-Johannes>) with THATG33K listed
  as contributor, matching the repository's actual sole author and admin.
- Landing page and footer credit Yonela Johannes and link to their GitHub profile.

### Fix: publishing is unblocked

- `scripts/release.mjs` no longer requires `package-lock.json`. It accepts the committed `pnpm-lock.yaml` (or an npm lockfile) so releases install reproducibly. This was the hard failure behind every red `Publish npm package` run.
- `npm pack --json` output is normalized across npm versions; npm >= 10 returns an object keyed by package name, which previously made the artifact count `undefined`.
- The packed-file allowlist accepts `.css`, so the published `./style.css` export no longer fails validation. Plain string exports are also handled correctly instead of throwing on a missing `types` condition.
- `package.json` `repository`/`homepage`/`bugs` now match the real GitHub remote (`thatg33k-t33/Seene`), so CI's repository assertion passes.
- The publish workflow installs with `pnpm install --frozen-lockfile` (the lockfile actually committed) instead of `npm ci`, which demanded a `package-lock.json` that does not exist.

### Fix: package size

- The library and CLI builds set `publicDir: false`, so the platform site's imagery is no longer copied into the npm package. The tarball drops from ~4.07 MB to ~220 KB (-94.6%); those PNGs were 82.6% of the package and are unreachable from package exports.

### Install: one command

- `seene init` now installs `@thatg33k/seene` from the registry at the exact running CLI version when it is not already present, so `npx @thatg33k/seene init` is a true single step. `--package <tarball>` still takes precedence for local builds and offline use.
- A failed auto-install now reports `install-failed` with the real cause and the exact command to retry, instead of collapsing into a generic project error.
- Generated `SEENE.md` instructions and CLI messages use the consumer's own package manager (`npx`, `pnpm exec`, `yarn` or `bunx`) rather than assuming pnpm.

### Fix

- `ProjectsView`: the "Register project" button referenced a non-existent `SenteButton` component, breaking the build once uncommented.

### Preview / Runtime

- **Fix**: Bridge heartbeat keep-alive now sends periodic `SEENE_STUDIO_PING` every 10s and retries `SEENE_CLIENT_HELLO` every 2s, preventing "Not connected" after 15s of inactivity.
- **Fix**: `ScenePreview` now correctly returns its JSX (was missing `return` statement, returning `undefined`).
- **Fix**: `SceneLibrary` checks `SelectedComponent` for document-level content (`<html>`, `RootLayout`) before rendering; falls back to `ApplicationPreview` (iframe) to preserve document boundaries.
- **Fix**: `ProjectPreview` already detects document content in children via `containsDocumentContent` and routes to `ApplicationPreview` with `route="/"`.
- **Add**: `SEENE_CLIENT_APPLICATION_ERROR` — preview runtime reports application crashes (e.g. Stripe misconfiguration) to the Studio via the bridge, surfacing them as inline notices.
- **Add**: `SEENE_CLIENT_CREATE_SCENE` — preview can request scene creation through the bridge; Studio responds with `SEENE_STUDIO_SCENE_CREATED`.

### Platform site

- **Redesign**: Complete zed.dev-style redesign — CSS variable design tokens, `FrameSection` with rails and corner nodes, `SeeneButton` with primary/secondary/ghost variants and `Kbd` chips.
- **Fix**: "Register project" button now uses `SenteButton` component instead of raw class strings.
- **Fix**: Hardcoded hex colors replaced with CSS variables across `StudioView`, `SettingsView`, `CreateSceneDialog`, `SceneLibrary`, `GettingStarted`, `SceneInspector`, and `BrandAttribution` for proper light/dark mode support.
- **Add**: `SiteHeader` — sticky header with primary/mobile navigation and a command palette.
- **Add**: `useSiteShortcuts` — `I` scrolls to install and Ctrl/Cmd+K opens the command menu.

### CLI

- `seene init` now supports Next.js App Router with automatic `app/seene/page.jsx` integration.
- `seene open --url` opens the Studio pre-connected to the running app.
- `seene scenes --json` reads the scene catalog as JSON.

### Publish

- GitHub Actions workflow (`.github/workflows/publish.yml`) now supports both OIDC trusted publishing and `NPM_TOKEN` secret fallback. Added `workflow_dispatch` with optional `npm_token` input for manual publishes with an automation token. The npm authentication step runs after the registry status check so the "skip if already published" step doesn't need credentials.
- `prepublishOnly` hook runs full `verify:release` before publishing.
