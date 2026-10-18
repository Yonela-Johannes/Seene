# Seene Product

Seene is a local scene studio for presenting real React DOM interfaces with camera perspective, focus and keyframed motion. Scene recipes and React components remain editable project files. Seene does not provide a cloud service, account, template generator or autonomous AI authoring service.

## Developer workflow

Initialize a React 18.2/19 project with Node.js 22.12 or later. Standard Vite and Next.js App/Pages Router projects receive generated development integrations. Other React DOM projects receive a wrapper that must be mounted by the developer. The host project continues to own its server, routes, providers, styles and production app.

Scenes are source pairs under `src/seene/scenes`: a validated `.scene.json` recipe and one matching `.tsx` or `.jsx` component. The local catalog discovers these pairs. The Studio can discover project-local components, create a single scene or an ordered Walkthrough, edit definitions, preview playback and request scene file changes through the host's development API. Creating a Walkthrough writes a versioned walkthrough document into the recipe and tags the generated scaffold sections with stable Seene IDs so nodes can target real components.

Vite discovery and preview work through the generated development glob. Creating, updating and deleting scene files through Vite Studio additionally requires `seeneCreateScenePlugin()` in the host's existing Vite plugins. Next initialization generates its local API route. Manual React DOM hosts must mount the generated wrapper and cannot use file-changing Studio actions without a host endpoint.

## Composition and playback

## Walkthrough authoring

A walkthrough is a versioned document of connected nodes: start, show, scroll, focus, highlight, click, wait, camera, transition, caption and end. `next` is authoritative for execution order and the node list is the editor's storage order; Seene repairs the chain from `start`, keeps unreachable nodes so validation can report them, and rejects cycles, dangling pointers and missing targets. Recipes created before walkthroughs existed have no document and keep the legacy `WebsiteWalkthrough` path; converting them is an explicit action, never a silent rewrite.

The Walkthrough Studio is one editor: a viewport, a connected sequence canvas, a single timeline and a settings inspector. Selecting a node seeks to it; play, pause, restart, step, scrub and single-step all read the same frame evaluator, so preview duration always equals export duration and backward seeking restores the earlier state. Global settings (title, resolution, frame rate, default transition/easing/camera/focus, background, playback, export) are shown alongside per-node overrides, which win where both are set.

Nodes target real React components and elements through stable Seene attributes rather than fragile CSS, text or coordinates. Show and scroll steps move the real scroll container; highlight outlines the measured element; click and wait steps perform a real interaction and verify the resulting UI state with a timeout, so a step fails clearly instead of animating a no-op. Non-deterministic interactions are reported as errors rather than silently skipped. Export captures the whole walkthrough as one continuous MP4 through the existing local pipeline; there is no per-node stitching.

`Scene` owns camera, focus and surface transforms. `Surface` registers a real React subtree against a scene node. Motion tracks target camera, focus or surface properties in milliseconds. Scene playback and seeking use a shared elapsed-time clock; browser preview cadence follows the browser and is not a fixed 60 FPS guarantee.

The exported `WebsiteWalkthrough` component keeps its separate optional controlled timeline API for callers that provide section timing and control props. The preview's `Scene` and `Scroll` buttons select a composition view; they are not the creation-mode selector.

Camera/focus controls use scene coordinates and an approximate DOM blur model. `maxBlur` bounds the optical blur; this is not ray tracing or aperture-shaped bokeh. Host components should be client-compatible, preserve their providers and put visual content inside registered `Surface` leaves.

## Export and limits

The CLI captures the registered scene from a running loopback host and encodes MP4 with local FFmpeg. Supported frame rates are 30, 60 and 120 FPS; the capture duration is limited to 120 seconds. Output is a project-relative `.mp4`; dimensions are even integers between 64 and 3840, and quality is FFmpeg CRF 0–51. Chromium and FFmpeg are local prerequisites. Seene does not start the host app server.

React Native without a DOM is unsupported. Next.js Server Components and server-only modules cannot be imported into the client scene catalog. The host app's data loading, authentication, network exposure and production security remain host responsibilities. See [README](../README.md) for setup and [architecture](architecture.md) for implementation ownership.
