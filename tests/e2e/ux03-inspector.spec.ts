import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "./fixtures.js";

const evidenceDirectory = join(
  process.cwd(),
  "docs/relatorios/evidencias/ux-04",
);
async function captureInspector(
  page: import("@playwright/test").Page,
  name: string,
) {
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    join(evidenceDirectory, name),
    await page.locator(".ux03-inspector").screenshot(),
  );
}

test("inspects discovered MCP capabilities and copies sanitized exports without operational actions", async ({
  page,
}, testInfo) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const apiPaths: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    apiPaths.push(path);
    let json: any = [];
    if (path === "/api/bootstrap")
      json = {
        authenticated: false,
        configured: false,
        csrf: "fixture",
        period: {
          from: "2026-09-01",
          toExclusive: "2026-10-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (path === "/api/mcp-connections")
      json = [
        {
          id,
          name: "Fixture Azure",
          preset: "azure",
          transport: "stdio",
          authMode: "application",
          resourceContext: { namespace: "pricing" },
          status: "cadastrado",
          capability: { status: "pending" },
        },
      ];
    if (path === "/api/mcp-presets") json = [];
    if (path.endsWith("/catalog"))
      json = {
        server: { name: "Fixture Server", version: "test" },
        capabilities: { tools: {}, prompts: {}, resources: {} },
        tools: [
          {
            name: "cost_query",
            description: "Consulta demonstrativa",
            approved: false,
            reviewable: true,
            inputSchema: {
              type: "object",
              required: ["scope"],
              properties: {
                scope: {
                  oneOf: [{ $ref: "#/definitions/Scope" }, { type: "null" }],
                },
                password: { type: "string", default: "fixture-secret" },
              },
              definitions: {
                Scope: {
                  type: "object",
                  required: ["tenantId"],
                  properties: { tenantId: { type: "string", format: "uuid" } },
                },
              },
              _meta: { sessionRef: "session-fixture-secret" },
            },
          },
          {
            name: "simple_echo",
            description: "Exemplo sintético simples",
            approved: false,
            reviewable: true,
            inputSchema: {
              type: "object",
              required: ["message"],
              properties: { message: { type: "string", minLength: 3 } },
            },
          },
        ],
        resources: {
          status: "discovered",
          items: [
            {
              name: "Cost summary",
              uri: "file:///fixture/cost?session_id=fixture-secret",
              description: "Resource sintético",
              mimeType: "application/json",
            },
          ],
        },
        resourceTemplates: {
          status: "discovered",
          items: [
            {
              name: "Cost by period",
              uriTemplate: "file:///fixture/{period}",
              mimeType: "application/json",
            },
          ],
        },
        prompts: {
          status: "discovered",
          items: [
            {
              name: "summarize",
              description: "Prompt sintético",
              arguments: [
                {
                  name: "period",
                  required: true,
                  description: "Período de exemplo",
                },
              ],
            },
          ],
        },
      };
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await page.getByLabel("Conexão para análise").selectOption(id);
  await page.getByRole("button", { name: "Descobrir capacidades MCP" }).click();
  await expect(
    page.getByText("Fixture Server", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /cost_query/ })).toBeVisible();
  await page.getByText("Input JSON · exemplo sintético").click();
  await expect(
    page.getByText(/Schema avançado requer edição manual/),
  ).toBeVisible();
  await page.getByText("JSON original sanitizado").click();
  await page.getByRole("button", { name: "Copiar schema JSON" }).click();
  const copiedSchema = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(copiedSchema).toContain('"oneOf"');
  expect(copiedSchema).toContain('"password"');
  expect(copiedSchema).not.toContain("fixture-secret");
  expect(copiedSchema).not.toContain("session-fixture-secret");
  await page.getByRole("button", { name: "Prompts", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Prompts", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  const focusedOutline = await page.evaluate(
    () => getComputedStyle(document.activeElement!).outlineWidth,
  );
  expect(Number.parseFloat(focusedOutline)).toBeGreaterThanOrEqual(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionDuration = await page
    .locator(".ux03-primary-tabs button")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(
    reducedMotionDuration
      .split(",")
      .every((duration) => Number.parseFloat(duration) === 0),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 640, height: 900 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /cost_query/ }).click();
  await page.screenshot({
    path: testInfo.outputPath("ux03-inspector-dark-1280.png"),
    fullPage: true,
  });
  await captureInspector(page, "inspector-dark-desktop-1280.png");
  const darkDesktopAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(darkDesktopAxe.violations).toEqual([]);
  await page.getByRole("button", { name: /simple_echo/ }).click();
  await page.getByText("Input JSON · exemplo sintético").click();
  await expect(page.locator(".ux03-schema-block pre")).toContainText(
    '"example"',
  );
  await page.getByRole("button", { name: "Copiar exemplo" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '"message": "example"',
  );
  await page.getByRole("button", { name: /cost_query/ }).click();
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await page.getByRole("button", { name: /Cost summary/ }).click();
  await expect(
    page.getByText("file:///fixture/cost?session_id=[REMOVIDO]"),
  ).toBeVisible();
  await expect(page.getByText(/Templates retornados: 1/)).toBeVisible();
  await page.getByRole("button", { name: "Prompts", exact: true }).click();
  await page.getByRole("button", { name: /summarize/ }).click();
  await expect(page.getByRole("heading", { name: "summarize" })).toBeVisible();
  await page.getByRole("button", { name: "Replicar / Exportar" }).click();
  await page.getByRole("button", { name: "VS Code · Copilot" }).click();
  const vscodeText = await page.locator(".ux03-export-code").innerText();
  const vscode = JSON.parse(vscodeText);
  expect(vscode.mcpServers.tesseractMcp.type).toBe("stdio");
  expect(vscode.mcpServers.tesseractMcp.tools).toBeUndefined();
  expect(JSON.stringify(vscode)).not.toContain("fixture-secret");
  await page.getByRole("button", { name: "Copiar configuração" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '"mcpServers"',
  );
  await captureInspector(page, "vscode-copilot-dark-desktop-1280.png");
  await page.getByRole("button", { name: "PowerShell · informativo" }).click();
  await expect(
    page.getByText(/não é uma configuração operacional de cliente PowerShell/),
  ).toBeVisible();
  await expect(page.locator(".ux03-export-code")).toContainText(
    "AI Shell foi arquivado",
  );
  await expect(page.locator(".ux03-export-code")).not.toContainText(
    '"servers"',
  );
  await page.getByRole("button", { name: "Copiar texto informativo" }).click();
  await expect(page.locator(".ux03-notice")).toContainText(
    "Texto informativo copiado",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "não é uma configuração operacional",
  );
  await captureInspector(page, "powershell-informative-dark-desktop-1280.png");
  await page.getByRole("button", { name: "Manifesto Tesseract" }).click();
  const manifest = JSON.parse(
    await page.locator(".ux03-export-code").innerText(),
  );
  expect(manifest.format).toBe("tesseract.capability-manifest");
  expect(JSON.stringify(manifest)).not.toContain("fixture-secret");
  await page.getByRole("button", { name: "Copiar manifesto" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '"tesseract.capability-manifest"',
  );
  await page.screenshot({
    path: testInfo.outputPath("ux03-export-dark-1280.png"),
    fullPage: true,
  });
  await captureInspector(page, "export-dark-desktop-1280.png");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await captureInspector(page, "export-light-desktop-1280.png");
  const lightDesktopAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(lightDesktopAxe.violations).toEqual([]);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("ux03-export-light-768.png"),
    fullPage: true,
  });
  await captureInspector(page, "export-light-tablet-768.png");
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("ux03-export-light-390.png"),
    fullPage: true,
  });
  await captureInspector(page, "export-light-mobile-390.png");
  expect(
    apiPaths.filter((path) =>
      /\/(call|approve-tools|test|connect|auth\/|inspect)$/.test(path),
    ),
  ).toEqual([]);
  expect(apiPaths.filter((path) => path.endsWith("/catalog"))).toHaveLength(1);
  expect(pageErrors).toEqual([]);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test("shows configured, empty, and not-advertised HTTP capabilities distinctly", async ({
  page,
}) => {
  const id = "22222222-2222-4222-8222-222222222222";
  const apiPaths: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    apiPaths.push(path);
    let json: any = [];
    if (path === "/api/bootstrap")
      json = {
        authenticated: false,
        csrf: "fixture",
        period: {
          from: "2026-09-01",
          toExclusive: "2026-10-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (path === "/api/mcp-connections")
      json = [
        {
          id,
          name: "HTTP vazio",
          preset: "custom",
          transport: "http",
          endpoint: "https://mcp.example.test/mcp",
          authMode: "none",
          status: "cadastrado",
        },
      ];
    if (path === "/api/mcp-presets") json = [];
    if (path.endsWith("/catalog"))
      json = {
        server: { name: "HTTP fixture" },
        capabilities: { tools: {}, resources: {} },
        tools: [],
        resources: { status: "empty", items: [] },
        prompts: { status: "not_advertised", items: [] },
      };
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await page.getByLabel("Conexão para análise").selectOption(id);
  await page.getByRole("button", { name: "Replicar / Exportar" }).click();
  await expect(
    page.getByText(/Configuração salva; capacidades não verificadas/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explorar MCP" }).click();
  await page.getByRole("button", { name: "Descobrir capacidades MCP" }).click();
  await expect(
    page.getByText(/O servidor anunciou Tools, mas não retornou itens/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await expect(
    page.getByText(/O servidor anunciou Resources, mas não retornou itens/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prompts", exact: true }).click();
  await expect(page.getByText(/O servidor não anunciou Prompts/)).toBeVisible();
  await page.getByRole("button", { name: "Replicar / Exportar" }).click();
  const config = JSON.parse(
    await page.locator(".ux03-export-code").innerText(),
  );
  expect(config.mcpServers.tesseractMcp.type).toBe("http");
  expect(config.mcpServers.tesseractMcp.url).toBe(
    "https://mcp.example.test/mcp",
  );
  expect(
    apiPaths.filter((path) =>
      /\/(call|approve-tools|test|connect|auth\/|inspect)$/.test(path),
    ),
  ).toEqual([]);
});
