# Seene Architecture

`docs/product.md` describes product behavior. This document maps its implementation boundaries.

## Authoring path

1. `src/project/commands.ts` detects the host, generates a Vite/Next/manual React connection, and preserves existing app entry/providers where possible.
2. Recipes are stored as `src/seene/scenes/<id>.scene.json` beside one matching `.tsx` or `.jsx` component. `src/project/discovery.ts` and `src/core/recipes.ts` validate catalog entries; Vite uses a development glob, while Next/manual integrations use the generated static catalog.
3. `src/core/platform.ts` owns scene defaults and scaffold generation. `src/vite/scene-files.ts` owns project-local component discovery, safe source-pair writes/deletes, and recipe updates.

## Runtime path

- `src/core/scene.ts`, `motion.ts`, `preview.ts`, `recipes.ts` and `spatial.ts` own the canonical Zod contracts and deterministic evaluators. TypeScript types are derived from these schemas.
- `src/preview/modules.tsx` loads scene modules and resolves recipes through the canonical catalog operation. `SceneLibrary.tsx` renders the virtualized scene list, creation/deletion UI and selected preview.
- `ScenePreview.tsx` owns the preview session, play/pause/replay/seek controls, camera/focus inspector, composition mode, capture registration and export command UI.
- `src/react/index.tsx` registers live `Surface` nodes and applies the evaluated transforms, opacity and leaf blur to the host React DOM tree.
- `WebsiteWalkthrough.tsx` renders real children or ordered explicit sections in a scroll viewport. `websiteTimeline.ts` maps section positions and elapsed time. The controlled timeline is opt-in; generated walkthrough scaffolds currently do not assign section timing.
- `src/vite/seene-plugin.ts` serves Vite development endpoints for content discovery and scene create/update/delete. `src/vite/next-handler.ts` provides the Next API handlers; the generated Next Studio route is development-only.
- `src/export/` and `src/cli/` own snapshot and MP4 export orchestration. The exporter seeks the live capture bridge at frame times and invokes local FFmpeg; it does not start the host server.

## Validation boundaries

The architecture tests enforce ownership between pure core logic, React DOM runtime, preview UI, project filesystem services, framework handlers and CLI effects. Browser tests cover rendered behavior; unit tests alone do not prove host styles, providers or visual fidelity. Local scene APIs are development tools: keep host development servers on trusted interfaces and do not expose them to untrusted networks. The host remains responsible for its own providers, data, authentication, routes and production security.

Public package exports are declared in `package.json`: the core entry, `/preview`, `/style.css`, `/vite`, and `/next`. The CLI is the `seene` binary in `dist/cli/`.
