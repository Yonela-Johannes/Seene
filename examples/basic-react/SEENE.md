# Seene by THATG33K
https://yonela-johannes.github.io/Seene/seene/
## This example host

This is a standard Vite + React DOM project. Seene init connects the existing React root and creates `src/seene/ProjectPreview.tsx`; it does not replace the Vite config or React plugin. Run the host with its own `pnpm dev` command, then open it with `pnpm exec seene open --url http://localhost:5173`.

To let Studio create recipe/component files through Vite's dev server, add `seeneCreateScenePlugin()` from `@thatg33k/seene/vite` to the existing Vite `plugins` array while retaining the React plugin.

## Authoring

Create `src/seene/scenes/<id>.scene.json` and one matching `<id>.tsx` or `<id>.jsx` default-exported React component directly in the scenes directory. The lowercase recipe ID must match both filenames, and the component's `Surface` IDs must match the recipe's scene nodes.

Use `pnpm exec seene scenes --json` to inspect validated recipes and `pnpm exec seene validate` to verify the connection. Vite's development glob discovers file additions and updates without `seene sync`.

Run `pnpm exec seene guide --json` for the installed package's complete schema and authoring contract.
