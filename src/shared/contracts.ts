import { z } from "zod";
const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Data inválida",
  );
export const scopeSchema = z
  .object({
    tenantId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    resourceGroup: z
      .string()
      .min(1)
      .max(90)
      .regex(/^[^/\\?#]+$/)
      .optional(),
  })
  .strict();
export const periodSchema = z
  .object({
    from: civilDate,
    toExclusive: civilDate,
    timeZone: z.literal("America/Sao_Paulo"),
  })
  .refine(
    (p) =>
      p.from < p.toExclusive &&
      (Date.parse(p.toExclusive) - Date.parse(p.from)) / 86400000 <= 400,
    "Selecione até 400 dias, com início anterior ao fim",
  );
export const costQuerySchema = z
  .object({
    scope: scopeSchema,
    period: periodSchema,
    basis: z.enum(["ActualCost", "AmortizedCost"]),
    groupBy: z.enum(["ServiceName", "ResourceId"]),
    granularity: z.enum(["Daily", "Monthly"]),
  })
  .strict();
export type Scope = z.infer<typeof scopeSchema>;
export type DateRange = z.infer<typeof periodSchema>;
export type CostQuery = z.infer<typeof costQuerySchema>;
export type RequestContext = {
  diagnose?: (event: {
    source: string;
    operation: string;
    status: string;
    detail: string;
  }) => void;
  principalKind?: "user" | "application";
  accessId?: string;
  configurationVersion?: number;
  sessionId: string;
  userId: string;
  tenantId: string;
  signal: AbortSignal;
};
export type ResultMeta = {
  scope: Scope;
  period?: DateRange;
  source: string;
  fetchedAt: string;
  status: "complete" | "partial" | "unavailable";
  warnings: string[];
};
export type Money = { currency: string; amount: string };
export type CostResult = {
  meta: ResultMeta;
  basis: CostQuery["basis"];
  rows: (Money & { date: string; dimension: string })[];
  totals: Money[];
};
export type BudgetItem = {
  id: string;
  name: string;
  amount: string;
  currency: string;
  spent: string | null;
  percent: string | null;
  period: DateRange;
  timeGrain: string;
  spendPeriodLabel: string;
  filters: unknown;
  thresholds: number[];
};
export type BudgetStatus = { meta: ResultMeta; items: BudgetItem[] };
export type Scenario = {
  id: string;
  sku: string | null;
  location: string | null;
  quantity: string | null;
  source: "official" | "simulation";
  term: string;
  currency: string | null;
  estimatedSavings: string | null;
  coverage: number | null;
  utilization: number | null;
  commitment: string | null;
  costWithout: string | null;
  costWith: string | null;
  assumptions: string[];
};
export type BenefitAnalysis = {
  meta: ResultMeta;
  kind: "reservation" | "savingsPlan";
  existing: Record<string, unknown>[];
  recommendations: Scenario[];
  scenarios: Scenario[];
  detailedSimulationAvailable: boolean;
};
export type Subscription = { id: string; name: string; tenantId: string };
export type ChatEvent =
  | { type: "mcpEvidence"; result: unknown }
  | { type: "hubEvidence"; result: unknown }
  | { type: "text"; text: string }
  | { type: "result"; result: CostResult | BudgetStatus | BenefitAnalysis }
  | { type: "error"; code: string; message: string };
export function scopePath(scope: Scope) {
  return (
    `/subscriptions/${encodeURIComponent(scope.subscriptionId)}` +
    (scope.resourceGroup
      ? `/resourceGroups/${encodeURIComponent(scope.resourceGroup)}`
      : "")
  );
}
export function meta(scope: Scope, source: string): ResultMeta {
  return {
    scope,
    source,
    fetchedAt: new Date().toISOString(),
    status: "complete",
    warnings: [],
  };
}
