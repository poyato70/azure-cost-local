import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:4317", headless: true, channel: "msedge" },
  webServer: {
    command: "npm start",
    url: "http://localhost:4317/api/health",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
