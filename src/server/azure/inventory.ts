import type {
  RequestContext,
  Scope,
  Subscription,
} from "../../shared/contracts.js";
import { AppError } from "../errors.js";
import { ArmHttp } from "./http.js";
export class Inventory {
  constructor(private http: ArmHttp) {}
  async listSubscriptions(ctx: RequestContext): Promise<Subscription[]> {
    const r = await this.http.list(
      ctx,
      "/subscriptions?api-version=2022-12-01",
    );
    if (r.partial)
      throw new AppError("upstream", "Lista de subscriptions incompleta.", 502);
    return r.items
      .filter((s) => s.tenantId?.toLowerCase() === ctx.tenantId.toLowerCase())
      .map((s) => ({
        id: s.subscriptionId,
        name: s.displayName,
        tenantId: s.tenantId,
      }));
  }
  async listResourceGroups(ctx: RequestContext, subscriptionId: string) {
    await this.authorize(ctx, { tenantId: ctx.tenantId, subscriptionId });
    const r = await this.http.list(
      ctx,
      `/subscriptions/${encodeURIComponent(subscriptionId)}/resourcegroups?api-version=2021-04-01`,
    );
    if (r.partial)
      throw new AppError("upstream", "Lista de grupos incompleta.", 502);
    return r.items.map((s) => String(s.name));
  }
  async authorize(ctx: RequestContext, scope: Scope) {
    if (scope.tenantId.toLowerCase() !== ctx.tenantId.toLowerCase())
      throw new AppError("forbidden", "Tenant fora da sessão.", 403);
    const subs = await this.listSubscriptions(ctx);
    if (
      !subs.some(
        (s) => s.id.toLowerCase() === scope.subscriptionId.toLowerCase(),
      )
    )
      throw new AppError("forbidden", "Subscription fora da sessão.", 403);
  }
}
