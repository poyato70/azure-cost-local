import { test, expect } from "./fixtures.js";
test("native dark theme toggles persistently and breadcrumbs expose MCP hierarchy", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Análise", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Caminho de navegação" }),
  ).toContainText("Conexões/MCPs/Análise");
  await expect(
    page.getByRole("heading", { name: "Laboratório de capacidades MCP" }),
  ).toBeVisible();
});
test("Next static shell keeps the separate Microsoft callback page functional", async ({
  page,
}) => {
  await page.goto("/auth/complete");
  await expect(
    page.getByRole("heading", { name: "Login Microsoft" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voltar ao dashboard" }),
  ).toBeVisible();
});
