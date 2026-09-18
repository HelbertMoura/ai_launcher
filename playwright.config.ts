import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Cold Vite transforms on Windows can exceed 30s before the first page load.
  // Keep assertions independently bounded while giving app boot a realistic budget.
  timeout: 60_000,
  fullyParallel: true,
  // CI: one retry absorbs shared-runner flakiness; a single worker keeps the
  // shared Vite dev server deterministic. Local runs stay parallel, no retry.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
