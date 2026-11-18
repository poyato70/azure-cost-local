import { defineConfig } from "@playwright/test";
import { createUniqueTestOutputDir } from "./scripts/test-path-safety.js";
const testPort =
  process.env.TESSERACT_PREVIEW_PORT ||
  process.env.TESSERACT_E2E_PORT ||
  "4317";
export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: [
    "**/mission-10-mcp.spec.ts",
    "**/mission-12-orchestration.spec.ts",
  ],
  workers: 2,
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    headless: true,
    channel: "msedge",
  },
  webServer: {
    command: "node --import tsx scripts/playwright-server.ts",
    url: `http://127.0.0.1:${testPort}/api/health`,
    env: { PORT: testPort },
    reuseExistingServer: false,
  },
  outputDir: createUniqueTestOutputDir("tesseract-playwright-default-"),
  reporter: "list",
});
