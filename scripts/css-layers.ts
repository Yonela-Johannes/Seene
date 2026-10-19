
export const DEFAULT_LAYER_PREFIX = "seene-";

const AT_LAYER = /^@layer(?![-\w])/;

export function namespaceCssLayers(css: string, prefix: string = DEFAULT_LAYER_PREFIX): string {
  if (!css.includes("@layer")) return css;
  let output = "";
  let index = 0;
  while (index < css.length) {
    const character = css[index];
    if (character === '"' || character === "'") {
      // Copy string literals (data URIs, content values) verbatim so `@layer` text inside is untouched.
      let end = index + 1;
      while (end < css.length && css[end] !== character) end += css[end] === "\\" ? 2 : 1;
      end = Math.min(end + 1, css.length);
      output += css.slice(index, end);
      index = end;
      continue;
    }
    if (character === "/" && css[index + 1] === "*") {
      const close = css.indexOf("*/", index + 2);
      const end = close === -1 ? css.length : close + 2;
      output += css.slice(index, end);
      index = end;
      continue;
    }
    if (/^url\(/i.test(css.slice(index, index + 4)) && !/[\w-]/.test(css[index - 1] ?? "")) {
      // Unquoted url() tokens may embed `@layer` text; copy them verbatim up to the closing paren.
      let end = index + 4;
      while (end < css.length) {
        const inner = css[end];
        if (inner === '"' || inner === "'") {
          end += 1;
          while (end < css.length && css[end] !== inner) end += css[end] === "\\" ? 2 : 1;
          end = Math.min(end + 1, css.length);
          continue;
        }
        if (inner === ")") { end += 1; break; }
        end += 1;
      }
      output += css.slice(index, end);
      index = end;
      continue;
    }
    if (character === "@" && AT_LAYER.test(css.slice(index, index + 7))) {
      let cursor = index + "@layer".length;
      while (cursor < css.length && css[cursor] !== "{" && css[cursor] !== ";") cursor += 1;
      const prelude = css.slice(index + "@layer".length, cursor);
      const terminator = cursor < css.length ? css[cursor] : "";
      output += `@layer${namespacePrelude(prelude, prefix)}${terminator}`;
      index = cursor + (terminator ? 1 : 0);
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

function namespacePrelude(prelude: string, prefix: string): string {
  return prelude
    .split(",")
    .map((entry) => {
      const name = entry.trim();
      if (!name || name.startsWith(prefix)) return entry;
      const leading = entry.slice(0, entry.length - entry.trimStart().length);
      const trailing = entry.slice(entry.trimEnd().length);
      return `${leading}${prefix}${name}${trailing}`;
    })
    .join(",");
}
