import { defineConfig } from "@playwright/test";
import { createUniqueTestOutputDir } from "./scripts/test-path-safety.js";
const previewPort = process.env.TESSERACT_PREVIEW_PORT || "4317";
export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: [
    "**/mission-10-mcp.spec.ts",
    "**/mission-12-orchestration.spec.ts",
  ],
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${previewPort}`, headless: true, channel: "msedge" },
  webServer: {
    command: "node --import tsx scripts/playwright-server.ts",
    url: `http://127.0.0.1:${previewPort}/api/health`,
    reuseExistingServer: false,
  },
  outputDir: createUniqueTestOutputDir("tesseract-playwright-default-"),
  reporter: "list",
});
