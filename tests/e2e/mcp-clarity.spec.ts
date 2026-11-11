import { test, expect } from "./fixtures.js";
const id = "11111111-1111-4111-8111-111111111111",
  accessId = "22222222-2222-4222-8222-222222222222";
test("shows transport before save, deletes without empty JSON and isolates analysis errors", async ({
  page,
}) => {
  let fail = true,
    deleted = false,
    identity = false;
  await page.route("**/api/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    let json: any = [];
    if (p === "/api/bootstrap")
      json = { authenticated: false, csrf: "t", period: {} };
    if (p === "/api/accesses")
      json = [
        {
          id: accessId,
          name: "FinOps aplicação",
          tenantId: accessId,
          clientId: accessId,
        },
      ];
    if (p === "/api/mcp-connections")
      json = deleted
        ? []
        : [
            {
              id,
              name: "Nome sem protocolo",
              preset: "azure",
              transport: "stdio",
              authMode: "application",
              accessId,
              resourceContext: { namespace: "advisor" },
              approvedTools: [],
            },
          ];
    if (
      p === `/api/mcp-connections/${id}` &&
      route.request().method() === "DELETE"
    ) {
      expect(route.request().headers()["content-type"]).toBeUndefined();
      if (fail) {
        fail = false;
        await route.fulfill({
          status: 500,
          json: {
            message: "Falha exclusiva da exclusão",
            requestId: "trace-delete",
          },
        });
        return;
      }
      deleted = true;
      json = { ok: true };
    }
    if (p === `/api/accesses/${accessId}/connect`) {
      identity = true;
      json = { connected: true };
    }
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Integração", exact: true }).click();
  const form = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Cadastrar MCP", exact: true }),
  });
  await expect(form.locator(".mcp-details")).toContainText("Sem endpoint HTTP");
  const card = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Nome sem protocolo",
      exact: true,
    }),
  });
  await expect(card).toContainText("advisor");
  await expect(card).toContainText("Client Credentials");
  await card.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Falha exclusiva" }),
  ).toContainText("trace-delete");
  await card
    .getByRole("button", { name: "Analisar tools", exact: true })
    .click();
  await expect(page.getByText(/Catálogo ainda não consultado/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Tools descobertas/ }),
  ).not.toBeVisible();
  await expect(
    page.getByText("Falha exclusiva da exclusão", { exact: false }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Excluir", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Conectar identidade FinOps aplicação" })
    .click();
  await expect.poll(() => identity).toBe(true);
  await page.getByRole("button", { name: "Integração", exact: true }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nome sem protocolo", exact: true }),
  ).not.toBeVisible();
});
test("discovers registry records and prepares a reviewed registration", async ({
  page,
}) => {
  let searched = false;
  await page.route("**/api/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    let json: any = [];
    if (p === "/api/bootstrap")
      json = { authenticated: false, csrf: "t", period: {} };
    if (p === "/api/mcp-registry/search") {
      searched = true;
      expect(route.request().postDataJSON().query).toBe("com.microsoft/azure");
      json = {
        source: "https://registry.modelcontextprotocol.io",
        queriedAt: new Date().toISOString(),
        servers: [
          {
            name: "com.microsoft/azure",
            version: "3.0.0",
            description: "Azure registrado",
            status: "active",
            packages: [
              {
                identifier: "@azure/mcp",
                version: "3.0.0",
                registryType: "npm",
                transport: "stdio",
              },
            ],
            remotes: [],
          },
          {
            name: "fixture/second",
            version: "1",
            description: "Segunda opção",
            status: "active",
            packages: [],
            remotes: [],
          },
        ],
      };
    }
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Descoberta", exact: true }).click();
  await page
    .getByRole("button", { name: "Buscar servidores", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "com.microsoft/azure", exact: true }),
  ).toBeVisible();
  expect(searched).toBe(true);
  const chooser = page.getByLabel("Servidor encontrado");
  await expect(
    page.getByRole("heading", { name: "fixture/second", exact: true }),
  ).toHaveCount(0);
  await chooser.selectOption("1");
  await expect(
    page.getByRole("heading", { name: "fixture/second", exact: true }),
  ).toBeVisible();
  await chooser.selectOption("0");
  await page
    .getByRole("button", { name: "Preparar cadastro Azure", exact: true })
    .click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Azure MCP",
  );
  await expect(
    page.getByText("Sem endpoint HTTP — comunicação por stdin/stdout", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await page.getByRole("button", { name: "Integração", exact: true }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Descoberta", exact: true }).click();
  await page
    .getByRole("button", { name: "Preparar cadastro ARM", exact: true })
    .click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Azure Resource Manager MCP",
  );
  await expect(page.getByLabel("Endpoint MCP", { exact: true })).toHaveValue(
    "https://mcp.management.azure.com",
  );
});
