import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["mission-10-mcp.spec.ts"],
  workers: 1,
  timeout: 45000,
  expect: { timeout: 6000 },
  outputDir: "test-results/m10-qa-run/playwright-output",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:14517",
    headless: true,
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
