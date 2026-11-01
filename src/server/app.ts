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
export type AppDeps = { config?: Config; store?: SessionStore; http?: ArmHttp };
export async function buildApp(deps: AppDeps = {}) {
  const config = deps.config || readConfig(),
    store = deps.store || new SessionStore(),
    identity = new MicrosoftIdentity(store, config);
  const http = deps.http || new ArmHttp((ctx) => identity.getArmToken(ctx)),
    inventory = new Inventory(http),
    costs = new AzureCosts(http),
    budgets = new Budgets(http),
    benefits = new Benefits(http);
  const app = Fastify({ logger: false, bodyLimit: 32000 });
  await app.register(cookie);
  const chat = new CopilotChat({ inventory, costs, budgets, benefits });
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
  const context = (request: any): RequestContext => {
    const s = session(request);
    if (!s.userId)
      throw new AppError("unauthenticated", "Entre com Microsoft.", 401);
    return {
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
  app.addHook("onResponse", async (req) => {
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
      authenticated: !!s.userId,
      tenantId: config.tenantId,
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
      const id = await identity.finish(req.cookies.sid || "", q.state, q.code);
      setCookie(reply, id);
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
      current.loginError = { code: safe.code, message: safe.message };
      return reply.redirect("/auth/complete");
    }
  });
  app.post("/api/auth/logout", async (req, reply) => {
    const s = session(req);
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
    const query = costQuerySchema.parse(req.body),
      ctx = context(req);
    await inventory.authorize(ctx, query.scope);
    const current = await costs.queryCosts(ctx, query);
    return current;
  });
  app.post("/api/costs/compare", async (req) => {
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
    const scope = scopeSchema.parse(req.body),
      ctx = context(req);
    await inventory.authorize(ctx, scope);
    return budgets.getBudgets(ctx, scope);
  });
  app.post("/api/benefits/query", async (req) => {
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
    const ctx = context(req);
    const input = z
      .object({
        message: z.string().min(1).max(4000),
        scope: scopeSchema.optional(),
        basis: z.enum(["ActualCost", "AmortizedCost"]),
        consent: z.literal(true),
      })
      .strict()
      .parse(req.body);
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
    const emit = (event: unknown) => {
      if (!controller.signal.aborted && !reply.raw.destroyed)
        reply.raw.write(JSON.stringify(event) + "\n");
    };
    try {
      await chat.ask(
        { ...ctx, signal: AbortSignal.any([ctx.signal, controller.signal]) },
        input,
        emit,
      );
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
    await chat.close();
  });
  return Object.assign(app, {
    services: { store, config, inventory, costs, budgets, benefits, context },
  });
}
