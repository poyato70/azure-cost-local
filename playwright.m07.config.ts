import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["mission-07.spec.ts", "mcp-clarity.spec.ts", "mcp-laboratory.spec.ts"],
  workers: 1,
  use: { baseURL: "http://127.0.0.1:14317", headless: true, channel: "msedge" },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:14317/api/health",
    reuseExistingServer: false,
    env: { PORT: "14317" },
  },
  reporter: "list",
});
