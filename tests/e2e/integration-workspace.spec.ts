import { test, expect } from "./fixtures.js";
test("workspace remains usable on desktop and mobile", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      json:
        path === "/api/bootstrap"
          ? { authenticated: false, csrf: "local", period: {} }
          : [],
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Conecte capacidades/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Conhecimento e skills", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conhecimento e skills", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
});
test("editing a Bearer connection explains the protected credential is retained", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === "/api/bootstrap")
      json = { authenticated: false, csrf: "local", period: {} };
    if (path === "/api/mcp-connections")
      json = [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "OpenShift",
          preset: "kubernetes",
          transport: "http",
          endpoint: "https://mcp.example.net/mcp",
          authMode: "bearer",
          tokenConfigured: true,
          configurationVersion: 1,
          resourceContext: {},
          approvedTools: [],
        },
      ];
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Integração", exact: true }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByLabel(
      "Token do endpoint MCP (já protegido; deixe vazio para manter)",
    ),
  ).toBeVisible();
});
test("independent investigation does not offer a Copilot check", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === "/api/bootstrap")
      json = { authenticated: false, csrf: "local", period: {} };
    if (path === "/api/mcp-connections")
      json = [
        {
          id,
          name: "OpenShift",
          preset: "kubernetes",
          transport: "http",
          authMode: "none",
          resourceContext: {},
          approvedTools: [],
        },
      ];
    if (path === "/api/agents")
      json = [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Analista",
          provider: "azure-chat-v1",
          mcpConnectionIds: [id],
          configurationVersion: 1,
        },
      ];
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Investigações", exact: true })
    .click();
  await page.getByLabel("Conexão MCP independente").selectOption(id);
  await expect(
    page.getByRole("heading", { name: "Investigue com seu agente" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verificar Copilot" }),
  ).not.toBeVisible();
});
test("starts with integration journey and saves independent MCP without Azure", async ({
  page,
}) => {
  let body: any;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === "/api/bootstrap")
      json = {
        authenticated: false,
        csrf: "local",
        period: {
          from: "2026-09-01",
          toExclusive: "2026-11-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (
      path === "/api/mcp-connections" &&
      route.request().method() === "POST"
    ) {
      body = route.request().postDataJSON();
      json = { id: "test" };
    }
    await route.fulfill({ json });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Conecte capacidades.*Investigue com evidências/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Conecte sua conta Azure", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: /1. Conectar/ }).click();
  await page.getByLabel("Serviço", { exact: true }).selectOption("kubernetes");
  await page.getByLabel("Nome", { exact: true }).fill("OpenShift teste");
  await page
    .getByLabel("Endpoint MCP", { exact: true })
    .fill("https://mcp.example.net/mcp");
  await expect(
    page.getByLabel("Acesso vinculado", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Salvar MCP", exact: true }).click();
  await expect.poll(() => body?.preset).toBe("kubernetes");
  expect(body.authMode).toBe("none");
  expect(body.accessId).toBeUndefined();
});
test("knowledge displays pinned source and content without running Markdown", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === "/api/bootstrap")
      json = { authenticated: false, csrf: "local", period: {} };
    if (path === "/api/knowledge")
      json = [
        {
          id: "doc",
          name: "Skill FinOps",
          path: "SKILL.md",
          commit: "a".repeat(40),
          contentHash: "b".repeat(64),
          url:
            "https://github.com/example/catalog/blob/" +
            "a".repeat(40) +
            "/SKILL.md",
          license: "MIT",
          importedAt: "2026-11-10T12:00:00Z",
          content: "# Instrução revisada\n<script>window.unsafe=true</script>",
        },
      ];
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Conhecimento e skills", exact: true })
    .click();
  await page
    .getByLabel("Pesquisar no nome, caminho e conteúdo")
    .fill("revisada");
  await expect(
    page.getByRole("heading", { name: "Skill FinOps" }),
  ).toBeVisible();
  await page.getByText("Conteúdo e integridade", { exact: true }).click();
  await expect(page.getByText(/<script>window.unsafe/)).toBeVisible();
  expect(await page.evaluate(() => (window as any).unsafe)).toBeUndefined();
});
