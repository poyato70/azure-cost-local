import { authorizeArmScope } from "./arm-policy.js";
import { createHash } from "node:crypto";
import { AppError } from "../errors.js";
import { mcpPresentation } from "../../shared/mcp-presentation.js";
import type { McpProfile, ToolDescriptor } from "../../shared/connections.js";
export function descriptor(t: any): ToolDescriptor {
  const text = JSON.stringify({
    schema: t.inputSchema || {},
    annotations: t.annotations || {},
  });
  if (text.length > 65536)
    throw new AppError("unsupported", "Schema de ferramenta muito grande.");
  return {
    name: t.name,
    description: String(t.description || "").slice(0, 4000),
    inputSchema: t.inputSchema || {},
    schemaHash: createHash("sha256").update(text).digest("hex"),
    annotations: t.annotations,
  };
}
// Conservatively accept a small grammar; advanced queries are rejected rather than guessed safe.
export function validateQuery(q: string, preset: string) {
  if (q.length > 12000 || /[^\x20-\x7e\r\n\t]/.test(q))
    throw new AppError("unsupported", "Consulta fora do subconjunto seguro.");
  if (preset === "adx") {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(q.split("|")[0].trim()) ||
      q
        .split("|")
        .slice(1)
        .some(
          (stage) =>
            !/^(?:take\s+\d{1,6}|count|project\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*|(?:sort|order)\s+by\s+[A-Za-z_][A-Za-z0-9_]*(?:\s+(?:asc|desc))?)$/i.test(
              stage.trim(),
            ),
        )
    )
      throw new AppError(
        "forbidden",
        "KQL fora do escopo permitido; comandos e referências externas são bloqueados.",
        403,
      );
  } else if (preset === "powerbi") {
    if (
      !/^EVALUATE\s+(TOPN\(\s*\d+\s*,\s*[A-Za-z_][A-Za-z0-9_]*\s*\)|[A-Za-z_][A-Za-z0-9_]*)\s*$/i.test(
        q,
      )
    )
      throw new AppError(
        "forbidden",
        "DAX fora do subconjunto de consulta permitido.",
        403,
      );
  }
}
export function reviewable(p: McpProfile, t: ToolDescriptor) {
  const n = t.name.toLowerCase();
  if (
    /secret|password|token|credential|deploy|delete|create|update|execute_code|command|generate_query|list_tools|mcp_tool/.test(
      n,
    )
  )
    return false;
  if (["custom", "kubernetes"].includes(p.preset))
    return (
      t.annotations?.readOnlyHint === true &&
      t.annotations?.destructiveHint !== true
    );
  const patterns: Record<string, RegExp> = {
    arm: /^(query_costs|forecast_costs|list_budgets|get_budget|list_dimensions)$/,
    azure:
      /^(?:azmcp_)?(?:subscription_list|group_list|pricing_get|advisor_recommendation_list|optimization_recommendation_(?:list|alternatives|explain))$/,
    adx: /^(?:azmcp_)?kusto_(?:(?:cluster|database|table)_(?:get|list)|query|query_execute)$/,
    fabric:
      /^(?:list_workspaces|get_workspace|list_items|get_item|get_capacity|get_capacities|list_capacities)$/,
    powerbi:
      /^(?:get_semantic_model_schema|execute_query|get_report_metadata)$/,
  };
  return patterns[p.preset]?.test(n) ?? false;
}
export function authorizeTool(
  p: McpProfile,
  t: ToolDescriptor,
  args: Record<string, unknown>,
  registeredQuery?: string,
) {
  if (
    !reviewable(p, t) ||
    !p.approvedTools.some(
      (x) => x.name === t.name && x.schemaHash === t.schemaHash,
    )
  )
    throw new AppError(
      "forbidden",
      "Ferramenta não aprovada ou schema alterado. Revise a conexão.",
      403,
    );
  if (["custom", "kubernetes"].includes(p.preset)) return args;
  if (p.preset === "arm") {
    authorizeArmScope(p.resourceContext.scope || "", args);
    return args;
  }
  const canonical = (k: string) =>
    k
      .replace(/[-_]/g, "")
      .toLowerCase()
      .replace(/semanticmodel/g, "model");
  const context = Object.fromEntries(
    Object.entries(p.resourceContext).map(([k, v]) => [canonical(k), v]),
  );
  const supplied = new Set<string>();
  const scopeKey =
    /^(tenant(?:id)?|subscription(?:id)?|cluster(?:uri|id)?|database(?:id|name)?|workspace(?:id)?|model(?:id)?|resourcegroup(?:name)?|item(?:id)?|report(?:id)?|capacity(?:id)?)$/;
  const walk = (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      const k = canonical(key);
      if (scopeKey.test(k)) {
        if (
          typeof value !== "string" ||
          context[k] === undefined ||
          value !== context[k]
        )
          throw new AppError(
            "forbidden",
            "Recurso fora do contexto cadastrado.",
            403,
          );
        supplied.add(k);
      }
      if (/query|kql|dax/i.test(key)) {
        if (typeof value !== "string" || !["adx", "powerbi"].includes(p.preset))
          throw new AppError(
            "forbidden",
            "Consulta genérica não autorizada.",
            403,
          );
        if (value !== registeredQuery) validateQuery(value, p.preset);
      }
      if (value && typeof value === "object") {
        if (Array.isArray(value))
          throw new AppError(
            "forbidden",
            "Argumentos compostos não autorizados.",
            403,
          );
        walk(value as Record<string, unknown>);
      }
    }
  };
  walk(args);
  // A configured scope must be explicit in every invocation; global discovery cannot escape it.
  for (const k of Object.keys(context)) {
    if (scopeKey.test(k) && !supplied.has(k))
      throw new AppError(
        "forbidden",
        "Informe todos os recursos do contexto cadastrado.",
        403,
      );
  }
  if (
    ["fabric", "powerbi", "adx"].includes(p.preset) &&
    !Object.keys(context).some((k) => scopeKey.test(k))
  )
    throw new AppError(
      "forbidden",
      "Cadastre um escopo de recursos antes de consultar.",
      403,
    );
  return args;
}
export function safeToolResult(value: unknown) {
  const strip = (v: any): any => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .filter(
            ([k]) =>
              !/secret|password|access.?token|refresh.?token|authorization|credential/i.test(
                k,
              ),
          )
          .map(([k, v]) => [k, strip(v)]),
      );
    return v;
  };
  const sanitized = strip(value);
  const text = JSON.stringify(sanitized);
  return text.length > 131072
    ? {
        partial: true,
        message: "Resultado limitado a 128 kB.",
        text: text.slice(0, 120000),
        presentation: mcpPresentation(sanitized),
      }
    : JSON.parse(text);
}
