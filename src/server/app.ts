import { ForecastService } from "./forecast/service.js";
import { registerMulticloudRoutes } from "./multicloud/routes.js";
import { forecastQuery } from "../shared/forecast.js";
import { Diagnostics } from "./diagnostics/service.js";
import { HubService } from "./hubs/service.js";
import { registerHubRoutes } from "./hubs/routes.js";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { readConfig, type Config } from "./config.js";
import { SessionStore, type Session } from "./auth/session-store.js";
import { MicrosoftIdentity } from "./auth/msal-provider.js";
import { authError } from "./auth/auth-errors.js";
import { ArmHttp } from "./azure/http.js";
import { Inventory } from "./azure/inventory.js";
import { AzureCosts, compareCosts } from "./costs/service.js";
import { previousPeriod, lastCompleteMonths } from "./costs/periods.js";
import { Budgets } from "./budgets/service.js";
import { Benefits } from "./benefits/service.js";
import {
  scopeSchema,
  costQuerySchema,
  type RequestContext,
} from "../shared/contracts.js";
import { AppError } from "./errors.js";
import { CopilotChat } from "./chat/copilot.js";
import { ConfigStore } from "./storage/config-store.js";
import { SecretStore } from "./storage/secret-store.js";
import { AccessService } from "./connections/access-service.js";
import { Invalidation } from "./connections/invalidation.js";
import { ApplicationProvider } from "./auth/application-provider.js";
import { IdentityProvider } from "./auth/identity-provider.js";
import { McpRegistry } from "./mcp/registry.js";
import { AgentService } from "./agents/service.js";
import { LocalAgentRuntime } from "./agents/runtime.js";
import { KnowledgeService } from "./knowledge/service.js";
import { registerConnectionRoutes } from "./connections/routes.js";
import { selectionSchema } from "../shared/connections.js";
import { assertApiSelection } from "./connections/data-provider.js";
export type AppDeps = {
  config?: Config;
  store?: SessionStore;
  http?: ArmHttp;
  configStore?: ConfigStore;
};
export async function buildApp(deps: AppDeps = {}) {
  const config = deps.config || readConfig(),
    store = deps.store || new SessionStore(),
    identity = new MicrosoftIdentity(store, config);
  const saved = deps.configStore || new ConfigStore(),
    vault = new SecretStore(saved.root),
    gate = new Invalidation(saved),
    accesses = new AccessService(saved, vault, gate),
    identities = new IdentityProvider(
      new ApplicationProvider(accesses, vault),
      accesses,
      gate,
      store,
      config,
      identity,
    ),
    mcps = new McpRegistry(saved, vault, accesses, gate, identities),
    agents = new AgentService(saved, vault, gate);
  const http = deps.http || new ArmHttp((ctx) => identities.getToken(ctx)),
    inventory = new Inventory(http),
    costs = new AzureCosts(http),
    budgets = new Budgets(http),
    benefits = new Benefits(http),
    forecast = new ForecastService(http);
  const diagnostics = new Diagnostics();
  const app = Fastify({ logger: false, bodyLimit: 32000 });
  await app.register(cookie);
  const hubs = new HubService(saved, gate, identities, mcps, {
    inventory,
    costs,
    budgets,
    benefits,
  });
  const chat = new CopilotChat(
    { inventory, costs, budgets, benefits, forecast },
    mcps,
    hubs,
  );
  const knowledge = new KnowledgeService(saved);
  const localAgents = new LocalAgentRuntime(
    { inventory, costs, budgets, benefits, forecast },
    vault,
    identities,
    gate,
    mcps,
    hubs,
    knowledge,
  );
  const session = (request: any): Session => {
    const s = store.get(request.cookies.sid);
    if (!s)
      throw new AppError(
        "unauthenticated",
        "Entre com Microsoft para consultar seus dados.",
        401,
      );
    return s;
  };
  const context = (request: any, local = false): RequestContext => {
    const s = session(request);
    if (!s.userId && !local)
      throw new AppError("unauthenticated", "Entre com Microsoft.", 401);
    return {
      requestId: String(request.id),
      diagnose: (event) =>
        diagnostics.record(s.id, { ...event, requestId: String(request.id) }),
      principalKind: s.principalKind || "user",
      accessId: s.accessId,
      configurationVersion: s.accessVersion,
      sessionId: s.id,
      userId: s.userId,
      tenantId: s.tenantId,
      signal: AbortSignal.any(
        [s.controller.signal, (request as any).operationSignal].filter(Boolean),
      ),
    };
  };
  const setCookie = (reply: any, id: string) =>
    reply.setCookie("sid", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 3600,
    });
  registerHubRoutes(app, hubs, context, session, identities, setCookie);
  app.addHook("onRequest", async (req, reply) => {
    const controller = new AbortController();
    (req as any).operationSignal = controller.signal;
    const onClose = () => {
      if (!reply.raw.writableEnded) controller.abort();
    };
    const onAbort = () => controller.abort();
    req.raw.once("aborted", onAbort);
    reply.raw.once("close", onClose);
    (req as any).operationCleanup = () => {
      req.raw.off("aborted", onAbort);
      reply.raw.off("close", onClose);
    };
    const host = req.headers.host;
    const allowed = [`localhost:${config.port}`, `127.0.0.1:${config.port}`];
    if (!host || !allowed.includes(host))
      throw new AppError("forbidden", "Host recusado.", 403);
    if (req.headers.origin && req.headers.origin !== config.origin)
      throw new AppError("forbidden", "Origem recusada.", 403);
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const s = session(req),
        csrf = req.headers["x-csrf-token"];
      if (
        typeof csrf !== "string" ||
        csrf.length !== s.csrf.length ||
        !timingSafeEqual(Buffer.from(csrf), Buffer.from(s.csrf))
      )
        throw new AppError(
          "forbidden",
          "Sessão de formulário inválida. Recarregue a página.",
          403,
        );
    }
  });
  app.addHook("onResponse", async (req, reply) => {
    const path = req.url.split("?")[0];
    const sid = store.get((req.cookies as any).sid)?.id;
    if (
      sid &&
      path.startsWith("/api/") &&
      !["/api/bootstrap", "/api/health", "/api/diagnostics"].includes(path)
    )
      diagnostics.record(sid, {
        requestId: String(req.id),
        source: "Aplicação local",
        operation: req.method + " " + path,
        status: String(reply.statusCode),
        detail:
          (req as any).diagnosticError ||
          (path === "/api/chat"
            ? "Fluxo de chat aberto; este HTTP não comprova sucesso de consulta. Confira eventos de tools e erros da mesma operação."
            : "Rota local concluída; status refere-se a esta operação."),
      });
    (req as any).operationCleanup?.();
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
    return payload;
  });
  app.setErrorHandler((error, req, reply) => {
    (req as any).diagnosticError =
      error instanceof AppError
        ? error.code + ": " + error.message
        : "Parâmetros inválidos ou falha interna; dados brutos omitidos.";
    if (error instanceof z.ZodError)
      return reply.status(400).send({
        code: "invalid_request",
        message: "Parâmetros inválidos. Confira escopo e datas.",
      });
    const e =
      error instanceof AppError
        ? error
        : new AppError(
            "upstream",
            "Não foi possível concluir a operação. Tente novamente.",
            500,
          );
    return reply.status(e.status).send({ code: e.code, message: e.message });
  });
  registerConnectionRoutes(app, {
    accesses,
    identity: identities,
    mcps,
    agents,
    vault,
    session,
    context,
    mcpContext: (r: any) => context(r, true),
    setCookie,
  });
  app.get("/api/knowledge", async (req) => {
    session(req);
    return knowledge.list(
      z
        .string()
        .max(200)
        .parse((req.query as any).q || ""),
    );
  });
  app.post("/api/knowledge", async (req) =>
    knowledge.import(req.body, context(req, true).signal),
  );
  app.delete("/api/knowledge/:id", async (req) => {
    await knowledge.remove(
      z
        .string()
        .uuid()
        .parse((req.params as any).id),
    );
    return { ok: true };
  });
  app.get("/api/diagnostics", async (req) => diagnostics.list(session(req).id));
  registerMulticloudRoutes(app, session, (ref) => vault.read(ref));
  app.delete("/api/diagnostics", async (req) => {
    diagnostics.clear(session(req).id);
    return { ok: true };
  });
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/bootstrap", async (req, reply) => {
    let s = store.get(req.cookies.sid);
    if (!s) {
      const id = store.create("", config.tenantId);
      s = store.get(id)!;
      setCookie(reply, id);
    }
    return {
      csrf: s.csrf,
      activeAccessId: s.accessId,
      principalKind: s.principalKind,
      authenticated: !!s.userId,
      tenantId: s.userId ? s.tenantId : config.tenantId,
      clientId: config.clientId,
      configured: !!config.tenantId && !!config.clientId,
      loginError: s.loginError,
      period: lastCompleteMonths(new Date(), 2),
    };
  });
  app.post("/api/config", async (req) => {
    const s = session(req);
    if (s.userId)
      throw new AppError(
        "invalid_request",
        "Saia antes de mudar a configuração.",
      );
    const c = z
      .object({ tenantId: z.string().uuid(), clientId: z.string().uuid() })
      .strict()
      .parse(req.body);
    config.tenantId = c.tenantId;
    config.clientId = c.clientId;
    return { ok: true };
  });
  app.post("/api/auth/login", async (req, reply) => {
    const old = session(req);
    const result = await identity.begin();
    store.remove(old.id);
    setCookie(reply, result.id);
    return { url: result.url };
  });
  app.get("/api/auth/callback", async (req, reply) => {
    try {
      const upstream = z
        .object({
          error: z.string().optional(),
          error_description: z.string().optional(),
        })
        .parse(req.query);
      if (upstream.error)
        throw authError({
          errorCode: upstream.error,
          errorMessage: upstream.error_description,
        });
      const q = z
        .object({ state: z.string(), code: z.string() })
        .parse(req.query);
      const id = await identities.finish(
        req.cookies.sid || "",
        q.state,
        q.code,
      );
      setCookie(reply, id);
      diagnostics.record(id, {
        source: "Login Microsoft",
        operation: "callback",
        status: "sucesso",
        detail: "Login concluído. Tokens e URL OAuth omitidos.",
      });
      return reply.redirect("/auth/complete");
    } catch (error) {
      const safe =
        error instanceof z.ZodError
          ? new AppError(
              "invalid_request",
              "Retorno de login incompleto. Inicie um novo login pelo dashboard.",
            )
          : authError(error);
      let current = store.get(req.cookies.sid);
      if (!current) {
        const id = store.create("", config.tenantId);
        current = store.get(id)!;
        setCookie(reply, id);
      }
      diagnostics.record(current.id, {
        source: "Login Microsoft",
        operation: "callback",
        status: safe.code,
        detail: safe.message,
      });
      current.loginError = { code: safe.code, message: safe.message };
      return reply.redirect("/auth/complete");
    }
  });
  app.post("/api/auth/logout", async (req, reply) => {
    const s = session(req);
    await mcps.closeSession(s.id);
    identities.applications.clear();
    costs.clear(s.id);
    store.remove(s.id);
    reply.clearCookie("sid", { path: "/" });
    return { ok: true };
  });
  app.get("/api/auth/session", async (req) => {
    const s = session(req);
    return { authenticated: !!s.userId, tenantId: s.tenantId };
  });
  app.get("/api/subscriptions", async (req) =>
    inventory.listSubscriptions(context(req)),
  );
  app.get("/api/resource-groups", async (req) => {
    const q = z.object({ subscriptionId: z.string().uuid() }).parse(req.query);
    return inventory.listResourceGroups(context(req), q.subscriptionId);
  });
  app.post("/api/costs/query", async (req) => {
    if (req.headers["x-data-source"] === "mcp")
      assertApiSelection({
        accessId: context(req).accessId || "",
        source: "mcp",
        mcpConnectionId: String(req.headers["x-mcp-connection"] || ""),
      });
    const query = costQuerySchema.parse(req.body),
      ctx = context(req);
    await inventory.authorize(ctx, query.scope);
    const current = await costs.queryCosts(ctx, query);
    return current;
  });
  app.post("/api/costs/compare", async (req) => {
    if (req.headers["x-data-source"] === "mcp")
      assertApiSelection({
        accessId: context(req).accessId || "",
        source: "mcp",
        mcpConnectionId: String(req.headers["x-mcp-connection"] || ""),
      });
    const query = costQuerySchema.parse(req.body),
      ctx = context(req);
    await inventory.authorize(ctx, query.scope);
    const current = await costs.queryCosts(ctx, query),
      previous = await costs.queryCosts(ctx, {
        ...query,
        period: previousPeriod(query.period),
      });
    return {
      current,
      previous,
      comparison: compareCosts(current, previous),
      warnings:
        current.meta.status !== "complete" ||
        previous.meta.status !== "complete"
          ? [
              "Comparação indisponível: pelo menos um dos períodos está incompleto.",
            ]
          : [],
    };
  });
  app.post("/api/budgets/query", async (req) => {
    if (req.headers["x-data-source"] === "mcp")
      assertApiSelection({
        accessId: context(req).accessId || "",
        source: "mcp",
        mcpConnectionId: String(req.headers["x-mcp-connection"] || ""),
      });
    const scope = scopeSchema.parse(req.body),
      ctx = context(req);
    await inventory.authorize(ctx, scope);
    return budgets.getBudgets(ctx, scope);
  });
  app.post("/api/budgets/locks", async (req) => {
    assertApiSelection({
      accessId: context(req).accessId || "",
      source: req.headers["x-data-source"] === "mcp" ? "mcp" : "api",
    });
    const body = z
        .object({ scope: scopeSchema, showAll: z.boolean().default(false) })
        .strict()
        .parse(req.body),
      ctx = context(req);
    await inventory.authorize(ctx, body.scope);
    return budgets.getLocks(ctx, body.scope, body.showAll);
  });
  app.post("/api/forecast/query", async (req) => {
    const ctx = context(req);
    assertApiSelection({
      accessId: ctx.accessId || "",
      source: req.headers["x-data-source"] === "mcp" ? "mcp" : "api",
    });
    const q = forecastQuery.parse(req.body);
    await inventory.authorize(ctx, q.scope);
    return forecast.query(ctx, q);
  });
  app.post("/api/benefits/query", async (req) => {
    if (req.headers["x-data-source"] === "mcp")
      assertApiSelection({
        accessId: context(req).accessId || "",
        source: "mcp",
        mcpConnectionId: String(req.headers["x-mcp-connection"] || ""),
      });
    const b = z
        .object({
          scope: scopeSchema,
          kind: z.enum(["reservation", "savingsPlan"]),
        })
        .parse(req.body),
      ctx = context(req);
    await inventory.authorize(ctx, b.scope);
    return benefits.analyzeBenefits(ctx, b.scope, b.kind);
  });
  app.get("/api/chat/status", async (req) => {
    context(req);
    return chat.status();
  });
  app.post("/api/chat", async (req, reply) => {
    const input = z
      .object({
        runtime: z.enum(["copilot", "agent"]).default("copilot"),
        agentId: z.string().uuid().optional(),
        selection: selectionSchema.optional(),
        message: z.string().min(1).max(4000),
        scope: scopeSchema.optional(),
        basis: z.enum(["ActualCost", "AmortizedCost"]),
        consent: z.literal(true),
      })
      .strict()
      .parse(req.body);
    const independent =
      input.runtime === "agent" &&
      input.selection?.source === "mcp" &&
      !input.selection.hubId &&
      !!input.selection.mcpConnectionId &&
      ["custom", "kubernetes"].includes(
        (await mcps.get(input.selection.mcpConnectionId)).preset,
      );
    const ctx = context(req, independent);
    if (independent && input.scope)
      throw new AppError(
        "invalid_request",
        "Investigações de MCP independente não recebem filtros Azure.",
      );
    if (
      req.headers["x-data-source"] === "mcp" &&
      input.selection?.source !== "mcp"
    )
      throw new AppError(
        "invalid_request",
        "A fonte MCP exige uma conexão e um acesso salvo ativos. Reconecte o acesso; nenhuma consulta API foi executada.",
      );
    if (
      !independent &&
      input.selection &&
      input.selection.accessId !== ctx.accessId
    )
      throw new AppError(
        "forbidden",
        "O acesso selecionado difere da sessão ativa. Reconecte o acesso.",
        403,
      );
    if (input.scope) await inventory.authorize(ctx, input.scope);
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const controller = new AbortController();
    const disconnect = () => controller.abort();
    reply.raw.on("close", disconnect);
    const emit = (event: any) => {
      if (event?.type === "error")
        ctx.diagnose?.({
          source: "Chat",
          operation: "resposta",
          status: event.code,
          detail: event.message,
        });
      if (!controller.signal.aborted && !reply.raw.destroyed)
        reply.raw.write(JSON.stringify(event) + "\n");
    };
    const streamCtx = {
      ...ctx,
      signal: AbortSignal.any([ctx.signal, controller.signal]),
      diagnose: (
        event: Parameters<NonNullable<RequestContext["diagnose"]>>[0],
      ) => {
        ctx.diagnose?.(event);
        if (event.status === "aguardando")
          emit({ type: "progress", message: event.detail });
      },
    };
    emit({
      type: "progress",
      message: "Preparando provedor e verificando ferramentas autorizadas…",
    });
    try {
      if (input.runtime === "agent") {
        if (!input.agentId || !input.selection)
          throw new AppError(
            "invalid_request",
            "Selecione um agente e acesso.",
          );
        await localAgents.ask(
          streamCtx,
          await agents.get(input.agentId),
          { ...input, selection: input.selection },
          emit,
        );
      } else await chat.ask(streamCtx, input, emit);
    } catch (e) {
      emit({
        type: "error",
        code: e instanceof AppError ? e.code : "upstream",
        message:
          e instanceof AppError
            ? e.message
            : "Chat indisponível. Verifique o Copilot CLI e tente novamente.",
      });
    } finally {
      reply.raw.off("close", disconnect);
      reply.raw.end();
    }
  });
  app.addHook("onClose", async () => {
    store.clear();
    await mcps.close();
    await chat.close();
  });
  return Object.assign(app, {
    services: { store, config, inventory, costs, budgets, benefits, context },
  });
}
