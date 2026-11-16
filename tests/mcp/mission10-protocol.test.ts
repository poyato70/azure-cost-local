import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { protectedTestPaths, safeRemoveTestDirectory } from "../../scripts/test-path-safety.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:http";
import {
  createMission10Server,
  FIXTURE_MARKER,
} from "../fixtures/mcp-mission10-server.js";

const root = process.cwd();
const fixture = join(root, "tests", "fixtures", "mcp-mission10-server.ts");
const clients: Client[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.close().catch(() => {});
  for (const dir of dirs.splice(0))
    safeRemoveTestDirectory(dir, tmpdir(), protectedTestPaths());
});

async function validateProtocol(client: Client) {
  const version = client.getServerVersion();
  expect(version).toMatchObject({
    name: "tesseract-mission-10-fixture",
    version: "1.0.0",
  });
  expect(client.getServerCapabilities()).toMatchObject({
    tools: {},
    resources: { listChanged: true },
    prompts: { listChanged: true },
  });

  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toEqual([
    "m10_read_status",
    "m10_schema_echo",
    "m10_controlled_error",
    "m10_temp_write",
  ]);
  const schemaTool = tools.find((tool) => tool.name === "m10_schema_echo")!;
  expect(schemaTool.inputSchema.required).toContain("requiredText");
  expect((schemaTool.inputSchema.properties as any).mode.enum).toEqual([
    "safe",
    "diagnostic",
  ]);
  const read = await client.callTool({
    name: "m10_read_status",
    arguments: {},
  });
  expect(JSON.stringify(read)).toContain(FIXTURE_MARKER);
  const invalid = await client.callTool({
    name: "m10_controlled_error",
    arguments: { requiredText: "x" },
  });
  expect(invalid.isError).toBe(true);
  expect(JSON.stringify(invalid)).toContain("erro controlado");

  const { resources } = await client.listResources();
  expect(resources).toHaveLength(2);
  const staticResource = await client.readResource({
    uri: "m10-fixture://mission-10/static",
  });
  expect(JSON.stringify(staticResource)).toContain("recurso estático");
  const structured = await client.readResource({
    uri: "m10-fixture://mission-10/structured",
  });
  expect(JSON.stringify(structured)).toContain('\\"kind\\":\\"structured\\"');

  const { prompts } = await client.listPrompts();
  expect(prompts.map((prompt) => prompt.name)).toEqual([
    "m10_greeting",
    "m10_required_prompt",
  ]);
  await expect(
    client.getPrompt({ name: "m10_required_prompt" }),
  ).rejects.toThrow();
  const prompt = await client.getPrompt({
    name: "m10_required_prompt",
    arguments: { topic: "protocolo" },
  });
  expect(JSON.stringify(prompt)).toContain(FIXTURE_MARKER);
}

it("speaks real MCP over stdio and closes the child process", async () => {
  const temp = await mkdtemp(join(tmpdir(), "tesseract-m10-stdio-"));
  dirs.push(temp);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", fixture, "--stdio"],
    cwd: root,
    env: { ...process.env, M10_FIXTURE_TEMP: temp },
    stderr: "pipe",
  });
  const client = new Client({
    name: "mission-10-test-client",
    version: "1.0.0",
  });
  clients.push(client);
  await client.connect(transport, { timeout: 15000 });
  await validateProtocol(client);
  const write = await client.callTool({
    name: "m10_temp_write",
    arguments: { value: "isolated" },
  });
  expect(JSON.stringify(write)).toContain(FIXTURE_MARKER);
  expect(await readFile(join(temp, "observation.txt"), "utf8")).toContain(
    "isolated",
  );
  await client.close();
  expect(transport.pid).toBeNull();
}, 30000);

it("speaks real MCP over stateful Streamable HTTP and rejects unknown sessions", async () => {
  const { server } = createMission10Server();
  const transports = new Map<
    string,
    import("@modelcontextprotocol/sdk/server/streamableHttp.js").StreamableHTTPServerTransport
  >();
  const http = createServer(async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport && sessionId) {
      res.writeHead(404).end();
      return;
    }
    if (!transport) {
      let created!: import("@modelcontextprotocol/sdk/server/streamableHttp.js").StreamableHTTPServerTransport;
      created = new (
        await import("@modelcontextprotocol/sdk/server/streamableHttp.js")
      ).StreamableHTTPServerTransport({
        sessionIdGenerator: () => globalThis.crypto.randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, created);
        },
      });
      transport = created;
      await server.connect(transport);
    }
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (!address || typeof address === "string")
    throw new Error("No HTTP address");
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${address.port}/mcp`),
  );
  const client = new Client({
    name: "mission-10-test-client",
    version: "1.0.0",
  });
  clients.push(client);
  try {
    await client.connect(transport, { timeout: 15000 });
    await validateProtocol(client);
    const sessionId = transport.sessionId;
    expect(sessionId).toBeTruthy();
    const missing = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mcp-session-id": "unknown-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "ping",
        params: {},
      }),
    });
    expect(missing.status).toBe(404);
  } finally {
    await client.close().catch(() => {});
    await new Promise<void>((resolve) => http.close(() => resolve()));
    await server.close();
  }
}, 30000);
