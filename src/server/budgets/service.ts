import { Decimal } from "decimal.js";
import {
  meta,
  scopePath,
  type BudgetItem,
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
export class Budgets {
  constructor(private http: ArmHttp) {}
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
