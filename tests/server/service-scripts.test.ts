import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { it, expect } from "vitest";

const windows = process.platform === "win32";
const shell = "powershell.exe";

async function fixture(rootName: string, healthy = true) {
  const root = await mkdtemp(join(tmpdir(), rootName));
  await mkdir(join(root, "dist", "server"), { recursive: true });
  await mkdir(join(root, "node_modules"), { recursive: true });
  for (const name of ["service.ps1", "start.ps1", "stop.ps1", "status.ps1"])
    await writeFile(join(root, name), await readFile(join(process.cwd(), name)));
  await mkdir(join(root, "scripts"), { recursive: true });
  for (const name of ["start.ps1", "stop.ps1"])
    await writeFile(
      join(root, "scripts", name),
      await readFile(join(process.cwd(), "scripts", name)),
    );
  const response = healthy
    ? `res.end(JSON.stringify({ok:true,app:"Tesseract 2.0"}));`
    : `res.end(JSON.stringify({ok:true,app:"fixture"}));`;
  await writeFile(
    join(root, "dist", "server", "main.js"),
    `const http=require('node:http');const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');${response}});server.listen(Number(process.env.PORT),'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));setInterval(()=>{},1000);`,
  );
  const appData = join(root, "appdata");
  await mkdir(appData, { recursive: true });
  const canonicalRoot = resolve(root).replace(/[\\/]+$/, "").toLowerCase();
  const hash = createHash("sha256").update(canonicalRoot).digest("hex");
  return {
    root,
    appData,
    metadata: join(appData, "AzureCostLocal", "instances", hash, "service.json"),
  };
}

function runScript(
  root: string,
  appData: string,
  script: string,
  args: string[] = [],
  timeout = 20000,
) {
  return spawnSync(
    shell,
    ["-NoProfile", "-NonInteractive", "-File", join(root, script), ...args],
    {
      encoding: "utf8",
      timeout,
      env: { ...process.env, LOCALAPPDATA: appData },
    },
  );
}

async function stopFixture(root: string, appData: string, port: number) {
  runScript(root, appData, "stop.ps1", ["-Port", String(port)], 18000);
}

it.skipIf(!windows)("service scripts detect stale PID, start, report, and stop only this checkout", async () => {
  const f = await fixture("tesseract-service-lifecycle-");
  const port = 14431;
  try {
    await mkdir(dirname(f.metadata), { recursive: true });
    await writeFile(
      f.metadata,
      JSON.stringify({
        projectRoot: f.root,
        entryPoint: join(f.root, "dist/server/main.js"),
        pid: 2147483000,
        port,
        startedAt: new Date().toISOString(),
      }),
    );
    const started = runScript(f.root, f.appData, "scripts/start.ps1", [
      "-Port",
      String(port),
      "-StartupTimeoutSeconds",
      "10",
      "-SkipBuild",
    ]);
    expect(started.status, started.stdout + started.stderr).toBe(0);
    expect(started.stdout).toContain("iniciado");
    const metadata = JSON.parse((await readFile(f.metadata, "utf8")).replace(/^\uFEFF/, ""));
    expect(metadata.projectRoot).toBe(f.root);
    expect(metadata.port).toBe(port);
    expect(metadata.stdoutLog).toContain("service.out.log");
    expect(runScript(f.root, f.appData, "status.ps1", ["-Port", String(port)]).status).toBe(0);
    const stopped = runScript(f.root, f.appData, "scripts/stop.ps1", ["-Port", String(port)]);
    expect(stopped.status, stopped.stdout + stopped.stderr).toBe(0);
    await expect(readFile(f.metadata)).rejects.toThrow();
  } finally {
    await stopFixture(f.root, f.appData, port);
    await rm(f.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
}, 30000);

it.skipIf(!windows)("refuses another process on a busy port without terminating it", async () => {
  const f = await fixture("tesseract-service-port-");
  const port = 14432;
  const server = spawn(
    process.execPath,
    [
      "-e",
      `require('node:http').createServer((_,r)=>r.end('unrelated')).listen(${port},'127.0.0.1');setInterval(()=>{},1000)`,
    ],
    { stdio: "ignore" },
  );
  try {
    await delay(500);
    const started = runScript(f.root, f.appData, "start.ps1", [
      "-Port",
      String(port),
      "-SkipBuild",
    ]);
    expect(started.status).not.toBe(0);
    expect(started.stdout + started.stderr).toContain("ocupada");
    expect(server.exitCode).toBeNull();
    expect(await readFile(f.metadata).catch(() => "")).toBe("");
  } finally {
    server.kill();
    await rm(f.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
}, 15000);

it.skipIf(!windows)("preserves a live process when only the health check times out", async () => {
  const f = await fixture("tesseract-service-timeout-", false);
  const port = 14433;
  try {
    const started = runScript(
      f.root,
      f.appData,
      "start.ps1",
      ["-Port", String(port), "-StartupTimeoutSeconds", "5", "-SkipBuild"],
      15000,
    );
    expect(started.status).not.toBe(0);
    expect(started.stdout + started.stderr).toContain("foi preservado");
    const metadata = JSON.parse((await readFile(f.metadata, "utf8")).replace(/^\uFEFF/, ""));
    expect(metadata.pid).toBeGreaterThan(0);
    const stopped = runScript(f.root, f.appData, "stop.ps1", ["-Port", String(port)]);
    expect(stopped.status, stopped.stdout + stopped.stderr).toBe(0);
  } finally {
    await stopFixture(f.root, f.appData, port);
    await rm(f.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  }
}, 20000);
