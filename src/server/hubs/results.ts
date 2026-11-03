import { Decimal } from "decimal.js";
import { AppError } from "../errors.js";
export function kustoRows(raw: any): Record<string, unknown>[] {
  if (
    raw?.error ||
    raw?.hasErrors ||
    (Array.isArray(raw?.Exceptions) && raw.Exceptions.length)
  )
    throw new AppError(
      "hub_partial",
      "O Hub informou erro ou resposta parcial.",
      502,
    );
  const tables = raw?.Tables;
  if (!Array.isArray(tables))
    throw new AppError(
      "hub_schema",
      "Resposta sem tabelas Kusto reconhecidas.",
      502,
    );
  if (tables.some((t: any) => t.TableName === "QueryStatus" && t.Rows?.length))
    throw new AppError(
      "hub_partial",
      "O Hub informou consulta parcial ou erro.",
      502,
    );
  const t =
    tables.find((t: any) => t.TableName === "PrimaryResult") ||
    tables.find((t: any) => t.TableName === "Table_0");
  if (
    !t ||
    !Array.isArray(t.Columns) ||
    !Array.isArray(t.Rows) ||
    t.Rows.length > 10000
  )
    throw new AppError(
      "hub_schema",
      "Tabela financeira ausente ou acima do limite.",
      502,
    );
  const names = t.Columns.map((c: any) => c.ColumnName);
  if (
    names.some((n: any) => typeof n !== "string") ||
    new Set(names).size !== names.length
  )
    throw new AppError("hub_schema", "Colunas inválidas.", 502);
  return t.Rows.map((r: any[]) => {
    if (!Array.isArray(r) || r.length !== names.length)
      throw new AppError("hub_schema", "Linha inválida.", 502);
    return Object.fromEntries(names.map((n: string, i: number) => [n, r[i]]));
  });
}
export function amount(v: unknown) {
  if (
    typeof v !== "string" ||
    !/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(v) ||
    !new Decimal(v).isFinite()
  )
    throw new AppError("hub_schema", "Valor monetário exato ausente.", 502);
  return new Decimal(v).toString();
}

export function mcpHubRows(raw: any): Record<string, unknown>[] {
  if (
    raw?.partial ||
    raw?.error ||
    (raw?.status !== undefined && raw.status !== 200)
  )
    throw new AppError(
      "hub_partial",
      "O comando MCP informou falha ou truncamento.",
      502,
    );
  const items = raw?.results?.items ?? raw?.items;
  if (items !== undefined) {
    if (
      !Array.isArray(items) ||
      items.length > 10000 ||
      items.some((x) => !x || typeof x !== "object" || Array.isArray(x))
    )
      throw new AppError("hub_schema", "Linhas MCP inválidas.", 502);
    return items;
  }
  return kustoRows(raw);
}
