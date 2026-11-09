import { test, expect } from "@playwright/test";
test("tag editing does not resend the applied financial query", async ({
  page,
}) => {
  const tenantId = "11111111-1111-4111-8111-111111111111",
    subscriptionId = "22222222-2222-4222-8222-222222222222";
  const period = {
    from: "2026-09-01",
    toExclusive: "2026-11-01",
    timeZone: "America/Sao_Paulo",
  };
  let calls = 0;
  await page.addInitScript(() =>
    localStorage.setItem("tesseract-welcome-hidden", "1"),
  );
  await page.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname;
    let json: any = [];
    if (p === "/api/bootstrap")
      json = { authenticated: true, csrf: "test", tenantId, period };
    if (p === "/api/subscriptions")
      json = [{ id: subscriptionId, name: "Teste", tenantId }];
    if (p === "/api/costs/query") {
      calls++;
      expect(r.request().postDataJSON().tagFilter).toEqual({
        name: "CostCenter",
        values: ["FinOps"],
      });
      json = {
        meta: {
          scope: { tenantId, subscriptionId },
          period,
          status: "complete",
          source: "Fixture",
          warnings: [],
          fetchedAt: new Date().toISOString(),
        },
        basis: "ActualCost",
        rows: [],
        totals: [],
      };
    }
    if (p === "/api/costs/compare") json = { comparison: [] };
    await r.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Por tag", exact: true }).click();
  await page.getByLabel("Chave da tag").fill("CostCenter");
  await page.getByLabel("Valor da tag").fill("FinOps");
  await page
    .getByRole("button", { name: "Aplicar filtro de cobrança" })
    .click();
  await page
    .getByRole("button", { name: "Consultar custos", exact: true })
    .click();
  await expect.poll(() => calls).toBe(1);
  await page.getByLabel("Valor da tag").fill("Outro rascunho");
  await page
    .getByRole("heading", { name: "Custos por tag da cobrança" })
    .click();
  expect(calls).toBe(1);
});
test("welcome closes with Escape, tree exposes MCP tasks and help", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Integração", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Laboratório de capacidades MCP" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Descoberta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Descobrir manifesto" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Guia e referências" }).click();
  await expect(
    page.getByRole("link", { name: "FinOps Foundation", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
