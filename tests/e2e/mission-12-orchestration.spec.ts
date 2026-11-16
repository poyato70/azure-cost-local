import { test, expect } from "./fixtures.js";
import { mkdir, mkdtemp, open, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { createUniqueTestOutputDir, protectedTestPaths, safeRemoveTestDirectory } from "../../scripts/test-path-safety.js";

const appPort = 14518;
const evidence = createUniqueTestOutputDir(
  "tesseract-m12-evidence-",
  protectedTestPaths(),
  join(process.cwd(), "test-results"),
);
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
  await mkdir(join(temp, "fixture-data"), { recursive: true });
  await mkdir(join(temp, "app-data"), { recursive: true });
  fixture = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      join(process.cwd(), "tests/fixtures/mcp-mission12-pair.ts"),
      "--http-pair",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TESSERACT_TEST_RUNTIME: "1",
        TESSERACT_TEST_DATA_DIR: join(temp, "fixture-data"),
        LOCALAPPDATA: join(temp, "fixture-local-app-data"),
        M12_FIXTURE_CALLS: join(temp, "fixture-calls.log"),
        M12_A_DELAY_FILE: join(temp, "delay-a"),
      },
      stdio: ["ignore", "pipe", "inherit"],
    },
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
      LOCALAPPDATA: join(temp, "local-app-data"),
      TESSERACT_TEST_RUNTIME: "1",
      TESSERACT_TEST_DATA_DIR: local,
      TESSERACT_TEST_PROTECTED_ROOTS: JSON.stringify([
        join(process.env.LOCALAPPDATA || tmpdir(), "Tesseract"),
        join(process.env.LOCALAPPDATA || tmpdir(), "AzureCostLocal"),
      ]),
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
  if (temp)
    safeRemoveTestDirectory(temp, tmpdir(), protectedTestPaths());
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

  const pendingAfterRestart = await page.evaluate(
    async ({ a, b, csrf }) => {
      const response = await fetch("/api/mcp-orchestrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          serverA: a,
          toolA: "m12_synthetic_cost",
          argsA: { scope: "RESTART_TEST" },
          serverB: b,
          toolB: "m12_summarize_cost",
          confirmedA: true,
        }),
      });
      if (!response.ok) throw new Error((await response.text()).slice(0, 400));
      return response.json();
    },
    { a: profiles[0].id, b: profiles[1].id, csrf: bootstrap.csrf },
  );
  expect(pendingAfterRestart.state).toBe("awaiting_b_confirmation");
  await writeFile(join(temp, "delay-a"), "hold", "utf8");
  await page.evaluate(
    ({ a, b, csrf }) => {
      void fetch("/api/mcp-orchestrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          serverA: a,
          toolA: "m12_synthetic_cost",
          argsA: { scope: "INTERRUPTED_TEST" },
          serverB: b,
          toolB: "m12_summarize_cost",
          idempotencyKey: crypto.randomUUID(),
          confirmedA: true,
        }),
      }).catch(() => {});
    },
    { a: profiles[0].id, b: profiles[1].id, csrf: bootstrap.csrf },
  );
  const callLogPath = join(temp, "fixture-calls.log");
  const callDeadline = Date.now() + 10000;
  let callsBeforeCrash = "";
  while (Date.now() < callDeadline) {
    try {
      callsBeforeCrash = await readFile(callLogPath, "utf8");
      if (callsBeforeCrash.trim().split(/\r?\n/).filter((x) => x === "a").length === 3) break;
    } catch {}
    await sleep(100);
  }
  expect(callsBeforeCrash.trim().split(/\r?\n/).sort()).toEqual(["a", "a", "a", "b"]);
  const appExit = new Promise<void>((resolve) => {
    app?.once("exit", () => resolve());
  });
  app?.kill("SIGTERM");
  await appExit;
  const local = join(temp, "app-data");
  const out = await open(join(evidence, "tesseract-m12.stdout.log"), "a");
  const err = await open(join(evidence, "tesseract-m12.stderr.log"), "a");
  app = spawn(process.execPath, ["dist/server/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      LOCALAPPDATA: join(temp, "local-app-data"),
      TESSERACT_TEST_RUNTIME: "1",
      TESSERACT_TEST_DATA_DIR: local,
      TESSERACT_TEST_PROTECTED_ROOTS: JSON.stringify([
        join(process.env.LOCALAPPDATA || tmpdir(), "Tesseract"),
        join(process.env.LOCALAPPDATA || tmpdir(), "AzureCostLocal"),
      ]),
      AZURE_TENANT_ID: "",
      AZURE_CLIENT_ID: "",
    },
    stdio: ["ignore", out.fd, err.fd],
  });
  await Promise.all([out.close(), err.close()]);
  await waitFor(`http://127.0.0.1:${appPort}/api/health`);
  const persisted = JSON.parse(
    await readFile(join(local, "Tesseract", "orchestrations.json"), "utf8"),
  );
  expect(persisted.flows.find((flow: any) => flow.id === pendingAfterRestart.id)?.state).toBe(
    "approval_required",
  );
  expect(persisted.flows.find((flow: any) => flow.state === "succeeded")?.resultB.structuredContent.marker).toBe(
    "M12_SYNTHETIC_SUMMARY",
  );
  expect(persisted.flows.find((flow: any) => flow.state === "indeterminate" && flow.stage === "A")).toBeTruthy();
  await sleep(5500);
  expect((await readFile(callLogPath, "utf8")).trim().split(/\r?\n/).sort()).toEqual([
    "a", "a", "a", "b",
  ]);
});
