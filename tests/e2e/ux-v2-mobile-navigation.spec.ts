import { expect, test } from "./fixtures.js";

test("UX v2: mobile MCP navigation closes after parent and child selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: /Menu/ });
  const navigation = page.getByRole("navigation", { name: "Navegação principal" });

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toHaveClass(/mobile-open/);

  await navigation.getByRole("button", { name: "MCPs", exact: true }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).not.toHaveClass(/mobile-open/);

  await menu.click();
  await navigation.getByRole("button", { name: "Análise", exact: true }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(navigation.getByRole("button", { name: "Análise", exact: true }))
    .toHaveAttribute("aria-current", "page");

  await menu.click();
  await navigation.getByRole("button", { name: "Integração", exact: true }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(navigation.getByRole("button", { name: "MCPs", exact: true }))
    .toHaveAttribute("aria-current", "page");
});
