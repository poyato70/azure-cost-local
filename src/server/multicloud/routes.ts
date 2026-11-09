import type { FastifyInstance } from "fastify";
import { cloudQuerySchema } from "../../shared/multicloud.js";
import { queryCloud } from "./service.js";
export function registerMulticloudRoutes(
  app: FastifyInstance,
  session: (r: any) => { controller: AbortController },
  readSecret: (ref: string) => Promise<string>,
) {
  app.post("/api/multicloud/query", async (req) => {
    const s = session(req);
    const signal = AbortSignal.any(
      [
        s.controller.signal,
        (req as any).operationSignal,
        AbortSignal.timeout(120000),
      ].filter(Boolean),
    );
    return queryCloud(cloudQuerySchema.parse(req.body), signal, readSecret);
  });
}
