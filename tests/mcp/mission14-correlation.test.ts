import { expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { McpOrchestration } from "../../src/server/mcp/orchestration.js";
import { OrchestrationStore } from "../../src/server/mcp/orchestration-store.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import {
  protectedTestPaths,
  safeRemoveTestDirectory,
} from "../../scripts/test-path-safety.js";

it("correlates persisted synthetic MCP cost and inventory results from independent servers", async () => {
  const temp = await mkdtemp(join(tmpdir(), "tesseract-m14-"));
  const counts = { costs: 0, inventory: 0 };
  let oversizedCosts = false;
  let wrongScopeCosts = false;
  const servers: Array<{
    http: ReturnType<typeof createServer>;
    sessions: Map<string, any>;
  }> = [];
  const period = { from: "2026-10-01", toExclusive: "2026-11-01" };
  const launch = async (kind: "costs" | "inventory") => {
    const sessions = new Map<string, any>();
    const http = createServer(async (req, res) => {
      let session = req.headers["mcp-session-id"]
        ? sessions.get(String(req.headers["mcp-session-id"]))
        : undefined;
      if (!session && req.headers["mcp-session-id"])
        return void res.writeHead(404).end();
      if (!session) {
        const server = new McpServer(
          { name: `m14-${kind}`, version: "1" },
          { capabilities: { tools: {} } },
        );
        server.registerTool(
          kind === "costs" ? "list_costs" : "list_inventory",
          {
            inputSchema: {
              scope: z.string(),
              from: z.string(),
              toExclusive: z.string(),
            },
            annotations: { readOnlyHint: true },
            _meta:
              kind === "inventory"
                ? { "tesseract/approval": "each-call" }
                : undefined,
          },
          async () => {
            counts[kind]++;
            const costRows = [
              {
                lineId: "cost-1",
                provider: "azure",
                scope: "sub-01",
                resourceId: "vm-01",
                period,
                currency: "USD",
                amount: "10.10",
                classification: "usage",
                evidenceRef: "cost://cost-1",
              },
              {
                lineId: "cost-2",
                provider: "azure",
                scope: "sub-01",
                resourceId: "vm-01",
                period,
                currency: "USD",
                amount: "0.20",
                classification: "usage",
                evidenceRef: "cost://cost-2",
              },
              {
                lineId: "shared-1",
                provider: "azure",
                scope: "sub-01",
                resourceId: null,
                period,
                currency: "USD",
                amount: "2.00",
                classification: "shared",
                evidenceRef: "cost://shared-1",
              },
              {
                lineId: "unmatched-1",
                provider: "azure",
                scope: "sub-01",
                resourceId: "vm-missing",
                period,
                currency: "USD",
                amount: "3.00",
                classification: "usage",
                evidenceRef: "cost://unmatched-1",
              },
            ];
            return {
              content: [{ type: "text", text: `synthetic-${kind}` }],
              structuredContent:
                kind === "costs"
                  ? {
                      rows: oversizedCosts
                        ? Array.from({ length: 251 }, (_, index) => ({
                            ...costRows[0],
                            lineId: `oversized-${index}`,
                          }))
                        : wrongScopeCosts
                          ? costRows.map((row) => ({
                              ...row,
                              scope: "scope-other",
                            }))
                          : costRows,
                    }
                  : {
                      rows: [
                        {
                          inventoryId: "inv-1",
                          provider: "azure",
                          scope: "sub-01",
                          resourceId: "vm-01",
                          resourceType: "compute",
                          name: "Synthetic VM",
                          evidenceRef: "inventory://inv-1",
                        },
                        {
                          inventoryId: "inv-2",
                          provider: "azure",
                          scope: "sub-02",
                          resourceId: "vm-01",
                          resourceType: "compute",
                          name: "Other scope VM",
                          evidenceRef: "inventory://inv-2",
                        },
                      ],
                    },
            };
          },
        );
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
    servers.push({ http, sessions });
    return `http://127.0.0.1:${(http.address() as import("node:net").AddressInfo).port}/mcp`;
  };
  try {
    const endpoints = await Promise.all([launch("costs"), launch("inventory")]);
    const ids = [randomUUID(), randomUUID()];
    const snapshot: any = {
      schemaVersion: 1,
      accessProfiles: [],
      agentProfiles: [],
      mcpProfiles: endpoints.map((endpoint, i) => ({
        id: ids[i],
        name: `M14 ${i ? "inventory" : "costs"}`,
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
    const configStore: any = {
      read: async () => structuredClone(snapshot),
      mutate: async (fn: any) => fn(snapshot),
    };
    const registry = new McpRegistry(
      configStore,
      {} as any,
      {} as any,
      new Invalidation(configStore),
      {} as any,
    );
    const context: any = {
      sessionId: "m14-owner-session",
      userId: "m14-owner",
      tenantId: "",
      requestId: "m14-request",
      signal: new AbortController().signal,
      diagnose: () => {},
    };
    await registry.approve(context, ids[0], ["list_costs"]);
    await registry.approve(context, ids[1], ["list_inventory"]);
    const file = join(temp, "orchestrations.json");
    const service = new McpOrchestration(
      registry,
      new OrchestrationStore(file),
    );
    await expect(
      service.startFinOpsCorrelation(context, {
        serverA: ids[0],
        toolA: "list_costs",
        serverB: ids[1],
        toolB: "list_inventory",
        scope: "sub-01",
        period: { from: "2026-13-01", toExclusive: "2026-14-01" },
        confirmedA: true,
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(counts).toEqual({ costs: 0, inventory: 0 });
    const idempotencyKey = randomUUID();
    const flow = await service.startFinOpsCorrelation(context, {
      serverA: ids[0],
      toolA: "list_costs",
      serverB: ids[1],
      toolB: "list_inventory",
      idempotencyKey,
      scope: "sub-01",
      period,
      confirmedA: true,
    });
    expect(flow.state).toBe("awaiting_b_confirmation");
    expect(counts).toEqual({ costs: 1, inventory: 0 });
    const repeated = await service.startFinOpsCorrelation(context, {
      serverA: ids[0],
      toolA: "list_costs",
      serverB: ids[1],
      toolB: "list_inventory",
      idempotencyKey,
      scope: "sub-01",
      period,
      confirmedA: true,
    });
    expect(repeated.id).toBe(flow.id);
    expect(counts).toEqual({ costs: 1, inventory: 0 });
    await expect(
      service.startFinOpsCorrelation(context, {
        serverA: ids[0],
        toolA: "list_costs",
        serverB: ids[1],
        toolB: "list_inventory",
        idempotencyKey,
        scope: "other-scope",
        period,
        confirmedA: true,
      }),
    ).rejects.toMatchObject({ code: "invalid_request", status: 409 });
    await expect(
      service.get("other-session", flow.id, "user:other-owner"),
    ).rejects.toMatchObject({ code: "not_found" });
    const done = await service.confirm(context, flow.id);
    expect(done.state).toBe("succeeded");
    expect(counts).toEqual({ costs: 1, inventory: 1 });
    expect((done as any).correlation).toMatchObject({
      status: "complete_with_discrepancies",
      totals: [{ currency: "USD", amount: "15.3", period }],
      associations: [
        {
          resourceId: "vm-01",
          amount: "10.3",
          costLineIds: ["cost-1", "cost-2"],
        },
      ],
      nonAllocatable: [{ costLineIds: ["shared-1"] }],
      unassociated: [{ costLineIds: ["unmatched-1"] }],
    });
    expect((done as any).resultA).toEqual({
      summary: expect.stringContaining("detalhes derivados"),
    });
    expect((done as any).resultB).toEqual({
      summary: expect.stringContaining("resposta original omitida"),
    });
    const stored = JSON.parse(await readFile(file, "utf8"));
    expect(stored.flows[0].kind).toBe("finops-correlation");
    expect(JSON.stringify(stored)).not.toMatch(/token|password|secret/i);
    const recoveredService = new McpOrchestration(
      registry,
      new OrchestrationStore(file),
    );
    await recoveredService.init();
    const recovered = await recoveredService.get(
      "new-session-after-restart",
      flow.id,
      "user:m14-owner",
    );
    expect(recovered.state).toBe("succeeded");
    expect((recovered as any).correlation.totals).toEqual([
      { currency: "USD", amount: "15.3", period },
    ]);
    wrongScopeCosts = true;
    const wrongScope = await service.startFinOpsCorrelation(context, {
      serverA: ids[0],
      toolA: "list_costs",
      serverB: ids[1],
      toolB: "list_inventory",
      idempotencyKey: randomUUID(),
      scope: "sub-01",
      period,
      confirmedA: true,
    });
    expect(wrongScope.state).toBe("failed");
    expect(wrongScope.error).toMatch(/escopo solicitado/);
    expect(counts).toEqual({ costs: 2, inventory: 1 });
    wrongScopeCosts = false;
    oversizedCosts = true;
    const oversized = await service.startFinOpsCorrelation(context, {
      serverA: ids[0],
      toolA: "list_costs",
      serverB: ids[1],
      toolB: "list_inventory",
      idempotencyKey: randomUUID(),
      scope: "sub-01",
      period,
      confirmedA: true,
    });
    expect(oversized.state).toBe("failed");
    expect(oversized.error).toMatch(/250 linhas/);
    expect(counts).toEqual({ costs: 3, inventory: 1 });
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
