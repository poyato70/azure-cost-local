import { expect, it } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createMission10Server,
  FIXTURE_MARKER,
} from "../fixtures/mcp-mission10-server.js";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import { descriptor } from "../../src/server/mcp/tool-policy.js";

it("enforces discovery approval, changed schemas, controlled errors and redaction with a real SDK server", async () => {
  const state = { calls: 0, writes: 0 };
  let changeSchema: () => void = () => {};
  let schemaVersionChanged = false;
  const transports = new Map<
    string,
    {
      transport: StreamableHTTPServerTransport;
      server: ReturnType<typeof createMission10Server>["server"];
    }
  >();
  const http = createServer(async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let session = sessionId ? transports.get(sessionId) : undefined;
    if (!session && sessionId) {
      res.writeHead(404).end();
      return;
    }
    if (!session) {
      const fixture = createMission10Server(state);
      if (schemaVersionChanged) fixture.changeSchema();
      let created!: StreamableHTTPServerTransport;
      created = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, { transport: created, server: fixture.server });
        },
      });
      await fixture.server.connect(created);
      session = { transport: created, server: fixture.server };
    }
    await session.transport.handleRequest(req, res);
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture address");

  const mcpId = randomUUID();
  const profile: any = {
    id: mcpId,
    name: "Tesseract M10 fixture",
    preset: "custom",
    transport: "http",
    endpoint: `http://127.0.0.1:${address.port}/mcp`,
    authMode: "none",
    allowPrivateNetwork: true,
    resourceContext: {},
    approvedTools: [],
    configurationVersion: 1,
  };
  const snapshot: any = {
    schemaVersion: 1,
    accessProfiles: [],
    mcpProfiles: [profile],
    agentProfiles: [],
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
  const events: any[] = [];
  const ctx: any = {
    sessionId: "m10-session",
    userId: "",
    tenantId: "",
    requestId: "m10-request",
    signal: new AbortController().signal,
    diagnose: (event: any) => events.push(event),
  };
  try {
    const tools = await registry.tools(ctx, mcpId);
    expect(tools).toHaveLength(4);
    expect((await registry.list(ctx.sessionId))[0].connected).toBe(true);
    expect((await registry.list("different-session"))[0].connected).toBe(false);
    expect(
      tools.find((tool: any) => tool.name === "m10_temp_write"),
    ).toMatchObject({ reviewable: false, approved: false });
    expect(
      tools.find((tool: any) => tool.name === "m10_controlled_error")?._meta,
    ).toEqual({ "tesseract/approval": "each-call" });
    expect(
      descriptor({
        name: "m10_read_status",
        inputSchema: {},
        _meta: { "tesseract/approval": "each-call" },
      }).schemaHash,
    ).not.toBe(
      descriptor({ name: "m10_read_status", inputSchema: {} }).schemaHash,
    );

    await expect(
      registry.call(ctx, mcpId, "m10_read_status", {}),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(state.calls).toBe(0);

    await registry.approve(ctx, mcpId, [
      "m10_read_status",
      "m10_schema_echo",
      "m10_controlled_error",
    ]);
    const result = await registry.call(ctx, mcpId, "m10_read_status", {});
    expect(JSON.stringify(result)).toContain(FIXTURE_MARKER);
    expect(result.requestId).toBe(ctx.requestId);
    expect(state.calls).toBe(1);

    await expect(
      registry.call(ctx, mcpId, "m10_schema_echo", {}),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const schemaResult = await registry.call(ctx, mcpId, "m10_schema_echo", {
      requiredText: "controlled",
      count: 7,
      enabled: false,
      mode: "diagnostic",
      tags: ["a", "b"],
      options: { limit: 5 },
    });
    expect(JSON.stringify(schemaResult)).toContain('"count":7');

    await expect(
      registry.call(ctx, mcpId, "m10_controlled_error", { requiredText: "x" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(state.calls).toBe(1);
    await expect(
      registry.call(
        ctx,
        mcpId,
        "m10_controlled_error",
        { requiredText: "x" },
        undefined,
        true,
      ),
    ).rejects.toMatchObject({ code: "mcp_tool_failed" });
    expect(state.calls).toBe(2);
    await expect(
      registry.call(ctx, mcpId, "m10_controlled_error", { requiredText: "x" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(state.calls).toBe(2);

    await expect(
      registry.approve(ctx, mcpId, ["m10_temp_write"]),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      registry.call(ctx, mcpId, "m10_temp_write", {
        value: "unauthorized-write-must-not-run",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(state.writes).toBe(0);
    expect(events.some((event) => event.status === "sucesso")).toBe(true);
    expect(events.some((event) => event.status === "mcp_tool_failed")).toBe(
      true,
    );

    await registry.disconnect(mcpId);
    schemaVersionChanged = true;
    await expect(
      registry.call(ctx, mcpId, "m10_schema_echo", {
        requiredText: "old schema",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const redacted = await registry.call(ctx, mcpId, "m10_read_status", {});
    expect(descriptor({ name: "token_test", inputSchema: {} }).name).toBe(
      "token_test",
    );
    expect(JSON.stringify(redacted)).not.toContain("controlled-token");
  } finally {
    await registry.close();
    for (const { transport, server } of transports.values()) {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    }
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
}, 30000);
