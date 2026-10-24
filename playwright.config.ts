import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/**
 * E2E tests run against a real Next.js server and the local Supabase stack.
 * - Default: builds and starts the app on port 3100.
 * - Set E2E_BASE_URL to reuse an already running server (e.g. `npm run dev`).
 */
const external = process.env.E2E_BASE_URL;
const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  // Screenshot capture for design review: `QA=1 npx playwright test visual.qa`.
  testIgnore: process.env.QA ? [] : ["**/*.qa.spec.ts"],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "hr-HR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${port}`,
        url: `http://localhost:${port}`,
        timeout: 400_000,
        reuseExistingServer: true,
        env: { NEXT_PUBLIC_SITE_URL: `http://localhost:${port}` },
      },
});
