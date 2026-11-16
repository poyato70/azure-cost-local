import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import { AppError } from "../errors.js";
import type { FinOpsPeriod } from "./correlation.js";

export type AzureCostMetric = "ActualCost" | "AmortizedCost";
export type CollectionStatus = "complete" | "partial" | "invalid";
export type AdaptedAzureRows<T> = {
  rows: T[];
  status: CollectionStatus;
  reasons: string[];
  rejectedRows: number;
  reportedTotal?: { amount: string; currency: string };
};

const boundedString = (value: unknown, max = 512): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

function schemaProps(schema: any) {
  return schema && typeof schema === "object" && schema.properties &&
    typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, any>
    : {};
}

function requireStringProperty(props: Record<string, any>, key: string) {
  if (!props[key] || props[key].type !== "string")
    throw new AppError("unsupported", `Schema MCP incompatível: ${key} textual é obrigatório.`);
}

function enumHas(schema: any, value: string) {
  return Array.isArray(schema?.enum) && schema.enum.includes(value);
}

function mapGroupBy(schema: any) {
  if (schema?.type === "string" && enumHas(schema, "ResourceId")) return "ResourceId";
  if (schema?.type === "array" && schema.items?.type === "string" && enumHas(schema.items, "ResourceId"))
    return ["ResourceId"];
  throw new AppError("unsupported", "Schema MCP não oferece agrupamento explícito por ResourceId.");
}

export function buildAzureCostQueryArguments(
  input: { scope: string; period: FinOpsPeriod; metric: AzureCostMetric },
  inputSchema: unknown,
) {
  const props = schemaProps(inputSchema), required = Array.isArray((inputSchema as any)?.required)
    ? (inputSchema as any).required as string[] : [];
  for (const key of ["scope", "from", "to"]) requireStringProperty(props, key);
  if (!props.groupBy) throw new AppError("unsupported", "Schema MCP sem groupBy; associação por recurso não é segura.");
  const metricProperty = props.metric;
  if (!metricProperty || metricProperty.type !== "string" || !enumHas(metricProperty, input.metric))
    throw new AppError("unsupported", "Schema MCP não confirma a métrica financeira solicitada.");
  const args: Record<string, unknown> = {
    scope: input.scope,
    from: input.period.from,
    to: input.period.toExclusive,
    groupBy: mapGroupBy(props.groupBy),
    metric: input.metric,
  };
  if (props.top) {
    if (props.top.type !== "integer" && props.top.type !== "number")
      throw new AppError("unsupported", "Schema MCP possui limite top incompatível.");
    const max = typeof props.top.maximum === "number" ? props.top.maximum : 100;
    const min = typeof props.top.minimum === "number" ? props.top.minimum : 1;
    args.top = Math.min(100, max);
    if ((args.top as number) < min)
      throw new AppError("unsupported", "O limite documentado de linhas não é aceito pelo MCP.");
  }
  if (props.granularity) {
    const granularity = props.granularity;
    if (!enumHas(granularity, "None"))
      throw new AppError("unsupported", "O schema MCP não confirma granularidade None para o total do período solicitado.");
    args.granularity = "None";
  }
  const unsupportedRequired = required.filter((key) => !(key in args));
  if (unsupportedRequired.length)
    throw new AppError("unsupported", "Schema MCP exige campos sem mapeamento M15.");
  return args;
}

function parsedArmScope(scope: string) {
  const match = scope.match(/^\/subscriptions\/([0-9a-f-]{36})(?:\/resourceGroups\/([\p{L}\p{N}_(). -]{1,90}))?$/iu);
  if (!match || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match[1]))
    throw new AppError("forbidden", "O escopo Azure da correlação precisa ser subscription ou resource group cadastrado.", 403);
  return { subscriptionId: match[1], resourceGroup: match[2] };
}

function resourceBelongsToScope(scope: string, resourceId: string) {
  const expected = scope.toLowerCase().replace(/\/$/, "");
  const actual = resourceId.toLowerCase().replace(/\/$/, "");
  return actual === expected || actual.startsWith(expected + "/");
}

export function buildAzureResourceGraphQuery(scope: string) {
  const parsed = parsedArmScope(scope);
  if (parsed.resourceGroup && !/^[\p{L}\p{N}_(). -]+$/u.test(parsed.resourceGroup))
    throw new AppError("unsupported", "Nome de resource group fora do subconjunto seguro da query M15.");
  const escaped = parsed.resourceGroup?.replace(/'/g, "''");
  return [
    "Resources",
    `| where subscriptionId =~ '${parsed.subscriptionId.toLowerCase()}'`,
    ...(escaped ? [`| where resourceGroup =~ '${escaped}'`] : []),
    "| project id, name, type, location, resourceGroup, subscriptionId",
    "| order by id asc",
  ].join(" ");
}

export function isBoundedAzureResourceGraphCall(scope: string, args: Record<string, unknown>) {
  if (Object.keys(args).some((key) => !["query", "options"].includes(key))) return false;
  if (args.query !== buildAzureResourceGraphQuery(scope)) return false;
  if (args.options === undefined) return true;
  if (!args.options || typeof args.options !== "object" || Array.isArray(args.options)) return false;
  const options = args.options as Record<string, unknown>;
  if (Object.keys(options).some((key) => !["$top", "$skipToken"].includes(key))) return false;
  if (options.$top !== undefined && (!Number.isInteger(options.$top) || (options.$top as number) < 1 || (options.$top as number) > 250)) return false;
  if (options.$skipToken !== undefined && !boundedString(options.$skipToken, 4096)) return false;
  return true;
}

export function buildAzureInventoryArguments(scope: string, inputSchema: unknown) {
  const props = schemaProps(inputSchema), required = Array.isArray((inputSchema as any)?.required)
    ? (inputSchema as any).required as string[] : [];
  requireStringProperty(props, "query");
  const args: Record<string, unknown> = { query: buildAzureResourceGraphQuery(scope) };
  if (required.includes("options") || props.options) {
    if (!props.options || props.options.type !== "object")
      throw new AppError("unsupported", "Schema MCP possui options incompatível para paginação limitada.");
    const optionProps = schemaProps(props.options);
    const topSchema = optionProps["$top"];
    if (topSchema && (topSchema.type === "integer" || topSchema.type === "number"))
      args.options = { "$top": 250 };
    else if (required.includes("options"))
      throw new AppError("unsupported", "Schema MCP não permite limitar o tamanho da página de inventário.");
  }
  if (required.some((key) => !(key in args)))
    throw new AppError("unsupported", "Schema MCP exige campos sem mapeamento M15.");
  return args;
}

function objectRows(payload: unknown): Record<string, unknown>[] | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.rows) && record.rows.every((row) => row && typeof row === "object" && !Array.isArray(row)))
    return record.rows as Record<string, unknown>[];
  if (Array.isArray(record.data) && record.data.every((row) => row && typeof row === "object" && !Array.isArray(row)))
    return record.data as Record<string, unknown>[];
  return undefined;
}

function costRows(payload: unknown): Record<string, unknown>[] | undefined {
  const direct = objectRows(payload);
  if (direct) return direct;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, any>;
  const result = record.properties && typeof record.properties === "object" ? record.properties : record;
  if (!Array.isArray(result.columns) || !Array.isArray(result.rows)) return undefined;
  const columns = result.columns.map((column: any) =>
    typeof column === "string" ? column : column && typeof column.name === "string" ? column.name : undefined,
  );
  if (!columns.length || columns.some((name: unknown) => typeof name !== "string" || !name) || new Set(columns).size !== columns.length)
    return undefined;
  if (result.rows.some((row: unknown) => !Array.isArray(row) || row.length !== columns.length))
    return undefined;
  return result.rows.map((values: unknown[]) => Object.fromEntries(columns.map((name: string, index: number) => [name, values[index]])));
}

function metricValue(row: Record<string, unknown>, metric: AzureCostMetric) {
  const candidates = metric === "ActualCost"
    ? ["actualCost", "ActualCost", "cost", "Cost", "PreTaxCost", "amount"]
    : ["amortizedCost", "AmortizedCost", "cost", "Cost", "amount"];
  const present = candidates.filter((key) => row[key] !== undefined && row[key] !== null);
  if (!present.length) return undefined;
  const values = new Set(present.map((key) => String(row[key])));
  if (values.size > 1) return undefined;
  return row[present[0]];
}

function decimalText(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value);
  if (!/^-?(?:0|[1-9]\d{0,49})(?:\.\d{1,24})?$/.test(text)) return undefined;
  if (typeof value === "number" && text.replace(/[^0-9]/g, "").length > 15) return undefined;
  try { return new Decimal(text).isFinite() ? new Decimal(text).toString() : undefined; }
  catch { return undefined; }
}

function continuation(payload: unknown, count: number, cap: number) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const p = payload as Record<string, unknown>;
  const nested = p.properties && typeof p.properties === "object" && !Array.isArray(p.properties)
    ? p.properties as Record<string, unknown> : {};
  const reasons: string[] = [];
  if ([p, nested].some((value) => value.truncated === true || value.isTruncated === true || value.partial === true || value.hasMore === true ||
      (typeof value.skipToken === "string" && value.skipToken.length > 0) ||
      (typeof value.nextLink === "string" && value.nextLink.length > 0) ||
      (typeof value.nextToken === "string" && value.nextToken.length > 0))) reasons.push("A fonte indicou continuação ou truncamento; páginas adicionais não foram chamadas automaticamente.");
  const total = p.totalRecords ?? p.totalCount ?? nested.totalRecords ?? nested.totalCount;
  if (typeof total === "number" && Number.isFinite(total) && total > count) reasons.push("A contagem total da fonte excede as linhas recebidas.");
  if (count >= cap && typeof total !== "number") reasons.push("O limite conservador de linhas foi atingido sem total que comprove completude.");
  return [...new Set(reasons)];
}

export function adaptAzureArmCostResult(input: {
  payload: unknown; scope: string; period: FinOpsPeriod; metric: AzureCostMetric; serverId: string;
}): AdaptedAzureRows<any> {
  const source = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
    ? input.payload as Record<string, unknown> : undefined;
  const rows = costRows(source);
  if (!rows) throw new AppError("unsupported", "Resposta ARM MCP não corresponde ao contrato de linhas FinOps suportado.");
  if (rows.length > 5000) throw new AppError("unsupported", "Resposta ARM MCP excede o limite absoluto de linhas.");
  const reasons = continuation(source, rows.length, 100);
  const adaptedRows: any[] = [];
  let rejectedRows = 0;
  const seen = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const amount = decimalText(metricValue(row, input.metric));
    const currency = row.currency ?? row.Currency ?? row.currencyCode;
    const resourceId = row.resourceId ?? row.ResourceId ?? row.id;
    const rowScope = row.scope ?? row.Scope;
    if (!amount || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) ||
        (resourceId !== null && resourceId !== undefined &&
          (!boundedString(resourceId) || !resourceBelongsToScope(input.scope, resourceId))) ||
        (rowScope !== undefined && (typeof rowScope !== "string" || rowScope.toLowerCase() !== input.scope.toLowerCase()))) {
      rejectedRows++;
      adaptedRows.push({ lineId: `azure-row-${index + 1}` });
      continue;
    }
    const originalResourceId = typeof resourceId === "string" ? resourceId : undefined;
    const canonicalResourceId = originalResourceId?.toLowerCase();
    const key = JSON.stringify([canonicalResourceId ?? null, currency]);
    const fingerprint = JSON.stringify([amount, input.metric]);
    const old = seen.get(key);
    if (old !== undefined) {
      if (old !== fingerprint) {
        rejectedRows++;
        reasons.push("Linhas repetidas para a mesma identidade e moeda possuem valores conflitantes.");
        adaptedRows.push({ lineId: `azure-row-${index + 1}` });
      } else reasons.push("Linha duplicada exata removida do total para evitar dupla contagem.");
      continue;
    }
    seen.set(key, fingerprint);
    const sourceIdentity = createHash("sha256").update(JSON.stringify([input.scope.toLowerCase(), input.period, input.metric, index, canonicalResourceId ?? null, currency, amount])).digest("hex").slice(0, 32);
    adaptedRows.push({
      lineId: `azure-query-${sourceIdentity}`,
      provider: "Azure",
      scope: input.scope,
      resourceId: canonicalResourceId ?? null,
      ...(originalResourceId && originalResourceId !== canonicalResourceId ? { originalResourceId } : {}),
      period: input.period,
      currency,
      amount,
      classification: ["usage", "credit", "shared"].includes(String(row.classification))
        ? row.classification
        : "unclassified",
      evidenceRef: `azure-arm-mcp:${input.serverId}:query_costs:row-${index + 1}`,
    });
  }
  if (rejectedRows) reasons.push(`${rejectedRows} linha(s) não satisfizeram o contrato; foram preservadas como inválidas.`);
  return { rows: adaptedRows, status: rejectedRows || reasons.length ? "partial" : "complete", reasons, rejectedRows };
}

export function adaptAzureArmInventoryResult(input: {
  payload: unknown; scope: string; serverId: string;
}): AdaptedAzureRows<any> {
  const source = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
    ? input.payload as Record<string, unknown> : undefined;
  const rows = objectRows(source);
  if (!rows) throw new AppError("unsupported", "Resposta Azure Resource Graph não corresponde ao contrato de inventário suportado.");
  if (rows.length > 5000) throw new AppError("unsupported", "Resposta de inventário excede o limite absoluto de linhas.");
  const reasons = continuation(source, rows.length, 250);
  const inventoryRows: any[] = [];
  let rejectedRows = 0;
  for (const [index, row] of rows.entries()) {
    const resourceId = row.id ?? row.resourceId;
    const name = row.name;
    const resourceType = row.type ?? row.resourceType;
    const resourceGroup = row.resourceGroup;
    const subscriptionId = row.subscriptionId;
    const scopeParts = parsedArmScope(input.scope);
    const inScope = typeof subscriptionId === "string" && subscriptionId.toLowerCase() === scopeParts.subscriptionId.toLowerCase() &&
      (!scopeParts.resourceGroup || (typeof resourceGroup === "string" && resourceGroup.toLowerCase() === scopeParts.resourceGroup.toLowerCase())) &&
      boundedString(resourceId) && resourceBelongsToScope(input.scope, resourceId);
    if (!inScope || !boundedString(resourceId) || !boundedString(name, 256) || !boundedString(resourceType, 256)) {
      rejectedRows++;
      inventoryRows.push({ inventoryId: `azure-inventory-row-${index + 1}` });
      continue;
    }
    const canonicalResourceId = resourceId.toLowerCase();
    const ref = createHash("sha256").update(canonicalResourceId).digest("hex").slice(0, 32);
    inventoryRows.push({
      inventoryId: `azure-resource-${ref}`,
      provider: "Azure",
      scope: input.scope,
      resourceId,
      ...(canonicalResourceId !== resourceId ? { canonicalResourceId } : {}),
      resourceType,
      name,
      ...(typeof row.location === "string" ? { region: row.location } : {}),
      ...(typeof resourceGroup === "string" ? { group: resourceGroup } : {}),
      evidenceRef: `azure-arm-mcp:${input.serverId}:execute_query:resource-${ref}`,
    });
  }
  if (rejectedRows) reasons.push(`${rejectedRows} recurso(s) fora do escopo ou incompatíveis; foram preservados como inválidos.`);
  return { rows: inventoryRows, status: rejectedRows || reasons.length ? "partial" : "complete", reasons, rejectedRows };
}
