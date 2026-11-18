import { test, expect } from "./fixtures.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const subscriptionId = "22222222-2222-4222-8222-222222222222";

test("APIs page presents cost query visually and preserves sanitized copy/export", async ({
  page,
}) => {
  let queryBody: any;
  let throttleNext = false;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: any = {};
    if (path === "/api/bootstrap")
      body = {
        csrf: "fixture",
        authenticated: true,
        configured: true,
        tenantId,
        clientId: subscriptionId,
        period: {
          from: "2026-10-01",
          toExclusive: "2026-11-01",
          timeZone: "America/Sao_Paulo",
        },
      };
    else if (
      path === "/api/accesses" ||
      path === "/api/mcp-connections" ||
      path === "/api/agents"
    )
      body = [];
    else if (path === "/api/subscriptions")
      body = [{ id: subscriptionId, tenantId, name: "Subscription sintética" }];
    else if (path === "/api/resource-groups") body = ["rg-demo"];
    else if (path === "/api/costs/query") {
      queryBody = route.request().postDataJSON();
      if (throttleNext) {
        await route.fulfill({
          status: 429,
          json: {
            code: "throttled",
            message: "Azure limitou temporariamente a consulta.",
          },
        });
        return;
      }
      body = {
        meta: {
          scope: { tenantId, subscriptionId },
          period: queryBody.period,
          source: "Fixture Azure REST",
          fetchedAt: "2026-11-18T12:00:00.000Z",
          status: "complete",
          warnings: ["Dados sintéticos de teste."],
        },
        basis: queryBody.basis,
        rows: [
          {
            date: "2026-10-01",
            dimension: "Compute",
            amount: "10.10",
            currency: "BRL",
          },
          {
            date: "2026-10-01",
            dimension: "Storage",
            amount: "4.25",
            currency: "BRL",
          },
          {
            date: "2026-10-02",
            dimension: "Compute",
            amount: "2.00",
            currency: "USD",
          },
        ],
        totals: [
          { currency: "BRL", amount: "14.35" },
          { currency: "USD", amount: "2" },
        ],
      };
    } else if (path === "/api/diagnostics")
      body = [
        {
          time: "2026-11-18T12:00:00.000Z",
          requestId: "fixture-request",
          source: "Azure",
          operation: "query",
          status: "error",
          detail:
            "client_secret=should-not-export Cookie: session=private-value",
        },
      ];
    await route.fulfill({ json: body });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "APIs — capacidades", exact: true })
    .click();
  await expect(page.getByLabel("Data final inclusiva")).toHaveValue(
    "2026-10-31",
  );
  await page.getByLabel("Agrupar custos por").selectOption("ResourceId");
  await page.getByLabel("Granularidade da consulta").selectOption("Monthly");
  await page
    .getByRole("button", { name: "Consultar custos no escopo selecionado" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Custos no período" }),
  ).toBeVisible();
  await expect(page.getByText("Total · BRL")).toBeVisible();
  await expect(page.getByText("Total · USD")).toBeVisible();
  await expect(page.getByText("14,35", { exact: false })).toBeVisible();
  await expect(page.getByText("2,00", { exact: false })).toBeVisible();
  await expect(page.getByText("Detalhes técnicos")).toBeVisible();
  await expect(page.locator(".api-finops-result pre")).toBeHidden();
  expect(queryBody.period.toExclusive).toBe("2026-11-01");
  expect(queryBody.groupBy).toBe("ResourceId");
  expect(queryBody.granularity).toBe("Monthly");
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("heading", { name: "Custos no período" }),
    ).toBeVisible();
    const overflow = await page.evaluate(() => ({
      width: window.innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className:
              typeof element.className === "string" ? element.className : "",
            text: element.textContent?.trim().slice(0, 60),
            region: element.closest(
              ".filters, .api-query-controls, .api-finops-result",
            )?.className,
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        })
        .filter((element) => element.right > window.innerWidth + 1)
        .slice(0, 8),
    }));
    expect(overflow.pageWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width,
    );
  }

  await page.getByRole("button", { name: "Copiar detalhes" }).click();
  await expect(page.getByText("Detalhes técnicos copiados.")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Fixture Azure REST");

  await page.getByText("Logs da operação").click();
  await page
    .getByRole("button", { name: "Copiar eventos visíveis do diagnóstico" })
    .click();
  await expect(
    page.getByText("Eventos visíveis copiados para a área de transferência."),
  ).toBeVisible();
  const log = await page.evaluate(() => navigator.clipboard.readText());
  expect(log).not.toContain("should-not-export");
  expect(log).not.toContain("private-value");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Exportar eventos visíveis para arquivo de log",
    })
    .click();
  expect((await download).suggestedFilename()).toMatch(
    /^tesseract-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/,
  );
  throttleNext = true;
  await page
    .getByRole("button", { name: "Consultar custos no escopo selecionado" })
    .click();
  await expect(page.locator(".api-state[role=alert]")).toContainText(
    "Azure limitou temporariamente",
  );
  await expect(
    page.getByRole("heading", { name: "Custos no período" }),
  ).toHaveCount(0);
});
