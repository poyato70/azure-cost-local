import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { pathToFileURL } from "node:url";

export const FIXTURE_MARKER = "M10_FIXTURE_ONLY";
const fixtureState = () => ({ calls: 0, writes: 0 });

export function createMission10Server(
  state = fixtureState(),
  options: { changedSchema?: boolean } = {},
) {
  const server = new McpServer(
    { name: "tesseract-mission-10-fixture", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  server.registerTool(
    "m10_read_status",
    {
      description:
        "Leitura determinística de dados identificados da Missão 10.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      state.calls++;
      return {
        content: [
          {
            type: "text",
            text: `${FIXTURE_MARKER}: status=ready; calls=${state.calls}`,
          },
        ],
        structuredContent: {
          marker: FIXTURE_MARKER,
          status: "ready",
          calls: state.calls,
        },
      };
    },
  );

  const schemaTool = server.registerTool(
    "m10_schema_echo",
    {
      description: "Exercita tipos, enum, defaults, arrays e objeto aninhado.",
      inputSchema: {
        requiredText: options.changedSchema
          ? z
              .number()
              .int()
              .describe("Texto obrigatório de teste, com schema alterado")
          : z.string().min(1).describe("Texto obrigatório de teste"),
        count: z.number().int().min(0).max(20).default(2),
        enabled: z.boolean().default(true),
        mode: z.enum(["safe", "diagnostic"]).default("safe"),
        tags: z.array(z.string()).default([]),
        options: z
          .object({ limit: z.number().int().min(1).max(10).default(3) })
          .default({ limit: 3 }),
        optionalNote: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return {
        content: [
          { type: "text", text: `${FIXTURE_MARKER}: schema echo concluído` },
        ],
        structuredContent: { marker: FIXTURE_MARKER, received: args },
      };
    },
  );

  server.registerTool(
    "m10_controlled_error",
    {
      description: "Retorna erro MCP controlado e identificável.",
      inputSchema: { requiredText: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false },
      _meta: { "tesseract/approval": "each-call" },
    },
    async () => {
      state.calls++;
      return {
        isError: true,
        content: [{ type: "text", text: `${FIXTURE_MARKER}: erro controlado` }],
      };
    },
  );

  server.registerTool(
    "m10_temp_write",
    {
      description:
        "Grava apenas no diretório temporário exclusivo informado no ambiente da fixture.",
      inputSchema: { value: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ value }) => {
      const root = process.env.M10_FIXTURE_TEMP;
      if (!root) throw new Error("M10_FIXTURE_TEMP ausente; escrita negada.");
      await mkdir(root, { recursive: true });
      await writeFile(
        `${root}/observation.txt`,
        `${FIXTURE_MARKER}: ${value}\n`,
        { flag: "a" },
      );
      state.writes++;
      return {
        content: [
          {
            type: "text",
            text: `${FIXTURE_MARKER}: temporary write completed`,
          },
        ],
      };
    },
  );

  server.registerResource(
    "m10-static-resource",
    "m10-fixture://mission-10/static",
    {
      title: "Recurso estático M10",
      description: `${FIXTURE_MARKER}: texto estático`,
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, text: `${FIXTURE_MARKER}: recurso estático` },
      ],
    }),
  );

  server.registerResource(
    "m10-json-resource",
    "m10-fixture://mission-10/structured",
    {
      title: "Recurso estruturado M10",
      description: `${FIXTURE_MARKER}: JSON`,
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ marker: FIXTURE_MARKER, kind: "structured" }),
        },
      ],
    }),
  );

  server.registerPrompt(
    "m10_greeting",
    {
      description: "Prompt de teste com argumento opcional.",
      argsSchema: { name: z.string().optional() },
    },
    async ({ name }) => ({
      description: `${FIXTURE_MARKER}: prompt`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Olá ${name || "visitante"} — ${FIXTURE_MARKER}`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "m10_required_prompt",
    {
      description: "Prompt M10 com argumento obrigatório.",
      argsSchema: { topic: z.string().min(1) },
    },
    async ({ topic }) => ({
      description: `${FIXTURE_MARKER}: prompt obrigatório`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Tópico: ${topic} — ${FIXTURE_MARKER}`,
          },
        },
      ],
    }),
  );

  return {
    server,
    state,
    changeSchema: () =>
      schemaTool.update({ paramsSchema: { requiredText: z.number().int() } }),
  };
}

async function runStdioFixture() {
  const { server } = createMission10Server();
  await server.connect(new StdioServerTransport());
}

async function runHttpFixture() {
  const transports = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();
  let changedSchema = false;
  const http = createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/mcp") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let session = sessionId ? transports.get(sessionId) : undefined;
        if (!session && req.headers["mcp-session-id"]) {
          res.writeHead(404).end("Unknown MCP session");
          return;
        }
        if (!session) {
          const { server } = createMission10Server(undefined, {
            changedSchema,
          });
          let transport!: StreamableHTTPServerTransport;
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              transports.set(id, { transport, server });
            },
          });
          transport.onclose = () => {
            if (transport.sessionId) transports.delete(transport.sessionId);
          };
          await server.connect(transport);
          session = { transport, server };
        }
        await session.transport.handleRequest(req, res);
        return;
      }
      if (req.method === "DELETE" && req.url === "/mcp") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        const session = sessionId ? transports.get(sessionId) : undefined;
        if (!session) {
          res.writeHead(404).end();
          return;
        }
        await session.transport.handleRequest(req, res);
        transports.delete(sessionId!);
        await session.server.close();
        return;
      }
      if (req.method === "POST" && req.url === "/__mission10/change-schema") {
        changedSchema = true;
        res.writeHead(204).end();
        return;
      }
      res.writeHead(404).end();
    } catch (error) {
      if (!res.headersSent) res.writeHead(500);
      res.end(error instanceof Error ? error.message : "MCP fixture error");
    }
  });
  const port = Number(process.env.M10_MCP_PORT || 0);
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, "127.0.0.1", () => resolve());
  });
  const address = http.address();
  if (!address || typeof address === "string")
    throw new Error("Invalid HTTP address");
  process.stdout.write(JSON.stringify({ port: address.port }) + "\n");
  const close = async () => {
    for (const { transport, server } of transports.values()) {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    }
    await new Promise<void>((resolve) => http.close(() => resolve()));
  };
  process.once("SIGINT", () => {
    void close().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void close().finally(() => process.exit(0));
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--stdio")) await runStdioFixture();
  else if (process.argv.includes("--http")) await runHttpFixture();
}
