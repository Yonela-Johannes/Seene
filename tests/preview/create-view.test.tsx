// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateView } from "../../src/platform/CreateView";
import { createHref, readRoute, studioHref, websiteStudioHref } from "../../src/platform/api";

type Route = { match: RegExp; method?: string; body: unknown; status?: number };

const PROJECT = {
  path: "/apps/demo", name: "demo", connected: true, sceneDirectory: "src/seene/scenes",
  sceneCount: 2, addedAt: "2026-01-01T00:00:00.000Z", issues: [],
};

const CONTENT = {
  files: [
    { path: "src/components/Hero.tsx", default: true, exports: [], kind: "component", title: "Hero", previewable: true },
    { path: "app/dashboard/page.tsx", default: true, exports: ["Page"], kind: "page", title: "Dashboard", route: "/dashboard", previewable: false, issue: "Route files render the whole page; select a section or component instead." },
  ],
};

const calls: Array<{ url: string; method: string; body?: unknown }> = [];

function installFetch(routes: Route[]) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    const route = routes.find(candidate => candidate.match.test(url) && (candidate.method ?? "GET") === method);
    const status = route?.status ?? (route ? 200 : 404);
    const body = route?.body ?? { error: `no route for ${method} ${url}` };
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
  }));
}

beforeEach(() => {
  calls.length = 0;
  window.location.hash = "";
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("create routes", () => {
  it("round-trips create links and studio deep links", () => {
    expect(createHref()).toBe("#/create");
    expect(createHref("walkthrough")).toBe("#/create?kind=walkthrough");
    expect(createHref("scene", "/apps/demo")).toBe("#/create?kind=scene&project=%2Fapps%2Fdemo");
    expect(readRoute("#/create?kind=walkthrough")).toEqual({ view: "create", kind: "walkthrough" });
    expect(readRoute("#/create?project=%2Fapps%2Fdemo")).toEqual({ view: "create", project: "/apps/demo" });
    expect(readRoute(studioHref("/apps/demo", "hero"))).toEqual({ view: "studio", project: "/apps/demo", scene: "hero" });
    expect(readRoute("#/projects/%2Fapps%2Fdemo")).toEqual({ view: "studio", project: "/apps/demo" });
    expect(websiteStudioHref("https://example.com/pricing?plan=pro", "page-2"))
      .toBe("#/websites/https%3A%2F%2Fexample.com%2Fpricing%3Fplan%3Dpro?step=page-2");
    expect(readRoute(websiteStudioHref("https://example.com/pricing?plan=pro", "page-2")))
      .toEqual({ view: "website", url: "https://example.com/pricing?plan=pro", step: "page-2" });
  });
});

describe("unified creation flow", () => {
  it("walks from kind to targets to a created scene and opens the studio on it", async () => {
    installFetch([
      { match: /\/projects\/content/, body: { project: PROJECT, content: CONTENT } },
      { match: /\/projects\/sources\/discover/, body: { home: "/home/x/.seene", roots: [], projects: [], scanned: 0, truncated: false } },
      { match: /\/projects\/scenes$/, method: "POST", body: { project: PROJECT, scene: { id: "hero", title: "Hero" }, catalog: { issues: [], scenes: [] } } },
      { match: /\/projects$/, body: { home: "/home/x/.seene", projects: [PROJECT] } },
    ]);

    render(<CreateView />);
    expect(screen.getByRole("heading", { name: "Create" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Scene\b/ }));

    const projectCard = await screen.findByRole("button", { name: /demo/ });
    fireEvent.click(projectCard);

    const hero = await screen.findByRole("checkbox", { name: /Hero/ }) as HTMLInputElement;
    expect(hero.disabled).toBe(false);
    // Route files are shown with a reason rather than hidden or silently selectable.
    expect((screen.getByRole("checkbox", { name: /Dashboard/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Route files render the whole page/)).toBeTruthy();
    fireEvent.click(hero);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const title = await screen.findByLabelText("Title") as HTMLInputElement;
    expect(title.value).toBe("Hero");
    fireEvent.click(screen.getByRole("button", { name: "Create scene" }));

    await waitFor(() => expect(window.location.hash).toBe(studioHref("/apps/demo", "hero")));
    const created = calls.find(call => call.method === "POST" && /\/projects\/scenes$/.test(call.url));
    expect(created?.body).toMatchObject({
      path: "/apps/demo", id: "hero", title: "Hero", compositionType: "scene",
      sections: [{ file: "src/components/Hero.tsx" }],
    });
  });

  it("checks a manual path and explains when the folder cannot be used", async () => {
    installFetch([
      { match: /\/projects\/sources\/inspect/, method: "POST", body: {
        home: "/home/x/.seene",
        source: { path: "/nope", name: "nope", exists: false, isDirectory: false, react: false, hasPackageJson: false, connected: false, registered: false, sceneDirectory: "src/seene/scenes", sceneCount: 0, issue: "That folder does not exist. Check the path and try again." },
      } },
      { match: /\/projects\/sources\/discover/, body: { home: "/home/x/.seene", roots: [], projects: [], scanned: 0, truncated: false } },
      { match: /\/projects$/, body: { home: "/home/x/.seene", projects: [] } },
    ]);

    render(<CreateView initialKind="scene" />);
    const input = await screen.findByLabelText("Project folder path");
    fireEvent.change(input, { target: { value: "/nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Check folder" }));

    expect(await screen.findByText(/That folder does not exist/)).toBeTruthy();
    // No "Register and continue" action is offered for a folder Seene cannot use.
    expect(screen.queryByRole("button", { name: /Register and continue/ })).toBeNull();
  });
});

const WEBSITE_INSPECTION = {
  url: "https://example.com/",
  title: "Example Studio",
  sections: [
    { id: "hero", label: "Hero", selector: "#hero" },
    { id: "features", label: "Features", selector: "#features" },
  ],
  pages: [
    { url: "https://example.com/", title: "Home", path: "/" },
    { url: "https://example.com/pricing", title: "Pricing", path: "/pricing" },
  ],
  interactiveElements: [
    { id: "signup", label: "Sign up", kind: "link", selector: "a.signup", href: "https://example.com/pricing" },
  ],
  status: "ok",
  canIframe: true,
  inspectedWith: "browser",
};

describe("website URL import", () => {
  it("inspects a URL, keeps the user's target order and opens the website studio", async () => {
    installFetch([
      { match: /\/websites\/inspect$/, method: "POST", body: { inspection: WEBSITE_INSPECTION } },
      { match: /\/websites$/, method: "POST", body: {
        project: {
          version: 1, id: "example-com", url: "https://example.com/", title: "Example Studio",
          inspection: WEBSITE_INSPECTION,
          walkthrough: { version: 1, title: "Example Studio", settings: {}, nodes: [] },
          createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        },
      } },
      { match: /\/projects\/sources\/discover/, body: { home: "/home/x/.seene", roots: [], projects: [], scanned: 0, truncated: false } },
      { match: /\/projects$/, body: { home: "/home/x/.seene", projects: [] } },
    ]);

    render(<CreateView initialUrl="https://example.com" />);

    const card = await screen.findByText("Example Studio");
    expect(card).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue with this website" }));

    // Select the section before the page. The import must preserve this order instead of
    // grouping all pages ahead of all sections.
    fireEvent.click(await screen.findByRole("checkbox", { name: /Hero/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Pricing/ }));

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create walkthrough" }));

    await waitFor(() => expect(window.location.hash).toBe(websiteStudioHref("https://example.com/")));
    const imported = calls.find(call => call.method === "POST" && /\/websites$/.test(call.url));
    expect(imported?.body).toMatchObject({
      url: "https://example.com/",
      title: "Example Studio",
      targets: [
        { kind: "section", id: "hero", label: "Hero", selector: "#hero" },
        { kind: "page", url: "https://example.com/pricing", title: "Pricing" },
      ],
    });
  });

  it("lets an inspected site with no discoveries continue so steps can be added in the Studio", async () => {
    const bare = {
      ...WEBSITE_INSPECTION,
      sections: [],
      interactiveElements: [],
      pages: [{ url: "https://example.com/", title: "Home", path: "/" }],
    };
    installFetch([
      { match: /\/websites\/inspect$/, method: "POST", body: { inspection: bare } },
      { match: /\/websites$/, method: "POST", body: {
        project: {
          version: 1, id: "example-com", url: "https://example.com/", title: "Example Studio",
          inspection: bare,
          walkthrough: { version: 1, title: "Example Studio", settings: {}, nodes: [] },
          createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        },
      } },
      { match: /\/projects\/sources\/discover/, body: { home: "/home/x/.seene", roots: [], projects: [], scanned: 0, truncated: false } },
      { match: /\/projects$/, body: { home: "/home/x/.seene", projects: [] } },
    ]);

    render(<CreateView initialUrl="https://example.com" />);
    await screen.findByText("Example Studio");
    fireEvent.click(screen.getByRole("button", { name: "Continue with this website" }));

    // The empty-state notice is shown, and Continue stays enabled.
    expect(await screen.findByText(/No sections were discovered automatically/)).toBeTruthy();
    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton);
    fireEvent.click(await screen.findByRole("button", { name: "Create walkthrough" }));

    await waitFor(() => expect(window.location.hash).toBe(websiteStudioHref("https://example.com/")));
    const imported = calls.find(call => call.method === "POST" && /\/websites$/.test(call.url));
    expect((imported?.body as { targets?: unknown[] }).targets).toEqual([]);
  });

  it("shows inspection failures instead of inventing a site", async () => {
    installFetch([
      { match: /\/websites\/inspect$/, method: "POST", status: 502, body: { error: "The website answered with HTTP 500." } },
      { match: /\/projects\/sources\/discover/, body: { home: "/home/x/.seene", roots: [], projects: [], scanned: 0, truncated: false } },
      { match: /\/projects$/, body: { home: "/home/x/.seene", projects: [] } },
    ]);

    render(<CreateView initialUrl="https://example.com" />);
    expect(await screen.findByText(/The website answered with HTTP 500/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue with this website" })).toBeNull();
  });
});
