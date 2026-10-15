# Website Walkthrough Notes

This file records the current implementation boundary for Website Walkthrough. It replaces the earlier Phase 2 checklist, which overstated coverage and listed tests that are no longer present.

## Current behavior

- Studio creation offers `Website Walkthrough` alongside `Single Scene`.
- Selected project-local component modules are imported into the generated scene component in the chosen order. The renderer uses live React components, not a screenshot list or a separate rendering engine.
- `WebsiteWalkthrough` accepts children or explicit ordered section definitions. Its optional timeline API accepts controlled `seekTime`, `duration`, `isPlaying` and callbacks. Explicit section geometry is measured from rendered DOM elements.
- `websiteTimeline.ts` maps section boundaries and elapsed time deterministically. Section durations, pauses, seeks and scene track times are milliseconds.
- ScenePreview's `Scene` and `Scroll` controls select preview composition modes. They are distinct from the Create Scene `Single Scene` / `Website Walkthrough` options.

## Limits

Generated selected-component scaffolds do not assign per-section durations or automatically connect the sections to the cinematic Scene timeline. Use the `WebsiteWalkthrough` controlled timeline API explicitly when authoring that integration; do not claim every generated walkthrough is synchronized automatically.

Walkthrough sections are normal React DOM content, so their supported CSS, assets and client interactions remain in the host application. Server-only modules and async Server Components cannot be imported into the client scene catalog. Layout and scroll height depend on the selected components and their CSS; Seene does not synthesize missing sections.

## Source and verification

- Component and props: `src/preview/WebsiteWalkthrough.tsx`
- Section wrapper: `src/preview/WebsiteSection.tsx`
- Discovery: `src/preview/sectionDiscovery.ts`
- Timeline math: `src/preview/websiteTimeline.ts`
- Scaffold generation: `src/core/platform.ts`
- Creation/reopen coverage: `tests/project/walkthrough-creation.test.ts`, `tests/preview/scene-management-and-walkthrough.test.tsx`, and `tests/preview/website-walkthrough.test.tsx`

Run `npm run test:launch` and `npm run test:core` for source and timeline checks. Complete generated-walkthrough browser verification should confirm selected components, natural scroll height, play/pause/seek behavior and reopening in a real host app.
