import { test, expect } from "./fixtures.js";
import { mkdir, mkdtemp, open, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import {
  createUniqueTestOutputDir,
  protectedTestPaths,
  safeRemoveTestDirectory,
} from "../../scripts/test-path-safety.js";

const appPort = 14517;
const fixtureScript = join(
  process.cwd(),
  "tests",
  "fixtures",
  "mcp-mission10-server.ts",
);
const evidenceRoot = createUniqueTestOutputDir(
  "tesseract-m10-evidence-",
  protectedTestPaths(),
  join(process.cwd(), "test-results"),
);
let appProcess: ChildProcess | undefined;
let fixtureProcess: ChildProcess | undefined;
let tempRoot = "";
let fixturePort = 0;

async function waitFor(url: string, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor não respondeu dentro do limite: ${url}`);
}

test.beforeAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  tempRoot = await mkdtemp(join(tmpdir(), "tesseract-m10-e2e-"));
  const fixtureTemp = join(tempRoot, "fixture-effects");
  const fixtureLog = join(evidenceRoot, "mcp-fixture.stderr.log");
  fixtureProcess = spawn(
    process.execPath,
    ["--import", "tsx", fixtureScript, "--http"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TESSERACT_TEST_RUNTIME: "1",
        TESSERACT_TEST_DATA_DIR: join(tempRoot, "fixture-data"),
        LOCALAPPDATA: join(tempRoot, "fixture-local-app-data"),
        M10_FIXTURE_TEMP: fixtureTemp,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let fixtureOutput = "";
  fixtureProcess.stdout?.on("data", (chunk) => {
    fixtureOutput += chunk.toString();
    if (fixtureOutput.includes("\n")) {
      try {
        fixturePort = JSON.parse(fixtureOutput.split("\n")[0]).port;
      } catch {}
    }
  });
  fixtureProcess.stderr?.on(
    "data",
    (chunk) =>
      void import("node:fs/promises").then(({ appendFile }) =>
        appendFile(fixtureLog, chunk),
      ),
  );
  fixtureProcess.stdout?.on(
    "data",
    (chunk) =>
      void import("node:fs/promises").then(({ appendFile }) =>
        appendFile(join(evidenceRoot, "mcp-fixture.stdout.log"), chunk),
      ),
  );
  const fixtureDeadline = Date.now() + 20000;
  while (!fixturePort && Date.now() < fixtureDeadline)
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (!fixturePort)
    throw new Error(
      "A fixture Streamable HTTP não publicou sua porta dinâmica.",
    );

  const localApp = join(tempRoot, "local-app-data");
  await mkdir(localApp, { recursive: true });
  await mkdir(join(tempRoot, "fixture-data"), { recursive: true });
  const appStdout = await open(join(evidenceRoot, "tesseract.stdout.log"), "a");
  const appStderr = await open(join(evidenceRoot, "tesseract.stderr.log"), "a");
  appProcess = spawn(process.execPath, ["dist/server/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      LOCALAPPDATA: join(tempRoot, "platform-local-app-data"),
      TESSERACT_TEST_RUNTIME: "1",
      TESSERACT_TEST_DATA_DIR: localApp,
      TESSERACT_TEST_PROTECTED_ROOTS: JSON.stringify([
        join(process.env.LOCALAPPDATA || tmpdir(), "Tesseract"),
        join(process.env.LOCALAPPDATA || tmpdir(), "AzureCostLocal"),
      ]),
      AZURE_TENANT_ID: "",
      AZURE_CLIENT_ID: "",
    },
    stdio: ["ignore", appStdout.fd, appStderr.fd],
  });
  await Promise.all([appStdout.close(), appStderr.close()]);
  await waitFor(`http://127.0.0.1:${appPort}/api/health`);
});

test.afterAll(async () => {
  for (const child of [appProcess, fixtureProcess]) {
    if (!child || child.exitCode !== null) continue;
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  if (tempRoot)
    safeRemoveTestDirectory(tempRoot, tmpdir(), protectedTestPaths());
});

test("connects to controlled MCP, reviews, authorizes, executes and verifies activity", async ({
  page,
}) => {
  page.on("response", async (response) => {
    if (
      response.url().endsWith("/api/mcp-connections") &&
      response.request().method() === "POST"
    ) {
      const body = await response.text();
      const { appendFile } = await import("node:fs/promises");
      await appendFile(
        join(evidenceRoot, "e2e-http.log"),
        `${response.status()} ${body}\n`,
      );
    }
  });
  const geometry: Record<string, unknown>[] = [];
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`http://127.0.0.1:${appPort}/`);
  const bootstrapResponse = await page.waitForResponse(
    (response) => response.url().endsWith("/api/bootstrap") && response.ok(),
  );
  const bootstrap = await bootstrapResponse.json();
  await page.evaluate((csrf: string) => {
    sessionStorage.setItem("m10-csrf", csrf);
  }, bootstrap.csrf);
  await page.addInitScript((csrf: string) => {
    sessionStorage.setItem("m10-csrf", csrf);
  }, bootstrap.csrf);
  await page.reload();
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mapa de conexões" }),
  ).toBeVisible();
  await expect(page.getByText("Nenhuma operação registrada")).toBeVisible();
  const emptyStateA11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(emptyStateA11y.violations).toEqual([]);

  await page.getByRole("button", { name: "Nova conexão" }).click();
  await page.getByLabel("Serviço", { exact: true }).selectOption("custom");
  await page.getByLabel("Nome", { exact: true }).fill("Fixture Missão 10");
  await page
    .getByRole("textbox", { name: "Endpoint MCP" })
    .fill(`http://127.0.0.1:${fixturePort}/mcp`);
  await page
    .locator("#mcp-profile-form select")
    .filter({ has: page.locator('option[value="none"]') })
    .selectOption("none");
  await page
    .getByLabel("Autorizar rede privada / loopback deste endpoint")
    .check();
  await page.getByRole("button", { name: "Salvar MCP" }).click();
  await expect(
    page.getByText(
      "Conexão salva. Teste a autenticação e revise as ferramentas.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fixture Missão 10" }),
  ).toBeVisible();

  const mapProvider = page.getByRole("group", { name: "Selecionar provedor" });
  await expect(
    mapProvider.getByRole("button", { name: /Personalizado/ }),
  ).toBeVisible();
  await mapProvider.getByRole("button", { name: /Personalizado/ }).click();
  const integrationGroup = page.getByRole("group", {
    name: "Integrações de Personalizado",
  });
  await expect(
    integrationGroup.getByRole("button", { name: /Fixture Missão 10/ }),
  ).toBeVisible();
  await integrationGroup
    .getByRole("button", { name: /Fixture Missão 10/ })
    .click();
  await page
    .getByRole("region", { name: "Ações da integração" })
    .getByRole("button", { name: "Conectar e listar tools" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Servidor respondeu e listou 4 tool/ }),
  ).toBeVisible();
  await expect(
    integrationGroup.getByRole("button", { name: /Fixture Missão 10.*Ativa/ }),
  ).toBeVisible();

  await page
    .getByRole("region", { name: "Ações da integração" })
    .getByRole("button", { name: "Analisar tools", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inspector de capacidades MCP" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Descobrir capacidades MCP" }).click();
  await expect(
    page.getByText(/tesseract-mission-10-fixture/).first(),
  ).toBeVisible();
  const capabilityGroup = page.getByRole("group", {
    name: "Tipo de capacidade",
  });
  await capabilityGroup.getByRole("button", { name: "Resources" }).click();
  await page.getByRole("button", { name: /m10-json-resource/ }).click();
  await expect(
    page.getByRole("heading", { name: "m10-json-resource" }),
  ).toBeVisible();
  await capabilityGroup.getByRole("button", { name: "Prompts" }).click();
  await page.getByRole("button", { name: /m10_required_prompt/ }).click();
  await expect(
    page.getByRole("heading", { name: "m10_required_prompt" }),
  ).toBeVisible();
  await capabilityGroup.getByRole("button", { name: "Resources" }).click();
  await page.getByRole("button", { name: /m10-json-resource/ }).click();
  await page
    .getByRole("button", { name: "Ler resource", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Evidência de leitura MCP" }),
  ).toContainText("M10_FIXTURE_ONLY");

  const toolRows = page.locator(".tool-row");
  await toolRows
    .filter({ hasText: "m10_schema_echo" })
    .locator("input[type=checkbox]")
    .check();
  await page.getByRole("button", { name: "Salvar tools permitidas" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Tools permitidas salvas" }),
  ).toBeVisible();
  await page
    .getByLabel("Tools", { exact: true })
    .selectOption("m10_schema_echo");
  await expect(page.getByLabel("requiredText", { exact: true })).toBeVisible();
  await page.getByLabel("requiredText", { exact: true }).fill("argumento m10");
  await page.getByLabel("count", { exact: true }).fill("7");
  await page.getByLabel("enabled", { exact: true }).selectOption("false");
  await page.getByLabel("mode", { exact: true }).selectOption("diagnostic");
  await page.getByLabel("tags", { exact: true }).fill('["qa","mcp"]');
  await page.getByLabel("options.limit", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Executar tool selecionada" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Executando m10_schema_echo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Resultado de m10_schema_echo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Resultado da tool" }),
  ).toContainText("M10_FIXTURE_ONLY");
  await expect(
    page.getByRole("region", { name: "Resultado da tool" }),
  ).toContainText('"count": 7');
  const resultStateA11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(resultStateA11y.violations).toEqual([]);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const measurements = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      map: document
        .querySelector(".connections-map")
        ?.getBoundingClientRect()
        .toJSON(),
      provider: document
        .querySelector(".map-provider-column")
        ?.getBoundingClientRect()
        .toJSON(),
      integrations: document
        .querySelector(".map-integration-column")
        ?.getBoundingClientRect()
        .toJSON(),
      activity: document
        .querySelector(".map-activity")
        ?.getBoundingClientRect()
        .toJSON(),
      focused: document.activeElement?.tagName,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));
    geometry.push({ viewport, ...measurements });
    expect(measurements.scrollWidth).toBeLessThanOrEqual(
      measurements.innerWidth + 1,
    );
    expect(measurements.map?.width).toBeGreaterThan(0);
    await page.screenshot({
      path: join(
        evidenceRoot,
        `mission10-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await mapProvider
      .getByRole("button", { name: /Azure/ })
      .evaluate((button) => getComputedStyle(button).transitionDuration),
  ).toBe("0s");
  await expect(
    page.getByRole("button", { name: "Salvar tools permitidas" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();

  await toolRows
    .filter({ hasText: "m10_controlled_error" })
    .locator("input[type=checkbox]")
    .check();
  await page.getByRole("button", { name: "Salvar tools permitidas" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Tools permitidas salvas" }),
  ).toBeVisible();
  await page
    .getByLabel("Tools", { exact: true })
    .selectOption("m10_controlled_error");
  await page
    .getByLabel("requiredText", { exact: true })
    .fill("provocar erro controlado");
  const perCallApproval = page.getByLabel(
    "Confirmo esta execução (obrigatório em cada chamada)",
    { exact: true },
  );
  await expect(perCallApproval).not.toBeChecked();
  await page.getByRole("button", { name: "Executar tool selecionada" }).click();
  await expect(page.locator(".access-feedback.error")).toContainText(
    "Confirme explicitamente esta execução",
  );
  await expect(perCallApproval).not.toBeChecked();
  await perCallApproval.check();
  await page.getByRole("button", { name: "Executar tool selecionada" }).click();
  await expect(page.locator(".access-feedback.error")).toContainText(
    "A tool MCP informou falha na consulta",
  );
  await expect(perCallApproval).not.toBeChecked();
  await page.getByRole("button", { name: "Executar tool selecionada" }).click();
  await expect(page.locator(".access-feedback.error")).toContainText(
    "Confirme explicitamente esta execução",
  );

  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await mapProvider.getByRole("button", { name: /Personalizado/ }).click();
  await expect(page.locator(".map-event-list")).toContainText(
    "m10_schema_echo",
  );
  await expect(page.locator(".map-event-list")).toContainText("sucesso");
  await expect(page.locator(".map-event-list")).toContainText(
    "m10_controlled_error",
  );
  await expect(page.locator(".map-event-list")).toContainText(
    "mcp_tool_failed",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: join(evidenceRoot, "mission10-activity-error.png"),
    fullPage: true,
  });
  const currentIntegration = page
    .getByRole("group", { name: "Integrações de Personalizado" })
    .getByRole("button", { name: /Fixture Missão 10/ });
  await currentIntegration.click();
  await expect(page.getByRole("button", { name: "Desconectar" })).toBeVisible();
  await page.getByRole("button", { name: "Desconectar" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Conexão encerrada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Fixture Missão 10.*Salva/ }),
  ).toBeVisible();

  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      join(evidenceRoot, "mission10-viewport-inspection.json"),
      JSON.stringify(geometry, null, 2),
    ),
  );
  const settings = await readFile(
    join(
      tempRoot,
      "local-app-data",
      "AzureCostLocal",
      "config",
      "settings.json",
    ),
    "utf8",
  );
  expect(settings).toContain("Fixture Missão 10");
  expect(settings).not.toContain("tokenRef");
});
