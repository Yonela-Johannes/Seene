import type { ProjectState } from "../core/project";

export function portableIntegration(project: ProjectState, catalog: string): Record<string,string> {
  const files: Record<string,string> = {
    "src/seene/catalog.js": catalog,
    "src/seene/ProjectPreview.jsx": `// @seene-scaffold-version 1
"use client";
import React from "react";
import { ProjectPreview } from "@thatg33k/seene/preview";
import "@thatg33k/seene/style.css";
import { sceneModules } from "./catalog";
export function SeeneProjectPreview({ children, enabled, active, ...props }) {
  if (!enabled) return children;
  return <ProjectPreview {...props} projectId=${JSON.stringify(project.projectId)} enabled={enabled} active={active} sceneModules={sceneModules}>{children}</ProjectPreview>;
}
`,
  };
  if (project.adapter === "react") return files;
  files["src/seene/Studio.jsx"] = `// @seene-scaffold-version 1
"use client";
import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import "@thatg33k/seene/style.css";
const Preview = process.env.NODE_ENV === "development" ? dynamic(() => import("./ProjectPreview").then(m => m.SeeneProjectPreview), { ssr: false }) : () => null;
export default function SeeneStudio({ children }) {
  const [target, setTarget] = useState(null);
  const [theme, setTheme] = useState("dark");
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById("__next") || document.getElementById("root");
    const elements = [html, body, appRoot].filter(Boolean);
    const detectTheme = () => {
      for (const element of elements) {
        const value = element.getAttribute("data-theme") || element.getAttribute("data-color-scheme");
        if (value === "light" || element.classList.contains("light")) return "light";
        if (value === "dark" || element.classList.contains("dark")) return "dark";
      }
      return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
    };
    const updateTheme = () => setTheme(detectTheme());
    const observer = new MutationObserver(updateTheme);
    for (const element of elements) observer.observe(element, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-scheme"] });
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    media?.addEventListener?.("change", updateTheme);
    const htmlOverflow = html.style.overflow;
    const bodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    updateTheme();
    setTarget(body);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", updateTheme);
      html.style.overflow = htmlOverflow;
      body.style.overflow = bodyOverflow;
    };
  }, []);
  if (!target || process.env.NODE_ENV !== "development") return null;
  const palette = theme === "light" ? {
    "--seene-bg": "#ffffff", "--seene-surface": "#ffffff", "--seene-surface-2": "#f6f7f9",
    "--seene-border": "#e4e7ee", "--seene-border-text": "#c3c9d6", "--seene-text": "#12151c",
    "--seene-text-muted": "#5b6476", "--seene-accent": "hsl(219 93% 42%)", "--seene-accent-hover": "hsl(219 93% 35%)",
  } : {
    "--seene-bg": "hsl(219 92% 2%)", "--seene-surface": "#0d1119", "--seene-surface-2": "#141a26",
    "--seene-border": "#1d2637", "--seene-border-text": "#2b3a52", "--seene-text": "#eef1f6",
    "--seene-text-muted": "#9aa4b8", "--seene-accent": "hsl(219 90% 68%)", "--seene-accent-hover": "hsl(219 90% 74%)",
  };
  return createPortal(
    <div data-seene-studio-root="" data-seene-theme={theme} style={{ position: "fixed", inset: 0, zIndex: 2147483647, overflow: "hidden", background: "var(--seene-bg)", color: "var(--seene-text)", colorScheme: theme, ...palette }}>
      <Preview enabled active createSceneEndpoint="/api/seene/create-scene">{children}</Preview>
    </div>,
    target,
  );
}
`;
  const depth = project.entry.split("/").length - 1;
  const studio = "../".repeat(depth) + "src/seene/Studio";
  if (project.adapter === "next-app") {
    const appEntry = project.entry.startsWith("src/") ? project.entry.slice(4) : project.entry;
    files[project.entry] = `// @seene-scaffold-version 1
import React from "react";
import { notFound } from "next/navigation";
import SeeneStudio from ${JSON.stringify(studio)};
export default function SeenePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><meta name="seene-project" content=${JSON.stringify(project.projectId)} /><SeeneStudio /></>;
}
`;
    const routeDirectory = (project.entry.startsWith("src/") ? "src/" : "") + appEntry.slice(0, appEntry.lastIndexOf("/seene/page.jsx"));
    files[`${routeDirectory}/api/seene/create-scene/route.js`] = `// @seene-scaffold-version 1\nexport { GET, POST, PUT, DELETE } from "@thatg33k/seene/next";\nexport const runtime = "nodejs";\n`;
    files[`${routeDirectory}/api/seene/content/route.js`] = `// @seene-scaffold-version 1\nexport { GET } from "@thatg33k/seene/next";\nexport const runtime = "nodejs";\n`;
  } else {
    files[project.entry] = `// @seene-scaffold-version 1
import React from "react";
import SeeneStudio from ${JSON.stringify(studio)};
export function getServerSideProps() {
  return process.env.NODE_ENV === "development" ? { props: {} } : { notFound: true };
}
export default function SeenePage() {
  return <><meta name="seene-project" content=${JSON.stringify(project.projectId)} /><SeeneStudio /></>;
}
`;
    const pagesDirectory = project.entry.startsWith("src/") ? "src/pages" : "pages";
    files[`${pagesDirectory}/api/seene/create-scene.js`] = `// @seene-scaffold-version 1\nimport { createPagesHandler } from "@thatg33k/seene/next";\nexport const config = { api: { bodyParser: false } };\nexport default createPagesHandler;\n`;
    files[`${pagesDirectory}/api/seene/content.js`] = `// @seene-scaffold-version 1\nimport { createPagesHandler } from "@thatg33k/seene/next";\nexport const config = { api: { bodyParser: false } };\nexport default createPagesHandler;\n`;
  }
  return files;
}

export function portableCatalog(entries: {source:string;binding:string}[]): string {
  const imports = entries.map((entry,index) => `import recipe${index} from ${JSON.stringify("./scenes/" + entry.source.split("/").pop())};`);
  const mappings = entries.flatMap((entry,index) => [
    `  ${JSON.stringify(entry.source)}: async () => ({default:recipe${index}}),`,
    `  ${JSON.stringify(entry.binding)}: () => import(${JSON.stringify("./scenes/" + entry.binding.split("/").pop()?.replace(/\.[jt]sx$/, ""))}),`,
  ]);
  return "// @seene-scaffold-version 1\n" + imports.join("\n") + "\nexport const sceneModules = {\n" + mappings.join("\n") + "\n};\n";
}

