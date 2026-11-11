import { test, expect } from "./fixtures.js";
test("analysis isolates configuration actions and shares discovered tools with the executor", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  let release!: () => void, reached!: () => void;
  const pending = new Promise<void>((r) => (release = r)),
    started = new Promise<void>((r) => (reached = r));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === "/api/bootstrap")
      json = {
        authenticated: false,
        csrf: "t",
        period: {
          from: "2026-09-01",
          toExclusive: "2026-11-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (path === "/api/mcp-connections")
      json = [
        {
          id,
          name: "Fixture MCP",
          preset: "azure",
          transport: "stdio",
          status: "cadastrado",
          authMode: "application",
          capability: { status: "pending" },
        },
      ];
    if (path.endsWith("/catalog")) {
      reached();
      await pending;
      json = {
        server: { name: "Fixture", version: "1" },
        capabilities: { tools: {} },
        prompts: { status: "not_advertised", items: [] },
        resources: { status: "not_advertised", items: [] },
        tools: [
          {
            name: "pricing_get",
            reviewable: true,
            approved: false,
            inputSchema: {
              type: "object",
              properties: { sku: { type: "string" } },
            },
          },
        ],
      };
    }
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nova conexão", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Editar", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Conexão para análise").selectOption(id);
  await page
    .getByRole("button", { name: "Listar capacidades, prompts e resources" })
    .click();
  await started;
  await expect(
    page.getByRole("button", { name: "Conectar e listar tools" }),
  ).toHaveCount(0);
  release();
  await expect(
    page.getByRole("heading", { name: /Tools descobertas \(1\)/ }),
  ).toBeVisible();
  await page.getByText("Prompts e recursos", { exact: true }).click();
  await expect(
    page.getByText("Não anunciado pelo servidor").first(),
  ).toBeVisible();
});
