import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";
import {
  hubInput,
  type HubProfile,
  type HubOperation,
} from "../../shared/hubs.js";
import {
  scopeSchema,
  type Scope,
  type RequestContext,
  type CostResult,
} from "../../shared/contracts.js";
import type { ConfigStore } from "../storage/config-store.js";
import type { Invalidation } from "../connections/invalidation.js";
import type { IdentityProvider } from "../auth/identity-provider.js";
import type { McpRegistry } from "../mcp/registry.js";
import { fetchBound, validateEndpoint } from "../security/endpoint-policy.js";
import { AppError, assertActive } from "../errors.js";
import { lastCompleteMonths } from "../costs/periods.js";
import { buildHubQuery, type QueryOperation } from "./queries.js";
import { kustoRows, mcpHubRows, amount } from "./results.js";
import { reconcile } from "./reconcile.js";
import type { QueryServices } from "../chat/tools.js";
export class HubService {
  constructor(
    private store: ConfigStore,
    private gate: Invalidation,
    private identity: IdentityProvider,
    private mcps: McpRegistry,
    private services: QueryServices,
  ) {}
  async watch(id: string, controller: AbortController) {
    const h = await this.get(id);
    const v = await this.gate.capture([
      "hub:" + id,
      "access:" + h.accessId,
      ...(h.transport === "mcp" ? ["mcp:" + h.mcpConnectionId] : []),
    ]);
    v["hub:" + id] = h.configurationVersion;
    const stop = this.gate.watch(v, controller);
    try {
      await this.gate.assertCurrent(v);
      return stop;
    } catch (e) {
      stop();
      throw e;
    }
  }
  async list() {
    return (await this.store.read()).hubProfiles || [];
  }
  async get(id: string) {
    const h = (await this.list()).find((h) => h.id === id);
    if (!h) throw new AppError("invalid_request", "Hub não encontrado.", 404);
    return h;
  }
  async save(raw: unknown) {
    const v = hubInput.parse(raw),
      url = await validateEndpoint(v.endpoint, v.allowPrivateNetwork);
    if (
      !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.kusto\.windows\.net\/?$/.test(
        v.endpoint,
      ) ||
      url.url.port
    )
      throw new AppError(
        "invalid_endpoint",
        "Use a raiz HTTPS de um cluster ADX público.",
      );
    let h!: HubProfile;
    await this.store.mutate((s) => {
      if (!s.accessProfiles.some((a) => a.id === v.accessId))
        throw new AppError("invalid_request", "Acesso não encontrado.");
      if (
        v.transport === "mcp" &&
        !s.mcpProfiles.some(
          (m) =>
            m.id === v.mcpConnectionId &&
            m.accessId === v.accessId &&
            m.preset === "adx",
        )
      )
        throw new AppError(
          "invalid_request",
          "Vincule MCP ADX do mesmo acesso.",
        );
      const old = (s.hubProfiles || []).find((h) => h.id === v.id);
      if (v.id && !old)
        throw new AppError("invalid_request", "Hub não encontrado.", 404);
      if (old && old.configurationVersion !== v.expectedVersion)
        throw new AppError("configuration_changed", "Recarregue o Hub.", 409);
      const { expectedVersion, ...fields } = v;
      h = {
        ...fields,
        endpoint: url.url.origin,
        id: old?.id || randomUUID(),
        configurationVersion: (old?.configurationVersion || 0) + 1,
      };
      s.hubProfiles = [
        ...(s.hubProfiles || []).filter((x) => x.id !== h.id),
        h,
      ];
    });
    this.gate.changed("hub:" + h.id);
    return h;
  }
  async remove(id: string) {
    await this.store.mutate((s) => {
      s.hubProfiles = (s.hubProfiles || []).filter((h) => h.id !== id);
    });
    this.gate.changed("hub:" + id);
  }
  async run(
    ctx: RequestContext,
    id: string,
    raw: Scope,
    basis: CostResult["basis"],
    operation: HubOperation = "costs",
    now = new Date(),
  ): Promise<any> {
    const scope = scopeSchema.parse(raw);
    if (!scope.resourceGroup || scope.tenantId !== ctx.tenantId)
      throw new AppError("forbidden", "Selecione um RG do tenant ativo.", 403);
    const h = await this.get(id);
    if (ctx.accessId !== h.accessId)
      throw new AppError(
        "forbidden",
        "Conecte o acesso vinculado ao Hub.",
        403,
      );
    const revisions = await this.gate.capture([
        "hub:" + id,
        "access:" + h.accessId,
        ...(h.transport === "mcp" ? ["mcp:" + h.mcpConnectionId] : []),
      ]),
      controller = new AbortController(),
      unwatch = this.gate.watch(revisions, controller);
    revisions["hub:" + id] = h.configurationVersion;
    const context = {
      ...ctx,
      signal: AbortSignal.any([
        ctx.signal,
        controller.signal,
        AbortSignal.timeout(60000),
      ]),
    };
    try {
      await this.gate.assertCurrent(revisions);
      assertActive(controller.signal);
      await this.services.inventory.authorize(context, scope);
      const period = lastCompleteMonths(now, 2);
      if (operation === "reconcile") {
        const [hr, ar] = await Promise.allSettled([
          this.run(context, id, scope, basis, "costs", now),
          this.services.costs.queryCosts(context, {
            scope,
            basis,
            period,
            groupBy: "ServiceName",
            granularity: "Monthly",
          }),
        ]);
        await this.gate.assertCurrent(revisions);
        assertActive(controller.signal);
        assertActive(context.signal);
        const hub = hr.status === "fulfilled" ? hr.value : undefined,
          arm = ar.status === "fulfilled" ? ar.value : undefined;
        if (hub && arm) return { hub, arm, comparison: reconcile(hub, arm) };
        if (!hub && !arm)
          throw new AppError(
            "hub_reconcile_unavailable",
            "As duas fontes estão indisponíveis. Verifique acesso, dados e schema.",
            502,
          );
        return {
          hub,
          arm,
          comparison: {
            status: "partial",
            message: hub
              ? "Cost Management não respondeu; resultado Hub preservado."
              : "Hub não respondeu; resultado Cost Management preservado.",
            code: "source_unavailable",
          },
        };
      }
      const execute = async (op: QueryOperation) => {
        const query = buildHubQuery(op, scope, period);
        let data: any;
        if (h.transport === "api") {
          const token = await this.identity.getToken(context, h.endpoint);
          const response = await fetchBound(
            h.endpoint + "/v1/rest/query",
            {
              method: "POST",
              signal: context.signal,
              headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                db: h.database,
                csl: query,
                properties: JSON.stringify({
                  Options: {
                    servertimeout: "00:00:45",
                    truncationmaxrecords: 10000,
                    truncationmaxsize: 1048576,
                  },
                }),
              }),
            },
            h.allowPrivateNetwork,
          );
          if (!response.ok) {
            await response.body?.cancel();
            throw new AppError(
              response.status === 403 ? "forbidden" : "hub_unavailable",
              "Consulta Hub indisponível (HTTP " +
                response.status +
                "). Verifique acesso, schema e dataset.",
              response.status === 403 ? 403 : 502,
            );
          }
          data = await response.json();
        } else {
          const m = await this.mcps.get(h.mcpConnectionId!);
          if (
            m.accessId !== h.accessId ||
            m.preset !== "adx" ||
            m.resourceContext.clusterUri !== h.endpoint ||
            m.resourceContext.database !== h.database
          )
            throw new AppError(
              "forbidden",
              "Contexto MCP difere do Hub cadastrado.",
              403,
            );
          const tools = await this.mcps.tools(context, m.id),
            t = tools.find(
              (t) =>
                t.approved &&
                /^(azmcp_)?kusto_query(?:_execute)?$/.test(t.name),
            );
          if (!t)
            throw new AppError(
              "unsupported",
              "Aprove a ferramenta Kusto query do MCP.",
            );
          const args = {
            "cluster-uri": h.endpoint,
            database: h.database,
            tenant: scope.tenantId,
            subscription: scope.subscriptionId,
            query,
          };
          const result = await this.mcps.call(
            context,
            m.id,
            t.name,
            args,
            query,
          );
          const r = result.result as any;
          data = r.structuredContent;
          if (!data) {
            const text = r.content
              ?.filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
            try {
              data = JSON.parse(text);
            } catch {
              throw new AppError(
                "hub_schema",
                "Resposta MCP sem JSON Kusto reconhecido.",
                502,
              );
            }
          }
        }
        await this.gate.assertCurrent(revisions);
        assertActive(controller.signal);
        assertActive(context.signal);
        return h.transport === "mcp" ? mcpHubRows(data) : kustoRows(data);
      };
      if (operation === "reservations" || operation === "savingsPlans") {
        const datasets = [];
        for (const op of [
          operation === "reservations"
            ? "reservationCosts"
            : "savingsPlanCosts",
          operation,
          operation === "reservations"
            ? "utilizationReservations"
            : "utilizationSavingsPlans",
        ] as QueryOperation[]) {
          try {
            const rows = await execute(op);
            datasets.push({
              dataset: op,
              status: rows.length ? "partial" : "no_rows",
              rows,
              warning:
                "Dados limitados a 100 linhas; métricas agregadas e completude não certificadas.",
            });
          } catch (e) {
            if (context.signal.aborted) throw e;
            datasets.push({
              dataset: op,
              status: "unavailable",
              reason:
                e instanceof AppError ? e.message : "Dataset indisponível.",
            });
          }
        }
        return {
          source: "finops-hub",
          hubId: id,
          period,
          scope,
          kind: operation,
          datasets,
          coverage: null,
          utilization: null,
          realizedSavings: null,
          warnings: [
            "Recomendações são projeções, não economias realizadas.",
            "Dados de compra de billing não são atribuídos ao RG.",
            "Percentuais exigem denominadores compatíveis; não são inferidos.",
            "Recomendações sem moeda verificável não são somadas a custos; não há total de economia projetada.",
          ],
        };
      }
      const rawRows = await execute("costs");
      const field = basis === "ActualCost" ? "BilledCost" : "EffectiveCost";
      const rows = rawRows.map((r) => {
        if (
          typeof r.BillingCurrency !== "string" ||
          !r.BillingCurrency ||
          typeof r.Month !== "string" ||
          !/^\d{4}-\d{2}-01/.test(r.Month)
        )
          throw new AppError(
            "hub_schema",
            "Colunas de custo incompatíveis.",
            502,
          );
        const date = r.Month.slice(0, 10);
        if (date < period.from || date >= period.toExclusive)
          throw new AppError("hub_schema", "Linha fora do período.", 502);
        return {
          date,
          dimension: scope.resourceGroup!,
          currency: r.BillingCurrency,
          amount: amount(r[field]),
        };
      });
      const totals = [...new Set(rows.map((r) => r.currency))].map(
        (currency) => ({
          currency,
          amount: rows
            .filter((r) => r.currency === currency)
            .reduce((s, r) => s.plus(r.amount), new Decimal(0))
            .toString(),
        }),
      );
      const hub = {
        basis,
        rows,
        totals,
        coverageConfirmed: false,
        hubId: id,
        focusBasis: field,
        meta: {
          scope,
          period,
          source: "FinOps hub / " + h.transport + " / " + h.name,
          fetchedAt: new Date().toISOString(),
          status: "partial" as const,
          warnings: [
            "Cobertura/freshness da exportação não certificada; ausência de linhas não prova custo zero.",
            "Valores FOCUS não são equivalentes universais a ActualCost/AmortizedCost.",
          ],
        },
      };
      return hub;
    } finally {
      unwatch();
      controller.abort();
    }
  }
}
