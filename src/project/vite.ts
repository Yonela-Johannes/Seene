import ts from "typescript";
import { fault } from "./errors";

const sceneModulesAttribute = `sceneModules={import.meta.env.DEV ? import.meta.glob("/src/seene/scenes/*.{scene.json,tsx}") : undefined}`;
const alias = "SeeneProjectPreview";
const moduleName = "@thatg33k/seene/preview";

export function generatedPreview(entry: string) {
  const path = "src/seene/ProjectPreview." + (entry.endsWith(".jsx") ? "jsx" : "tsx");
  if (entry === path) throw fault("conflict", "The application entry occupies Seene's preview adapter path.", path);
  const directory = entry.split("/").slice(0, -1);
  const target = path.replace(/\.[jt]sx$/, "").split("/");
  while (directory.length && directory[0] === target[0]) { directory.shift(); target.shift(); }
  const specifier = (directory.length ? "../".repeat(directory.length) : "./") + target.join("/");
  const typed = entry.endsWith(".tsx");
  const text = `import { ProjectPreview } from "@thatg33k/seene/preview";
import "@thatg33k/seene/style.css";
${typed ? 'import type { ComponentProps } from "react";\n' : ''}
const sceneModules = import.meta.env.DEV ? import.meta.glob("/src/seene/scenes/*.{scene.json,tsx,jsx}") : undefined;

export function SeeneProjectPreview(props${typed ? ': Omit<ComponentProps<typeof ProjectPreview>, "sceneModules" | "hot">' : ''}) {
  if (!import.meta.env.DEV) return props.children;
  return <ProjectPreview {...props} sceneModules={sceneModules} hot={import.meta.hot} />;
}
`;
  return { path, specifier, text };
}
export function extractSurfaceIds(source: string, filename: string): { literalIds: Set<string>; dynamicCount: number } {
  const literalIds = new Set<string>();
  let dynamicCount = 0;
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const walk = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)
      && (node.tagName.text === "Surface" || node.tagName.text === "Motion")) {
      const idAttr = node.attributes.properties.find(attr => ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && attr.name.text === "id");
      if (idAttr && ts.isJsxAttribute(idAttr) && idAttr.initializer) {
        if (ts.isStringLiteral(idAttr.initializer)) {
          literalIds.add(idAttr.initializer.text);
        } else if (ts.isJsxExpression(idAttr.initializer) && idAttr.initializer.expression && ts.isStringLiteral(idAttr.initializer.expression)) {
          literalIds.add(idAttr.initializer.expression.text);
        } else {
          dynamicCount++;
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
  return { literalIds, dynamicCount };
}

function unsupported(message: string): never { throw fault("unsupported-project", message); }
function parse(source: string, filename: string) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if ((file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length)
    unsupported("Fix source syntax errors before initializing Seene.");
  return file;
}
function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, child => walk(child, visit));
}
export function htmlEntry(html: string, devServer = false): string {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/<base\b/i.test(clean)) unsupported("HTML base elements are unsupported; use a root Vite entry.");
  const tags = [...clean.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi)];
  const entries: string[] = [];
  for (const tag of tags) {
    const attributes = [...tag[1].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)];
    if (/\btype\s*=/.test(tag[1]) && !attributes.some(item => item[1].toLowerCase() === "type"))
      unsupported("Use quoted script type attributes for an unambiguous Vite entry.");
    const types = attributes.filter(item => item[1].toLowerCase() === "type");
    const sources = attributes.filter(item => item[1].toLowerCase() === "src");
    if (types.length === 1 && types[0][3] === "module") {
      if (devServer && sources.length === 1 && sources[0][3] === "/@vite/client") continue;
      if (devServer && !sources.length && /import\s+(?:RefreshRuntime|\{\s*injectIntoGlobalHook\s*\})\s+from\s+[\'"]\/@react-refresh[\'"]/.test(tag[0])) continue;
      if (sources.length !== 1) unsupported("Use one external TSX or JSX module in index.html.");
      entries.push(devServer ? sources[0][3].replace(/\?t=\d+$/, "") : sources[0][3]);
    }
  }
  if (entries.length !== 1 || !/^\/?[\w./-]+\.(tsx|jsx)$/.test(entries[0]))
    unsupported("Use one unambiguous TSX or JSX module entry in index.html.");
  return entries[0].replace(/^\//, "");
}
export function inspectConfig(source: string, filename: string) {
  const file = parse(source, filename);
  const imports = new Map<string, string>();
  const reactPlugins = ["@vitejs/plugin-react", "@vitejs/plugin-react-swc"];
  const bind = (local: string, imported: string) => {
    if (local === "__dirname" || imports.has(local)) unsupported("Ambiguous Vite config import binding.");
    imports.set(local, imported);
  };
  let config: ts.Expression | undefined;
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const name = statement.moduleSpecifier.text;
      if (!["vite", ...reactPlugins, "@tailwindcss/vite", "@thatg33k/seene/vite", "path", "node:path"].includes(name))
        unsupported("Custom Vite config imports require manual adaptation.");
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly || statement.attributes) unsupported("Unsupported Vite config import.");
      if (name === "vite") {
        if (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)
          || clause.namedBindings.elements.length !== 1) unsupported("Import defineConfig by name from Vite.");
        for (const binding of clause.namedBindings.elements) {
          if (binding.isTypeOnly || (binding.propertyName ?? binding.name).text !== "defineConfig") unsupported("Unsupported Vite config import.");
          bind(binding.name.text, "vite:defineConfig");
        }
      } else if (name === "@thatg33k/seene/vite") {
        if (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)
          || clause.namedBindings.elements.length !== 1) unsupported("Import seeneCreateScenePlugin by name from @thatg33k/seene/vite.");
        const binding = clause.namedBindings.elements[0];
        if (binding.isTypeOnly || (binding.propertyName ?? binding.name).text !== "seeneCreateScenePlugin")
          unsupported("Import seeneCreateScenePlugin by name from @thatg33k/seene/vite.");
        bind(binding.name.text, "seene:create-scene");
      } else {
        if (!clause.name || clause.namedBindings) unsupported("Use default imports for supported Vite plugins and path.");
        bind(clause.name.text, name);
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals && !config) config = statement.expression;
    else unsupported("Use a static Vite defineConfig object; dynamic config requires manual adaptation.");
  }
  if (config && ts.isCallExpression(config) && ts.isIdentifier(config.expression)
    && imports.get(config.expression.text) === "vite:defineConfig" && config.arguments.length === 1)
    config = config.arguments[0];
  if (!config || !ts.isObjectLiteralExpression(config)) unsupported("Use a static Vite config object.");
  const seen = new Set<string>();
  let reactPluginCount = 0;
  const pluginCounts = new Map<string, number>();
  for (const property of config.properties) {
    if (!ts.isPropertyAssignment(property) || !property.name
      || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) unsupported("Computed/spread Vite configuration is unsupported.");
    const key = property.name.text;
    if (seen.has(key)) unsupported("Duplicate Vite configuration keys are ambiguous.");
    seen.add(key);
    if (key === "root" || key === "base") {
      if (!ts.isStringLiteral(property.initializer)
        || !(key === "base" ? ["/"] : [".", "./"]).includes(property.initializer.text))
        unsupported("Only a single project root with Vite base '/' is supported.");
    } else if (key === "plugins") {
      if (!ts.isArrayLiteralExpression(property.initializer)) unsupported("Use a literal Vite plugin array.");
      for (const plugin of property.initializer.elements) {
        if (!ts.isCallExpression(plugin) || !ts.isIdentifier(plugin.expression) || plugin.arguments.length !== 0)
          unsupported("Use direct, zero-option calls to the standard React and supported Vite plugins.");
        const imported = imports.get(plugin.expression.text);
        if (!imported || ![...reactPlugins, "@tailwindcss/vite", "seene:create-scene"].includes(imported))
          unsupported("Use only imported standard React, Tailwind, and Seene Vite plugins.");
        const count = (pluginCounts.get(imported) ?? 0) + 1;
        pluginCounts.set(imported, count);
        if (count > 1) unsupported("Do not configure duplicate Vite plugins.");
        if (reactPlugins.includes(imported)) reactPluginCount++;
      }
    }
  }
  if (reactPluginCount !== 1) unsupported("Configure exactly one standard React Vite plugin for the TSX scene integration.");
}
export function inspectEntry(source: string, filename: string, projectId: string) {
  const file = parse(source, filename);
  const adapter = generatedPreview(filename);
  const canonicalSpecifier = adapter.specifier;
  let previewImport: ts.ImportDeclaration | undefined;
  let previewLocal: string | undefined;
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier !== canonicalSpecifier && specifier !== "@thatg33k/seene/preview") continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings))
      unsupported("Import the Seene preview as a runtime named export.");
    const binding = clause.namedBindings.elements.find(item =>
      (item.propertyName ?? item.name).text === (specifier === canonicalSpecifier ? "SeeneProjectPreview" : "ProjectPreview"),
    );
    if (!binding || binding.isTypeOnly) unsupported("Import the Seene preview as a runtime named export.");
    if (previewImport) unsupported("Use one Seene preview import in the React entry.");
    previewImport = statement;
    previewLocal = binding.name.text;
  }
  if (previewImport && previewLocal) {
    const openings: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
    let closings = 0;
    let strayIdentifier = false;
    walk(file, node => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && ts.isIdentifier(node.tagName) && node.tagName.text === previewLocal) openings.push(node);
      if (ts.isJsxClosingElement(node) && ts.isIdentifier(node.tagName) && node.tagName.text === previewLocal) closings++;
      if (ts.isIdentifier(node) && node.text === previewLocal) {
        const isImported = ts.isImportSpecifier(node.parent) && node.parent.name === node;
        const isJsxTag = (ts.isJsxOpeningElement(node.parent) || ts.isJsxSelfClosingElement(node.parent)
          || ts.isJsxClosingElement(node.parent)) && node.parent.tagName === node;
        if (!isImported && !isJsxTag) strayIdentifier = true;
      }
    });
    if (openings.length !== 1 || closings !== 1 || ts.isJsxSelfClosingElement(openings[0]) || strayIdentifier)
      unsupported("Keep one unshadowed Seene preview wrapper around the existing React root.");
    const opening = openings[0] as ts.JsxOpeningElement;
    const attributes = opening.attributes.properties;
    const projectAttribute = attributes.find(attribute => ts.isJsxAttribute(attribute)
      && ts.isIdentifier(attribute.name) && attribute.name.text === "projectId");
    const enabledAttribute = attributes.find(attribute => ts.isJsxAttribute(attribute)
      && ts.isIdentifier(attribute.name) && attribute.name.text === "enabled");
    const enabledExpression = enabledAttribute && ts.isJsxAttribute(enabledAttribute)
      && enabledAttribute.initializer && ts.isJsxExpression(enabledAttribute.initializer)
      ? enabledAttribute.initializer.expression?.getText(file)
      : undefined;
    if (!projectAttribute || !ts.isJsxAttribute(projectAttribute) || !projectAttribute.initializer
      || !ts.isStringLiteral(projectAttribute.initializer) || enabledExpression !== "import.meta.env.DEV")
      unsupported("Preserve the development-only Seene preview gate and project identity.");
    const replacements = [
      { start: previewImport.getStart(file), end: previewImport.end, text: `import { SeeneProjectPreview } from ${JSON.stringify(canonicalSpecifier)};` },
      { start: opening.getStart(file), end: opening.end, text: `<SeeneProjectPreview projectId=${JSON.stringify(projectId)} enabled={import.meta.env.DEV}>` },
    ].sort((a, b) => b.start - a.start);
    let text = source;
    for (const replacement of replacements)
      text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end);
    return { integrated: true, alreadyIntegrated: true, text, projectId };
  }
  if (source.includes("SeeneProjectPreview"))
    unsupported("Seene preview wrapper import and JSX usage do not match.");
  const createRootBindings = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== "react-dom/client") continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings))
      unsupported("Import createRoot as a runtime named export from react-dom/client.");
    for (const binding of clause.namedBindings.elements) {
      if ((binding.propertyName ?? binding.name).text !== "createRoot") continue;
      if (binding.isTypeOnly) unsupported("createRoot must be imported as a runtime value.");
      createRootBindings.add(binding.name.text);
    }
  }
  if (!createRootBindings.size) unsupported("Import createRoot as a runtime named export from react-dom/client.");
  const importLine = `import { SeeneProjectPreview } from ${JSON.stringify(canonicalSpecifier)};\n`;
  let elementStart = -1, elementEnd = -1;
  walk(file, node => {
    if (ts.isCallExpression(node) && node.expression.getText(file).endsWith(".render") && node.arguments.length > 0) {
      const arg = node.arguments[0];
      elementStart = arg.getStart(file);
      elementEnd = arg.getEnd();
    }
  });
  if (elementStart === -1) unsupported("Could not locate createRoot().render(...) in entry file.");
  const originalElement = source.slice(elementStart, elementEnd);
  const wrappedElement = `<SeeneProjectPreview projectId=${JSON.stringify(projectId)} enabled={import.meta.env.DEV}>{${originalElement}}</SeeneProjectPreview>`;
  const wrappedSource = source.slice(0, elementStart) + wrappedElement + source.slice(elementEnd);
  let importPosition = 0;
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    importPosition = statement.end;
  }
  const text = wrappedSource.slice(0, importPosition) + (importPosition ? "\n" : "") + importLine + wrappedSource.slice(importPosition);
  return { integrated: true, alreadyIntegrated: false, text, projectId };
}
