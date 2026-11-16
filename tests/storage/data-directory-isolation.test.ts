import { expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { buildApp } from "../../src/server/app.js";
import { ConfigStore } from "../../src/server/storage/config-store.js";
import { OrchestrationStore } from "../../src/server/mcp/orchestration-store.js";
import { resolveTesseractDataDirectory } from "../../src/server/storage/data-directory.js";
import { protectedTestPaths, safeRemoveTestDirectory } from "../../scripts/test-path-safety.js";

const sandbox = process.env.TESSERACT_TEST_DATA_DIR!;
const storePath = join(resolveTesseractDataDirectory("Tesseract"), "orchestrations.json");
const isWithin = (parent: string, child: string) => {
  const part = relative(resolve(parent), resolve(child));
  return part === "" || (part !== ".." && !part.startsWith(`..${sep}`));
};

function runNode(
  env: NodeJS.ProcessEnv,
  entry = "tests/fixtures/unsafe-store-init.ts",
): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", entry],
      { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "", err = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (out += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (err += chunk));
    child.once("error", reject);
    child.once("exit", (code) => resolveResult({ code, out, err }));
  });
}

it("buildApp without injected stores initializes only under the automatic test root", async () => {
  const [first, second] = await Promise.all([buildApp(), buildApp()]);
  await Promise.all([first.close(), second.close()]);
  expect(isWithin(tmpdir(), storePath)).toBe(true);
  expect(isWithin(sandbox, storePath)).toBe(true);
  expect(new ConfigStore().root).toBe(join(sandbox, "AzureCostLocal", "config"));
  expect(JSON.parse(await readFile(storePath, "utf8"))).toEqual({
    schemaVersion: 1,
    flows: [],
  });
});

it("OrchestrationStore without an explicit file resolves to the automatic test root and repeats safely", async () => {
  const store = new OrchestrationStore();
  await Promise.all([store.init(), store.init()]);
  expect(store.file).toBe(storePath);
  expect(JSON.parse(await readFile(storePath, "utf8")).flows).toEqual([]);
});

it("fails closed for alternate test-runner signals when the safe directory is missing", () => {
  const env = process.env as Record<string, string | undefined>;
  const previous = {
    runtime: env.TESSERACT_TEST_RUNTIME,
    data: env.TESSERACT_TEST_DATA_DIR,
    protected: env.TESSERACT_TEST_PROTECTED_ROOTS,
    nodeEnv: env.NODE_ENV,
    vitest: env.VITEST,
  };
  try {
    delete env.TESSERACT_TEST_RUNTIME;
    delete env.TESSERACT_TEST_DATA_DIR;
    delete env.TESSERACT_TEST_PROTECTED_ROOTS;
    env.NODE_ENV = "test";
    delete env.VITEST;
    expect(() => new OrchestrationStore()).toThrow("TESSERACT_TEST_DATA_DIR");
    env.NODE_ENV = "production";
    env.VITEST = "1";
    expect(() => new ConfigStore()).toThrow("TESSERACT_TEST_DATA_DIR");
    delete env.VITEST;
    env.TESSERACT_TEST_RUNTIME = "1";
    expect(() => new OrchestrationStore()).toThrow("TESSERACT_TEST_DATA_DIR");
  } finally {
    for (const [key, value] of [
      ["TESSERACT_TEST_RUNTIME", previous.runtime],
      ["TESSERACT_TEST_DATA_DIR", previous.data],
      ["TESSERACT_TEST_PROTECTED_ROOTS", previous.protected],
      ["NODE_ENV", previous.nodeEnv],
      ["VITEST", previous.vitest],
    ] as const) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
});

it("refuses an explicitly selected protected operational path before I/O", () => {
  const [operationalTesseractRoot] = JSON.parse(
    process.env.TESSERACT_TEST_PROTECTED_ROOTS!,
  ) as string[];
  expect(() =>
    new OrchestrationStore(join(operationalTesseractRoot, "orchestrations.json")),
  ).toThrow("armazenamento operacional protegido");
});

// A cold tsx child took 3.4 s alone and exceeded Vitest's 5 s default under
// parallel load; this bounded allowance covers process startup, not behavior.
it("refuses an unsafe child process before it creates any persistent files", async () => {
  const root = await mkdtemp(join(tmpdir(), "tesseract-isolation-negative-"));
  const unsafeData = join(root, "would-have-been-operational");
  const env = { ...process.env };
  env.TESSERACT_TEST_RUNTIME = "1";
  env.LOCALAPPDATA = unsafeData;
  delete env.TESSERACT_TEST_DATA_DIR;
  delete env.TESSERACT_TEST_PROTECTED_ROOTS;
  delete env.VITEST;
  delete env.VITEST_POOL_ID;
  delete env.JEST_WORKER_ID;
  env.NODE_ENV = "production";
  try {
    const child = await runNode(env);
    expect(child.code).toBe(0);
    expect(child.err).toContain("TESSERACT_TEST_DATA_DIR");
    await expect(stat(unsafeData)).rejects.toMatchObject({ code: "ENOENT" });
    expect(child.err).toContain("STORE_REJECTED:");
    expect(child.err).toContain("APP_REJECTED:");
    await expect(stat(unsafeData)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    safeRemoveTestDirectory(root, tmpdir(), protectedTestPaths());
  }
}, 15000);

// Each cold tsx child took 3.6–4.0 s alone and exceeded Vitest's 5 s default
// under the four-worker suite; this allows process startup without weakening
// the child's assertions.
it("passes explicit temporary isolation to a configured subprocess", async () => {
  const root = await mkdtemp(join(tmpdir(), "tesseract-isolation-child-"));
  const env = {
    ...process.env,
    TESSERACT_TEST_RUNTIME: "1",
    TESSERACT_TEST_DATA_DIR: join(root, "data"),
    LOCALAPPDATA: join(root, "local-app-data"),
    TESSERACT_EXPECT_SAFE_TEST: "1",
  };
  try {
    await mkdir(env.TESSERACT_TEST_DATA_DIR, { recursive: true });
    const child = await runNode(env);
    expect(child.code).toBe(0);
    expect(child.out.trim()).toContain(join(root, "data", "Tesseract", "orchestrations.json"));
    expect(JSON.parse(await readFile(join(root, "data", "Tesseract", "orchestrations.json"), "utf8")).flows).toEqual([]);
  } finally {
    safeRemoveTestDirectory(root, tmpdir(), protectedTestPaths());
  }
}, 15000);

// Uses the same cold tsx startup path measured above.
it("keeps production path resolution based on LOCALAPPDATA", async () => {
  const root = await mkdtemp(join(tmpdir(), "tesseract-production-path-"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    LOCALAPPDATA: root,
    NODE_ENV: "production",
  };
  for (const key of [
    "TESSERACT_TEST_RUNTIME",
    "TESSERACT_TEST_DATA_DIR",
    "TESSERACT_TEST_PROTECTED_ROOTS",
    "VITEST",
    "VITEST_POOL_ID",
    "JEST_WORKER_ID",
    "PLAYWRIGHT_TEST",
  ]) delete env[key];
  try {
    const child = await runNode(env);
    expect(child.code).toBe(1);
    expect(child.out.trim().split("\n")).toEqual([
      "UNSAFE_STORE_ACCEPTED",
      "UNSAFE_APP_ACCEPTED",
      `PRODUCTION_CONFIG_ROOT:${join(root, "AzureCostLocal", "config")}`,
    ]);
    expect(
      JSON.parse(await readFile(join(root, "Tesseract", "orchestrations.json"), "utf8")).flows,
    ).toEqual([]);
  } finally {
    safeRemoveTestDirectory(root, tmpdir(), protectedTestPaths());
  }
}, 15000);
