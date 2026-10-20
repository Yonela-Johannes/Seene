export const SEENE_BRAND = Object.freeze({
  name: "Seene",
  tagline: "Cinematic scenes for real React interfaces.",
  creator: "THATG33K",
  maintainer: "Yonela Johannes",
  title: "Seene by THATG33K",
  url: "https://yonela-johannes.github.io/Seene/seene/",
  organization: "https://github.com/thatg33k-t33",
  repository: "https://github.com/Yonela-Johannes/Seene",
  npm: "https://www.npmjs.com/package/@thatg33k/seene",
  docs: "https://github.com/Yonela-Johannes/Seene#readme",
  examples: "https://github.com/Yonela-Johannes/Seene/tree/main/examples",
  issues: "https://github.com/Yonela-Johannes/Seene/issues",
  demo: "https://yonela-johannes.github.io/Seene/seene/tests/preview/walkthrough-fixture.html?seene-mode=scroll",
  license: "MIT",
  packageName: "@thatg33k/seene",
  maintainerProfile: "https://github.com/Yonela-Johannes",
  maintainerSite: "https://yonela-johannes.vercel.app",
});

/** Install the package with npm first, then run the CLI from the project root. Seene is never
 * fetched with `npx`, so the version in `package.json` is the one the project actually uses. */
export const SEENE_NPM_INSTALL_COMMAND = `npm install ${SEENE_BRAND.packageName}`;
export const SEENE_INIT_COMMAND = `npx ${SEENE_BRAND.packageName} init`;
export const SEENE_INSTALL_COMMAND = `${SEENE_NPM_INSTALL_COMMAND}\n${SEENE_INIT_COMMAND}`;
