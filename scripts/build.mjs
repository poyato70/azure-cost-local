import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist/web", { recursive: true });
await build({ entryPoints: ["src/web/app.tsx"], bundle: true, outfile: "dist/web/app.js", platform: "browser", format: "esm", minify: true, loader: { ".css": "css" } });
await copyFile("index.html", "dist/web/index.html");
await copyFile("dist/web/app.css", "dist/web/styles.css");
