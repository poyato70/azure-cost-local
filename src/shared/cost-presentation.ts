import { Decimal } from "decimal.js";
import type { CostResult } from "./contracts.js";

export type CostChartPoint = { date: string; amount: number };
export type CostDimensionTotal = { dimension: string; amount: string };

export function aggregateCostsByDate(
  result: CostResult,
  currency: string,
): CostChartPoint[] {
  const byDate = new Map<string, Decimal>();
  for (const row of result.rows) {
    if (row.currency !== currency) continue;
    byDate.set(
      row.date,
      (byDate.get(row.date) || new Decimal(0)).plus(row.amount),
    );
  }
  return [...byDate]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, amount]) => ({ date, amount: amount.toNumber() }));
}

export function aggregateCostsByDimension(
  result: CostResult,
  currency: string,
): CostDimensionTotal[] {
  const byDimension = new Map<string, Decimal>();
  for (const row of result.rows) {
    if (row.currency !== currency) continue;
    byDimension.set(
      row.dimension,
      (byDimension.get(row.dimension) || new Decimal(0)).plus(row.amount),
    );
  }
  return [...byDimension].map(([dimension, amount]) => ({
    dimension,
    amount: amount.toString(),
  }));
}
