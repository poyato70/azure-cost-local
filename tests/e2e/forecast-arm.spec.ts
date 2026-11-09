import { test, expect } from "./fixtures.js";
const tenantId = "11111111-1111-4111-8111-111111111111",
  subscriptionId = "22222222-2222-4222-8222-222222222222";
test("shows Forecast and Actual separately and offers the official delegated ARM preset", async ({
  page,
}) => {
  await page.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname;
    let json: any = [];
    if (p === "/api/bootstrap")
      json = {
        csrf: "t",
        authenticated: true,
        configured: true,
        tenantId,
        period: {
          from: "2026-11-01",
          toExclusive: "2026-12-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (p === "/api/subscriptions")
      json = [{ id: subscriptionId, tenantId, name: "Test subscription" }];
    if (p === "/api/forecast/query")
      json = {
        basis: "ActualCost",
        meta: {
          source: "Azure Forecast fixture",
          status: "complete",
          warnings: ["Previsão não é fatura."],
        },
        forecastTotals: [{ currency: "BRL", amount: "42" }],
        actualTotals: [{ currency: "BRL", amount: "10" }],
        rows: [
          {
            date: "2026-11-02",
            costStatus: "Actual",
            currency: "BRL",
            amount: "10",
          },
          {
            date: "2026-11-05",
            costStatus: "Forecast",
            currency: "BRL",
            amount: "42",
          },
        ],
      };
    await r.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await page
    .getByLabel("Incluir realizados, apresentados separadamente")
    .check();
  await page.getByRole("button", { name: "Consultar previsão Azure" }).click();
  await expect(
    page.getByRole("heading", { name: "Valores previstos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Valores realizados retornados pelo Azure",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Previsto", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await page.getByLabel("Serviço", { exact: true }).selectOption("arm");
  await expect(page.getByLabel("Endpoint MCP")).toHaveValue(
    "https://mcp.management.azure.com",
  );
  await expect(page.getByLabel("scope", { exact: true })).toBeVisible();
  await expect(page.getByText(/MCP.Access/)).toBeVisible();
});
