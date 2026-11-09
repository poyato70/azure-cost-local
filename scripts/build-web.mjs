import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", "--webpack"],
  { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
);
if (result.status !== 0) process.exit(result.status || 1);
await import("./export-web.mjs");
