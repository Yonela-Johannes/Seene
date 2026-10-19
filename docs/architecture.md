# Seene Architecture

`docs/product.md` describes product behavior. This document maps its implementation boundaries.

## Authoring path

1. `src/project/commands.ts` detects the host, generates a Vite/Next/manual React connection, and preserves existing app entry/providers where possible.
2. Recipes are stored as `src/seene/scenes/<id>.scene.json` beside one matching `.tsx` or `.jsx` component. `src/project/discovery.ts` and `src/core/recipes.ts` validate catalog entries; Vite uses a development glob, while Next/manual integrations use the generated static catalog.
3. `src/core/platform.ts` owns scene defaults, scaffold generation and walkthrough tagging. `src/vite/scene-files.ts` owns project-local component discovery, safe source-pair writes/deletes, recipe updates, and regenerating a Seene walkthrough scaffold when its recipe changes.

## Runtime path

- `src/core/scene.ts`, `motion.ts`, `preview.ts`, `recipes.ts`, `walkthrough.ts` and `spatial.ts` own the canonical Zod contracts and deterministic evaluators. TypeScript types are derived from these schemas.
- `src/core/walkthrough.ts` owns the versioned walkthrough document, its validation, the timeline scheduler and the single frame evaluator. `walkthroughDuration` compiles authored camera/focus overrides into the canonical `MotionTrack` form so `evaluateMotion` remains the only motion engine.
- `src/preview/modules.tsx` loads scene modules and resolves recipes through the canonical catalog operation. `SceneLibrary.tsx` renders the virtualized scene list, creation/deletion UI and selected preview.
- `ScenePreview.tsx` owns the preview session, play/pause/replay/seek controls, camera/focus inspector, composition mode, capture registration and export command UI. When the active definition carries a walkthrough document it renders `WalkthroughStudio` in its place.
- `WalkthroughStudio.tsx` is the authoring shell: the connected sequence canvas, the unified timeline transport, the settings inspector, undo/redo, the component/section browser and autosave. `WalkthroughTimeline.tsx` is the single transport and `WalkthroughInspector.tsx` shows global settings or per-node overrides.
- `WalkthroughStage.tsx` renders the real scene subtree inside a scroll container and applies the evaluated frame: scroll, highlight, caption and interaction. `walkthroughRuntime.ts` binds frames to real DOM targets through stable Seene attributes, performs clicks and verifies the expected UI state with timeouts.
- `src/react/index.tsx` registers live `Surface` nodes and applies the evaluated transforms, opacity and leaf blur to the host React DOM tree.
- `WebsiteWalkthrough.tsx` renders real children or ordered explicit sections in a scroll viewport. `websiteTimeline.ts` maps section positions and elapsed time. The controlled timeline is opt-in; recipes without a walkthrough document keep this legacy path unchanged.
- `src/vite/seene-plugin.ts` serves Vite development endpoints for content discovery (`/__seene/content`) and scene create/update/delete. `src/vite/next-handler.ts` provides the Next API handlers; the generated Next Studio route is development-only. Next hosts receive matching `/api/seene/create-scene` and `/api/seene/content` routes, and the preview falls back to `GET /api/seene/create-scene` for installs generated before the content route existed.
- `src/vite/platform-plugin.ts` serves the local studio console API under `/__seene/platform`: project registration, project-local content discovery, scene create/update/delete and `/projects/sources/discover`. Discovery scans only the `?root=` folders it is given, or common project containers such as `~/Projects`, and returns folder names plus `package.json` facts such as framework, React version and package manager — never source. Every endpoint is loopback-guarded so the console stays on the developer's machine.
- `src/export/` and `src/cli/` own snapshot and MP4 export orchestration. The exporter seeks the live capture bridge at frame times and invokes local FFmpeg; it does not start the host server.

## Validation boundaries

The architecture tests enforce ownership between pure core logic, React DOM runtime, preview UI, project filesystem services, framework handlers and CLI effects. Browser tests cover rendered behavior; unit tests alone do not prove host styles, providers or visual fidelity. Local scene APIs are development tools: keep host development servers on trusted interfaces and do not expose them to untrusted networks. The host remains responsible for its own providers, data, authentication, routes and production security.

Public package exports are declared in `package.json`: the core entry, `/preview`, `/style.css`, `/vite`, and `/next`. The CLI is the `seene` binary in `dist/cli/`. The published `/style.css` is compiled by Tailwind v4, so `build:library` namespaces its `@layer` names (`base` becomes `seene-base`); hosts that compile CSS with Tailwind v3 through PostCSS otherwise reject `@layer base` for lack of a matching `@tailwind base` directive and fail the development-only Studio route.
