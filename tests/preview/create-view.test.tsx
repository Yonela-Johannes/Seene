// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateView } from "../../src/platform/CreateView";
import { createHref, readRoute, studioHref } from "../../src/platform/api";

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
  });
});

describe("unified creation flow", () => {
  it("walks from kind to targets to a created scene and opens the studio on it", async () => {
    installFetch([
      { match: /\/projects\/content/, body: { project: PROJECT, content: CONTENT } },
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
