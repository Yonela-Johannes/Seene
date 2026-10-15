# Product and Documentation Audit

Audit date: 2026-10-15. This snapshot describes package version 0.1.6 in the current worktree. It does not authorize or perform a release.

## Product boundaries

- The package exports its core React DOM API, `/preview`, `/style.css`, `/vite`, `/next`, and the `seene` CLI.
- Vite and Next.js App/Pages Router receive generated development integrations. Other React DOM hosts require a developer-mounted wrapper. React Native without a DOM is unsupported.
- Scene recipes and matching TSX/JSX components live directly in `src/seene/scenes`. Vite discovers them through a development glob; Next/manual catalogs are generated and synced with `seene sync` after file additions/removals.
- Vite file creation, updates and deletion require `seeneCreateScenePlugin()` in the host config. Next initialization generates its local API route. These are development endpoints; do not expose host development servers to untrusted networks.
- Website Walkthrough creation imports selected live components in order. Generated walkthrough scaffolds do not add per-section durations or automatically bind their timeline to the cinematic Scene timeline. The exported controlled timeline API is separate and must be configured by the caller.
- DOM depth of field is an approximation. MP4 export requires a running loopback host, Playwright Chromium and FFmpeg; it supports 30/60/120 FPS and captures no more than 120 seconds.

## Verification

Passed in this worktree:

- `npm run typecheck`
- `npm run build` (architecture checks, app, library/declarations and CLI)
- `npm run build:pages`
- `npm run test:core`: 182 tests
- `npm run test:react`: 49 tests
- `npm run test:launch`: 309 tests
- `npm run test:export`: 56 tests
- `npm run build:test && pnpm exec playwright test tests/browser/preview.spec.ts`: 5 browser tests
- `SEENE_VERIFY_HARDWARE=0 npm run test:library`: installed library creation/deletion, persistence, snapshots, reopening and MP4 export passed
- `npm run test:installed`: installed-tarball consumer workflow passed
- `npm run test:portable:react`, `npm run test:portable:app`, and `npm run test:portable:pages`: passed during the immediately preceding implementation verification
- CLI `--version`, `--help` and `guide --json`: passed; guide version 2 reports 11 concepts and 7 workflow steps
- The live homepage was checked at 1440, 390 and 320 CSS pixels; no browser console errors were observed and the document did not overflow the viewport.

## Limits and notes

- The optional library GPU/frame-budget measurement was unavailable: headless Chromium reported `disabled_software` instead of hardware compositing. The library E2E passed with only this benchmark disabled.
- The full browser suite's Next.js 14 fixture previously exceeded its 180-second setup timeout. The five homepage/preview browser specs pass; the Next.js 14 fixture was not rerun in this documentation task.
- `npm run build` emits a Vite warning that the module-level `use client` directive in `WebsiteWalkthrough.tsx` is ignored during bundling. The build and declaration generation complete successfully.
- No package publication or GitHub Pages deployment was performed.

For setup and developer-facing limits, see [README](README.md) and [product](docs/product.md). Implementation ownership is summarized in [architecture](docs/architecture.md); current Walkthrough scope is in [PH2_IMPLEMENTATION.md](PH2_IMPLEMENTATION.md).
