import { Decimal } from "decimal.js";
import { z } from "zod";

export type FinOpsPeriod = { from: string; toExclusive: string };
export type FinOpsSource = {
  serverId: string;
  tool: string;
  executionId: string;
};
export type FinOpsCostRow = {
  lineId: string;
  provider: string;
  scope: string;
  resourceId?: string | null;
  originalResourceId?: string;
  period: FinOpsPeriod;
  currency: string;
  amount: string;
  classification: "usage" | "credit" | "shared" | "unclassified";
  evidenceRef: string;
};
export type FinOpsInventoryRow = {
  inventoryId: string;
  provider: string;
  scope: string;
  resourceId: string;
  canonicalResourceId?: string;
  resourceType: string;
  name: string;
  region?: string;
  group?: string;
  metadata?: Record<string, string>;
  evidenceRef: string;
};
export type CorrelateFinOpsInput = {
  correlationId: string;
  requestedScope: string;
  requestedPeriod: FinOpsPeriod;
  sources: { costs: FinOpsSource; inventory: FinOpsSource };
  costRows: unknown[];
  inventoryRows: unknown[];
};
type RowIssue = {
  rowIndex: number;
  lineId?: string;
  inventoryId?: string;
  reason: string;
};
type ClassifiedCost = {
  provider: string;
  scope: string;
  resourceId?: string | null;
  originalResourceId?: string;
  costLineIds: string[];
  evidenceRefs: string[];
  currency: string;
  amount: string;
  period: FinOpsPeriod;
  reason: string;
};
export type CorrelationResult = {
  correlationId: string;
  requestedScope: string;
  requestedPeriod: FinOpsPeriod;
  status: "complete" | "complete_with_discrepancies" | "insufficient_data";
  totals: Array<{ currency: string; amount: string; period: FinOpsPeriod }>;
  associations: Array<{
    provider: string;
    scope: string;
    resourceId: string;
    normalizedResourceId: string;
    originalResourceIds?: string[];
    inventoryIds: string[];
    resources: Array<
      Pick<
        FinOpsInventoryRow,
        | "inventoryId"
        | "resourceId"
        | "canonicalResourceId"
        | "resourceType"
        | "name"
        | "region"
        | "group"
        | "evidenceRef"
      >
    >;
    costLineIds: string[];
    evidenceRefs: string[];
    currency: string;
    amount: string;
    period: FinOpsPeriod;
    rule:
      | "exact-provider-scope-resource-id"
      | "exact-provider-scope-source-canonical-id";
  }>;
  unassociated: ClassifiedCost[];
  ambiguous: Array<ClassifiedCost & { inventoryIds: string[] }>;
  nonAllocatable: ClassifiedCost[];
  invalidCosts: RowIssue[];
  invalidInventory: RowIssue[];
  duplicates: Array<{
    lineId: string;
    kind: "exact_duplicate";
    occurrences: number;
  }>;
  inventoryWithoutCosts: Array<
    Pick<
      FinOpsInventoryRow,
      | "inventoryId"
      | "provider"
      | "scope"
      | "resourceId"
      | "resourceType"
      | "name"
      | "region"
      | "group"
      | "evidenceRef"
    >
  >;
  provenance: {
    correlationId: string;
    costs: FinOpsSource;
    inventory: FinOpsSource;
    matchingRule: "exact-provider-scope-resource-id-or-source-declared-canonical-id";
  };
};

const Money = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
const MAX_ROWS = 250;
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};
const identifier = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => value.trim() === value);
const periodSchema = z
  .object({
    from: z.string().refine(validDate),
    toExclusive: z.string().refine(validDate),
  })
  .strict()
  .refine((value) => value.from < value.toExclusive);
export const finOpsPeriodSchema = periodSchema;
export function hasFinOpsCostOutsideScope(rows: unknown[], scope: string) {
  return rows.some((row) => {
    const parsed = costSchema.safeParse(row);
    return parsed.success && parsed.data.scope !== scope;
  });
}
const amountSchema = z
  .string()
  .max(80)
  .regex(/^-?(?:0|[1-9]\d{0,49})(?:\.\d{1,24})?$/)
  .refine((value) => {
    try {
      return new Money(value).isFinite();
    } catch {
      return false;
    }
  });
const costSchema = z
  .object({
    lineId: identifier,
    provider: identifier,
    scope: identifier,
    resourceId: identifier.nullable().optional(),
    originalResourceId: identifier.optional(),
    period: periodSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: amountSchema,
    classification: z.enum(["usage", "credit", "shared", "unclassified"]),
    evidenceRef: z.string().min(1).max(300),
  })
  .strict();
const inventorySchema = z
  .object({
    inventoryId: identifier,
    provider: identifier,
    scope: identifier,
    resourceId: identifier,
    canonicalResourceId: identifier.optional(),
    resourceType: identifier,
    name: identifier,
    region: z.string().max(200).optional(),
    group: z.string().max(200).optional(),
    metadata: z
      .record(z.string(), z.string().max(256))
      .refine((value) => Object.keys(value).length <= 20)
      .optional(),
    evidenceRef: z.string().min(1).max(300),
  })
  .strict();
const sourceSchema = z
  .object({
    serverId: identifier,
    tool: identifier,
    executionId: identifier,
  })
  .strict();

export function projectFinOpsCostRows(rows: unknown[]): unknown[] {
  return rows.map((value) => {
    const parsed = costSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    const record =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return typeof record.lineId === "string" &&
      record.lineId.length <= 512 &&
      record.lineId.trim() === record.lineId
      ? { lineId: record.lineId }
      : {};
  });
}

const identityKey = (provider: string, scope: string, resourceId: string) =>
  JSON.stringify([provider, scope, resourceId]);
const periodCurrencyKey = (period: FinOpsPeriod, currency: string) =>
  JSON.stringify([period.from, period.toExclusive, currency]);
const costKey = (row: FinOpsCostRow) =>
  JSON.stringify([row.provider, row.scope, row.lineId]);
const costFingerprint = (row: FinOpsCostRow) =>
  JSON.stringify([
    row.provider,
    row.scope,
    row.lineId,
    row.resourceId ?? null,
    row.originalResourceId ?? null,
    row.period.from,
    row.period.toExclusive,
    row.currency,
    row.amount,
    row.classification,
    row.evidenceRef,
  ]);

function issueRow(
  value: unknown,
  rowIndex: number,
  kind: "cost" | "inventory",
): RowIssue {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const idKey = kind === "cost" ? "lineId" : "inventoryId";
  const id = record[idKey];
  return {
    rowIndex,
    ...(typeof id === "string"
      ? kind === "cost"
        ? { lineId: id }
        : { inventoryId: id }
      : {}),
    reason: kind === "cost" ? "invalid_cost_row" : "invalid_inventory_row",
  };
}

function classificationRecord(
  row: FinOpsCostRow,
  reason: string,
): ClassifiedCost {
  return {
    provider: row.provider,
    scope: row.scope,
    ...(row.resourceId ? { resourceId: row.resourceId } : {}),
    ...(row.originalResourceId ? { originalResourceId: row.originalResourceId } : {}),
    costLineIds: [row.lineId],
    evidenceRefs: [row.evidenceRef],
    currency: row.currency,
    amount: new Money(row.amount).toString(),
    period: row.period,
    reason,
  };
}

export function correlateFinOps(
  input: CorrelateFinOpsInput,
): CorrelationResult {
  if (input.costRows.length > MAX_ROWS || input.inventoryRows.length > MAX_ROWS)
    throw new RangeError(`A análise aceita até ${MAX_ROWS} linhas por fonte.`);
  const requestedPeriod = periodSchema.parse(input.requestedPeriod);
  const requestedScope = identifier.parse(input.requestedScope);
  const costsSource = sourceSchema.parse(input.sources.costs);
  const inventorySource = sourceSchema.parse(input.sources.inventory);
  const invalidCosts: RowIssue[] = [];
  const invalidInventory: RowIssue[] = [];
  const parsedCosts: Array<{ row: FinOpsCostRow; rowIndex: number }> = [];
  const parsedInventory: FinOpsInventoryRow[] = [];

  input.costRows.forEach((value, rowIndex) => {
    const parsed = costSchema.safeParse(value);
    if (!parsed.success) {
      invalidCosts.push(issueRow(value, rowIndex, "cost"));
      return;
    }
    if (
      parsed.data.period.from !== requestedPeriod.from ||
      parsed.data.period.toExclusive !== requestedPeriod.toExclusive
    ) {
      invalidCosts.push({
        rowIndex,
        lineId: parsed.data.lineId,
        reason: "period_mismatch",
      });
      return;
    }
    if (parsed.data.scope !== requestedScope) {
      invalidCosts.push({
        rowIndex,
        lineId: parsed.data.lineId,
        reason: "scope_mismatch",
      });
      return;
    }
    parsedCosts.push({ row: parsed.data, rowIndex });
  });
  input.inventoryRows.forEach((value, rowIndex) => {
    const parsed = inventorySchema.safeParse(value);
    if (parsed.success && parsed.data.scope === requestedScope)
      parsedInventory.push(parsed.data);
    else if (parsed.success)
      invalidInventory.push({
        rowIndex,
        inventoryId: parsed.data.inventoryId,
        reason: "scope_mismatch",
      });
    else invalidInventory.push(issueRow(value, rowIndex, "inventory"));
  });

  const costsById = new Map<
    string,
    Array<{ row: FinOpsCostRow; rowIndex: number }>
  >();
  for (const { row, rowIndex } of parsedCosts) {
    const key = costKey(row);
    costsById.set(key, [...(costsById.get(key) || []), { row, rowIndex }]);
  }
  const validCosts: FinOpsCostRow[] = [];
  const duplicates: CorrelationResult["duplicates"] = [];
  for (const indexedRows of costsById.values()) {
    const rows = indexedRows.map(({ row }) => row);
    if (rows.length === 1) {
      validCosts.push(rows[0]);
      continue;
    }
    const firstFingerprint = costFingerprint(rows[0]);
    if (rows.every((row) => costFingerprint(row) === firstFingerprint)) {
      validCosts.push(rows[0]);
      duplicates.push({
        lineId: rows[0].lineId,
        kind: "exact_duplicate",
        occurrences: rows.length,
      });
    } else {
      invalidCosts.push({
        lineId: rows[0].lineId,
        rowIndex: indexedRows[0].rowIndex,
        reason: "conflicting_duplicate_line_id",
      });
    }
  }

  const inventoryByIdentity = new Map<string, FinOpsInventoryRow[]>();
  for (const row of parsedInventory) {
    const key = identityKey(
      row.provider,
      row.scope,
      row.canonicalResourceId || row.resourceId,
    );
    inventoryByIdentity.set(key, [
      ...(inventoryByIdentity.get(key) || []),
      row,
    ]);
  }
  const totals = new Map<
    string,
    { currency: string; amount: Decimal; period: FinOpsPeriod }
  >();
  const associations = new Map<
    string,
    CorrelationResult["associations"][number]
  >();
  const unassociated: ClassifiedCost[] = [];
  const ambiguous: CorrelationResult["ambiguous"] = [];
  const nonAllocatable: ClassifiedCost[] = [];
  const referencedInventory = new Set<string>();

  for (const row of validCosts) {
    const groupKey = periodCurrencyKey(row.period, row.currency);
    const total = totals.get(groupKey) || {
      currency: row.currency,
      amount: new Money(0),
      period: row.period,
    };
    total.amount = total.amount.plus(row.amount);
    totals.set(groupKey, total);

    if (row.classification === "shared" || !row.resourceId) {
      nonAllocatable.push(
        classificationRecord(row, "shared_or_missing_resource_id"),
      );
      continue;
    }
    const candidates =
      inventoryByIdentity.get(
        identityKey(row.provider, row.scope, row.resourceId),
      ) || [];
    if (candidates.length === 0) {
      unassociated.push(classificationRecord(row, "no_exact_identity"));
      continue;
    }
    for (const candidate of candidates)
      referencedInventory.add(candidate.inventoryId);
    if (candidates.length > 1) {
      ambiguous.push({
        ...classificationRecord(row, "multiple_exact_identities"),
        inventoryIds: candidates
          .map((candidate) => candidate.inventoryId)
          .sort(),
      });
      continue;
    }
    const match = candidates[0];
    const group = JSON.stringify([
      row.provider,
      row.scope,
      row.resourceId,
      row.period.from,
      row.period.toExclusive,
      row.currency,
      match.inventoryId,
    ]);
    const existing = associations.get(group) || {
      provider: row.provider,
      scope: row.scope,
      resourceId: row.resourceId,
      normalizedResourceId: row.resourceId,
      ...(row.originalResourceId ? { originalResourceIds: [row.originalResourceId] } : {}),
      inventoryIds: [match.inventoryId],
      resources: [
        {
          inventoryId: match.inventoryId,
          resourceId: match.resourceId,
          ...(match.canonicalResourceId
            ? { canonicalResourceId: match.canonicalResourceId }
            : {}),
          resourceType: match.resourceType,
          name: match.name,
          ...(match.region ? { region: match.region } : {}),
          ...(match.group ? { group: match.group } : {}),
          evidenceRef: match.evidenceRef,
        },
      ],
      costLineIds: [],
      evidenceRefs: [row.evidenceRef, match.evidenceRef],
      currency: row.currency,
      amount: "0",
      period: row.period,
      rule:
        match.canonicalResourceId &&
        match.canonicalResourceId !== match.resourceId
          ? ("exact-provider-scope-source-canonical-id" as const)
          : ("exact-provider-scope-resource-id" as const),
    };
    existing.costLineIds.push(row.lineId);
    if (row.originalResourceId) {
      existing.originalResourceIds ||= [];
      if (!existing.originalResourceIds.includes(row.originalResourceId))
        existing.originalResourceIds.push(row.originalResourceId);
    }
    if (!existing.evidenceRefs.includes(row.evidenceRef))
      existing.evidenceRefs.push(row.evidenceRef);
    if (!existing.evidenceRefs.includes(match.evidenceRef))
      existing.evidenceRefs.push(match.evidenceRef);
    existing.amount = new Money(existing.amount).plus(row.amount).toString();
    associations.set(group, existing);
  }

  const inventoryWithoutCosts = parsedInventory
    .filter((row) => !referencedInventory.has(row.inventoryId))
    .map(
      ({
        inventoryId,
        provider,
        scope,
        resourceId,
        resourceType,
        name,
        region,
        group,
        evidenceRef,
      }) => ({
        inventoryId,
        provider,
        scope,
        resourceId,
        resourceType,
        name,
        ...(region ? { region } : {}),
        ...(group ? { group } : {}),
        evidenceRef,
      }),
    )
    .sort((a, b) =>
      [a.provider, a.scope, a.resourceId, a.inventoryId]
        .join("|")
        .localeCompare(
          [b.provider, b.scope, b.resourceId, b.inventoryId].join("|"),
        ),
    );

  const totalsList = [...totals.values()]
    .sort((a, b) =>
      periodCurrencyKey(a.period, a.currency).localeCompare(
        periodCurrencyKey(b.period, b.currency),
      ),
    )
    .map(({ amount, ...rest }) => ({ ...rest, amount: amount.toString() }));
  const discrepancy = Boolean(
    unassociated.length ||
    ambiguous.length ||
    nonAllocatable.length ||
    invalidCosts.length ||
    invalidInventory.length ||
    duplicates.length,
  );
  return {
    correlationId: input.correlationId,
    requestedScope,
    requestedPeriod,
    status:
      validCosts.length === 0
        ? "insufficient_data"
        : discrepancy
          ? "complete_with_discrepancies"
          : "complete",
    totals: totalsList,
    associations: [...associations.values()].sort((a, b) =>
      [a.provider, a.scope, a.resourceId, a.currency]
        .join("|")
        .localeCompare(
          [b.provider, b.scope, b.resourceId, b.currency].join("|"),
        ),
    ),
    unassociated,
    ambiguous,
    nonAllocatable,
    invalidCosts: invalidCosts.sort((a, b) => a.rowIndex - b.rowIndex),
    invalidInventory: invalidInventory.sort((a, b) => a.rowIndex - b.rowIndex),
    duplicates,
    inventoryWithoutCosts,
    provenance: {
      correlationId: input.correlationId,
      costs: costsSource,
      inventory: inventorySource,
      matchingRule:
        "exact-provider-scope-resource-id-or-source-declared-canonical-id",
    },
  };
}
