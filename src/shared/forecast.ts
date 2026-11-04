import { z } from "zod";
import {
  scopeSchema,
  periodSchema,
  type ResultMeta,
  type Money,
} from "./contracts.js";
export const forecastQuery = z
  .object({
    scope: scopeSchema,
    period: periodSchema,
    basis: z.enum(["ActualCost", "AmortizedCost"]),
    includeActual: z.boolean().default(false),
  })
  .strict();
export type ForecastQuery = z.infer<typeof forecastQuery>;
export type ForecastResult = {
  meta: ResultMeta;
  basis: ForecastQuery["basis"];
  rows: (Money & { date: string; costStatus: "Actual" | "Forecast" })[];
  forecastTotals: Money[];
  actualTotals: Money[];
};
