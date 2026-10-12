import { defineConfig, devices } from "@playwright/test";
const baseURL =
  process.env.SEENE_TEST_URL ??
  "http://127.0.0.1:" +
    String(process.env.SEENE_TEST_PORT ?? 4173);
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 10000 },
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: process.env.SEENE_TEST_URL
    ? undefined
    : {
        command: `npm run preview -- --config vite.test.config.ts --port ${process.env.SEENE_TEST_PORT ?? 4173} --strictPort`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 30000,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
