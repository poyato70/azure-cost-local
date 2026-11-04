import { Decimal } from "decimal.js";
import {
  forecastQuery,
  type ForecastQuery,
  type ForecastResult,
} from "../../shared/forecast.js";
import {
  scopePath,
  meta,
  type RequestContext,
} from "../../shared/contracts.js";
import type { ArmHttp } from "../azure/http.js";
import { AppError, assertActive } from "../errors.js";
import { totals } from "../costs/service.js";
export class ForecastService {
  constructor(private http: ArmHttp) {}
  async query(
    ctx: RequestContext,
    raw: ForecastQuery,
  ): Promise<ForecastResult> {
    const q = forecastQuery.parse(raw);
    assertActive(ctx.signal);
    if (q.scope.tenantId !== ctx.tenantId)
      throw new AppError("forbidden", "Tenant fora da sessão.", 403);
    const duration =
      Date.parse(q.period.toExclusive) - Date.parse(q.period.from);
    if (duration <= 0 || duration > 366 * 86400000)
      throw new AppError(
        "invalid_request",
        "Selecione um período de até 366 dias.",
      );
    const base =
      scopePath(q.scope) +
      "/providers/Microsoft.CostManagement/forecast?api-version=2025-03-01";
    const target = new URL(base, "https://management.azure.com");
    const body = {
      type: q.basis,
      timeframe: "Custom",
      timePeriod: {
        from: q.period.from + "T00:00:00Z",
        to: new Date(Date.parse(q.period.toExclusive) - 1000)
          .toISOString()
          .replace(".000Z", "Z"),
      },
      includeActualCost: q.includeActual,
      includeFreshPartialCost: false,
      dataset: {
        granularity: "Daily",
        aggregation: { totalCost: { name: "Cost", function: "Sum" } },
      },
    };
    const result: ForecastResult = {
      basis: q.basis,
      meta: {
        ...meta(q.scope, "Azure Cost Management Forecast API"),
        period: q.period,
        warnings: [
          "Previsão oficial sujeita a revisão; não representa cobrança realizada nem fatura final.",
          "Ausência de histórico ou suporte ao escopo pode impedir a previsão.",
        ],
      },
      rows: [],
      forecastTotals: [],
      actualTotals: [],
    };
    let next: string | undefined = base;
    const seen = new Set<string>();
    while (next) {
      const url = new URL(next, target);
      if (
        url.origin !== target.origin ||
        url.pathname !== target.pathname ||
        url.username ||
        url.password ||
        seen.has(url.href) ||
        seen.size >= 50
      ) {
        result.meta.status = "partial";
        result.meta.warnings.push(
          "Paginação não validada; resultados parciais.",
        );
        break;
      }
      seen.add(url.href);
      const data = await this.http.request(ctx, url.href, body);
      assertActive(ctx.signal);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new AppError(
          "forecast_schema",
          "Resposta de previsão inválida.",
          502,
        );
      const p = data.properties;
      if (!p) {
        if (Object.keys(data).length)
          throw new AppError(
            "forecast_schema",
            "Resposta de previsão sem estrutura reconhecida.",
            502,
          );
        break;
      }
      const columns = (p.columns || []).map((c: any) => c.name);
      const index = (...names: string[]) =>
        names.map((n) => columns.indexOf(n)).find((i) => i >= 0) ?? -1;
      const ai = index("Cost", "PreTaxCost", "totalCost"),
        di = index("UsageDate", "Date"),
        si = index("CostStatus"),
        ci = index("Currency");
      if (!Array.isArray(p.rows))
        throw new AppError(
          "forecast_schema",
          "Linhas de previsão ausentes.",
          502,
        );
      if (p.rows.length && [ai, di, si, ci].some((i) => i < 0))
        throw new AppError(
          "forecast_schema",
          "Colunas de previsão incompatíveis; nenhum valor foi inferido.",
          502,
        );
      for (const row of p.rows) {
        const s = row[si];
        if (s !== "Forecast" && s !== "Actual")
          throw new AppError(
            "forecast_schema",
            "Tipo de valor não reconhecido: previsto e realizado não foram misturados.",
            502,
          );
        const r = String(row[di]);
        const date = /^\d{8}$/.test(r)
          ? `${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}`
          : r.slice(0, 10);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Number.isNaN(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date ||
          date < q.period.from ||
          date >= q.period.toExclusive ||
          typeof row[ci] !== "string" ||
          !row[ci] ||
          row[ai] === null ||
          row[ai] === undefined ||
          !["string", "number"].includes(typeof row[ai])
        )
          throw new AppError(
            "forecast_schema",
            "Linha de previsão inválida ou fora do período.",
            502,
          );
        let amount: Decimal;
        try {
          amount = new Decimal(row[ai]);
          if (!amount.isFinite()) throw Error();
        } catch {
          throw new AppError(
            "forecast_schema",
            "Valor monetário de previsão inválido.",
            502,
          );
        }
        if (s === "Actual" && !q.includeActual)
          throw new AppError(
            "forecast_schema",
            "O provedor incluiu dados realizados não solicitados.",
            502,
          );
        result.rows.push({
          date,
          costStatus: s,
          currency: row[ci],
          amount: amount.toString(),
        });
      }
      if (result.rows.length > 10000) {
        result.meta.status = "partial";
        result.meta.warnings.push("Limite de linhas atingido.");
        break;
      }
      if (
        p.nextLink !== null &&
        p.nextLink !== undefined &&
        typeof p.nextLink !== "string"
      )
        throw new AppError(
          "forecast_schema",
          "Paginação de previsão inválida.",
          502,
        );
      next = p.nextLink;
    }
    assertActive(ctx.signal);
    result.forecastTotals = totals(
      result.rows.filter((r) => r.costStatus === "Forecast"),
    );
    result.actualTotals = totals(
      result.rows.filter((r) => r.costStatus === "Actual"),
    );
    if (!result.forecastTotals.length && result.meta.status === "complete") {
      result.meta.status = "unavailable";
      result.meta.warnings.push(
        "O Azure não retornou valores previstos; não é possível afirmar previsão zero.",
      );
    }
    return result;
  }
}
