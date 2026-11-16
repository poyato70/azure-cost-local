import { test, expect } from "./fixtures.js";
import type { Page } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 720 },
] as const;

async function openConnectionsMap(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === "/api/bootstrap"
        ? { authenticated: false, csrf: "qa", period: {} }
        : [];
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await page.getByRole("button", { name: "Integração", exact: true }).click();
  await expect(page.getByRole("region", { name: "Mapa de conexões" })).toBeVisible();
}

for (const viewport of viewports) {
  test(`Missão 09 layout responsivo em ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openConnectionsMap(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    if (viewport.width < 761) {
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".tree-nav")).toBeVisible();
      await expect(page.getByRole("button", { name: "Integração", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Integração", exact: true }).click();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
    }

    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Elemento ausente: ${selector}`);
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
      };
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        map: box(".connections-map"),
        provider: box(".map-provider-column"),
        integration: box(".map-integration-column"),
        detail: box(".map-detail"),
        activity: box(".map-activity"),
        providerButton: box(".map-provider-node"),
        integrationButton: box(".map-integration-node"),
      };
    });

    expect(layout.documentWidth, "page should not overflow horizontally").toBeLessThanOrEqual(layout.width);
    expect(layout.map.x).toBeGreaterThanOrEqual(0);
    expect(layout.map.right).toBeLessThanOrEqual(layout.width + 1);
    expect(layout.providerButton.height).toBeGreaterThanOrEqual(44);
    expect(layout.integrationButton.height).toBeGreaterThanOrEqual(44);
    expect(pageErrors).toEqual([]);
    if (viewport.width <= 900) {
      expect(layout.provider.bottom).toBeLessThanOrEqual(layout.integration.y + 1);
      expect(layout.integration.bottom).toBeLessThanOrEqual(layout.detail.y + 1);
      expect(layout.activity.y).toBeGreaterThan(layout.detail.bottom);
    } else {
      expect(layout.provider.x).toBeLessThan(layout.integration.x);
      expect(layout.detail.y).toBeGreaterThan(layout.provider.bottom);
      expect(layout.activity.x).toBeGreaterThan(layout.provider.x);
    }

    await page.screenshot({ path: testInfo.outputPath(`m09-${viewport.name}-${viewport.width}x${viewport.height}.png`), fullPage: true });
  });
}

test("Missão 09 atividade loading/vazia, navegação, foco e movimento reduzido", async ({ page }) => {
  let diagnosticsCalls = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/diagnostics") {
      diagnosticsCalls++;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    const json = path === "/api/bootstrap" ? { authenticated: false, csrf: "qa", period: {} } : [];
    await route.fulfill({ json });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await page.getByRole("button", { name: "Integração", exact: true }).click();
  await expect(page.getByRole("button", { name: "Atualizar atividade" })).toBeEnabled();
  await expect.poll(() => diagnosticsCalls).toBeGreaterThan(0);
  const refresh = page.getByRole("button", { name: "Atualizar atividade" });
  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(refresh).toBeEnabled();
  await expect(page.getByText("Nenhuma operação registrada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preparar cadastro MCP" })).toBeVisible();

  const azure = page.getByRole("button", { name: /Azure 0 cadastros MCP/ });
  await azure.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /AWS 0 cadastros MCP/ })).toBeFocused();
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
});

test("Missão 09 apresenta erro de configuração sem travar a navegação", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/mcp-connections") {
      await route.fulfill({ status: 503, json: { message: "Falha controlada no QA" } });
      return;
    }
    const json = path === "/api/bootstrap" ? { authenticated: false, csrf: "qa", period: {} } : [];
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await page.getByRole("button", { name: "Integração", exact: true }).click();
  await expect(page.locator("div.error[role='alert']")).toContainText("Falha controlada no QA");
});
