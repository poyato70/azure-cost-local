import { Decimal } from "decimal.js";
import {
  type CostQuery,
  type CostResult,
  type Money,
  type RequestContext,
  scopePath,
  meta,
} from "../../shared/contracts.js";
import { ArmHttp } from "../azure/http.js";
import { assertActive, AppError } from "../errors.js";
export function totals(rows: Money[]): Money[] {
  const values = new Map<string, Decimal>();
  for (const r of rows)
    values.set(
      r.currency,
      (values.get(r.currency) || new Decimal(0)).plus(r.amount),
    );
  return [...values].map(([currency, value]) => ({
    currency,
    amount: value.toString(),
  }));
}
export function compareCosts(current: CostResult, previous: CostResult) {
  if (
    [current.meta?.status, previous.meta?.status].some(
      (s) => s && s !== "complete",
    )
  )
    return [];
  const currencies = new Set(
    [...current.totals, ...previous.totals].map((x) => x.currency),
  );
  return [...currencies].map((currency) => {
    const a = new Decimal(
        current.totals.find((x) => x.currency === currency)?.amount || 0,
      ),
      b = new Decimal(
        previous.totals.find((x) => x.currency === currency)?.amount || 0,
      );
    return {
      currency,
      delta: a.minus(b).toString(),
      percent: b.isZero() ? null : a.minus(b).div(b).times(100).toFixed(2),
    };
  });
}
export class AzureCosts {
  private cache = new Map<string, { at: number; value: CostResult }>();
  constructor(private http: ArmHttp) {}
  clear(sessionId: string) {
    for (const key of this.cache.keys())
      if (key.startsWith(sessionId + "|")) this.cache.delete(key);
  }
  async queryCosts(ctx: RequestContext, query: CostQuery): Promise<CostResult> {
    assertActive(ctx.signal);
    if (ctx.tenantId !== query.scope.tenantId)
      throw new AppError("forbidden", "Tenant fora da sessão.", 403);
    for (const [k, v] of this.cache)
      if (Date.now() - v.at > 300000) this.cache.delete(k);
    const key =
        ctx.sessionId +
        "|" +
        ctx.userId +
        "|" +
        (ctx.accessId || "legacy") +
        ":" +
        (ctx.configurationVersion || 0) +
        "|" +
        JSON.stringify(query),
      cached = this.cache.get(key);
    if (cached) return cached.value;
    const to = new Date(Date.parse(query.period.toExclusive) - 1000)
      .toISOString()
      .replace(".000Z", "Z");
    const body = {
      type: query.basis,
      timeframe: "Custom",
      timePeriod: { from: query.period.from + "T00:00:00Z", to },
      dataset: {
        granularity: query.granularity,
        aggregation: { totalCost: { name: "Cost", function: "Sum" } },
        grouping: [{ type: "Dimension", name: query.groupBy }],
      },
    };
    const result: CostResult = {
      meta: {
        ...meta(query.scope, "Azure Cost Management Query API"),
        period: query.period,
      },
      basis: query.basis,
      rows: [],
      totals: [],
    };
    let next: string | undefined =
      scopePath(query.scope) +
      "/providers/Microsoft.CostManagement/query?api-version=2026-06-01";
    const seen = new Set<string>();
    while (next) {
      const url = new URL(next, "https://management.azure.com");
      if (
        url.origin !== "https://management.azure.com" ||
        seen.has(url.href) ||
        seen.size >= 50
      ) {
        result.meta.status = "partial";
        result.meta.warnings.push("Paginação interrompida; totais parciais.");
        break;
      }
      seen.add(url.href);
      const data = await this.http.request(ctx, next, body),
        p = data.properties || {};
      const columns = (p.columns || []).map((c: any) => c.name);
      const index = (...names: string[]) =>
        names.map((n) => columns.indexOf(n)).find((i) => i >= 0) ?? -1;
      const ai = index("Cost", "PreTaxCost"),
        ci = index("Currency"),
        di = index("UsageDate", "BillingMonth", "Date"),
        gi = index(query.groupBy);
      if (p.rows?.length && (ai < 0 || ci < 0 || di < 0))
        throw new AppError(
          "upstream",
          "Colunas de custo inesperadas; nenhum total foi presumido.",
          502,
        );
      for (const row of p.rows || []) {
        const raw = String(row[di]);
        const date = /^\d{8}$/.test(raw)
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : raw.slice(0, 10);
        result.rows.push({
          date,
          dimension:
            gi < 0
              ? "Sem classificação"
              : String(row[gi] || "Sem classificação"),
          amount: new Decimal(row[ai]).toString(),
          currency: String(row[ci]),
        });
      }
      next = p.nextLink;
      if (result.rows.length > 100000) {
        result.meta.status = "partial";
        result.meta.warnings.push("Limite de linhas atingido.");
        break;
      }
    }
    result.totals = totals(result.rows);
    result.meta.warnings.push(
      "Dados de uso podem chegar com atraso e ser revisados pelo Azure. Custos reais não equivalem necessariamente ao total final da fatura.",
    );
    assertActive(ctx.signal);
    if (this.cache.size >= 100)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { at: Date.now(), value: result });
    return result;
  }
}
