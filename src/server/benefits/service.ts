import {
  meta,
  scopePath,
  type Scenario,
  type BenefitAnalysis,
  type RequestContext,
  type Scope,
} from "../../shared/contracts.js";
import { ArmHttp } from "../azure/http.js";
import { AppError } from "../errors.js";
import { lastCompleteMonths } from "../costs/periods.js";
const nullable = (x: any): string | null =>
  x == null
    ? null
    : typeof x === "object"
      ? nullable(x.value)
      : typeof x === "number" || typeof x === "string"
        ? String(x)
        : null;
export function normalizeRecommendation(
  item: any,
  kind: BenefitAnalysis["kind"],
): Scenario {
  const p = item.properties || {},
    d = p.recommendationDetails || p;
  const savings = d.savingsAmount ?? p.netSavings,
    without = p.costWithoutBenefit ?? p.costWithNoReservedInstances,
    withBenefit = d.totalCost ?? p.totalCostWithReservedInstances;
  const currency =
    p.currencyCode ||
    p.currency ||
    savings?.currency ||
    without?.currency ||
    withBenefit?.currency ||
    null;
  return {
    id: item.id || item.name || "",
    sku:
      p.skuProperties?.name ||
      p.armSkuName ||
      p.sku ||
      item.sku?.name ||
      item.sku ||
      null,
    location: p.location || item.location || null,
    quantity: nullable(p.recommendedQuantity ?? d.recommendedQuantity),
    source: "official",
    term: p.term || "Não informado",
    currency,
    estimatedSavings: nullable(savings),
    coverage: d.coveragePercentage ?? null,
    utilization: d.averageUtilizationPercentage ?? null,
    commitment: nullable(d.commitmentAmount),
    costWithout: nullable(without),
    costWith: nullable(withBenefit),
    assumptions: [
      `Fonte: recomendação oficial ${kind === "reservation" ? "Reservations" : "Savings Plans"}.`,
      `Janela histórica: ${p.lookBackPeriod || "não informada"}. Economia estimada para essa janela, sem garantia futura.`,
      "Recomendações alternativas e benefícios sobrepostos não devem ser somados.",
    ],
  };
}
export class Benefits {
  constructor(private http: ArmHttp) {}
  async analyzeBenefits(
    ctx: RequestContext,
    scope: Scope,
    kind: BenefitAnalysis["kind"],
  ): Promise<BenefitAnalysis> {
    const result: BenefitAnalysis = {
      meta: meta(scope, "Azure Recommendations + Cost Management"),
      kind,
      existing: [],
      recommendations: [],
      scenarios: [],
      detailedSimulationAvailable: false,
    };
    for (const term of ["P1Y", "P3Y"]) {
      const filter =
        kind === "savingsPlan"
          ? `properties/scope eq 'Single' AND properties/lookBackPeriod eq 'Last30Days' AND properties/term eq '${term}'`
          : `properties/scope eq 'Single' AND properties/lookBackPeriod eq 'Last30Days'`;
      if (kind === "reservation" && term === "P3Y") break;
      const path =
        scopePath(scope) +
        (kind === "reservation"
          ? "/providers/Microsoft.Consumption/reservationRecommendations"
          : "/providers/Microsoft.CostManagement/benefitRecommendations") +
        "?api-version=2026-06-01&$filter=" +
        encodeURIComponent(filter) +
        (kind === "savingsPlan"
          ? "&$expand=properties/allRecommendationDetails"
          : "");
      try {
        const r = await this.http.list(ctx, path);
        result.recommendations.push(
          ...r.items.map((x) => normalizeRecommendation(x, kind)),
        );
        if (r.partial) result.meta.status = "partial";
      } catch (e) {
        if (e instanceof AppError && ["unauthenticated"].includes(e.code))
          throw e;
        result.meta.status = "partial";
        result.meta.warnings.push(
          `${term}: ${e instanceof AppError ? e.message : "Não foi possível consultar recomendações."}`,
        );
      }
    }
    // Existing-benefit evidence is cost attributed to the chosen scope, not a global order inventory.
    const period = lastCompleteMonths(new Date(), 1);
    result.meta.period = period;
    try {
      const body = {
        type: "AmortizedCost",
        timeframe: "Custom",
        timePeriod: {
          from: period.from + "T00:00:00Z",
          to: new Date(Date.parse(period.toExclusive) - 1000).toISOString(),
        },
        dataset: {
          granularity: "None",
          aggregation: { cost: { name: "Cost", function: "Sum" } },
          grouping: [
            {
              type: "Dimension",
              name: kind === "reservation" ? "ReservationName" : "BenefitName",
            },
          ],
          filter: {
            dimensions: {
              name: "PricingModel",
              operator: "In",
              values: [kind === "reservation" ? "Reservation" : "SavingsPlan"],
            },
          },
        },
      };
      const data = await this.http.request(
        ctx,
        scopePath(scope) +
          "/providers/Microsoft.CostManagement/query?api-version=2026-06-01",
        body,
      );
      const p = data.properties || {},
        cols = (p.columns || []).map((x: any) => x.name);
      for (const row of p.rows || []) {
        const at = (name: string) => row[cols.indexOf(name)];
        result.existing.push({
          name:
            at(kind === "reservation" ? "ReservationName" : "BenefitName") ||
            "Sem nome",
          amortizedCost: nullable(at("Cost") ?? at("PreTaxCost")),
          currency: at("Currency") || null,
          coverage: null,
          utilization: null,
        });
      }
      if (p.nextLink) {
        result.meta.status = "partial";
        result.meta.warnings.push(
          "Atribuição de benefícios possui mais páginas; lista parcial.",
        );
      }
    } catch (e) {
      if (e instanceof AppError && e.code === "unauthenticated") throw e;
      result.meta.status = "partial";
      result.meta.warnings.push(
        "Atribuição de benefícios existentes não disponível neste escopo/contrato.",
      );
    }
    result.scenarios = result.recommendations;
    result.meta.warnings.push(
      "Benefícios existentes mostram custos amortizados atribuídos ao escopo no mês completo anterior; não constituem inventário global de contratos. Cobertura/utilização reais exigem acesso específico de billing.",
      "Simulação detalhada indisponível: série horária e preços contratuais não foram fornecidos.",
    );
    if (
      !result.recommendations.length &&
      !result.existing.length &&
      result.meta.status === "partial"
    )
      result.meta.status = "unavailable";
    return result;
  }
}
