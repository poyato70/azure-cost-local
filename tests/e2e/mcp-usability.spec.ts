import { test, expect } from "@playwright/test";
const a = "11111111-1111-4111-8111-111111111111",
  m = "22222222-2222-4222-8222-222222222222";
test("discovers tools, renders a nested schema and displays the executed result", async ({
  page,
}) => {
  let approved = false;
  let called: any;
  const tool = () => ({
    name: "pricing_get",
    reviewable: true,
    approved,
    inputSchema: {
      type: "object",
      required: ["request"],
      properties: {
        request: {
          type: "object",
          required: ["sku"],
          properties: {
            sku: { type: "string", description: "SKU exata" },
            currency: { type: "string", default: "USD" },
            service: { type: "string" },
            "service-family": { type: "string" },
            "price-type": { type: "string" },
            region: { type: "string" },
            includeSavingsPlan: { type: "boolean" },
          },
        },
      },
    },
  });
  await page.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname;
    let json: any = [];
    if (p === "/api/bootstrap")
      json = {
        csrf: "t",
        authenticated: false,
        configured: false,
        period: {
          from: "2026-09-01",
          toExclusive: "2026-11-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (p === "/api/mcp-connections")
      json = [
        {
          id: m,
          name: "Preços Azure",
          preset: "azure",
          transport: "stdio",
          authMode: "application",
          status: "cadastrado",
          capability: { status: "pending" },
        },
      ];
    if (p.endsWith("/test")) json = { connected: true, tools: [tool()] };
    if (p.endsWith("/approve-tools")) {
      approved = true;
      json = { ok: true };
    }
    if (p.endsWith("/call")) {
      called = r.request().postDataJSON();
      json = {
        source: "mcp",
        result: {
          content: [{ type: "text", text: "Preço de teste: 1.25 USD" }],
        },
      };
    }
    await r.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await page.getByRole("button", { name: "Conectar e listar tools" }).click();
  await expect(
    page.getByRole("heading", { name: /Tools descobertas \(1\)/ }),
  ).toBeVisible();
  await page.locator(".tool-row input[type=checkbox]").check();
  await page.getByRole("button", { name: "Salvar tools permitidas" }).click();
  await page.getByLabel("Tools", { exact: true }).selectOption("pricing_get");
  await expect(
    page.getByLabel("request.currency", { exact: true }),
  ).toHaveValue("BRL");
  await expect(page.getByLabel("request.sku", { exact: true })).toHaveValue(
    "Standard_D4s_v5",
  );
  await page.getByLabel("request.sku", { exact: true }).fill("Standard_D2s_v5");
  await page.getByLabel("request.region", { exact: true }).fill("eastus");
  await page.getByRole("button", { name: "Executar tool selecionada" }).click();
  await expect(
    page.getByRole("heading", { name: "Resultado de pricing_get" }),
  ).toBeVisible();
  expect(called.arguments).toEqual({
    request: {
      sku: "Standard_D2s_v5",
      region: "eastus",
      currency: "BRL",
      service: "Virtual Machines",
      "service-family": "Compute",
      "price-type": "Consumption",
    },
  });
  await page.getByLabel("request.sku", { exact: true }).fill("");
  await page.getByLabel("request.currency", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "Executar tool selecionada" }).click();
  await expect.poll(() => called.arguments.request.sku).toBe("Standard_D4s_v5");
  expect(called.arguments.request.currency).toBe("BRL");
  await expect(
    page.getByRole("region", { name: "Resultado da tool" }),
  ).toContainText("1.25 USD");
  await page
    .getByRole("region", { name: "Resultado da tool" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/mcp-schema-result.png" });
});
test("filters subscription names using a wildcard search", async ({ page }) => {
  await page.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname;
    await r.fulfill({
      json:
        p === "/api/bootstrap"
          ? {
              csrf: "t",
              authenticated: true,
              configured: true,
              tenantId: a,
              period: {
                from: "2026-09-01",
                toExclusive: "2026-11-01",
                timeZone: "America/Sao_Paulo",
              },
            }
          : p === "/api/subscriptions"
            ? [
                { id: a, name: "COMMON", tenantId: a },
                { id: m, name: "BB-GRNUV-PROD", tenantId: a },
                {
                  id: "33333333-3333-4333-8333-333333333333",
                  name: "OTHER",
                  tenantId: a,
                },
              ]
            : [],
    });
  });
  await page.goto("/");
  await page.getByLabel("Buscar subscription").fill("*grnuv*");
  await expect(
    page
      .getByLabel("Subscription", { exact: true })
      .getByRole("option", { name: "BB-GRNUV-PROD" }),
  ).toHaveCount(1);
  await expect(
    page
      .getByLabel("Subscription", { exact: true })
      .getByRole("option", { name: "COMMON" }),
  ).toHaveCount(1);
  await expect(
    page
      .getByLabel("Subscription", { exact: true })
      .getByRole("option", { name: "OTHER" }),
  ).toHaveCount(0);
});
