import { defineConfig } from "@playwright/test";
import { createUniqueTestOutputDir } from "./scripts/test-path-safety.js";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["mission-07.spec.ts", "mcp-clarity.spec.ts", "mcp-laboratory.spec.ts"],
  workers: 1,
  use: { baseURL: "http://127.0.0.1:14317", headless: true, channel: "msedge" },
  webServer: {
    command: "node --import tsx scripts/playwright-server.ts",
    url: "http://127.0.0.1:14317/api/health",
    reuseExistingServer: false,
    env: { PORT: "14317" },
  },
  outputDir: createUniqueTestOutputDir("tesseract-playwright-m07-"),
  reporter: "list",
});
