import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Registry } from "./registry.js";
import { isReadOnlyTool, withMcp } from "./mcp.js";

const registry = await new Registry().load();
const app = Fastify({ logger: false, bodyLimit: 32 * 1024 });
app.get("/api/health", async () => ({ status: "ok", app: "Tesseract 2.0", storage: "local-file" }));
app.get("/api/bindings", async () => registry.list());
app.get("/api/activity", async () => registry.events());
app.post<{ Body: { name?: string; endpoint?: string; transport?: "streamable-http" | "stdio"; command?: string; args?: string[]; env?: Record<string, string> } }>("/api/bindings", async (req, reply) => {
  if (typeof req.body?.name !== "string" || !req.body.name.trim()) return reply.code(400).send({ error: "Informe o nome da conexão MCP." });
  if (req.body.transport === "stdio" && (typeof req.body.command !== "string" || !Array.isArray(req.body.args ?? []) || (req.body.args ?? []).some((arg) => typeof arg !== "string") || (req.body.env !== undefined && (!req.body.env || typeof req.body.env !== "object" || Object.values(req.body.env).some((value) => typeof value !== "string"))))) return reply.code(400).send({ error: "Comando, argumentos ou ambiente stdio inválidos." });
  try {
    const binding = req.body.transport === "stdio"
      ? await registry.addStdio(req.body.name, req.body.command ?? "", req.body.args ?? [], req.body.env ?? {})
      : (typeof req.body.endpoint === "string" ? await registry.add(req.body.name, req.body.endpoint) : (() => { throw new Error("Informe o endpoint MCP."); })());
    const { env: _env, ...safeBinding } = binding;
    return reply.code(201).send(safeBinding);
  }
  catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
});
app.get<{ Params: { id: string } }>("/api/bindings/:id/tools", async (req, reply) => {
  const binding = registry.get(req.params.id); if (!binding) return reply.code(404).send({ error: "Binding não encontrado." });
  const observedAt = new Date().toISOString();
  try {
    const tools = await withMcp(binding, async (client) => (await client.listTools(undefined, { timeout: 15000 })).tools.map((tool) => ({ ...tool, readOnly: isReadOnlyTool(tool.name) })));
    await registry.discovered(binding.id); await registry.event(binding.id, "tools/list", "success");
    return { binding: { id: binding.id, name: binding.name, endpoint: binding.endpoint, transport: binding.transport }, observedAt, source: `MCP ${binding.transport} tools/list`, classification: "heuristic-read-only-filter", tools };
  } catch (error) { await registry.event(binding.id, "tools/list", "error"); return reply.code(502).send({ error: "Falha ao consultar servidor MCP.", detail: (error as Error).message, observedAt, source: `MCP ${binding.transport}` }); }
});
app.post<{ Params: { id: string }; Body: { name?: string; arguments?: Record<string, unknown> } }>("/api/bindings/:id/call", async (req, reply) => {
  const binding = registry.get(req.params.id); if (!binding) return reply.code(404).send({ error: "Binding não encontrado." });
  if (typeof req.body?.name !== "string" || !isReadOnlyTool(req.body.name, req.body.arguments)) return reply.code(403).send({ error: "Política local bloqueou esta operação; Foundry só permite descoberta learn=true ou subcomandos classificados read-only pelo nome." });
  const observedAt = new Date().toISOString();
  try {
    const result = await withMcp(binding, (client) => client.callTool({ name: req.body.name!, arguments: req.body.arguments ?? {} }, undefined, { timeout: 20000 }));
    const failed = Boolean(result.isError);
    await registry.event(binding.id, `tools/call:${req.body.name}`, failed ? "error" : "success");
    return { binding: { id: binding.id, name: binding.name, endpoint: binding.endpoint, transport: binding.transport }, operation: req.body.name, observedAt, source: `MCP ${binding.transport} tools/call`, result };
  } catch (error) { await registry.event(binding.id, `tools/call:${req.body.name}`, "error"); return reply.code(502).send({ error: "Falha na execução MCP.", detail: (error as Error).message, observedAt, source: `MCP ${binding.transport}` }); }
});
const staticRoot = fileURLToPath(new URL("../../dist/web/", import.meta.url));
if (existsSync(join(staticRoot, "index.html"))) {
  await app.register(fastifyStatic, { root: staticRoot });
  app.setNotFoundHandler((req, reply) => req.url.startsWith("/api/") ? reply.code(404).send({ error: "Rota não encontrada." }) : reply.sendFile("index.html"));
} else {
  app.get("/", async (_req, reply) => reply.type("text/plain").send("Execute npm run build para preparar a interface."));
}
const port = Number(process.env.PORT ?? 4317);
await app.listen({ host: "127.0.0.1", port });
console.log(`Tesseract 2.0 local em http://127.0.0.1:${port}`);
