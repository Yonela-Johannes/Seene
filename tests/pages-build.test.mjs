import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist-pages");
const base = process.env.SEENE_PAGES_BASE ?? "/Seene/seene/";
// User content without a trailing slash (`/Seene/seene`); the base itself always ends in `/`.
const baseRoot = base.endsWith("/") ? base.slice(0, -1) : base;
const origin = "https://pages.invalid";

function resolveOutputResource(source, from, description) {
  const url = new URL(source, `${origin}${base}${from}`);
  if (url.origin !== origin) return undefined;
  assert.ok(url.pathname.startsWith(base), `${description} must stay under ${base}: ${url.pathname}`);
  const relative = decodeURIComponent(url.pathname.slice(base.length));
  const file = path.resolve(output, relative);
  assert.ok(file.startsWith(`${output}${path.sep}`), `${description} resolves outside the Pages output`);
  assert.ok(existsSync(file), `${description} is missing from the Pages output: ${url.pathname}`);
  return file;
}

function htmlReferences(html) {
  const references = [];
  for (const tag of html.matchAll(/<(?:script|link|img|source)\b[^>]*>/gi)) {
    for (const attribute of tag[0].matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
      references.push(attribute[2]);
    }
  }
  return references;
}

function inspectCss(file, visited) {
  if (visited.has(file)) return;
  visited.add(file);
  const css = readFileSync(file, "utf8");
  const relative = path.relative(output, file).split(path.sep).join("/");
  for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    const source = match[2].trim();
    if (!source || /^(?:data:|https?:|#)/i.test(source)) continue;
    const asset = resolveOutputResource(source, relative, "CSS resource");
    if (asset?.endsWith(".css")) inspectCss(asset, visited);
  }
}

function verifyManifestEntry(key, manifest, visited, graph) {
  if (visited.has(key)) return;
  visited.add(key);
  const entry = manifest[key];
  assert.ok(entry, `Vite manifest is missing dependency ${key}`);
  const files = [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])].filter(Boolean);
  for (const relative of files) {
    const file = path.resolve(output, relative);
    assert.ok(file.startsWith(`${output}${path.sep}`), `manifest asset resolves outside Pages output: ${relative}`);
    assert.ok(existsSync(file), `manifest asset is missing from Pages output: ${relative}`);
    if (file.endsWith(".js")) graph.push(readFileSync(file, "utf8"));
    if (file.endsWith(".css")) inspectCss(file, new Set());
  }
  for (const dependency of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) {
    verifyManifestEntry(dependency, manifest, visited, graph);
  }
}

test("GitHub Pages output contains the base-prefixed homepage and walkthrough resource graph", () => {
  const homepagePath = path.join(output, "index.html");
  const fixtureRelative = "tests/preview/walkthrough-fixture.html";
  const fixturePath = path.join(output, fixtureRelative);
  assert.ok(existsSync(homepagePath), "homepage HTML must be emitted");
  assert.ok(existsSync(fixturePath), "walkthrough fixture HTML must be emitted at its public route");
  for (const asset of ["favicon.svg", "logo-seene.png", "og-image.png"]) {
    assert.ok(existsSync(path.join(output, asset)), `public asset ${asset} must be copied into the Pages output`);
  }

  const manifestPath = path.join(output, ".vite/manifest.json");
  assert.ok(existsSync(manifestPath), "Vite Pages manifest must be emitted for deployment verification");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const graph = [];
  const visited = new Set();
  for (const [htmlPath, relative, entryKey] of [
    [homepagePath, "index.html", "index.html"],
    [fixturePath, fixtureRelative, fixtureRelative],
  ]) {
    const html = readFileSync(htmlPath, "utf8");
    for (const reference of htmlReferences(html)) {
      resolveOutputResource(reference, relative, "HTML resource");
    }
    verifyManifestEntry(entryKey, manifest, visited, graph);
  }

  const bundle = graph.join("\n");
  assert.ok(bundle.includes(`${base}tests/preview/walkthrough-fixture.html?seene-mode=scroll`), "homepage demo link must preserve the query under the Pages base");
  for (const title of [
    "Every project deserved to be seen.",
    "Press record. Start scrolling.",
    "The work was good. The process wasn't.",
    "There had to be a better way.",
    "So I built Seene.",
    "Experience Seene",
  ]) assert.ok(bundle.includes(title), `walkthrough bundle is missing ${title}`);
  assert.ok(bundle.includes(`${baseRoot}/#install`), "walkthrough CTA must remain under the Pages base");
});
