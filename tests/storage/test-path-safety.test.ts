import { expect, it } from "vitest";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSafeTestPath,
  createUniqueTestOutputDir,
  protectedTestPaths,
  safeRemoveTestDirectory,
} from "../../scripts/test-path-safety.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tesseract-path-guard-"));
  const sandbox = join(root, "sandbox");
  const protectedDir = join(root, "protected-operational-backup");
  mkdirSync(sandbox);
  mkdirSync(protectedDir);
  writeFileSync(join(protectedDir, "sentinel.json"), "keep");
  return { root, sandbox, protectedDir, protectedPaths: [protectedDir] };
}

function cleanup(root: string) {
  safeRemoveTestDirectory(root, tmpdir(), []);
}

function unlinkFixtureLink(path: string) {
  try {
    if (process.platform === "win32") rmdirSync(path);
    else unlinkSync(path);
  } catch {}
}

it("allows and safely cleans unique output directories within the sandbox", () => {
  const f = fixture();
  try {
    const first = createUniqueTestOutputDir("valid-run-", f.protectedPaths, f.sandbox);
    const second = createUniqueTestOutputDir("valid-run-", f.protectedPaths, f.sandbox);
    expect(first).not.toBe(second);
    expect(assertSafeTestPath(first, { sandboxRoot: f.sandbox, protectedPaths: f.protectedPaths })).toBe(first);
    writeFileSync(join(first, "result.txt"), "temporary");
    safeRemoveTestDirectory(first, f.sandbox, f.protectedPaths);
    expect(existsSync(first)).toBe(false);
    expect(readFileSync(join(f.protectedDir, "sentinel.json"), "utf8")).toBe("keep");
  } finally {
    cleanup(f.root);
  }
});

it("protects both Windows and XDG operational data roots", () => {
  const f = fixture();
  const previousXdg = process.env.XDG_DATA_HOME;
  try {
    process.env.XDG_DATA_HOME = f.root;
    const roots = protectedTestPaths();
    expect(roots).toContain(join(f.root, "Tesseract"));
    expect(roots).toContain(join(f.root, "AzureCostLocal"));
  } finally {
    if (previousXdg === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = previousXdg;
    cleanup(f.root);
  }
});

it("refuses the sandbox ancestor when it contains a protected backup", () => {
  const f = fixture();
  try {
    expect(() => assertSafeTestPath(f.root, { sandboxRoot: tmpdir(), protectedPaths: f.protectedPaths })).toThrow();
    expect(() => safeRemoveTestDirectory(f.root, tmpdir(), f.protectedPaths)).toThrow();
    expect(() =>
      createUniqueTestOutputDir("unsafe-output-", f.protectedPaths, f.protectedDir),
    ).toThrow();
    expect(readFileSync(join(f.protectedDir, "sentinel.json"), "utf8")).toBe("keep");
  } finally {
    cleanup(f.root);
  }
});

it("refuses a relative path that escapes the test sandbox", () => {
  const f = fixture();
  const outside = join(f.root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "sentinel.txt"), "keep");
  try {
    const escape = join(f.sandbox, "..", "outside");
    expect(() => assertSafeTestPath(escape, { sandboxRoot: f.sandbox, protectedPaths: f.protectedPaths })).toThrow();
    expect(() => safeRemoveTestDirectory(escape, f.sandbox, f.protectedPaths)).toThrow();
    expect(readFileSync(join(outside, "sentinel.txt"), "utf8")).toBe("keep");
  } finally {
    cleanup(f.root);
  }
});

it("refuses an absolute protected operational path before removing it", () => {
  const f = fixture();
  try {
    expect(() => assertSafeTestPath(f.protectedDir, { sandboxRoot: f.root, protectedPaths: f.protectedPaths })).toThrow();
    expect(() => safeRemoveTestDirectory(f.protectedDir, f.root, f.protectedPaths)).toThrow();
    expect(readFileSync(join(f.protectedDir, "sentinel.json"), "utf8")).toBe("keep");
  } finally {
    cleanup(f.root);
  }
});

it("refuses a normalized alias of a protected path", () => {
  const f = fixture();
  try {
    const alias = join(f.root, "sandbox", "..", "protected-operational-backup", ".");
    expect(() => assertSafeTestPath(alias, { sandboxRoot: tmpdir(), protectedPaths: f.protectedPaths })).toThrow();
    expect(readFileSync(join(f.protectedDir, "sentinel.json"), "utf8")).toBe("keep");
  } finally {
    cleanup(f.root);
  }
});

it.runIf(process.platform === "win32")(
  "treats Windows paths with different casing as the same protected path",
  () => {
    const f = fixture();
    try {
      const differentlyCased = f.protectedDir.toUpperCase();
      expect(() =>
        safeRemoveTestDirectory(differentlyCased, f.root, f.protectedPaths),
      ).toThrow();
      expect(readFileSync(join(f.protectedDir, "sentinel.json"), "utf8")).toBe(
        "keep",
      );
    } finally {
      cleanup(f.root);
    }
  },
);

it("refuses symlink or junction targets that resolve to a protected directory", ({ skip }) => {
  const f = fixture();
  const link = join(f.sandbox, "output-link");
  try {
    try {
      symlinkSync(f.protectedDir, link, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP", "EOPNOTSUPP"].includes((error as NodeJS.ErrnoException).code || ""))
        skip();
      throw error;
    }
    expect(() =>
      createUniqueTestOutputDir("link-output-", f.protectedPaths, link),
    ).toThrow();
    expect(() => assertSafeTestPath(link, { sandboxRoot: f.sandbox, protectedPaths: f.protectedPaths })).toThrow();
    expect(() => safeRemoveTestDirectory(link, f.sandbox, f.protectedPaths)).toThrow();
    expect(readFileSync(join(f.protectedDir, "sentinel.json"), "utf8")).toBe("keep");
  } finally {
    unlinkFixtureLink(link);
    cleanup(f.root);
  }
});

it("refuses recursive cleanup when a descendant is a link", () => {
  const f = fixture();
  const link = join(f.sandbox, "nested-link");
  let supported = false;
  try {
    try {
      symlinkSync(f.protectedDir, link, process.platform === "win32" ? "junction" : "dir");
      supported = true;
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP", "EOPNOTSUPP"].includes((error as NodeJS.ErrnoException).code || ""))
        throw error;
    }
    if (!supported) return;
    expect(() => safeRemoveTestDirectory(f.sandbox, f.root, f.protectedPaths)).toThrow();
    expect(readFileSync(join(f.protectedDir, "sentinel.json"), "utf8")).toBe("keep");
  } finally {
    unlinkFixtureLink(link);
    cleanup(f.root);
  }
});
