import { AppError } from "../errors.js";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { scopeSchema, type RequestContext } from "../../shared/contracts.js";
import { hubOperation } from "../../shared/hubs.js";
import type { HubService } from "./service.js";
export function registerHubRoutes(
  app: FastifyInstance,
  hubs: HubService,
  context: (r: any) => RequestContext,
  session: (r: any) => any,
  identity: import("../auth/identity-provider.js").IdentityProvider,
  setCookie: (reply: any, id: string) => unknown,
) {
  const id = (r: any) => z.string().uuid().parse(r.params.id);
  app.post("/api/hubs/:id/login", async (r, reply) => {
    const h = await hubs.get(id(r)),
      old = session(r);
    if (old.principalKind === "application")
      throw new AppError(
        "invalid_request",
        "Selecione acesso de usuário para consentimento ADX.",
      );
    const result = await identity.begin(h.accessId, h.endpoint, old.id);
    old.controller.abort();
    old.userId = "";
    setCookie(reply, result.id);
    return { url: result.url };
  });
  app.get("/api/hubs", async (r) => {
    session(r);
    return hubs.list();
  });
  app.post("/api/hubs", async (r) => hubs.save(r.body));
  app.patch("/api/hubs/:id", async (r) =>
    hubs.save({ ...(r.body as any), id: id(r) }),
  );
  app.delete("/api/hubs/:id", async (r) => {
    await hubs.remove(id(r));
    return { ok: true };
  });
  app.post("/api/hubs/:id/query", async (r) => {
    const v = z
      .object({
        scope: scopeSchema,
        basis: z.enum(["ActualCost", "AmortizedCost"]),
        operation: hubOperation.default("costs"),
      })
      .strict()
      .parse(r.body);
    return hubs.run(context(r), id(r), v.scope, v.basis, v.operation);
  });
}
