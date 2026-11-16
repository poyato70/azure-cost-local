import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createUniqueTestOutputDir,
  safeRemoveTestDirectory,
  protectedTestPaths,
} from "./test-path-safety.js";

const protectedPaths = protectedTestPaths();
const sandbox = createUniqueTestOutputDir(
  "tesseract-playwright-server-",
  protectedPaths,
);
const appData = join(sandbox, "app-data");
mkdirSync(appData, { recursive: true });
const originalBase = process.env.LOCALAPPDATA || process.env.XDG_DATA_HOME;
const env = {
  ...process.env,
  TESSERACT_TEST_RUNTIME: "1",
  TESSERACT_TEST_DATA_DIR: appData,
  TESSERACT_TEST_PROTECTED_ROOTS: JSON.stringify(protectedPaths),
  LOCALAPPDATA: join(sandbox, "local-app-data"),
  XDG_DATA_HOME: join(sandbox, "xdg-data"),
  PORT: process.env.PORT || "4317",
};
if (originalBase) {
  env.TESSERACT_TEST_PROTECTED_ROOTS = JSON.stringify([
    ...protectedPaths,
    join(originalBase, "Tesseract"),
    join(originalBase, "AzureCostLocal"),
  ]);
}

const child = spawn(process.execPath, ["dist/server/main.js"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});
const shutdown = () => child.kill("SIGTERM");
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
const exitCode = await new Promise<number>((resolve) => {
  child.once("error", () => resolve(1));
  child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
});
safeRemoveTestDirectory(sandbox, join(sandbox, ".."), protectedPaths);
process.exitCode = exitCode;
