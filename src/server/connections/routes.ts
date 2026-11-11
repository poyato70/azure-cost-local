import { RegistryDiscovery } from "../mcp/discovery.js";
import { fetchBound } from "../security/endpoint-policy.js";
import { sanitizeEvidence } from "../multicloud/sanitize.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { id } from "../../shared/connections.js";
import type { RequestContext } from "../../shared/contracts.js";
import type { Session } from "../auth/session-store.js";
import type { AccessService } from "./access-service.js";
import type { IdentityProvider } from "../auth/identity-provider.js";
import type { McpRegistry } from "../mcp/registry.js";
import { presets, capability, httpAudience } from "../mcp/presets.js";
import type { AgentService } from "../agents/service.js";
import { ModelProvider } from "../agents/model-provider.js";
import { HttpAgentClient } from "../agents/http-agent.js";
import type { SecretStore } from "../storage/secret-store.js";
import { AppError } from "../errors.js";
export function registerConnectionRoutes(
  app: FastifyInstance,
  d: {
    accesses: AccessService;
    identity: IdentityProvider;
    mcps: McpRegistry;
    agents: AgentService;
    vault: SecretStore;
    session: (r: any) => Session;
    context: (r: any) => RequestContext;
    mcpContext?: (r: any) => RequestContext;
    setCookie: (reply: any, id: string) => void;
  },
) {
  const registryDiscovery = new RegistryDiscovery();
  app.post("/api/mcp-registry/search", async (r) =>
    registryDiscovery.search(r.body, (d.mcpContext || d.context)(r).signal),
  );
  app.post("/api/mcp-discovery", async (r) => {
    d.session(r);
    const input = z
      .object({
        url: z
          .string()
          .url()
          .max(2048)
          .refine((v) => new URL(v).protocol === "https:"),
        trusted: z.literal(true),
      })
      .strict()
      .parse(r.body);
    const response = await fetchBound(input.url, {
      signal: AbortSignal.any([
        (r as any).operationSignal,
        AbortSignal.timeout(15000),
      ]),
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new AppError(
        "upstream",
        `A fonte respondeu HTTP ${response.status}.`,
        502,
      );
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new AppError(
        "invalid_request",
        "Esta URL não retornou um manifesto JSON válido. Use a página apenas como referência.",
      );
    }
    const manifest = z
      .object({
        servers: z
          .array(
            z
              .object({
                name: z.string().min(1).max(200),
                url: z
                  .string()
                  .url()
                  .max(2048)
                  .refine(
                    (v) =>
                      new URL(v).protocol === "https:" &&
                      !new URL(v).username &&
                      !new URL(v).password,
                  ),
                description: z.string().max(2000).optional(),
              })
              .strict(),
          )
          .max(50),
      })
      .strict()
      .parse(raw);
    return sanitizeEvidence({ source: input.url, ...manifest });
  });
  const getId = (r: any) => z.object({ id }).parse(r.params).id;
  app.get("/api/accesses", async (r) => {
    d.session(r);
    return d.accesses.list();
  });
  app.post("/api/accesses", async (r) => d.accesses.save(r.body));
  app.patch("/api/accesses/:id", async (r) =>
    d.accesses.save({ ...(r.body as any), id: getId(r) }),
  );
  app.delete("/api/accesses/:id", async (r) => {
    await d.accesses.remove(getId(r));
    d.identity.applications.clear();
    return { ok: true };
  });
  app.post("/api/accesses/:id/connect", async (r, reply) => {
    const accessId = getId(r),
      mode = z
        .object({ mode: z.enum(["user", "application"]) })
        .parse(r.body).mode,
      s = d.session(r);
    if (mode === "user") {
      const result = await d.identity.begin(accessId, undefined, s.id);
      s.controller.abort();
      s.userId = "";
      d.setCookie(reply, result.id);
      return { url: result.url };
    }
    s.controller.abort();
    s.controller = new AbortController();
    s.userId = "";
    await d.identity.connectApplication(s.id, accessId);
    const access = await d.accesses.get(accessId),
      info = await d.identity.applications.details(
        accessId,
        "https://management.azure.com",
      );
    d.context(r).diagnose?.({
      source: "Identidade de aplicação",
      operation: "conectar",
      status: "sucesso",
      detail:
        "Token ARM obtido. Autenticação concluída; permissões de custo serão verificadas na consulta.",
    });
    return {
      connected: true,
      accessName: access.name,
      clientId: access.clientId,
      tenantId: access.tenantId,
      expiresAt: new Date(info.expires).toISOString(),
    };
  });
  app.post("/api/accesses/:id/test", async (r) => {
    const a = await d.accesses.get(getId(r));
    if (!a.secretRef)
      throw new AppError(
        "auth_configuration",
        "O teste sem popup requer Secret Value; use Conectar para login de usuário.",
      );
    const started = Date.now(),
      info = await d.identity.applications.details(
        a.id,
        "https://management.azure.com",
      );
    return {
      authenticated: true,
      message:
        `Secret válido para "${a.name}": token ARM ${info.cached ? "reutilizado do cache" : "obtido no Entra ID"} em ${Date.now() - started} ms, ` +
        `client ${a.clientId}, expira em ${new Date(info.expires).toLocaleString("pt-BR")}. ` +
        "Permissões de dados serão verificadas na consulta.",
    };
  });
  app.get("/api/mcp-presets", async (r) => {
    d.session(r);
    return presets.map((p) => ({
      ...p,
      modes: ["stdio", "http"].flatMap((transport) =>
        ["delegated", "application", "none", "bearer"].map((authMode) =>
          capability({ preset: p.id, transport, authMode } as any),
        ),
      ),
    }));
  });
  app.post("/api/mcp-connections/:id/login", async (r, reply) => {
    const p = await d.mcps.get(getId(r));
    if (p.transport !== "http" || p.authMode !== "delegated" || !p.accessId)
      throw new AppError(
        "unsupported",
        "Esta conexão não usa login delegado HTTP.",
      );
    const preset = presets.find((x) => x.id === p.preset)!;
    const old = d.session(r);
    const result = await d.identity.begin(p.accessId, httpAudience(p), old.id);
    old.controller.abort();
    old.userId = "";
    d.setCookie(reply, result.id);
    return { url: result.url };
  });
  app.get("/api/mcp-connections", async (r) => {
    return d.mcps.list(d.session(r).id);
  });
  app.post("/api/mcp-connections", async (r) => d.mcps.save(r.body));
  app.patch("/api/mcp-connections/:id", async (r) =>
    d.mcps.save({ ...(r.body as any), id: getId(r) }),
  );
  app.delete("/api/mcp-connections/:id", async (r) => {
    await d.mcps.remove(getId(r));
    return { ok: true };
  });
  for (const op of ["test", "connect"])
    app.post("/api/mcp-connections/:id/" + op, async (r) => ({
      connected: true,
      tools: await d.mcps.tools((d.mcpContext || d.context)(r), getId(r)),
      message:
        "Servidor respondeu ao protocolo MCP e listou tools. Essa etapa não comprova acesso aos dados do provedor. Salve as tools permitidas, preencha os parâmetros de uma tool e execute para testar essa operação.",
    }));
  app.post("/api/mcp-connections/:id/disconnect", async (r) => {
    await d.mcps.disconnect(getId(r));
    return { ok: true };
  });
  app.get("/api/mcp-connections/:id/tools", async (r) =>
    d.mcps.tools((d.mcpContext || d.context)(r), getId(r)),
  );
  app.post("/api/mcp-connections/:id/catalog", async (r) =>
    d.mcps.catalog((d.mcpContext || d.context)(r), getId(r)),
  );
  app.post("/api/mcp-connections/:id/inspect", async (r) =>
    d.mcps.inspect(
      (d.mcpContext || d.context)(r),
      getId(r),
      z
        .object({
          kind: z.enum(["prompt", "resource"]),
          name: z.string().min(1).max(2048),
          arguments: z.record(z.string(), z.string()).optional(),
        })
        .strict()
        .parse(r.body),
    ),
  );
  app.get("/api/mcp-connections/:id/capabilities", async (r) => {
    d.session(r);
    return capability(await d.mcps.get(getId(r)));
  });
  app.post("/api/mcp-connections/:id/approve-tools", async (r) =>
    d.mcps.approve(
      (d.mcpContext || d.context)(r),
      getId(r),
      z.object({ names: z.array(z.string()).max(100) }).parse(r.body).names,
    ),
  );
  app.post("/api/mcp-connections/:id/call", async (r) => {
    const v = z
      .object({
        name: z.string().max(200),
        arguments: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(r.body);
    return d.mcps.call(
      (d.mcpContext || d.context)(r),
      getId(r),
      v.name,
      v.arguments,
    );
  });
  app.get("/api/agents", async (r) => {
    d.session(r);
    return d.agents.list();
  });
  app.post("/api/agents", async (r) => d.agents.save(r.body));
  app.patch("/api/agents/:id", async (r) =>
    d.agents.save({ ...(r.body as any), id: getId(r) }),
  );
  app.delete("/api/agents/:id", async (r) => {
    await d.agents.remove(getId(r));
    return { ok: true };
  });
  app.post("/api/agents/:id/duplicate", async (r) =>
    d.agents.duplicate(getId(r)),
  );
  app.post("/api/agents/:id/test-model", async (r) => {
    z.object({ consent: z.literal(true) }).parse(r.body);
    const agent = await d.agents.get(getId(r)),
      ctx =
        agent.modelCredential.kind === "apiKey"
          ? (d.mcpContext || d.context)(r)
          : d.context(r);
    if (agent.provider === "http-agent-v1") {
      const h = await new HttpAgentClient(agent, d.vault).health(
        AbortSignal.any([ctx.signal, AbortSignal.timeout(30000)]),
      );
      return {
        connected: true,
        message: `O agente HTTP respondeu ao health check (${typeof h === "string" ? sanitizeEvidence(h) : JSON.stringify(sanitizeEvidence(h))}). Sem consumo de modelo.`,
      };
    }
    const model = new ModelProvider(agent, d.vault, d.identity, ctx);
    const result = await model.complete(
      {
        messages: [
          {
            role: "user",
            content:
              "Responda apenas OK. Teste de conexão, sem dados financeiros.",
          },
        ],
        tools: [],
      },
      AbortSignal.any([ctx.signal, AbortSignal.timeout(30000)]),
    );
    return {
      connected: true,
      message:
        "O endpoint de inferência respondeu. Tool calling e acesso a dados serão validados na consulta.",
    };
  });
}
