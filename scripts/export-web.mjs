import { cp, mkdir } from "node:fs/promises";
await mkdir("dist/web", { recursive: true });
await cp("out", "dist/web", { recursive: true });
