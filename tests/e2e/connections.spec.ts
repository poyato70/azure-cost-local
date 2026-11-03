import { test, expect } from "@playwright/test";
const tenantId = "11111111-1111-4111-8111-111111111111",
  clientId = "22222222-2222-4222-8222-222222222222";
test("saves a named application access without reading back its Secret Value", async ({
  page,
}) => {
  let profiles: any[] = [];
  let saved: any;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: any = [];
    if (path === "/api/bootstrap")
      json = {
        csrf: "test",
        authenticated: false,
        configured: false,
        tenantId: "",
        clientId: "",
        period: {
          from: "2026-09-01",
          toExclusive: "2026-11-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    if (path === "/api/accesses") {
      if (route.request().method() === "POST") {
        saved = route.request().postDataJSON();
        profiles = [
          {
            ...saved,
            id: clientId,
            secretAction: undefined,
            secretConfigured: true,
            configurationVersion: 1,
            credentialVersion: 1,
          },
        ];
        json = profiles[0];
      } else json = profiles;
    }
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Acessos", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Aplicação de teste");
  await page.getByLabel("Tenant ID", { exact: true }).fill(tenantId);
  await page
    .getByLabel("Application (Client) ID", { exact: true })
    .fill(clientId);
  await page.getByLabel("Modo preferido").selectOption("application");
  await page
    .getByLabel("Secret Value", { exact: true })
    .selectOption("replace");
  await page
    .getByLabel("Valor do Secret (não é Secret ID)")
    .fill("synthetic-only-secret");
  await page.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(
    page.getByText("Secret configurado", { exact: false }),
  ).toBeVisible();
  expect(saved.secretAction.value).toBe("synthetic-only-secret");
  await expect(page.locator("input[type=password]")).toHaveCount(0);
});
test("exposes the independent agent selector and MCP configuration", async ({
  page,
}) => {
  await page.route("**/api/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    await r.fulfill({
      json:
        path === "/api/bootstrap"
          ? {
              csrf: "test",
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
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByLabel("Assistente do chat").selectOption("agent");
  await expect(
    page.getByLabel("Agente cadastrado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Servidores MCP" }),
  ).toBeVisible();
  await page.getByLabel("Serviço", { exact: true }).selectOption("powerbi");
  await expect(page.getByLabel("Endpoint MCP")).toHaveValue(
    "https://api.fabric.microsoft.com/v1/mcp/powerbi",
  );
});
