import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/test-isolation.setup.ts"],
    maxWorkers: 4,
  },
});
