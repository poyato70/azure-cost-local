import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/(accesses|mcp-connections|agents)$/, (r) =>
    r.fulfill({ json: [] }),
  );
});

const tenantId = "11111111-1111-4111-8111-111111111111",
  subscriptionId = "22222222-2222-4222-8222-222222222222";
const period = {
  from: "2026-09-01",
  toExclusive: "2026-11-01",
  timeZone: "America/Sao_Paulo",
};
const meta = {
  scope: { tenantId, subscriptionId },
  period,
  source: "API simulada somente neste teste",
  status: "complete",
  fetchedAt: "2026-11-01T12:00Z",
  warnings: [],
};
test("opens Microsoft login in a separate window and updates the original dashboard", async ({
  page,
}) => {
  let done = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = {};
    if (path === "/api/bootstrap")
      json = {
        csrf: "test",
        authenticated: done,
        configured: true,
        tenantId,
        clientId: subscriptionId,
        period,
      };
    if (path === "/api/auth/login") {
      done = true;
      json = { url: "http://localhost:4317/auth/complete" };
    }
    if (path === "/api/subscriptions") json = [];
    await route.fulfill({ json });
  });
  await page.goto("/");
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Entrar com Microsoft/ }).click();
  const popup = await popupEvent;
  expect(popup).not.toBe(page);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible({ timeout: 10000 });
});
test("shows actionable login error returned by the local callback", async ({
  page,
}) => {
  await page.route("**/api/bootstrap", (r) =>
    r.fulfill({
      json: {
        csrf: "test",
        authenticated: false,
        configured: true,
        tenantId,
        clientId: subscriptionId,
        period,
        loginError: {
          code: "auth_configuration",
          message: "AADSTS7000218: configure Aplicativos móveis e de desktop.",
        },
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("AADSTS7000218");
  await expect(
    page.getByRole("heading", { name: "Conecte sua conta Azure" }),
  ).toBeVisible();
});
test("ignores a late cost response after switching resource groups", async ({
  page,
}) => {
  let oldStarted!: () => void, releaseOld!: () => void;
  const started = new Promise<void>((r) => (oldStarted = r)),
    gate = new Promise<void>((r) => (releaseOld = r));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = {};
    if (path === "/api/bootstrap")
      json = {
        authenticated: true,
        configured: true,
        csrf: "t",
        tenantId,
        period,
      };
    else if (path === "/api/subscriptions")
      json = [{ id: subscriptionId, tenantId, name: "Teste" }];
    else if (path === "/api/resource-groups") json = ["rg-a", "rg-b"];
    else if (path === "/api/costs/compare") json = { comparison: [] };
    else if (path === "/api/costs/query") {
      const q = route.request().postDataJSON();
      const old = q.scope.resourceGroup === "rg-a";
      if (old) {
        oldStarted();
        await gate;
      }
      json = {
        meta,
        basis: "ActualCost",
        rows: [],
        totals: [{ currency: "USD", amount: old ? "999" : "22" }],
      };
    }
    try {
      await route.fulfill({ json });
    } catch {
      /* Browser intentionally cancelled the old request. */
    }
  });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Resource group", exact: true })
    .selectOption("rg-a");
  await page
    .getByRole("button", { name: "Consultar custos", exact: true })
    .click();
  await started;
  await page
    .getByRole("combobox", { name: "Resource group", exact: true })
    .selectOption("rg-b");
  await expect(page.getByTestId("totals")).toContainText("22,00");
  releaseOld();
  await expect(page.getByTestId("totals")).not.toContainText("999");
});
test("shows setup without fake spend or password fields", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Conecte sua conta Azure" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tenant ID")).toBeVisible();
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  await expect(
    page.getByText("Nenhum dado financeiro carregado"),
  ).toBeVisible();
});
test("keeps currencies distinct, budgets empty and chat uses returned costs", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: any;
    if (path === "/api/bootstrap")
      body = {
        authenticated: true,
        configured: true,
        csrf: "test",
        tenantId,
        clientId: subscriptionId,
        period,
      };
    else if (path === "/api/subscriptions")
      body = [{ id: subscriptionId, tenantId, name: "Subscription de teste" }];
    else if (path === "/api/resource-groups") body = ["rg-a", "rg-b"];
    else if (path === "/api/costs/query")
      body = {
        meta,
        basis: "ActualCost",
        rows: [
          {
            date: "2026-09-01",
            dimension: "Compute",
            amount: "42",
            currency: "USD",
          },
          {
            date: "2026-09-01",
            dimension: "Storage",
            amount: "10",
            currency: "BRL",
          },
        ],
        totals: [
          { currency: "USD", amount: "42" },
          { currency: "BRL", amount: "10" },
        ],
      };
    else if (path === "/api/costs/compare")
      body = { comparison: [{ currency: "USD", delta: "2", percent: "5" }] };
    else if (path === "/api/budgets/query") body = { meta, items: [] };
    else if (path === "/api/chat/status")
      body = { available: true, message: "Copilot simulado no teste" };
    else if (path === "/api/chat")
      return route.fulfill({
        contentType: "application/x-ndjson",
        body:
          JSON.stringify({
            type: "text",
            text: "No período de setembro e outubro: USD 42,00. Fonte: Cost Management.",
          }) + "\n",
      });
    else body = {};
    await route.fulfill({ json: body });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Consultar custos", exact: true })
    .click();
  await expect(page.getByTestId("totals")).toContainText("42,00");
  await expect(page.getByTestId("totals")).toContainText("10,00");
  await page.getByRole("button", { name: "Budgets", exact: true }).click();
  await page.getByRole("button", { name: "Consultar budgets" }).click();
  await expect(page.getByText("Nenhum orçamento configurado")).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByLabel("Autorizo enviar o contexto necessário ao GitHub Copilot")
    .check();
  await page
    .getByLabel("Sua pergunta")
    .fill("Quanto gastei nos dois últimos meses?");
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(
    page.getByText(/No período de setembro e outubro/),
  ).toBeVisible();
});
test("forbidden is shown as error, not zero", async ({ page }) => {
  await page.route(/\/api\/(accesses|mcp-connections|agents)$/, (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route("**/api/bootstrap", (r) =>
    r.fulfill({
      json: {
        authenticated: true,
        configured: true,
        csrf: "t",
        tenantId,
        period,
      },
    }),
  );
  await page.route("**/api/subscriptions", (r) =>
    r.fulfill({ json: [{ id: subscriptionId, tenantId, name: "Teste" }] }),
  );
  await page.route("**/api/resource-groups*", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/costs/query", (r) =>
    r.fulfill({
      status: 403,
      json: { code: "forbidden", message: "Sem permissão Azure neste escopo." },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Consultar custos", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Sem permissão");
  await expect(page.getByTestId("totals")).toHaveCount(0);
});
