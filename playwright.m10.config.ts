import { defineConfig } from "@playwright/test";
import { createUniqueTestOutputDir } from "./scripts/test-path-safety.js";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["mission-10-mcp.spec.ts", "mission-12-orchestration.spec.ts", "mission-14-finops-correlation.spec.ts"],
  workers: 1,
  timeout: 45000,
  expect: { timeout: 6000 },
  outputDir: createUniqueTestOutputDir("tesseract-playwright-m10-"),
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:14517",
    headless: true,
    ...(process.env.CI ? {} : { channel: "msedge" }),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
