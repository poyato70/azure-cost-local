import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./fixtures.js";

const evidence = join(process.cwd(), "test-results", "mission-20");

test("preserves a negative health result and its stale age in the map and Inspector", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-18T12:00:00.000Z") });
  const methods: string[] = [];
  let healthMode: "negative" | "positive" | "unavailable" = "negative";
  await page.route("**/api/**", async (route) => {
    methods.push(route.request().method());
    const path = new URL(route.request().url()).pathname;
    const json = path === "/api/bootstrap"
      ? { authenticated: false, configured: false, csrf: "fixture", period: { from: "2026-10-01", toExclusive: "2026-11-01", timeZone: "America/Sao_Paulo" } }
      : path === "/api/health" ? { ok: healthMode === "positive", app: "Fixture sintética de saúde" } : [];
    await route.fulfill({ status: path === "/api/health" && healthMode === "unavailable" ? 503 : 200, json });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/new_features_ux");
  await expect(page.getByRole("heading", { name: "Observabilidade global" })).toBeVisible();
  await expect(page.locator(".obs-inspector-state")).toHaveText("Endpoint respondeu ok=false");
  const healthNode = page.getByRole("button", { name: /API local:/ });
  await expect(healthNode).toHaveClass(/is-error/);

  await page.clock.fastForward(61001);
  await expect(page.locator(".obs-inspector-state")).toHaveText("Desatualizado · Endpoint respondeu ok=false");
  await expect(healthNode).toHaveClass(/is-error/);
  await expect(page.locator(".obs-legend")).toContainText(/Resposta negativa ou leitura falhou.*desatualizada/i);
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "negative-stale-1280.png"), await page.screenshot({ fullPage: true }));

  healthMode = "positive";
  await page.clock.fastForward(1000);
  await page.getByRole("button", { name: "Atualizar" }).click();
  await expect(page.locator(".obs-inspector-state")).toHaveText("Endpoint respondeu ok=true");
  await expect(page.getByRole("button", { name: /API local: Endpoint respondeu ok=true/ })).toHaveClass(/is-ok/);
  await page.clock.fastForward(61001);
  const stalePositiveNode = page.getByRole("button", { name: /API local: Desatualizado · Endpoint respondeu ok=true/ });
  await expect(stalePositiveNode).toHaveClass(/is-stale/);
  await expect(page.locator(".obs-inspector-state")).toHaveText("Desatualizado · Endpoint respondeu ok=true");

  healthMode = "unavailable";
  await page.getByRole("button", { name: "Atualizar" }).click();
  await expect(page.locator(".obs-inspector-state")).toHaveText("Falha ao ler /api/health");
  await expect(page.getByRole("button", { name: /API local: Falha ao ler \/api\/health/ })).toHaveClass(/is-error/);
  await page.clock.fastForward(61001);
  await expect(page.locator(".obs-inspector-state")).toHaveText("Desatualizado · Falha ao ler /api/health");
  await expect(page.getByRole("button", { name: /API local: Desatualizado · Falha ao ler \/api\/health/ })).toHaveClass(/is-error/);

  expect(methods.length).toBeGreaterThanOrEqual(5);
  expect(methods.every((method) => method === "GET")).toBe(true);

  const darkAxe = await new AxeBuilder({ page }).include(".observability").analyze();
  expect(darkAxe.violations).toEqual([]);
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  const lightAxe = await new AxeBuilder({ page }).include(".observability").analyze();
  expect(lightAxe.violations).toEqual([]);
});
