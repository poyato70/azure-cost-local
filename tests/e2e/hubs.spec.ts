import { test, expect } from "./fixtures.js";
const tenantId = "11111111-1111-4111-8111-111111111111",
  subscriptionId = "22222222-2222-4222-8222-222222222222",
  accessId = "33333333-3333-4333-8333-333333333333",
  hubId = "44444444-4444-4444-8444-444444444444";
test("creates a traceable analyst draft without choosing credentials", async ({
  page,
}) => {
  await page.route("**/api/**", (r) =>
    r.fulfill({
      json:
        new URL(r.request().url()).pathname === "/api/bootstrap"
          ? {
              csrf: "t",
              authenticated: false,
              configured: false,
              tenantId: "",
              clientId: "",
              period: {
                from: "2026-09-01",
                toExclusive: "2026-11-01",
                timeZone: "America/Sao_Paulo",
              },
            }
          : [],
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Agentes", exact: true }).click();
  await page
    .getByRole("button", { name: "Usar perfil Analista FinOps" })
    .click();
  await expect(page.getByLabel("Nome do agente", { exact: true })).toHaveValue(
    "Analista FinOps",
  );
  await expect(page.getByText(/Perfil finops-analyst/)).toBeVisible();
  await expect(page.getByLabel("Instruções", { exact: true })).toContainText(
    "",
  );
  await expect(page.getByLabel("Instruções", { exact: true })).toHaveValue(
    /Não some/,
  );
});
test("queries Hub and shows explicit informative reconciliation without hiding differences", async ({
  page,
}) => {
  let operation = "";
  const profile = {
    id: hubId,
    name: "Hub de teste",
    accessId,
    transport: "api",
    endpoint: "https://test.westeurope.kusto.windows.net",
    database: "Hub",
    schemaVersion: "v1_2",
    configurationVersion: 1,
  };
  await page.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname;
    let json: any = [];
    if (p === "/api/bootstrap")
      json = {
        csrf: "t",
        authenticated: true,
        configured: true,
        tenantId,
        clientId: accessId,
        activeAccessId: accessId,
        period: {
          from: "2026-09-01",
          toExclusive: "2026-11-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (p === "/api/accesses")
      json = [
        {
          id: accessId,
          name: "Acesso de teste",
          tenantId,
          clientId: accessId,
          preferredMode: "user",
        },
      ];
    if (p === "/api/subscriptions")
      json = [{ id: subscriptionId, tenantId, name: "Subscription de teste" }];
    if (p === "/api/resource-groups") json = ["rg-test"];
    if (p === "/api/hubs") json = [profile];
    if (p === `/api/hubs/${hubId}/query`) {
      operation = r.request().postDataJSON().operation;
      json = {
        hub: {
          focusBasis: "BilledCost",
          meta: {
            source: "Hub sintético",
            period: { from: "2026-09-01", toExclusive: "2026-11-01" },
            warnings: ["Cobertura não certificada."],
          },
          rows: [{ date: "2026-09-01", currency: "BRL", amount: "42.10" }],
        },
        comparison: {
          status: "not_comparable",
          message: "Comparação informativa; bases não certificadas.",
          rows: [
            {
              currency: "BRL",
              hub: "42.10",
              costManagement: "40",
              difference: "2.10",
              percent: "5.25",
            },
          ],
        },
      };
    }
    await r.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "FinOps hub", exact: true }).click();
  await page
    .getByLabel("Subscription", { exact: true })
    .selectOption(subscriptionId);
  await page
    .getByLabel("Resource group", { exact: true })
    .selectOption("rg-test");
  await page.getByRole("button", { name: "FinOps hub", exact: true }).click();
  await page.getByLabel("Hub selecionado", { exact: true }).selectOption(hubId);
  await page
    .getByRole("button", { name: "Conciliar com Cost Management" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conciliação informativa" }),
  ).toBeVisible();
  expect(operation).toBe("reconcile");
  await expect(
    page.getByRole("cell", { name: "2.10", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByText(/Fonte: FinOps hub selecionado/)).toBeVisible();
});
