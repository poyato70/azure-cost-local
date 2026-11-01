import type { DateRange } from "../../shared/contracts.js";
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function lastCompleteMonths(now: Date, count: number): DateRange {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value),
    month = Number(parts.find((p) => p.type === "month")!.value) - 1;
  return {
    from: iso(new Date(Date.UTC(year, month - count, 1))),
    toExclusive: iso(new Date(Date.UTC(year, month, 1))),
    timeZone: "America/Sao_Paulo",
  };
}
export function previousPeriod(p: DateRange): DateRange {
  const from = new Date(p.from),
    to = new Date(p.toExclusive);
  if (from.getUTCDate() === 1 && to.getUTCDate() === 1) {
    const n =
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      to.getUTCMonth() -
      from.getUTCMonth();
    return {
      ...p,
      from: iso(
        new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - n, 1)),
      ),
      toExclusive: p.from,
    };
  }
  return {
    ...p,
    from: iso(new Date(+from - (+to - +from))),
    toExclusive: p.from,
  };
}
