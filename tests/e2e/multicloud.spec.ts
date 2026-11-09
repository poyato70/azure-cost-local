import { test, expect } from "@playwright/test";
test("queries multiple providers, exposes raw data and separates cost layers", async ({
  page,
}) => {
  await page.route("**/api/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === "/api/bootstrap")
      return r.fulfill({
        json: {
          csrf: "test",
          authenticated: false,
          configured: false,
          period: {
            from: "2026-09-01",
            toExclusive: "2026-11-01",
            timeZone: "America/Sao_Paulo",
          },
        },
      });
    if (path === "/api/multicloud/query") {
      const q = r.request().postDataJSON();
      if (q.provider === "gcp")
        return r.fulfill({
          status: 502,
          json: { message: "GCP: sessão ADC expirada (fixture de teste)." },
        });
      return r.fulfill({
        json: {
          provider: q.provider,
          scope: "Fixture de teste",
          from: q.from,
          toExclusive: q.toExclusive,
          basis: q.provider === "aws" ? "UnblendedCost" : "OpenCostAllocation",
          layer: q.provider === "aws" ? "billing" : "allocation",
          totals: [{ currency: "USD", amount: "42.5" }],
          rows: [
            {
              date: q.from,
              service: "Serviço de teste",
              currency: "USD",
              amount: "42.5",
            },
          ],
          raw: { evidence: "fixture-only" },
          warnings: ["Fixture: não representa custo real"],
          queriedAt: "2026-11-09T12:00:00Z",
        },
      });
    }
    return r.fulfill({ json: [] });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Visão multicloud", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conecte sua conta Azure" }),
  ).toHaveCount(0);
  await page.getByLabel("Consultar AWS").check();
  await page.getByLabel("Consultar Kubernetes / OpenShift").check();
  await page.getByLabel("Endpoint OpenCost").fill("http://localhost:9003");
  await page.getByLabel("Consultar GCP").check();
  await page.getByLabel("Projeto BigQuery").fill("finops-project");
  await page
    .getByLabel("Tabela Cloud Billing")
    .fill("finops-project.billing.export");
  await page.getByLabel("Autorizo a consulta BigQuery").check();
  await page.getByRole("button", { name: "Configurar escopo Azure" }).click();
  await page
    .getByRole("button", { name: "Visão multicloud", exact: true })
    .click();
  await expect(page.getByLabel("Tabela Cloud Billing")).toHaveValue(
    "finops-project.billing.export",
  );
  await page
    .getByRole("button", { name: "Consultar fontes selecionadas" })
    .click();
  await expect(
    page.getByText("2 de 3 fontes consultadas com sucesso", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/ADC expirada/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Resumo por base e moeda" }),
  ).toContainText("OpenCostAllocation");
  await expect(
    page.getByRole("heading", { name: "AWS · custos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kubernetes / OpenShift · alocação" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "JSON AWS" }).click();
  await expect(page.getByText(/fixture-only/)).toBeVisible();
  await page.getByRole("button", { name: "Tabela AWS" }).click();
  await expect(
    page.getByRole("cell", { name: "Serviço de teste" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
