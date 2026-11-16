import { test, expect } from "./fixtures.js";

test("validates Azure OpenAI Usage inputs and submits a recognized portal resource", async ({
  page,
}, testInfo) => {
  const submissions: unknown[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/bootstrap") {
      await route.fulfill({
        json: { authenticated: false, csrf: "fixture-csrf", period: {} },
      });
      return;
    }
    if (path === "/api/cloud/azure-ai-usage" && request.method() === "POST") {
      const body = request.postDataJSON();
      submissions.push(body);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        json: {
          source: "fixture: Azure Monitor",
          metrics: [
            { metric: "ProcessedPromptTokens", total: 1234, points: [] },
            { metric: "GeneratedTokens", total: 567, points: [] },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Descoberta", exact: true }).click();
  await page.getByLabel("Integração cloud").selectOption("Azure OpenAI Usage");

  const resource = page.getByLabel("Resource ID da conta Azure OpenAI");
  const form = page.locator(".azure-ai-usage");
  const from = page.getByLabel("Início (UTC)");
  const to = page.getByLabel("Fim exclusivo (UTC; não incluído no intervalo)");
  const submit = page.getByRole("button", { name: "Consultar tokens" });
  await from.fill("2026-11-01");
  await to.fill("2026-12-01");

  await resource.fill("https://example.com/#resource/subscriptions/00000000-0000-4000-8000-000000000000/resourceGroups/rg-openai/providers/Microsoft.CognitiveServices/accounts/conta-openai");
  await submit.click();
  await expect(form.getByRole("alert")).toContainText("portal.azure.com");
  expect(submissions).toHaveLength(0);

  await resource.fill("https://portal.azure.com/#resource/subscriptions/00000000-0000-4000-8000-000000000000/resourceGroups/rg-openai/providers/Microsoft.CognitiveServices/accounts/conta-openai");
  await submit.click();
  await expect(page.getByRole("button", { name: "Consultando…" })).toBeDisabled();
  await expect(form).toHaveAttribute("aria-busy", "true");
  await expect(form.locator("div[role=status]")).toContainText("Fonte: fixture: Azure Monitor");
  await expect(page.getByText("1.234 tokens")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mission-07-azure-ai-usage.png"), fullPage: true });
  expect(submissions).toEqual([
    {
      resourceId:
        "/subscriptions/00000000-0000-4000-8000-000000000000/resourceGroups/rg-openai/providers/Microsoft.CognitiveServices/accounts/conta-openai",
      from: "2026-11-01",
      toExclusive: "2026-12-01",
    },
  ]);

  await resource.fill(
    "/subscriptions/00000000-0000-4000-8000-000000000000/resourceGroups/rg-openai/providers/Microsoft.CognitiveServices/accounts/conta-openai",
  );
  await to.fill("2026-12-02");
  await submit.click();
  await expect(form.getByRole("alert")).toContainText("máximo é de 30 dias");
  expect(submissions).toHaveLength(1);

  await submit.click();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  const focusStyle = await submit.evaluate((button) => {
    const style = getComputedStyle(button);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).not.toBe("0px");
});
