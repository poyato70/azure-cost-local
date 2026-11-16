import { afterAll } from "vitest";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { protectedTestPaths, safeRemoveTestDirectory } from "../scripts/test-path-safety.js";

const originalBase =
  process.env.LOCALAPPDATA || process.env.XDG_DATA_HOME || tmpdir();
const protectedRoots = [
  join(originalBase, "Tesseract"),
  join(originalBase, "AzureCostLocal"),
];
// Capture the real operational roots before replacing platform data variables
// with paths inside this sandbox. Recomputing them at teardown would protect
// descendants of the sandbox and (correctly) refuse to remove the sandbox.
const cleanupProtectedPaths = protectedTestPaths(protectedRoots);
const sandbox = await mkdtemp(join(tmpdir(), "tesseract-vitest-"));
const appData = join(sandbox, "app-data");
await mkdir(appData, { recursive: true });
process.env.TESSERACT_TEST_RUNTIME = "1";
process.env.TESSERACT_TEST_DATA_DIR = appData;
process.env.TESSERACT_TEST_PROTECTED_ROOTS = JSON.stringify(protectedRoots);
// Legacy code and children that still read platform data variables get an
// isolated value as well; central storage resolvers use the explicit marker.
process.env.LOCALAPPDATA = join(sandbox, "local-app-data");
process.env.XDG_DATA_HOME = join(sandbox, "xdg-data");

afterAll(async () => {
  safeRemoveTestDirectory(sandbox, tmpdir(), cleanupProtectedPaths);
});
