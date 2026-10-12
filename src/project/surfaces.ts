import ts from "typescript";

export type SurfaceScanResult = {
  literalIds: Set<string>;
  unverifiableReason?: string;
};

export function extractSurfaceIds(source: string, filename: string): SurfaceScanResult {
  const literalIds = new Set<string>();
  let unverifiableReason: string | undefined;

  const surfaceTagNames = new Set<string>(["Surface"]);
  const localComponents = new Set<string>();

  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  // First pass: inspect imports
  const scanImports = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const modulePath = node.moduleSpecifier.text;
      // Skip type-only imports
      if (node.importClause?.isTypeOnly) return;

      if (modulePath === "@thatg33k/seene") {
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          for (const spec of node.importClause.namedBindings.elements) {
            if (spec.isTypeOnly) continue;
            const propertyName = spec.propertyName ? spec.propertyName.text : spec.name.text;
            if (propertyName === "Surface") {
              surfaceTagNames.add(spec.name.text);
            }
          }
        }
      } else if (modulePath.startsWith(".") || modulePath.startsWith("@/")) {
        // Record non-type local imports
        if (node.importClause) {
          if (node.importClause.name) {
            localComponents.add(node.importClause.name.text);
          }
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (const spec of node.importClause.namedBindings.elements) {
                if (!spec.isTypeOnly) {
                  localComponents.add(spec.name.text);
                }
              }
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              localComponents.add(node.importClause.namedBindings.name.text);
            }
          }
        }
      }
    }
    ts.forEachChild(node, scanImports);
  };
  scanImports(file);

  // Second pass: inspect JSX tags
  const walk = (node: ts.Node) => {
    if (unverifiableReason) return;

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;

      // Check for member-expression Surface e.g. <Seene.Surface>
      if (ts.isPropertyAccessExpression(tag) && tag.name.text === "Surface") {
        unverifiableReason = `Uses member expression Surface (${tag.getText(file)}).`;
        return;
      }

      // Check if tag is a rendered local sub-component
      if (ts.isIdentifier(tag) && localComponents.has(tag.text)) {
        unverifiableReason = `Renders locally imported component (<${tag.text} />).`;
        return;
      }

      // Check if tag is a Surface element
      if (ts.isIdentifier(tag) && surfaceTagNames.has(tag.text)) {
        let hasSpread = false;
        let idVal: string | undefined;

        for (const attr of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attr)) {
            hasSpread = true;
            break;
          }
          if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && attr.name.text === "id") {
            if (attr.initializer) {
              if (ts.isStringLiteral(attr.initializer)) {
                idVal = attr.initializer.text;
              } else if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isStringLiteral(attr.initializer.expression)) {
                idVal = attr.initializer.expression.text;
              }
            }
          }
        }

        if (hasSpread) {
          unverifiableReason = "Uses spread attributes on Surface.";
          return;
        }

        if (idVal !== undefined) {
          literalIds.add(idVal);
        } else {
          unverifiableReason = "Uses dynamic computed ID on Surface.";
          return;
        }
      }
    }

    ts.forEachChild(node, walk);
  };

  walk(file);
  return { literalIds, unverifiableReason };
}
