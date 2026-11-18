import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./fixtures.js";

const evidence = join(process.cwd(), "test-results", "ux-06-07", "reconciled-84d5fe9-final");
const mockReadOnlyApi = async (page: import("@playwright/test").Page) => {
  const methods: string[] = [];
  await page.route("**/api/**", async (route) => {
    methods.push(route.request().method());
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/bootstrap") json = { authenticated: false, configured: false, csrf: "fixture", period: { from: "2026-10-01", toExclusive: "2026-11-01", timeZone: "America/Sao_Paulo" } };
    if (path === "/api/mcp-connections") json = [{ id: "fixture-connection", name: "[FIXTURE SINTÉTICA] MCP local", preset: "custom", transport: "http", status: "conectado", connected: true }];
    if (path === "/api/diagnostics") json = [{ time: "2026-11-18T12:00:00.000Z", source: "Fixture", operation: "health-check", status: "sucesso", detail: "Registro sintético; token=fixture-sensitive-value Bearer abc.def.ghi" }];
    if (path === "/api/mcp-orchestrations") json = [{ id: "fixture-flow", state: "succeeded", stage: "B", collection: { sourceMode: "synthetic" }, serverA: { id: "fixture-a", tool: "fixture_costs" }, serverB: { id: "fixture-b", tool: "fixture_summary" }, updatedAt: "2026-11-18T12:00:00.000Z" }];
    if (path === "/api/health") json = { ok: true, app: "Tesseract 2.0 · Fixture local" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
  });
  return methods;
};

test("UX-07 displays a read-only, keyboard-operable observability map and responsive themes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const methods = await mockReadOnlyApi(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/new_features_ux");
  await expect(page.getByRole("heading", { name: "Observabilidade global" })).toBeVisible();
  await page.getByRole("button", { name: /API local: Endpoint respondeu ok=true/ }).click();
  await expect(page.getByText(/confirma somente a resposta desse endpoint/)).toBeVisible();
  await page.getByRole("button", { name: /Conexões MCP: Lista consultada/ }).click();
  await expect(page.getByText("[FIXTURE SINTÉTICA] MCP local")).toBeVisible();
  await expect(page.getByText(/Esta tela consulta endpoints existentes com GET/)).toBeVisible();
  const graphFits = await page.evaluate(() => {
    const map = document.querySelector(".obs-map")!.getBoundingClientRect();
    const nodes = [...document.querySelectorAll(".obs-node")].map((item) => item.getBoundingClientRect());
    const inspector = document.querySelector(".obs-inspector")!.getBoundingClientRect();
    const world = document.querySelector(".obs-map-world")!;
    return { fits: nodes.every((node) => node.right <= map.right + 1 && node.left >= map.left - 1 && node.bottom <= map.bottom + 1 && node.top >= map.top - 1), inspectorBesideMap: inspector.left > map.right, map: [map.left, map.right, map.top, map.bottom, map.width, map.height], nodes: nodes.map((node) => [node.left, node.top, node.right, node.bottom]), transform: getComputedStyle(world).transform, label: document.querySelector(".obs-map-tools span")?.textContent };
  });
  console.log("MAP_GEOMETRY", JSON.stringify(graphFits));
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "map-geometry.json"), JSON.stringify(graphFits, null, 2));
  expect(graphFits.fits).toBe(true);
  expect(graphFits.inspectorBesideMap).toBe(true);
  await page.getByRole("button", { name: "Aproximar mapa" }).click();
  await expect(page.getByText(/^\d+%$/)).toBeVisible();
  await page.getByRole("button", { name: "Afastar mapa" }).click();
  const node = page.getByRole("button", { name: /Fluxos registrados: Histórico consultado/ });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#obs-inspector-title")).toHaveText("Fluxos registrados");
  await expect(page.getByText("fixture_costs → fixture_summary")).toBeVisible();
  await expect(page.getByText("Fixture sintética")).toBeVisible();
  await expect(page.getByText(/token=fixture-sensitive-value|abc\.def\.ghi/)).toHaveCount(0);
  await page.keyboard.press("Tab");
  expect(methods.every((method) => method === "GET")).toBe(true);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map(({ id, impact, description, nodes }) => ({ id, impact, description, targets: nodes.map((node) => node.target) })), null, 2)).toEqual([]);
  mkdirSync(evidence, { recursive: true });
  await page.waitForTimeout(1000);
  writeFileSync(join(evidence, "observability-dark-1280.png"), await page.screenshot({ fullPage: true }));
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightAxe = await new AxeBuilder({ page }).include(".observability").analyze();
  expect(lightAxe.violations, JSON.stringify(lightAxe.violations.map(({ id, impact, nodes }) => ({ id, impact, failures: nodes.map((node) => node.any.map((check) => check.message)) })), null, 2)).toEqual([]);
  writeFileSync(join(evidence, "observability-light-1280.png"), await page.screenshot({ fullPage: true }));
  await page.setViewportSize({ width: 768, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  writeFileSync(join(evidence, "observability-light-768.png"), await page.screenshot({ fullPage: true }));
  await page.setViewportSize({ width: 640, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const mobileGeometry = await page.evaluate(() => {
    const map = document.querySelector(".obs-map")!.getBoundingClientRect();
    const nodes = [...document.querySelectorAll(".obs-node")].map((node) => node.getBoundingClientRect());
    const legend = document.querySelector(".obs-legend")!.getBoundingClientRect();
    return { nodesInsideMap: nodes.every((node) => node.top >= map.top - 1 && node.bottom <= map.bottom + 1), legendAfterMap: legend.top >= map.bottom - 1, mapHeight: map.height };
  });
  expect(mobileGeometry.nodesInsideMap && mobileGeometry.legendAfterMap, JSON.stringify(mobileGeometry)).toBe(true);
  writeFileSync(join(evidence, "observability-light-390.png"), await page.screenshot({ fullPage: true }));
  expect(pageErrors).toEqual([]);
});

test("UX-06 lazy-loads on Ctrl+click, keeps regular navigation and closes on Escape", async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as Window & { __openingRafCount?: number };
    target.__openingRafCount = 0;
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      target.__openingRafCount = (target.__openingRafCount || 0) + 1;
      return requestFrame(callback);
    };
  });
  await mockReadOnlyApi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator(".opening-overlay")).toHaveCount(0);
  const openingPolicy = await page.evaluate(async () => {
    const response = await fetch("/tesseract-abertura.html");
    return { ok: response.ok, policy: response.headers.get("content-security-policy") };
  });
  expect(openingPolicy.ok).toBe(true);
  expect(openingPolicy.policy).toContain("frame-ancestors 'self'");
  await page.getByRole("link", { name: /TESSERACT — início/ }).click({ modifiers: ["Control"] });
  await expect(page.getByRole("dialog", { name: "Abertura animada do Tesseract" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar animação" })).toBeFocused();
  const openingFrame = page.frameLocator("iframe.opening-frame");
  await expect(openingFrame.locator("#c")).toBeVisible();
  await expect(openingFrame.getByRole("button", { name: "som: off" })).toBeVisible();
  await expect(openingFrame.getByRole("button", { name: "repetir" })).toBeVisible();
  expect(await page.locator("iframe.opening-frame").evaluate((frame) => {
    const target = frame as HTMLIFrameElement;
    return (target.contentWindow as (Window & { __openingRafCount?: number }) | null)?.__openingRafCount || 0;
  })).toBeGreaterThan(0);
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "opening-dark-1280.png"), await page.screenshot());
  await openingFrame.getByRole("button", { name: "som: off" }).focus();
  await openingFrame.locator("body").press("Escape");
  await expect(page.locator(".opening-overlay")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /TESSERACT — início/ })).toBeFocused();
  await page.getByRole("link", { name: /TESSERACT — início/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".opening-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("link", { name: /TESSERACT — início/ }).click({ modifiers: ["Control"] });
  const reducedFrame = page.frameLocator("iframe.opening-frame");
  await expect(reducedFrame.locator("#c")).toBeVisible();
  const reducedState = await page.locator("iframe.opening-frame").evaluate((frame) => {
    const currentFrame = frame as HTMLIFrameElement;
    return {
      reduced: currentFrame.contentWindow?.matchMedia("(prefers-reduced-motion: reduce)").matches,
      rafCount: (currentFrame.contentWindow as (Window & { __openingRafCount?: number }) | null)?.__openingRafCount || 0,
    };
  });
  expect(reducedState).toEqual({ reduced: true, rafCount: 0 });
  const openingAxe = await new AxeBuilder({ page }).include(".opening-overlay").analyze();
  expect(openingAxe.violations).toEqual([]);
  await page.getByRole("button", { name: "Fechar animação" }).click();
  await expect(page.locator(".opening-overlay")).toHaveCount(0);
});

test("isolated live preview reports real empty states without fixtures", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/new_features_ux");
  await expect(page.getByRole("heading", { name: "Observabilidade global" })).toBeVisible();
  await expect(page.getByRole("button", { name: /API local: Endpoint respondeu ok=true/ })).toBeVisible();
  const graphFits = await page.evaluate(() => {
    const map = document.querySelector(".obs-map")!.getBoundingClientRect();
    const lastNode = document.querySelector('.obs-node[aria-label^="Diagnósticos"]')!.getBoundingClientRect();
    return lastNode.right <= map.right + 1 && lastNode.left >= map.left - 1;
  });
  expect(graphFits).toBe(true);
  await expect(page.getByText("Nenhum fluxo registrado nesta sessão.")).toBeVisible();
  await expect(page.getByText("Nenhum diagnóstico registrado nesta sessão.")).toBeVisible();
  await expect(page.getByText(/0 configuração\(ões\) listada\(s\) nesta sessão/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }))).toEqual([]);
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "observability-live-empty-dark-1280.png"), await page.screenshot({ fullPage: true }));
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  writeFileSync(join(evidence, "observability-live-empty-light-1280.png"), await page.screenshot({ fullPage: true }));
  expect(errors).toEqual([]);
});
