import { Decimal } from "decimal.js";
import {
  meta,
  scopePath,
  type BudgetItem,
  type BudgetLocks,
  type BudgetLockTag,
  type BudgetStatus,
  type Scope,
  type RequestContext,
} from "../../shared/contracts.js";
import { ArmHttp } from "../azure/http.js";
const grains: Record<string, string> = {
  Monthly: "Consumo do ciclo mensal atual",
  Quarterly: "Consumo do ciclo trimestral atual",
  Annually: "Consumo do ciclo anual atual",
  BillingMonth: "Consumo do ciclo de faturamento mensal; datas não informadas",
  BillingQuarter:
    "Consumo do ciclo de faturamento trimestral; datas não informadas",
  BillingAnnual: "Consumo do ciclo de faturamento anual; datas não informadas",
};
export function normalizeBudget(b: any): BudgetItem {
  const p = b.properties || {},
    spend = p.currentSpend;
  return {
    id: b.id || "",
    name: b.name || "Orçamento",
    amount: String(p.amount ?? 0),
    timeGrain: p.timeGrain || "Unknown",
    spendPeriodLabel:
      grains[p.timeGrain] || "Período de consumo não informado pelo Azure",
    currency: spend?.unit || "Não informada",
    spent: spend?.amount == null ? null : String(spend.amount),
    percent:
      spend?.amount == null || !p.amount
        ? null
        : new Decimal(spend.amount)
            .div(p.amount)
            .times(100)
            .toDecimalPlaces(2)
            .toString(),
    period: {
      from: String(p.timePeriod?.startDate || "").slice(0, 10),
      toExclusive: String(p.timePeriod?.endDate || "").slice(0, 10),
      timeZone: "America/Sao_Paulo",
    },
    filters: p.filter || p.filters || null,
    thresholds: Object.values(p.notifications || {}).map(
      (n: any) => n.threshold,
    ),
  };
}
const lockKey = /budget|or[cç]ament|trava|lock|limite|teto|cota/i;
export class Budgets {
  constructor(private http: ArmHttp) {}
  async getLocks(
    ctx: RequestContext,
    scope: Scope,
    showAll = false,
  ): Promise<BudgetLocks> {
    const subscription = encodeURIComponent(scope.subscriptionId),
      items: BudgetLockTag[] = [],
      keep = (k: string) => showAll || lockKey.test(k),
      collect = (
        level: BudgetLockTag["level"],
        name: string,
        tags: unknown,
      ) => {
        for (const [key, value] of Object.entries(
          (tags && typeof tags === "object" ? tags : {}) as Record<
            string,
            unknown
          >,
        ))
          if (keep(key))
            items.push({ level, name, key, value: String(value ?? "") });
      };
    const result: BudgetLocks = {
      meta: meta(scope, "Tags Azure Resource Manager"),
      showAll,
      resourcesScanned: 0,
      items,
    };
    const sub = await this.http.request(
      ctx,
      `/subscriptions/${subscription}?api-version=2022-12-01`,
    );
    collect(
      "subscription",
      String(sub?.displayName || scope.subscriptionId),
      sub?.tags,
    );
    if (scope.resourceGroup) {
      const group = encodeURIComponent(scope.resourceGroup);
      const rg = await this.http.request(
        ctx,
        `/subscriptions/${subscription}/resourcegroups/${group}?api-version=2021-04-01`,
      );
      collect("resourceGroup", scope.resourceGroup, rg?.tags);
      const resources = await this.http.list(
        ctx,
        `/subscriptions/${subscription}/resourceGroups/${group}/resources?api-version=2021-04-01`,
      );
      result.resourcesScanned = resources.items.length;
      for (const res of resources.items)
        collect("resource", String(res.name || res.id), res.tags);
      if (resources.partial) result.meta.status = "partial";
    } else
      result.meta.warnings.push(
        "Selecione um resource group para incluir as tags dos recursos; apenas a subscription foi consultada.",
      );
    return result;
  }
  async getBudgets(ctx: RequestContext, scope: Scope): Promise<BudgetStatus> {
    const r = await this.http.list(
      ctx,
      scopePath(scope) +
        "/providers/Microsoft.Consumption/budgets?api-version=2026-06-01",
    );
    const result: BudgetStatus = {
      meta: meta(scope, "Microsoft.Consumption Budgets API"),
      items: r.items.map(normalizeBudget),
    };
    if (r.partial) result.meta.status = "partial";
    if (result.items.some((b) => b.spent === null))
      result.meta.warnings.push(
        "Azure não informou currentSpend para alguns budgets; consumo não foi substituído pelo total do escopo.",
      );
    return result;
  }
}
