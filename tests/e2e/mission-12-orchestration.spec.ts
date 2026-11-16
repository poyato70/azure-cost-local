import { test, expect } from "./fixtures.js";
import { mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

const appPort = 14518;
const evidence = join(process.cwd(), "test-results", "mission-12");
let app: ChildProcess | undefined;
let fixture: ChildProcess | undefined;
let temp = "";
let ports: { a: number; b: number } | undefined;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(url: string) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Timeout aguardando ${url}`);
}

test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
  temp = await mkdtemp(join(tmpdir(), "tesseract-m12-e2e-"));
  fixture = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      join(process.cwd(), "tests/fixtures/mcp-mission12-pair.ts"),
      "--http-pair",
    ],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "inherit"] },
  );
  let output = "";
  fixture.stdout?.on("data", (chunk) => {
    output += chunk.toString();
    if (output.includes("\n")) {
      try {
        ports = JSON.parse(output.split("\n")[0]);
      } catch {}
    }
  });
  const end = Date.now() + 20000;
  while (!ports && Date.now() < end) await sleep(100);
  if (!ports)
    throw new Error("Fixtures MCP M12 não publicaram as portas dinâmicas.");
  const local = join(temp, "app-data");
  const out = await open(join(evidence, "tesseract-m12.stdout.log"), "a");
  const err = await open(join(evidence, "tesseract-m12.stderr.log"), "a");
  app = spawn(process.execPath, ["dist/server/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      LOCALAPPDATA: local,
      AZURE_TENANT_ID: "",
      AZURE_CLIENT_ID: "",
    },
    stdio: ["ignore", out.fd, err.fd],
  });
  await Promise.all([out.close(), err.close()]);
  await waitFor(`http://127.0.0.1:${appPort}/api/health`);
});
test.afterAll(async () => {
  for (const child of [app, fixture])
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  if (temp) await rm(temp, { recursive: true, force: true });
});

test("runs and renders the authorized A-to-B MCP journey with real Streamable HTTP servers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`http://127.0.0.1:${appPort}/`);
  const bootstrap = await (
    await page.waitForResponse(
      (r) => r.url().endsWith("/api/bootstrap") && r.ok(),
    )
  ).json();
  await page.evaluate(
    (csrf) => sessionStorage.setItem("m10-csrf", csrf),
    bootstrap.csrf,
  );
  await page.addInitScript(
    (csrf) => sessionStorage.setItem("m10-csrf", csrf),
    bootstrap.csrf,
  );
  await page.reload();
  const create = async (name: string, port: number) =>
    page.evaluate(
      async ({ name, port, csrf }) => {
        const response = await fetch("/api/mcp-connections", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify({
            name,
            preset: "custom",
            transport: "http",
            endpoint: `http://127.0.0.1:${port}/mcp`,
            authMode: "none",
            allowPrivateNetwork: true,
            resourceContext: {},
            approvedTools: [],
          }),
        });
        if (!response.ok)
          throw new Error((await response.text()).slice(0, 500));
        return response.json();
      },
      { name, port, csrf: bootstrap.csrf },
    );
  const profiles = [
    await create("Fixture M12 A", ports!.a),
    await create("Fixture M12 B", ports!.b),
  ];
  for (const [i, name] of [
    "m12_synthetic_cost",
    "m12_summarize_cost",
  ].entries()) {
    const response = await page.evaluate(
      async ({ id, name, csrf }) =>
        fetch(`/api/mcp-connections/${id}/approve-tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify({ names: [name] }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.text()).slice(0, 500));
          return r.json();
        }),
      { id: profiles[i].id, name, csrf: bootstrap.csrf },
    );
    expect(response).toBeTruthy();
  }
  await page.reload();
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mapa de conexões" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Confirmo a execução da tool A autorizada" })
    .check();
  await page.getByRole("button", { name: "Executar A → B" }).click();
  await expect(page.locator(".mcp-orchestration [role=status]")).toContainText(
    "awaiting_b_confirmation",
  );
  await expect(page.locator(".mcp-orchestration [role=status]")).toContainText(
    "42.5",
  );
  await page.screenshot({
    path: join(evidence, "mission12-awaiting-b-1280x720.png"),
    fullPage: true,
  });
  const awaitingText = await page
    .locator(".mcp-orchestration [role=status] strong")
    .innerText();
  await page.reload();
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await expect(page.locator(".mcp-orchestration [role=status]")).toContainText(
    "awaiting_b_confirmation",
  );
  expect(
    await page.locator(".mcp-orchestration [role=status] strong").innerText(),
  ).toBe(awaitingText);
  await page.getByRole("button", { name: "Confirmar chamada B" }).click();
  await expect(page.locator(".mcp-orchestration [role=status]")).toContainText(
    "succeeded",
    { timeout: 15000 },
  );
  await expect(page.getByText("M12_SYNTHETIC_SUMMARY")).toBeVisible();
  await page.getByRole("button", { name: "MCPs", exact: true }).click();
  await expect(page.locator(".map-event-list")).toContainText("orquestração");
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      inner: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.inner + 1);
    await page.screenshot({
      path: join(
        evidence,
        `mission12-flow-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".mcp-flow-edge")
      .evaluate((el) => getComputedStyle(el).animationDuration),
  ).toBe("0s");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
