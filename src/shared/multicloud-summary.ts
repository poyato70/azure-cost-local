import { Decimal } from "decimal.js";
import type { CloudResult } from "./multicloud.js";
const Money = Decimal.clone({ precision: 48 });
export function consolidateCloudResults(results: CloudResult[]) {
  const groups = new Map<
    string,
    {
      currency: string;
      basis: string;
      layer: CloudResult["layer"];
      from: string;
      toExclusive: string;
      amount: string;
    }
  >();
  for (const r of results)
    for (const t of r.totals) {
      const key = [t.currency, r.basis, r.layer, r.from, r.toExclusive].join(
        "|",
      );
      groups.set(key, {
        currency: t.currency,
        basis: r.basis,
        layer: r.layer,
        from: r.from,
        toExclusive: r.toExclusive,
        amount: new Money(groups.get(key)?.amount || 0)
          .plus(t.amount)
          .toFixed(),
      });
    }
  return [...groups.values()];
}
