import { test, expect } from "./fixtures.js";

test("filters discovered tools locally without changing approval or execution state", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const apiPaths: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    apiPaths.push(`${route.request().method()} ${path}`);
    let json: any = [];
    if (path === "/api/bootstrap")
      json = {
        authenticated: false,
        csrf: "fixture-csrf",
        period: { from: "2026-09-01", toExclusive: "2026-11-01" },
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
    if (path === `/api/mcp-connections/${id}/catalog`)
      json = {
        server: { name: "Fixture MCP", version: "1" },
        capabilities: { tools: {} },
        prompts: { status: "not_advertised", items: [] },
        resources: { status: "not_advertised", items: [] },
        tools: [
          {
            name: "pricing_get",
            description: "Consulta demonstrativa de custos",
            reviewable: true,
            approved: false,
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "budget_summary",
            description: "Resumo demonstrativo de orçamento",
            reviewable: true,
            approved: false,
            inputSchema: { type: "object", properties: {} },
          },
        ],
      };
    await route.fulfill({ json });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await page.getByLabel("Conexão para análise").selectOption(id);
  await page.getByRole("button", { name: "Descobrir capacidades MCP" }).click();
  await expect(
    page.getByRole("heading", { name: /Tools descobertas \(2\)/ }),
  ).toBeVisible();
  const search = page.getByRole("searchbox", {
    name: "Buscar tools descobertas",
  });
  const save = page.getByRole("button", { name: "Salvar tools permitidas" });
  await expect(save).toBeDisabled();
  const pathsAfterDiscovery = [...apiPaths];

  await search.fill("cUsToS");
  await expect(page.locator(".tool-row")).toContainText("pricing_get");
  await expect(page.locator(".tool-row")).not.toContainText("budget_summary");
  await search.fill("orçamento");
  await expect(page.locator(".tool-row")).toContainText("budget_summary");
  await expect(page.locator(".tool-row")).not.toContainText("pricing_get");
  await search.fill("sem-correspondência");
  await expect(
    page.getByText("Nenhuma tool corresponde a esta busca.", { exact: true }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  expect(apiPaths).toEqual(pathsAfterDiscovery);
  expect(apiPaths.some((path) => /\/(approve-tools|call)$/.test(path))).toBe(
    false,
  );
});
