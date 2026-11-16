import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export type SafeTestPathOptions = {
  sandboxRoot: string;
  protectedPaths?: string[];
};

function canonicalPath(path: string): string {
  const absolute = resolve(path);
  let existing = absolute;
  const suffix: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return absolute;
    suffix.unshift(existing.slice(parent.length).replace(/^[\\/]+/, ""));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...suffix);
}

function contains(parent: string, child: string): boolean {
  const relativePath = relative(canonicalPath(parent), canonicalPath(child));
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

function overlaps(first: string, second: string): boolean {
  return contains(first, second) || contains(second, first);
}

function assertNoLinksBelow(path: string): void {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    const info = lstatSync(child);
    if (info.isSymbolicLink())
      throw new Error("Recusa de limpeza: o destino contém link simbólico ou junction.");
    if (info.isDirectory()) assertNoLinksBelow(child);
  }
}

export function protectedTestPaths(extra: string[] = []): string[] {
  const configured = process.env.TESSERACT_TEST_PROTECTED_ROOTS;
  let roots: string[] = [];
  if (configured) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configured);
    } catch {
      throw new Error("Raízes protegidas de teste inválidas.");
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every((path) => typeof path === "string" && isAbsolute(path))
    )
      throw new Error("Raízes protegidas de teste devem ser paths absolutos.");
    roots = parsed;
  }

  for (const dataRoot of [
    process.env.LOCALAPPDATA,
    process.env.XDG_DATA_HOME,
  ].filter((path): path is string => Boolean(path))) {
    roots.push(join(dataRoot, "Tesseract"), join(dataRoot, "AzureCostLocal"));
  }
  roots.push(join(process.cwd(), "test-results", "mission13-local-data-backup"));
  roots.push(...extra);
  return [...new Set(roots.map(canonicalPath))];
}

export function assertSafeTestPath(
  path: string,
  options: SafeTestPathOptions,
): string {
  const root = canonicalPath(options.sandboxRoot);
  const candidate = canonicalPath(path);
  if (candidate === root || !contains(root, candidate))
    throw new Error("Path de teste fora do sandbox ou igual à raiz do sandbox.");

  const protectedPaths = (options.protectedPaths ?? protectedTestPaths()).map(
    canonicalPath,
  );
  if (protectedPaths.some((protectedPath) => overlaps(candidate, protectedPath)))
    throw new Error("Path de teste coincide com diretório protegido.");

  try {
    if (lstatSync(path).isSymbolicLink())
      throw new Error("Path de teste não pode ser link simbólico ou junction.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return candidate;
}

export function createUniqueTestOutputDir(
  prefix = "tesseract-test-output-",
  protectedPaths = protectedTestPaths(),
  parentDirectory = tmpdir(),
): string {
  if (!/^[a-zA-Z0-9_-]+-$/.test(prefix))
    throw new Error("Prefixo inválido para diretório temporário de teste.");

  const parent = canonicalPath(parentDirectory);
  if (
    protectedPaths.some((protectedPath) => contains(protectedPath, parent))
  )
    throw new Error("Diretório-base de teste está dentro de um diretório protegido.");
  mkdirSync(parentDirectory, { recursive: true });
  if (canonicalPath(parentDirectory) !== parent)
    throw new Error("Diretório-base mudou durante a validação.");

  const candidate = mkdtempSync(join(parent, prefix));
  try {
    return assertSafeTestPath(candidate, {
      sandboxRoot: parent,
      protectedPaths,
    });
  } catch (error) {
    // It is our freshly created directory. Remove only if the guard confirms it
    // is safe; never clean a candidate after the path has resolved as protected.
    if (!protectedPaths.some((path) => overlaps(candidate, path))) {
      try {
        safeRemoveTestDirectory(candidate, parent, protectedPaths);
      } catch {
        // Preserve the original validation error and leave an ambiguous path
        // untouched rather than attempt an unvalidated cleanup.
      }
    }
    throw error;
  }
}

export function safeRemoveTestDirectory(
  path: string,
  sandboxRoot: string,
  protectedPaths = protectedTestPaths(),
): void {
  let info;
  try {
    info = lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (info.isSymbolicLink())
    throw new Error("Recusa de limpeza: alvo é link simbólico ou junction.");

  const validated = assertSafeTestPath(path, { sandboxRoot, protectedPaths });
  if (canonicalPath(path) !== validated)
    throw new Error("Recusa de limpeza: o destino mudou durante a validação.");
  if (!info.isDirectory())
    throw new Error("Recusa de limpeza: o destino não é um diretório.");
  assertNoLinksBelow(path);
  rmSync(path, { recursive: true, force: false, maxRetries: 5, retryDelay: 100 });
}

export function safeRemoveTestFile(
  path: string,
  sandboxRoot: string,
  protectedPaths = protectedTestPaths(),
): void {
  let info;
  try {
    info = lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (info.isSymbolicLink() || info.isDirectory())
    throw new Error("Recusa de limpeza: alvo de arquivo inválido.");
  const validated = assertSafeTestPath(path, { sandboxRoot, protectedPaths });
  if (canonicalPath(path) !== validated)
    throw new Error("Recusa de limpeza: o arquivo mudou durante a validação.");
  unlinkSync(path);
}
