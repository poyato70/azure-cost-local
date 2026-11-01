import { defineConfig } from "vite";
export default defineConfig({
  build: { outDir: "dist/web" },
  server: { host: "127.0.0.1", proxy: { "/api": "http://localhost:4317" } },
});
