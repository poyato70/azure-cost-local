import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { APP_VERSION } from "../src/shared/version.js";

it("keeps the displayed and reported app version aligned with package metadata", () => {
  const packageMetadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
  expect(APP_VERSION).toBe(packageMetadata.version);
});
