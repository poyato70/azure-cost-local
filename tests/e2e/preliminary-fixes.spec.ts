import { test, expect } from "./fixtures.js";
const tenantId = "11111111-1111-4111-8111-111111111111",
  subscriptionId = "22222222-2222-4222-8222-222222222222";
const period = {
  from: "2026-09-01",
  toExclusive: "2026-11-01",
  timeZone: "America/Sao_Paulo",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === "/api/bootstrap")
      json = {
        authenticated: true,
        configured: true,
        csrf: "test",
        tenantId,
        clientId: subscriptionId,
        period,
      };
    else if (path === "/api/subscriptions")
      json = [{ id: subscriptionId, tenantId, name: "GENUV" }];
    else if (path === "/api/resource-groups")
      json = ["rg-finops", "rg-dados", "rg-web"];
    else if (path === "/api/diagnostics")
      json = [
        {
          time: "2026-11-06T10:00:00Z",
          source: "Azure",
          operation: "query",
          status: "429",
          detail: "Espera Azure de teste",
          requestId: "req-1",
          attempt: 1,
        },
        {
          time: "2026-11-06T09:00:00Z",
          source: "Inventário",
          operation: "list",
          status: "200",
          detail: "Inventário de teste",
          requestId: "req-2",
        },
      ];
    else if (path === "/api/chat")
      return route.fulfill({
        contentType: "application/x-ndjson",
        body:
          [
            {
              type: "context",
              requestId: "req-3",
              runtime: "Copilot local",
              source: "APIs Azure Cost Management",
              tools: ["azure_query"],
            },
            { type: "progress", message: "Consulta de teste em execução" },
            {
              type: "usage",
              inputTokens: 10,
              outputTokens: 0,
              toolCalls: 1,
              durationMs: 1234,
              provider: "GitHub Copilot",
            },
            { type: "text", text: "Resposta de teste" },
          ]
            .map((e) => JSON.stringify(e))
            .join("\n") + "\n",
      });
    await route.fulfill({ json });
  });
});
test("filters RGs and searches compact diagnostics by status and operation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Buscar resource group", { exact: true })
    .fill("finops");
  await expect(
    page.getByLabel("Resource group", { exact: true }).getByRole("option"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Diagnóstico", exact: true }).click();
  await page.getByLabel("Status do log", { exact: true }).selectOption("429");
  await expect(
    page.getByRole("log").getByText(/Espera Azure de teste/),
  ).toBeVisible();
  await expect(
    page.getByRole("log").getByText(/Inventário de teste/),
  ).toHaveCount(0);
  await page.getByLabel("Pesquisar no log", { exact: true }).fill("req-2");
  await expect(
    page.getByText("Nenhum evento corresponde aos filtros."),
  ).toBeVisible();
  await page.getByLabel("Status do log", { exact: true }).selectOption("");
  await expect(
    page.getByRole("log").getByText(/Inventário de teste/),
  ).toBeVisible();
});
test("offers Copilot without Azure endpoint and shows source progress usage and revocable session consent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Agentes", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Usar Copilot local (sem endpoint)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Endpoint Azure OpenAI / Foundry", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ir para o chat com Copilot", exact: true })
    .click();
  await page
    .getByLabel("Autorizo enviar o contexto necessário ao GitHub Copilot", {
      exact: true,
    })
    .check();
  await page
    .getByLabel(
      "Lembrar autorização para este provedor nesta sessão do navegador",
      { exact: true },
    )
    .check();
  await page
    .getByLabel("Sua pergunta", { exact: true })
    .fill("Quais custos tenho?");
  await page
    .getByRole("button", { name: "Enviar pergunta", exact: true })
    .click();
  await expect(
    page.getByText("Contexto efetivo da consulta", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Consulta de teste em execução", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/tokens de entrada: 10 · saída: 0/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Custos", exact: true }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(
    page.getByLabel("Autorizo enviar o contexto necessário ao GitHub Copilot", {
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("button", {
      name: "Revogar autorização de contexto",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Autorizo enviar o contexto necessário ao GitHub Copilot", {
      exact: true,
    }),
  ).not.toBeChecked();
});
test("revoking consent cancels an active chat request", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/chat", async (route) => {
    await pending;
    await route
      .fulfill({ contentType: "application/x-ndjson", body: "" })
      .catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByLabel("Autorizo enviar o contexto necessário ao GitHub Copilot", {
      exact: true,
    })
    .check();
  await page.getByLabel("Sua pergunta", { exact: true }).fill("Quais custos?");
  const sent = page.waitForRequest(
    (r) => new URL(r.url()).pathname === "/api/chat",
  );
  await page
    .getByRole("button", { name: "Enviar pergunta", exact: true })
    .click();
  await sent;
  const aborted = page.waitForEvent(
    "requestfailed",
    (r) => new URL(r.url()).pathname === "/api/chat",
  );
  await page
    .getByRole("button", {
      name: "Revogar autorização de contexto",
      exact: true,
    })
    .click();
  await aborted;
  release();
  await expect(
    page.getByText(/Autorização revogada; execução cancelada/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar pergunta", exact: true }),
  ).toBeDisabled();
});
