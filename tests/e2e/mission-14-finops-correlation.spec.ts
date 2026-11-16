import { expect, test } from "./fixtures.js";
import AxeBuilder from "@axe-core/playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMission14Fixtures } from "../fixtures/mcp-mission14.js";
import {
  protectedTestPaths,
  safeRemoveTestDirectory,
} from "../../scripts/test-path-safety.js";

const appPort = 14519;
let app: ChildProcess | undefined;
let sandbox = "";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const launchApp = () =>
  spawn(process.execPath, ["dist/server/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      TESSERACT_TEST_RUNTIME: "1",
      TESSERACT_TEST_DATA_DIR: join(sandbox, "data"),
      LOCALAPPDATA: join(sandbox, "local-app-data"),
      TESSERACT_TEST_PROTECTED_ROOTS: JSON.stringify(protectedTestPaths()),
      AZURE_TENANT_ID: "",
      AZURE_CLIENT_ID: "",
    },
    stdio: "ignore",
  });
const waitApp = async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${appPort}/api/health`)).ok) return;
    } catch {}
    await pause(100);
  }
  throw new Error("Tesseract M14 E2E local não iniciou.");
};
const stopApp = async () => {
  if (app && app.exitCode === null) {
    const old = app;
    old.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        old.kill("SIGKILL");
        resolve();
      }, 5000);
      old.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  app = undefined;
};
test.beforeAll(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "tesseract-m14-e2e-"));
  await mkdir(join(sandbox, "data"), { recursive: true });
  app = launchApp();
  await waitApp();
});
test.afterAll(async () => {
  await stopApp();
  if (sandbox) safeRemoveTestDirectory(sandbox, tmpdir(), protectedTestPaths());
});

test("runs the two real synthetic MCP sources and inspects the persisted FinOps correlation", async ({
  page,
}) => {
  const pair = await startMission14Fixtures();
  try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`http://127.0.0.1:${appPort}/`);
    const bootstrap = await (
      await page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/bootstrap") && response.ok(),
      )
    ).json();
    await page.evaluate(
      (csrf) => sessionStorage.setItem("m10-csrf", csrf),
      bootstrap.csrf,
    );
    const profiles = await page.evaluate(
      async ({ endpoints, csrf }) => {
        const saved = [];
        for (const [index, endpoint] of endpoints.entries()) {
          const response = await fetch("/api/mcp-connections", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
            },
            body: JSON.stringify({
              name: `M14 Synthetic ${index ? "Inventory" : "Costs"}`,
              preset: "custom",
              transport: "http",
              endpoint,
              authMode: "none",
              allowPrivateNetwork: true,
              resourceContext: {},
              approvedTools: [],
            }),
          });
          if (!response.ok) throw new Error(await response.text());
          saved.push(await response.json());
        }
        for (const [index, name] of [
          "list_costs",
          "list_inventory",
        ].entries()) {
          const approved = await fetch(
            `/api/mcp-connections/${saved[index].id}/approve-tools`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrf,
              },
              body: JSON.stringify({ names: [name] }),
            },
          );
          if (!approved.ok) throw new Error(await approved.text());
        }
        return saved;
      },
      { endpoints: pair.endpoints, csrf: bootstrap.csrf },
    );
    await page.reload();
    await page.getByRole("button", { name: "Correlação MCP" }).click();
    await expect(
      page.getByRole("heading", { name: "Correlação de custos e inventário" }),
    ).toBeVisible();
    await expect(page.getByText("USD 15.3")).toHaveCount(0);
    await page
      .getByLabel("Servidor MCP de custos")
      .selectOption(profiles[0].id);
    await page.getByLabel("Tool de custos").selectOption("list_costs");
    await page
      .getByLabel("Servidor MCP de inventário")
      .selectOption(profiles[1].id);
    await page.getByLabel("Tool de inventário").selectOption("list_inventory");
    await page
      .getByRole("button", { name: "Executar correlação A → B" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Aguardando autorização de inventário",
    );
    await page
      .getByRole("button", { name: "Autorizar e consultar inventário B" })
      .click();
    await expect(page.getByRole("status")).toContainText("Concluído", {
      timeout: 15000,
    });
    await expect(page.getByText("USD 15.3")).toBeVisible();
    await expect(
      page.getByText(
        /Associados: 1 · Não associados: 1 · Ambíguos: 0 · Não alocáveis: 1/,
      ),
    ).toBeVisible();
    const m12History = await page.evaluate(() =>
      fetch("/api/mcp-orchestrations").then((response) => response.json()),
    );
    expect(m12History).toEqual([]);
    await page
      .getByText("Inspecionar linhas, identidade e proveniência")
      .click();
    await expect(page.getByText("cost://cost-1")).toBeVisible();
    await expect(page.getByText("inventory://inv-1")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const width = await page.evaluate(() => ({
        inner: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(width.scroll).toBeLessThanOrEqual(width.inner + 1);
    }
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    await stopApp();
    app = launchApp();
    await waitApp();
    await page.reload();
    await page.getByRole("button", { name: "Correlação MCP" }).click();
    const afterCompletedRestart = JSON.parse(
      await readFile(
        join(sandbox, "data", "Tesseract", "orchestrations.json"),
        "utf8",
      ),
    );
    expect(
      afterCompletedRestart.flows.find((item: any) => item.correlation)
        ?.correlation.totals,
    ).toEqual([
      {
        currency: "USD",
        amount: "15.3",
        period: { from: "2026-10-01", toExclusive: "2026-11-01" },
      },
    ]);

    await page
      .getByLabel("Servidor MCP de custos")
      .selectOption(profiles[0].id);
    await page.getByLabel("Tool de custos").selectOption("list_costs");
    await page
      .getByLabel("Servidor MCP de inventário")
      .selectOption(profiles[1].id);
    await page.getByLabel("Tool de inventário").selectOption("list_inventory");
    await page
      .getByRole("button", { name: "Executar correlação A → B" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Aguardando autorização de inventário",
    );
    expect(pair.counts).toEqual({ costs: 2, inventory: 1 });
    await stopApp();
    app = launchApp();
    await waitApp();
    const afterApprovalRestart = JSON.parse(
      await readFile(
        join(sandbox, "data", "Tesseract", "orchestrations.json"),
        "utf8",
      ),
    );
    expect(
      afterApprovalRestart.flows.filter(
        (item: any) => item.state === "approval_required",
      ),
    ).toHaveLength(1);
    expect(pair.counts).toEqual({ costs: 2, inventory: 1 });
    await page.getByLabel("Fonte de dados").selectOption("azure-arm-mcp");
    await expect(page.getByText(/Integração Azure em preparação/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Consultar custos e inventário Azure" }),
    ).toBeDisabled();
    await expect(page.getByText("USD 15.3")).toHaveCount(0);
    const azureAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(azureAxe.violations).toEqual([]);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      const width = await page.evaluate(() => ({
        inner: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(width.scroll).toBeLessThanOrEqual(width.inner + 1);
    }
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  } finally {
    await pair.close();
  }
});
