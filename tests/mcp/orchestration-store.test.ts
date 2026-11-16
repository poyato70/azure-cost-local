import { it, expect } from "vitest";
import { mkdtemp, open, readFile, readdir, rename, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OrchestrationStore, type OrchestrationStoreIO } from "../../src/server/mcp/orchestration-store.js";
import { McpOrchestration } from "../../src/server/mcp/orchestration.js";
import { AppError } from "../../src/server/errors.js";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { protectedTestPaths, safeRemoveTestDirectory, safeRemoveTestFile } from "../../scripts/test-path-safety.js";

it("persists terminal runs, enforces owner filtering, and marks in-flight runs indeterminate on restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-")),
    file = join(dir, "runs.json");
  try {
    const store = new OrchestrationStore(file, 3, 30),
      now = new Date().toISOString();
    const base: any = {
      id: "run-1",
      ownerId: "user:u1",
      sessionId: "old-session",
      requestId: "r1",
      idempotencyKey: "key",
      state: "running_b",
      stage: "B",
      serverA: { id: "a", tool: "read" },
      serverB: { id: "b", tool: "write" },
      createdAt: now,
      updatedAt: now,
      events: [],
    };
    const publicFlow = new McpOrchestration({} as any, store).publicView({
      ...base,
      approvalSessionId: "private-session",
      fingerprint: "private-fingerprint",
      processId: 12345,
    });
    expect(publicFlow).not.toHaveProperty("sessionId");
    expect(publicFlow).not.toHaveProperty("ownerId");
    expect(publicFlow).not.toHaveProperty("approvalSessionId");
    expect(publicFlow).not.toHaveProperty("fingerprint");
    expect(publicFlow).not.toHaveProperty("processId");
    await store.save(base);
    const service = new McpOrchestration({} as any, store);
    await service.init();
    expect((await store.get("run-1"))?.state).toBe("indeterminate");
    expect(await store.list("user:u1")).toHaveLength(1);
    expect(await store.list("user:u2")).toHaveLength(0);
    expect((await store.get("run-1"))?.events.at(-1)?.state).toBe(
      "indeterminate",
    );
    const restarted = new McpOrchestration(
      {} as any,
      new OrchestrationStore(file),
    );
    await restarted.init();
    expect((await restarted.get("new-session", "run-1", "user:u1")).state).toBe(
      "indeterminate",
    );
    await expect(
      restarted.get("other-session", "run-1", "user:u2"),
    ).rejects.toMatchObject({ status: 404 });
    const pending: any = {
      ...base,
      id: "run-2",
      state: "awaiting_b_confirmation",
      stage: "B",
      updatedAt: new Date().toISOString(),
    };
    await store.save(pending);
    await store.init();
    expect((await store.get("run-2"))?.state).toBe("approval_required");
    expect((await store.get("run-2"))?.events.at(-1)?.state).toBe(
      "approval_required",
    );
    let recoveryCalls = 0;
    const inspection = new McpOrchestration(
      { call: async () => { recoveryCalls++; } } as any,
      new OrchestrationStore(file),
    );
    await inspection.init();
    expect((await inspection.get("new-session", "run-2", "user:u1")).state).toBe("approval_required");
    expect((await inspection.confirm({ sessionId: "new-session", userId: "u1" } as any, "run-2")).state).toBe("approval_required");
    expect(recoveryCalls).toBe(0);
    await expect(store.locked(async()=>{})).resolves.toBeUndefined();
    await writeFile(file+".lock",JSON.stringify({token:"abandoned",pid:999999,createdAt:now}),"utf8");
    await expect(store.locked(async()=>{})).rejects.toMatchObject({code:"storage_unavailable"});
    safeRemoveTestFile(file + ".lock", dir, protectedTestPaths());

    const code=`import { OrchestrationStore } from ${JSON.stringify(new URL("../../src/server/mcp/orchestration-store.ts",import.meta.url).pathname)}; const s=new OrchestrationStore(process.argv[1]); await s.locked(async()=>{await new Promise(r=>setTimeout(r,600))});`;
    const child=spawn(process.execPath,["--import","tsx","--input-type=module","-e",code,file],{stdio:"ignore"});
    const childExit = new Promise<void>((resolve,reject)=>{child.once("exit",code=>code===0?resolve():reject(new Error(`lock process exited ${code}`)));child.once("error",reject);});
    for(let attempt=0;attempt<100&&!existsSync(file+".lock");attempt++) await new Promise(r=>setTimeout(r,20));
    expect(existsSync(file+".lock")).toBe(true);
    await expect(store.locked(async()=>{})).resolves.toBeUndefined();
    await childExit;
    expect(await store.read()).toMatchObject({schemaVersion:1,flows:[{id:"run-1"},{id:"run-2"}]});

    const crashCode = `import { OrchestrationStore } from ${JSON.stringify(new URL("../../src/server/mcp/orchestration-store.ts",import.meta.url).pathname)}; const s=new OrchestrationStore(process.argv[1]); await s.locked(async()=>{await new Promise(r=>setTimeout(r,30000))});`;
    const crashed=spawn(process.execPath,["--import","tsx","--input-type=module","-e",crashCode,file],{stdio:"ignore"});
    for(let attempt=0;attempt<100&&!existsSync(file+".lock");attempt++) await new Promise(r=>setTimeout(r,20));
    expect(existsSync(file+".lock")).toBe(true);
    const crashExit = new Promise<void>((resolve,reject)=>{crashed.once("exit",()=>resolve());crashed.once("error",reject);});
    crashed.kill();
    await crashExit;
    expect(existsSync(file+".lock")).toBe(true);
    const abandonedAt = new Date(Date.now() - 11000);
    await utimes(file+".lock", abandonedAt, abandonedAt);
    await expect(store.locked(async()=>{})).rejects.toMatchObject({code:"storage_unavailable"});
    safeRemoveTestFile(file + ".lock", dir, protectedTestPaths());

    expect(await store.read()).toMatchObject({schemaVersion:1,flows:[{id:"run-1"},{id:"run-2"}]});
  } finally {
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
  }
}, 15000);

it("requires the persisted owner even when the session matches and never falls back across stores", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-owner-isolation-"));
  const file = join(dir, "runs.json");
  const stored: any = {
    id: "owned-run",
    ownerId: "user:owner-1",
    sessionId: "shared-session",
    requestId: "request-1",
    state: "awaiting_b_confirmation",
    stage: "B",
    serverA: { id: "a", tool: "read" },
    serverB: { id: "b", tool: "write" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [],
  };
  let calls = 0;
  try {
    const firstStore = new OrchestrationStore(file);
    await firstStore.save(stored);
    const service = new McpOrchestration(
      {
        get: async () => ({ configurationVersion: 1 }),
        tools: async () => [{ name: "write", schemaHash: "schema", _meta: { "tesseract/approval": "each-call" } }],
        call: async () => {
          calls++;
          return { result: { structuredContent: { done: true } } };
        },
      } as any,
      firstStore,
    );

    await expect(service.get("shared-session", "owned-run", "user:owner-2"))
      .rejects.toMatchObject({ status: 404 });
    await expect(
      service.confirm(
        { sessionId: "shared-session", userId: "owner-2" } as any,
        "owned-run",
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(calls).toBe(0);

    await expect(
      new McpOrchestration({} as any, new OrchestrationStore(join(dir, "other.json")))
        .get("shared-session", "owned-run", "user:owner-1"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.get("a-different-session", "owned-run", "user:owner-1"),
    ).resolves.toMatchObject({ id: "owned-run" });
  } finally {
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
  }
});

it("serializes concurrent idempotency reservations across independent store instances", async()=>{
  const dir=await mkdtemp(join(tmpdir(),"tesseract-m13-race-")),file=join(dir,"runs.json");
  const calls={a:0,b:0};
  const registry:any={get:async()=>({configurationVersion:1}),tools:async()=>[{name:"b",schemaHash:"h",_meta:{}}],call:async(_ctx:any,_id:string,tool:string)=>{calls[tool==="a"?"a":"b"]++;await new Promise(r=>setTimeout(r,100));return {result:{structuredContent:tool==="a"?{amount:3,currency:"USD",period:"2026-01"}:{done:true}}};}};
  const ctx:any={sessionId:"s",userId:"u",tenantId:"t",requestId:"r",signal:new AbortController().signal};
  const input:any={serverA:"A",toolA:"a",argsA:{scope:"x"},serverB:"B",toolB:"b",idempotencyKey:"same",confirmedA:true};
  try {
    const one=new McpOrchestration(registry,new OrchestrationStore(file)),two=new McpOrchestration(registry,new OrchestrationStore(file));
    await Promise.all([one.init(),two.init()]);
    const [a,b]=await Promise.all([one.start(ctx,input),two.start(ctx,input)]);
    expect(a.id).toBe(b.id);
    for(let attempt=0;attempt<100&&(await new OrchestrationStore(file).get(a.id))?.state!=="succeeded";attempt++) await new Promise(r=>setTimeout(r,20));
    expect((await new OrchestrationStore(file).get(a.id))?.state).toBe("succeeded");
    expect((await two.get(ctx.sessionId,a.id,"user:u")).state).toBe("succeeded");
    expect(calls).toEqual({a:1,b:1});
    await expect(two.start(ctx,{...input,argsA:{scope:"different"}})).rejects.toMatchObject({status:409});
    expect(calls).toEqual({a:1,b:1});
  } finally { safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths()); }
});

it("reserves an idempotent MCP journey across independent processes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-process-race-"));
  const file = join(dir, "runs.json"), calls = join(dir, "calls.log");
  const modulePath = new URL("../../src/server/mcp/orchestration.js", import.meta.url).pathname;
  const storePath = new URL("../../src/server/mcp/orchestration-store.ts", import.meta.url).pathname;
  const code = `import {appendFile} from "node:fs/promises"; import {McpOrchestration} from ${JSON.stringify(modulePath)}; import {OrchestrationStore} from ${JSON.stringify(storePath)}; const [file,calls,key,arg]=process.argv.slice(1); const registry={get:async()=>({configurationVersion:1}),tools:async()=>[{name:"b",schemaHash:"h",_meta:{}}],call:async(_ctx,_id,tool)=>{await appendFile(calls,tool+"\\n"); await new Promise(r=>setTimeout(r,150)); return {result:{structuredContent:tool==="a"?{amount:3,currency:"USD",period:"2026-01"}:{done:true}}}}}; const service=new McpOrchestration(registry,new OrchestrationStore(file)); const ctx={sessionId:"s",userId:"u",tenantId:"t",requestId:"r",signal:new AbortController().signal}; try { await service.init(); const result=await service.start(ctx,{serverA:"A",toolA:"a",argsA:{scope:arg},serverB:"B",toolB:"b",idempotencyKey:key,confirmedA:true}); console.log(JSON.stringify({id:result.id,state:result.state,error:result.error})); } catch(e) { console.log(JSON.stringify({status:e.status,code:e.code,message:e.message})); process.exitCode= e.status===409?0:1; }`;
  const run = (arg: string) => new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code, file, calls, "shared-key", arg], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout?.on("data", chunk => stdout += chunk.toString());
    child.stderr?.on("data", chunk => stderr += chunk.toString());
    child.once("error", reject);
    child.once("exit", status => status === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || stdout || `child exited ${status}`)));
  });
  try {
    const [left, right] = await Promise.all([run("same"), run("same")]);
    expect(JSON.parse(left).id).toBe(JSON.parse(right).id);
    const persisted = new OrchestrationStore(file);
    for (let attempt = 0; attempt < 100 && (await persisted.get(JSON.parse(left).id))?.state !== "succeeded"; attempt++)
      await new Promise(resolve => setTimeout(resolve, 20));
    expect((await persisted.get(JSON.parse(left).id))?.state).toBe("succeeded");
    expect(await run("different")).toContain('"status":409');
    const callLog = await (await import("node:fs/promises")).readFile(calls, "utf8");
    expect(callLog.trim().split(/\r?\n/).sort()).toEqual(["a", "b"]);
  } finally {
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
  }
}, 20000);

it("preserves corrupt/versioned storage and retains unresolved runs under the cap", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-storage-"));
  const file = join(dir, "runs.json"), store = new OrchestrationStore(file, 2, 30);
  try {
    const fresh = new OrchestrationStore(join(dir, "not-created-yet", "runs.json"));
    await fresh.init();
    expect((await fresh.read()).flows).toEqual([]);
    const corrupt = "{broken";
    await writeFile(file, corrupt, "utf8");
    await expect(store.read()).rejects.toMatchObject({ code: "storage_corrupt" });
    expect(await readFile(file, "utf8")).toBe(corrupt);
    const unsupported = JSON.stringify({ schemaVersion: 2, flows: [] });
    await writeFile(file, unsupported, "utf8");
    await expect(store.read()).rejects.toMatchObject({ code: "storage_corrupt" });
    expect(await readFile(file, "utf8")).toBe(unsupported);
    safeRemoveTestFile(file, dir, protectedTestPaths());

    const now = new Date().toISOString();
    const flow = (id: string, state: string, offset: number): any => ({
      id, ownerId: "user:u", sessionId: "s", requestId: id,
      state, stage: "A", serverA: { id: "a", tool: "read" },
      serverB: { id: "b", tool: "summarize" },
      createdAt: new Date(Date.now() + offset).toISOString(),
      updatedAt: new Date(Date.now() + offset).toISOString(), events: [],
    });
    await store.save(flow("old", "succeeded", -3000));
    await store.save(flow("new", "succeeded", -2000));
    await store.save(flow("newest", "succeeded", -1000));
    await store.save(flow("unresolved", "indeterminate", 0));
    const snapshot = await store.read();
    expect(snapshot.flows.map(x => x.id).sort()).toEqual(["newest", "unresolved"]);
    const protectedStore = new OrchestrationStore(join(dir, "protected.json"), 2, 30);
    await protectedStore.save(flow("uncertain-1", "indeterminate", 0));
    await protectedStore.save(flow("uncertain-2", "indeterminate", 1));
    await expect(protectedStore.save(flow("uncertain-3", "indeterminate", 2))).rejects.toMatchObject({code:"storage_retention_limit"});
    expect((await protectedStore.read()).flows.map(x=>x.id).sort()).toEqual(["uncertain-1","uncertain-2"]);
  } finally {
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
  }
});

it("does not retry a call whose remote result is indeterminate after restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-indeterminate-"));
  const file = join(dir, "runs.json");
  let calls = 0;
  const registry: any = {
    get: async () => ({ configurationVersion: 1 }),
    tools: async () => [{ name: "b", schemaHash: "h", _meta: {} }],
    call: async () => {
      calls++;
      throw new AppError("mcp_result_indeterminate", "transport timeout", 502);
    },
  };
  const ctx: any = { sessionId: "s", userId: "u", tenantId: "t", requestId: "r", signal: new AbortController().signal };
  const input: any = { serverA: "A", toolA: "a", argsA: {}, serverB: "B", toolB: "b", idempotencyKey: "uncertain", confirmedA: true };
  try {
    const first = new McpOrchestration(registry, new OrchestrationStore(file));
    await first.init();
    const interrupted = await first.start(ctx, input);
    expect(interrupted.state).toBe("indeterminate");
    const restarted = new McpOrchestration(registry, new OrchestrationStore(file));
    await restarted.init();
    expect((await restarted.start(ctx, input)).state).toBe("indeterminate");
    expect(calls).toBe(1);
  } finally {
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
  }
});

it("keeps a post-call storage failure indeterminate and does not repeat MCP calls", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-post-call-write-"));
  const file = join(dir, "runs.json");
  let writes = 0;
  const io: OrchestrationStoreIO = {
    open: async (path, flags, ...args) => {
      if (String(path).endsWith(".tmp") && ++writes === 7)
        throw new AppError("storage_unavailable", "injected persistence failure", 503);
      return open(path, flags, ...args);
    },
    rename,
    unlink,
  };
  const calls = { a: 0, b: 0 };
  const registry: any = {
    get: async () => ({ configurationVersion: 1 }),
    tools: async () => [{ name: "b", schemaHash: "h", _meta: {} }],
    call: async (_ctx: any, _id: string, tool: string) => {
      calls[tool as "a" | "b"]++;
      return {
        result: {
          structuredContent:
            tool === "a"
              ? { amount: 3, currency: "USD", period: "2026-01" }
              : { marker: "B_COMPLETED" },
        },
      };
    },
  };
  const store = new OrchestrationStore(file, 500, 30, io);
  const service = new McpOrchestration(registry, store);
  const ctx: any = {
    sessionId: "session-1",
    userId: "owner-1",
    tenantId: "tenant-1",
    requestId: "request-1",
    signal: new AbortController().signal,
  };
  const input: any = {
    serverA: "A",
    toolA: "a",
    argsA: {},
    serverB: "B",
    toolB: "b",
    idempotencyKey: "post-call-storage-failure",
    confirmedA: true,
  };

  try {
    await service.init();
    const first = await service.start(ctx, input);
    expect(first.state).toBe("indeterminate");
    expect(first.resultB).toMatchObject({
      structuredContent: { marker: "B_COMPLETED" },
    });
    expect(calls).toEqual({ a: 1, b: 1 });

    const restarted = new McpOrchestration(registry, new OrchestrationStore(file));
    await restarted.init();
    expect((await restarted.start(ctx, input)).state).toBe("indeterminate");
    expect(calls).toEqual({ a: 1, b: 1 });
  } finally {
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
  }
});

it("blocks a new MCP call when unresolved runs exhaust retention capacity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-retention-start-"));
  try {
    const file = join(dir, "runs.json"),
      store = new OrchestrationStore(file, 2),
      now = new Date().toISOString(),
      calls: string[] = [];
    for (const id of ["uncertain-1", "uncertain-2"])
      await store.save({
        id,
        ownerId: "user:u1",
        sessionId: "session-1",
        requestId: id,
        state: "indeterminate",
        stage: "A",
        serverA: { id: "a", tool: "read" },
        serverB: { id: "b", tool: "summarize" },
        createdAt: now,
        updatedAt: now,
        events: [],
      });
    const service = new McpOrchestration(
      { call: async () => { calls.push("called"); return { result: {} }; } } as any,
      store,
    );
    await expect(
      service.start(
        {
          sessionId: "session-1",
          userId: "u1",
          requestId: "new-request",
          signal: new AbortController().signal,
        } as any,
        {
          serverA: "a",
          toolA: "read",
          argsA: {},
          serverB: "b",
          toolB: "summarize",
          idempotencyKey: "new-key",
          confirmedA: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "storage_retention_limit",
      status: 507,
      message: expect.stringContaining("não foram removidas"),
    });
    expect(calls).toEqual([]);
    expect((await store.read()).flows.map((flow) => flow.id)).toEqual([
      "uncertain-1",
      "uncertain-2",
    ]);
  } finally {
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
  }
});

it.each(["create", "write", "sync", "rename"] as const)("preserves the last committed snapshot when temp %s fails", async (failure) => {
  const dir = await mkdtemp(join(tmpdir(), "tesseract-m13-write-failure-"));
  const file = join(dir, "runs.json");
  const flow: any = { id:"kept", ownerId:"user:u", sessionId:"s", requestId:"r", state:"succeeded", stage:"A", serverA:{id:"a",tool:"a"}, serverB:{id:"b",tool:"b"}, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), events:[] };
  try {
    await new OrchestrationStore(file).save(flow);
    const original = await readFile(file, "utf8");
    const io: OrchestrationStoreIO = {
      open: async (path, flags, ...args) => {
        if (failure === "create" && String(path).endsWith(".tmp")) throw new Error("injected create failure");
        const handle = await open(path, flags, ...args);
        if (failure !== "write" && failure !== "sync") return handle;
        return Object.assign(Object.create(handle), {
          writeFile: failure === "write" ? async () => { throw new Error("injected write failure"); } : handle.writeFile.bind(handle),
          sync: failure === "sync" ? async () => { throw new Error("injected sync failure"); } : handle.sync.bind(handle),
          close: handle.close.bind(handle),
        }) as typeof handle;
      },
      rename: async (from, to) => { if (failure === "rename") throw new Error("injected rename failure"); return rename(from, to); },
      unlink,
    };
    const failing = new OrchestrationStore(file, 500, 30, io);
    await expect(failing.save({ ...flow, id:"not-committed" })).rejects.toThrow("injected");
    expect(await readFile(file, "utf8")).toBe(original);
    expect((await new OrchestrationStore(file).read()).flows.map((x) => x.id)).toEqual(["kept"]);
    expect((await readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  } finally { safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths()); }
});
