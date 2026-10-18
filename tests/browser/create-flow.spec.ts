import { test, expect, type Page, type Route } from "@playwright/test";

/** The platform API is stubbed here so the browser test is deterministic and never touches the
 * developer's real project registry. The endpoints themselves are covered against a real Vite
 * server in tests/project/platform-sources.test.ts. */

const PROJECT = {
  path: "/apps/demo", name: "demo", connected: true, sceneDirectory: "src/seene/scenes",
  sceneCount: 2, addedAt: "2026-01-01T00:00:00.000Z", issues: [],
};

const CONTENT = {
  files: [
    { path: "src/components/Hero.tsx", default: true, exports: [], kind: "component", title: "Hero", previewable: true },
    { path: "src/components/Features.tsx", default: true, exports: [], kind: "component", title: "Features", previewable: true },
    { path: "app/dashboard/page.tsx", default: true, exports: ["Page"], kind: "page", title: "Dashboard", route: "/dashboard", previewable: false, issue: "Route files render the whole page; select a section or component instead." },
  ],
};

const SCENE = {
  id: "hero", title: "Hero", description: "", source: "src/seene/scenes/hero.tsx", binding: "Hero",
  durationMs: 6000, hasSnapshot: false, compositionType: "walkthrough",
};

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installPlatformStub(page: Page, onCreated: (draft: Record<string, unknown>) => void) {
  await page.route("**/__seene/platform/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname.endsWith("/projects/content")) return fulfill(route, { project: PROJECT, content: CONTENT });
    if (url.pathname.endsWith("/projects/scenes") && method === "POST") {
      onCreated(request.postDataJSON() as Record<string, unknown>);
      return fulfill(route, { project: PROJECT, scene: SCENE, catalog: { issues: [], scenes: [SCENE] } });
    }
    if (url.pathname.endsWith("/projects/scenes") && method === "GET") return fulfill(route, { project: PROJECT, catalog: { issues: [], scenes: [SCENE] } });
    if (url.pathname.endsWith("/projects/sources/inspect")) {
      const body = request.postDataJSON() as { path: string };
      const usable = body.path !== "/nope";
      return fulfill(route, {
        home: "/tmp/.seene",
        source: {
          path: usable ? "/home/you/apps" : "/nope", name: usable ? "my-app" : "nope",
          exists: usable, isDirectory: usable, react: usable, hasPackageJson: usable,
          connected: usable, registered: usable, sceneDirectory: "src/seene/scenes", sceneCount: usable ? 2 : 0,
          ...(usable ? {} : { issue: "That folder does not exist. Check the path and try again." }),
        },
      });
    }
    if (url.pathname.endsWith("/projects/sources/browse")) {
      return fulfill(route, {
        path: "/home/you", parent: "/home", truncated: false,
        entries: [{ name: "apps", path: "/home/you/apps", isReactProject: true, hasPackageJson: true }],
      });
    }
    if (url.pathname.endsWith("/projects")) return fulfill(route, { home: "/tmp/.seene", projects: [PROJECT] });
    return fulfill(route, { error: `unhandled ${method} ${url.pathname}` }, 404);
  });
}

test("homepage presents the unified creation workflow with real entry points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Overview").getByRole("link", { name: "Open the studio" }).first()).toHaveAttribute("href", "#/projects");
  await expect(page.getByRole("heading", { name: "Projects, Scenes and Walkthroughs" })).toBeVisible();
  const create = page.getByLabel("Create");
  await expect(create.getByRole("link", { name: "Create a scene" })).toHaveAttribute("href", "#/create?kind=scene");
  await expect(create.getByRole("link", { name: "Create a walkthrough" })).toHaveAttribute("href", "#/create?kind=walkthrough");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Studio" })).toHaveAttribute("href", "#/projects");
});

test("creation flow selects a source, orders real targets and opens the new walkthrough", async ({ page }) => {
  let created: Record<string, unknown> | undefined;
  await installPlatformStub(page, draft => { created = draft; });

  await page.goto("/#/create");
  await expect(page.getByRole("heading", { name: "Create" })).toBeVisible();
  await page.getByRole("button", { name: "Walkthrough", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New walkthrough" })).toBeVisible();

  await page.getByRole("button", { name: /demo/ }).click();
  await expect(page.getByRole("heading", { name: "Available content" })).toBeVisible();

  await page.getByRole("checkbox", { name: /Hero/ }).check();
  await page.getByRole("checkbox", { name: /Features/ }).check();
  // A route file is offered with an explanation but cannot be selected.
  await expect(page.getByRole("checkbox", { name: /Dashboard/ })).toBeDisabled();
  await expect(page.getByText(/Route files render the whole page/)).toBeVisible();

  await page.getByRole("button", { name: "Move Hero down" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // The default title comes from the first target in the authored order.
  await expect(page.getByLabel("Title")).toHaveValue("Features");
  await page.getByRole("button", { name: "Create walkthrough" }).click();

  await expect.poll(() => page.url()).toMatch(/#\/projects\/.*demo.*scene=hero/);
  expect(created).toMatchObject({
    path: "/apps/demo", compositionType: "walkthrough",
    sections: [{ file: "src/components/Features.tsx" }, { file: "src/components/Hero.tsx" }],
  });
  // The console opens on the new scene and shows what kind it is.
  await expect(page.getByText("Hero", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Walkthrough", { exact: true }).first()).toBeVisible();
});

test("manual path validation and folder browsing are reachable from the source step", async ({ page }) => {
  await installPlatformStub(page, () => {});

  await page.goto("/#/create?kind=scene");
  await expect(page.getByRole("heading", { name: "New scene" })).toBeVisible();

  const pathInput = page.getByLabel("Project folder path");
  await pathInput.fill("/nope");
  await page.getByRole("button", { name: "Check folder" }).click();
  await expect(page.getByText(/That folder does not exist/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Register and continue/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Browse…" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a project folder" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("apps")).toBeVisible();
  await dialog.getByRole("button", { name: "Use", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with this folder" })).toBeVisible();
});
