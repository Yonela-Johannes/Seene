// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryPanel } from "../../src/platform/DiscoveryPanel";
import { studioHref } from "../../src/platform/api";

type Route = { match: RegExp; method?: string; body: unknown; status?: number };
type Call = { url: string; method: string; body?: { path?: string } };

const calls: Call[] = [];

function installFetch(routes: Route[]) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    const route = routes.find(candidate => candidate.match.test(url) && (candidate.method ?? "GET") === method);
    const status = route?.status ?? (route ? 200 : 404);
    return { ok: status >= 200 && status < 300, status, json: async () => route?.body ?? { error: "no route" } } as unknown as Response;
  }));
}

const project = (overrides: Record<string, unknown>) => ({
  path: "/home/x/Projects/app", name: "app", framework: "vite", hasSeene: false, sceneCount: 0,
  registered: false, ...overrides,
});

const scan = (projects: Array<Record<string, unknown>>) => ({
  home: "/home/x/.seene", roots: ["/home/x/Projects"], projects, scanned: 12, truncated: false,
});

beforeEach(() => { calls.length = 0; vi.restoreAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("project discovery panel", () => {
  it("lists what Seene found and registers a project in one click", async () => {
    installFetch([
      { match: /\/projects$/, method: "POST", body: { home: "/home/x/.seene", projects: [] } },
      { match: /\/projects\/sources\/discover/, body: scan([
        project({ path: "/home/x/Projects/web", name: "web", framework: "next", reactVersion: "19.2.0", packageManager: "pnpm", hasSeene: true, sceneCount: 1, modifiedMs: Date.now() - 3_600_000 }),
        project({ path: "/home/x/Projects/app", name: "app", registered: true }),
      ]) },
    ]);

    const onRegistered = vi.fn();
    render(<DiscoveryPanel onRegistered={onRegistered} />);

    expect(await screen.findByText("web")).toBeTruthy();
    expect(screen.getByText("Next.js")).toBeTruthy();
    expect(screen.getByText(/React 19\.2\.0/)).toBeTruthy();
    expect(screen.getByText("Has Seene")).toBeTruthy();
    expect(screen.getByText(/edited 1 hour ago/)).toBeTruthy();
    // An already-registered project opens the studio instead of asking to register again.
    expect(screen.getByRole("link", { name: "Open studio" }).getAttribute("href")).toBe(studioHref("/home/x/Projects/app"));

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(calls.some(call => call.method === "POST" && call.body?.path === "/home/x/Projects/web")).toBe(true));
    await waitFor(() => expect(onRegistered).toHaveBeenCalled());
    // Registered projects are marked after the rescan.
    await waitFor(() => expect(screen.getAllByText("Registered").length).toBeGreaterThanOrEqual(1));
  });

  it("keeps the panel honest when it finds nothing and when the server is down", async () => {
    installFetch([{ match: /\/projects\/sources\/discover/, body: scan([]) }]);
    render(<DiscoveryPanel onRegistered={() => {}} />);
    expect(await screen.findByText("No React projects found")).toBeTruthy();
    expect(screen.getByText(/Seene looked in 1 common folder/)).toBeTruthy();
  });

  it("reports a scan failure instead of an empty list", async () => {
    installFetch([{ match: /\/projects\/sources\/discover/, status: 400, body: { error: "Project discovery is limited to this machine." } }]);
    render(<DiscoveryPanel onRegistered={() => {}} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Project discovery is limited to this machine.");
  });
});
