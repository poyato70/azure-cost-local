import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 2,
  use: { baseURL: "http://localhost:4317", headless: true, channel: "msedge" },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4317/api/health",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
