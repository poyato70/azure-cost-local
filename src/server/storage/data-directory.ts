import { isAbsolute, relative, resolve, sep, join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, realpathSync } from "node:fs";

const TEST_RUNTIME = "TESSERACT_TEST_RUNTIME";
const TEST_DATA_DIR = "TESSERACT_TEST_DATA_DIR";
const PROTECTED_ROOTS = "TESSERACT_TEST_PROTECTED_ROOTS";

function testRuntime(): boolean {
  return (
    process.env[TEST_RUNTIME] === "1" ||
    Boolean(process.env[TEST_DATA_DIR]) ||
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.JEST_WORKER_ID) ||
    process.env.PLAYWRIGHT_TEST === "1"
  );
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function overlaps(left: string, right: string): boolean {
  return isWithin(left, right) || isWithin(right, left);
}

function canonicalPath(path: string): string {
  let current = resolve(path);
  const suffix: string[] = [];
  while (!existsSync(current)) {
    const parent = resolve(current, "..");
    if (parent === current) return resolve(path);
    suffix.unshift(current.slice(parent.length).replace(/^[\\/]+/, ""));
    current = parent;
  }
  return resolve(realpathSync(current), ...suffix);
}

function protectedRoots(): string[] {
  const raw = process.env[PROTECTED_ROOTS];
  if (!raw) return [];
  try {
    const roots = JSON.parse(raw);
    if (!Array.isArray(roots) || !roots.every((root) => typeof root === "string"))
      throw new Error("Isolamento Tesseract inválido: formato das raízes protegidas.");
    return roots.map((root) => canonicalPath(root));
  } catch {
    throw new Error("Isolamento Tesseract inválido: raízes protegidas malformadas.");
  }
}

function testDataRoot(): string {
  const raw = process.env[TEST_DATA_DIR];
  if (!raw || !isAbsolute(raw))
    throw new Error(
      "Isolamento Tesseract ausente: configure TESSERACT_TEST_DATA_DIR absoluto antes de inicializar armazenamento em testes.",
    );
  const root = canonicalPath(raw), systemTemp = canonicalPath(tmpdir());
  if (root === systemTemp || !isWithin(systemTemp, root))
    throw new Error(
      "Isolamento Tesseract inválido: o diretório de teste precisa ser exclusivo sob o diretório temporário do sistema.",
    );
  if (protectedRoots().some((protectedRoot) => overlaps(root, protectedRoot)))
    throw new Error(
      "Isolamento Tesseract inválido: o diretório de teste coincide com armazenamento operacional protegido.",
    );
  return root;
}

export function resolveTesseractDataDirectory(...segments: string[]): string {
  const testing = testRuntime();
  const root = testing
    ? testDataRoot()
    : process.env.LOCALAPPDATA || process.env.XDG_DATA_HOME || tmpdir();
  const result = resolve(root, ...segments);
  if (testing && !isWithin(root, result))
    throw new Error("Isolamento Tesseract inválido: caminho fora do diretório temporário.");
  return result;
}

export function resolvePersistentDirectory(path: string, label: string): string {
  if (!testRuntime()) return path;
  const result = canonicalPath(path);
  testDataRoot();
  if (protectedRoots().some((protectedRoot) => overlaps(result, protectedRoot)))
    throw new Error(`${label}: caminho coincide com armazenamento operacional protegido.`);
  if (!isWithin(canonicalPath(tmpdir()), result))
    throw new Error(`${label}: caminho persistente fora do diretório temporário durante testes.`);
  return result;
}

export function isTesseractTestRuntime(): boolean {
  return testRuntime();
}

export const tesseractTestEnvironment = {
  runtime: TEST_RUNTIME,
  dataDirectory: TEST_DATA_DIR,
  protectedRoots: PROTECTED_ROOTS,
};
