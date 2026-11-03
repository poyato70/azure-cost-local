import { Decimal } from "decimal.js";
import type { CostResult } from "../../shared/contracts.js";
export function reconcile(
  hub: CostResult & { coverageConfirmed?: boolean },
  arm: CostResult,
) {
  const currencies = [
    ...new Set([...hub.totals, ...arm.totals].map((x) => x.currency)),
  ].sort();
  const rows = currencies.map((currency) => {
    const h = hub.totals.find((x) => x.currency === currency)?.amount,
      a = arm.totals.find((x) => x.currency === currency)?.amount;
    const difference =
      h !== undefined && a !== undefined
        ? new Decimal(h).minus(a).toString()
        : null;
    return {
      currency,
      hub: h ?? null,
      costManagement: a ?? null,
      difference,
      percent:
        difference !== null && a !== undefined && !new Decimal(a).isZero()
          ? new Decimal(difference).div(a).mul(100).toString()
          : null,
    };
  });
  return {
    status: "not_comparable" as const,
    rows,
    hubMeta: hub.meta,
    costManagementMeta: arm.meta,
    reasons: [
      "Comparação informativa: equivalência entre bases FOCUS e Cost Management não foi certificada.",
      ...(hub.coverageConfirmed
        ? []
        : ["Cobertura completa do Hub não comprovada."]),
      ...(hub.meta.status !== "complete" || arm.meta.status !== "complete"
        ? ["Uma das fontes está parcial ou indisponível."]
        : []),
    ],
    tolerance: "0",
    message:
      "Diferenças são preservadas; igualdade numérica não certifica conciliação.",
  };
}
