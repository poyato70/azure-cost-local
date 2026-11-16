import { expect, it } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { McpOrchestration } from "../../src/server/mcp/orchestration.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import { OrchestrationStore } from "../../src/server/mcp/orchestration-store.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { protectedTestPaths, safeRemoveTestDirectory } from "../../scripts/test-path-safety.js";

it("orchestrates two real Streamable HTTP MCP servers once and preserves A through B confirmation", async () => {
  const temp = await mkdtemp(join(tmpdir(), "tesseract-m12-store-"));
  const calls = { a: 0, b: 0, received: undefined as any };
  const behavior = { invalidA: false, errorA: false, errorB: false };
  let changeBSchema = () => {};
  const servers: any[] = [];
  async function launch(role: "a" | "b") {
    const sessions = new Map<
      string,
      { transport: StreamableHTTPServerTransport; server: McpServer }
    >();
    const http = createServer(async (req, res) => {
      let session = req.headers["mcp-session-id"]
        ? sessions.get(String(req.headers["mcp-session-id"]))
        : undefined;
      if (!session && req.headers["mcp-session-id"])
        return void res.writeHead(404).end();
      if (!session) {
        const server = new McpServer(
          { name: `m12-${role}-fixture`, version: "1" },
          { capabilities: { tools: {} } },
        );
        if (role === "a")
          server.registerTool(
            "fixture_cost",
            {
              inputSchema: { scope: z.string() },
              annotations: { readOnlyHint: true },
            },
            async () => {
              calls.a++;
              if (behavior.errorA)
                return {
                  isError: true,
                  content: [{ type: "text", text: "M12_CONTROLLED_ERROR_A" }],
                };
              return {
                content: [{ type: "text", text: "M12_SYNTHETIC_COST" }],
                structuredContent: behavior.invalidA
                  ? {
                      marker: "M12_SYNTHETIC_COST",
                      amount: 42.5,
                      period: "2026-10",
                    }
                  : {
                      marker: "M12_SYNTHETIC_COST",
                      amount: 42.5,
                      currency: "USD",
                      period: "2026-10",
                    },
              };
            },
          );
        else {
          const summaryTool = server.registerTool(
            "fixture_summary",
            {
              inputSchema: {
                amount: z.number(),
                currency: z.string(),
                period: z.string(),
              },
              annotations: { readOnlyHint: true },
              _meta: { "tesseract/approval": "each-call" },
            },
            async (args) => {
              calls.b++;
              calls.received = args;
              if (behavior.errorB)
                return {
                  isError: true,
                  content: [{ type: "text", text: "M12_CONTROLLED_ERROR_B" }],
                };
              return {
                content: [{ type: "text", text: "M12_SYNTHETIC_SUMMARY" }],
                structuredContent: {
                  marker: "M12_SYNTHETIC_SUMMARY",
                  total: args.amount,
                  currency: args.currency,
                  period: args.period,
                },
              };
            },
          );
          changeBSchema = () =>
            summaryTool.update({
              paramsSchema: {
                amount: z.string(),
                currency: z.string(),
                period: z.string(),
              },
            });
        }
        let transport!: StreamableHTTPServerTransport;
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, server });
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };
        await server.connect(transport);
        session = { transport, server };
      }
      await session.transport.handleRequest(req, res);
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address() as import("node:net").AddressInfo;
    servers.push({ http, sessions });
    return `http://127.0.0.1:${address.port}/mcp`;
  }
  const endpoints = await Promise.all([launch("a"), launch("b")]);
  const ids = [randomUUID(), randomUUID()];
  const snapshot: any = {
    schemaVersion: 1,
    accessProfiles: [],
    agentProfiles: [],
    mcpProfiles: endpoints.map((endpoint, i) => ({
      id: ids[i],
      name: `M12 server ${i ? "B" : "A"}`,
      preset: "custom",
      transport: "http",
      endpoint,
      authMode: "none",
      allowPrivateNetwork: true,
      resourceContext: {},
      approvedTools: [],
      configurationVersion: 1,
    })),
  };
  const store: any = {
    read: async () => structuredClone(snapshot),
    mutate: async (fn: any) => fn(snapshot),
  };
  const registry = new McpRegistry(
    store,
    {} as any,
    {} as any,
    new Invalidation(store),
    {} as any,
  );
  const ctx: any = {
    sessionId: "m12-session",
    userId: "",
    tenantId: "",
    requestId: "m12-request",
    signal: new AbortController().signal,
    diagnose: () => {},
  };
  try {
    await registry.approve(ctx, ids[0], ["fixture_cost"]);
    await registry.approve(ctx, ids[1], ["fixture_summary"]);
    const flowService = new McpOrchestration(
      registry,
      new OrchestrationStore(join(temp, "orchestrations.json")),
    );
    const input = {
      serverA: ids[0],
      toolA: "fixture_cost",
      argsA: { scope: "TEST_ONLY" },
      serverB: ids[1],
      toolB: "fixture_summary",
      idempotencyKey: randomUUID(),
      confirmedA: true as const,
    };
    const pending = await flowService.start(ctx, input);
    expect(pending.state).toBe("awaiting_b_confirmation");
    expect(calls).toMatchObject({ a: 1, b: 0 });
    const repeated = await flowService.start(ctx, input);
    expect(repeated.id).toBe(pending.id);
    expect(calls.a).toBe(1);
    const complete = await flowService.confirm(ctx, pending.id);
    expect(complete.state).toBe("succeeded");
    expect(calls).toMatchObject({
      a: 1,
      b: 1,
      received: { amount: 42.5, currency: "USD", period: "2026-10" },
    });
    expect(JSON.stringify(complete.resultB)).toContain("M12_SYNTHETIC_SUMMARY");
    expect(complete.events.map((event) => event.stage)).toEqual([
      "A",
      "A",
      "B",
      "B",
      "B",
    ]);
    expect((await flowService.confirm(ctx, pending.id)).state).toBe(
      "succeeded",
    );
    expect(calls.b).toBe(1);
    snapshot.mcpProfiles[1].approvedTools = [];
    const blocked = await flowService.start(ctx, {
      ...input,
      idempotencyKey: randomUUID(),
    });
    expect(blocked.state).toBe("awaiting_b_confirmation");
    const denied = await flowService.confirm(ctx, blocked.id);
    expect(denied.state).toBe("failed");
    expect(denied.resultA).toBeDefined();
    expect(calls).toMatchObject({ a: 2, b: 1 });
    behavior.errorA = true;
    const errorA = await flowService.start(ctx, {
      ...input,
      idempotencyKey: randomUUID(),
    });
    expect(errorA.state).toBe("failed");
    expect(errorA.stage).toBe("A");
    expect(calls.b).toBe(1);
    behavior.errorA = false;
    behavior.invalidA = true;
    const invalidA = await flowService.start(ctx, {
      ...input,
      idempotencyKey: randomUUID(),
    });
    expect(invalidA.state).toBe("failed");
    expect(invalidA.stage).toBe("A");
    expect(calls.b).toBe(1);
    behavior.invalidA = false;
    await registry.approve(ctx, ids[1], ["fixture_summary"]);
    behavior.errorB = true;
    const errorB = await flowService.start(ctx, {
      ...input,
      idempotencyKey: randomUUID(),
    });
    const failedB = await flowService.confirm(ctx, errorB.id);
    expect(failedB.state).toBe("failed");
    expect(failedB.stage).toBe("B");
    expect(failedB.resultA).toBeDefined();
    expect(calls.b).toBe(2);
    behavior.errorB = false;
    const changedSchemaFlow = await flowService.start(ctx, {
      ...input,
      idempotencyKey: randomUUID(),
    });
    changeBSchema();
    const changedSchema = await flowService.confirm(ctx, changedSchemaFlow.id);
    expect(changedSchema.state).toBe("failed");
    expect(changedSchema.resultA).toBeDefined();
    expect(changedSchema.error).toMatch(/aprovação|schema|aprovada/i);
    expect(calls.b).toBe(2);
  } finally {
    for (const item of servers) {
      for (const { transport, server } of item.sessions.values()) {
        await transport.close().catch(() => {});
        await server.close().catch(() => {});
      }
      await new Promise<void>((resolve) => item.http.close(() => resolve()));
    }
    safeRemoveTestDirectory(temp, tmpdir(), protectedTestPaths());
  }
});
