import { test, expect } from "./fixtures.js";

test("uses the active application inventory to save a delegated ARM scope", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const accessId = "22222222-2222-4222-8222-222222222222";
  let saved: unknown;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let json: unknown = [];
    if (url.pathname === "/api/bootstrap")
      json = {
        authenticated: true,
        csrf: "t",
        period: {},
        activeAccessId: accessId,
        principalKind: "application",
      };
    if (url.pathname === "/api/accesses")
      json = [{ id: accessId, name: "Service Principal FinOps" }];
    if (url.pathname === "/api/subscriptions")
      json = [{ id, name: "Assinatura FinOps" }];
    if (url.pathname === "/api/resource-groups") {
      expect(url.searchParams.get("subscriptionId")).toBe(id);
      json = ["rg-finops"];
    }
    if (
      url.pathname === "/api/mcp-connections" &&
      route.request().method() === "POST"
    ) {
      saved = route.request().postDataJSON();
      json = { id };
    }
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Descoberta", exact: true }).click();
  await page
    .getByRole("button", { name: "Preparar cadastro ARM", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Assinatura", exact: true })
    .selectOption(id);
  await expect(page.getByLabel("Escopo ARM")).toHaveValue(
    `/subscriptions/${id}`,
  );
  await page
    .getByRole("combobox", { name: "Grupo de recursos (opcional)" })
    .selectOption("rg-finops");
  await expect(page.getByLabel("Escopo ARM")).toHaveValue(
    `/subscriptions/${id}/resourceGroups/rg-finops`,
  );
  await page
    .getByRole("combobox", { name: /Identidade Azure/ })
    .selectOption(accessId);
  await page.getByRole("button", { name: "Salvar MCP", exact: true }).click();
  await expect
    .poll(() => saved)
    .toMatchObject({
      preset: "arm",
      authMode: "delegated",
      resourceContext: {
        scope: `/subscriptions/${id}/resourceGroups/rg-finops`,
      },
    });
});
