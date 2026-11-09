import { Decimal } from "decimal.js";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandInput,
} from "@aws-sdk/client-cost-explorer";
import { fromIni } from "@aws-sdk/credential-providers";
import { BigQuery } from "@google-cloud/bigquery";
import {
  cloudQuerySchema,
  type CloudQuery,
  type CloudResult,
  type CloudRow,
} from "../../shared/multicloud.js";
import { AppError, assertActive } from "../errors.js";
import { fetchBound } from "../security/endpoint-policy.js";
import { sanitizeEvidence } from "./sanitize.js";
export { consolidateCloudResults } from "../../shared/multicloud-summary.js";
const MoneyDecimal = Decimal.clone({ precision: 48 });

function amount(v: unknown): string {
  if (typeof v !== "string" && typeof v !== "number")
    throw new AppError(
      "upstream",
      "O provedor não retornou um valor financeiro válido.",
    );
  const n = new MoneyDecimal(v);
  if (!n.isFinite() || n.abs().greaterThan("1e24") || n.decimalPlaces() > 18)
    throw new AppError(
      "upstream",
      "Valor financeiro inválido ou fora do limite de precisão (24 inteiros, 18 decimais).",
    );
  return n.toFixed();
}
function result(
  provider: CloudResult["provider"],
  scope: string,
  q: Pick<CloudQuery, "from" | "toExclusive">,
  basis: string,
  layer: CloudResult["layer"],
  rows: CloudRow[],
  raw: unknown,
  warnings: string[],
): CloudResult {
  const totals = new Map<string, Decimal>();
  for (const row of rows)
    totals.set(
      row.currency,
      (totals.get(row.currency) || new MoneyDecimal(0)).plus(row.amount),
    );
  return sanitizeEvidence({
    provider,
    scope,
    from: q.from,
    toExclusive: q.toExclusive,
    basis,
    layer,
    rows,
    totals: [...totals].map(([currency, value]) => ({
      currency,
      amount: value.toFixed(),
    })),
    raw,
    warnings,
    queriedAt: new Date().toISOString(),
  });
}
export async function queryAws(
  q: Extract<CloudQuery, { provider: "aws" }>,
  signal: AbortSignal,
  send: (input: GetCostAndUsageCommandInput) => Promise<any>,
): Promise<CloudResult> {
  const rows: CloudRow[] = [],
    raw: unknown[] = [],
    warnings = new Set<string>();
  const tokens = new Set<string>();
  let token: string | undefined;
  for (let page = 0; page < 100; page++) {
    assertActive(signal);
    const response = await send({
      TimePeriod: { Start: q.from, End: q.toExclusive },
      Granularity: "DAILY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      ...(q.accountId
        ? {
            Filter: {
              Dimensions: { Key: "LINKED_ACCOUNT", Values: [q.accountId] },
            },
          }
        : {}),
      ...(token ? { NextPageToken: token } : {}),
    });
    assertActive(signal);
    raw.push(response);
    if (!Array.isArray(response.ResultsByTime))
      throw new AppError("upstream", "Resposta AWS incompleta.");
    for (const period of response.ResultsByTime || []) {
      if (period.Estimated)
        warnings.add(
          "A AWS marcou parte dos valores como estimativa sujeita a revisão.",
        );
      for (const group of period.Groups || []) {
        const m = group.Metrics?.UnblendedCost;
        if (!m?.Unit || !period.TimePeriod?.Start)
          throw new AppError("upstream", "Resposta AWS incompleta.");
        rows.push({
          date: period.TimePeriod.Start,
          service: String(group.Keys?.[0] || "Sem serviço"),
          amount: amount(m.Amount),
          currency: m.Unit,
        });
      }
    }
    token = response.NextPageToken;
    if (!token)
      return result(
        "aws",
        q.accountId || `Perfil ${q.profile}`,
        q,
        "UnblendedCost",
        "billing",
        rows,
        raw,
        [...warnings],
      );
    if (tokens.has(token))
      throw new AppError(
        "upstream",
        "A AWS repetiu um token de paginação. Reduza o período.",
      );
    tokens.add(token);
  }
  throw new AppError(
    "limit_exceeded",
    "Limite de páginas AWS atingido. Reduza o período.",
  );
}
export function gcpSql(table: string) {
  const parsed = cloudQuerySchema.safeParse({
    provider: "gcp",
    projectId: "finops-project",
    table,
    from: "2026-01-01",
    toExclusive: "2026-02-01",
    confirmQueryCost: true,
  });
  if (!parsed.success)
    throw new AppError(
      "invalid_request",
      "Informe tabela no formato projeto.dataset.tabela, sem curingas.",
    );
  return `SELECT CAST(DATE(usage_start_time, 'UTC') AS STRING) AS date,
    service.description AS service, currency,
    CAST(SUM(CAST(cost AS NUMERIC) + IFNULL((SELECT SUM(CAST(c.amount AS NUMERIC)) FROM UNNEST(credits) c), 0)) AS STRING) AS amount
    FROM \`${table}\` WHERE usage_start_time >= TIMESTAMP(@from) AND usage_start_time < TIMESTAMP(@to)
    GROUP BY date, service, currency ORDER BY date, service LIMIT 10001`;
}
export function normalizeGcp(
  data: any[],
  q: Extract<CloudQuery, { provider: "gcp" }>,
) {
  if (data.length > 10000)
    throw new AppError(
      "limit_exceeded",
      "Resultado GCP excede 10 mil linhas. Reduza o período.",
    );
  const rows = data.map((r) => {
    if (!r.date || !r.currency || !r.service)
      throw new AppError("upstream", "Resposta BigQuery incompleta.");
    return {
      date: String(r.date),
      service: String(r.service),
      currency: String(r.currency),
      amount: amount(r.amount),
    };
  });
  return result(
    "gcp",
    q.table,
    q,
    "NetCostIncludingCredits",
    "billing",
    rows,
    data,
    [
      "Exportação Cloud Billing: custo líquido inclui créditos; dados podem chegar com atraso. Período UTC. Consulta BigQuery pode gerar cobrança.",
    ],
  );
}
export function normalizeOpenCost(
  body: any,
  q: Extract<CloudQuery, { provider: "kubernetes" }>,
  secrets: string[] = [],
) {
  if (body.code !== 200 || !Array.isArray(body.data))
    throw new AppError(
      "upstream",
      "OpenCost recusou a consulta ou retornou formato inesperado.",
    );
  const rows: CloudRow[] = [];
  for (const bucket of body.data)
    for (const [name, allocation] of Object.entries(bucket || {})) {
      const a = allocation as any;
      rows.push({
        date: q.from,
        service: String(a.name || name),
        currency: q.currency,
        amount: amount(a.totalCost),
      });
    }
  const destination = new URL(q.endpoint);
  return sanitizeEvidence(
    result(
      "kubernetes",
      destination.origin + destination.pathname.replace(/\/$/, ""),
      q,
      "OpenCostAllocation",
      "allocation",
      rows,
      body,
      [
        "Alocação por namespace no período completo. Moeda declarada pelo operador: confira a configuração do OpenCost. Não somar à fatura da nuvem subjacente. OpenShift requer OpenCost compatível implantado e autorizado no cluster.",
      ],
    ),
    secrets,
  );
}
export async function queryCloud(
  input: CloudQuery,
  signal: AbortSignal,
  readSecret?: (ref: string) => Promise<string>,
): Promise<CloudResult> {
  const q = cloudQuerySchema.parse(input);
  assertActive(signal);
  try {
    if (q.provider === "aws") {
      const client = new CostExplorerClient({
        region: "us-east-1",
        credentials: fromIni({ profile: q.profile }),
        maxAttempts: 2,
      });
      try {
        return await queryAws(q, signal, (input) =>
          client.send(new GetCostAndUsageCommand(input), {
            abortSignal: signal,
          }),
        );
      } finally {
        client.destroy();
      }
    }
    if (q.provider === "gcp") {
      const client = new BigQuery({ projectId: q.projectId });
      const [job] = await client.createQueryJob({
        query: gcpSql(q.table),
        params: { from: q.from, to: q.toExclusive },
        location: q.location,
        maximumBytesBilled: String(q.maximumBytesBilled),
        useLegacySql: false,
        jobTimeoutMs: 90000,
      });
      const cancel = () => {
        void job.cancel().catch(() => {});
      };
      signal.addEventListener("abort", cancel, { once: true });
      try {
        if (signal.aborted) {
          cancel();
          assertActive(signal);
        }
        const [rows] = await job.getQueryResults();
        assertActive(signal);
        return normalizeGcp(rows, q);
      } finally {
        signal.removeEventListener("abort", cancel);
      }
    }
    const url = new URL(q.endpoint);
    if (url.search || url.hash || url.username || url.password)
      throw new AppError(
        "invalid_endpoint",
        "Informe a URL base OpenCost sem credenciais, parâmetros ou fragmentos.",
      );
    url.pathname = url.pathname.replace(/\/$/, "") + "/allocation";
    url.searchParams.set(
      "window",
      `${q.from}T00:00:00Z,${q.toExclusive}T00:00:00Z`,
    );
    url.searchParams.set("aggregate", "namespace");
    url.searchParams.set("accumulate", "true");
    const headers: Record<string, string> = {};
    const secrets: string[] = [];
    if (q.secretRef) {
      if (!readSecret)
        throw new AppError(
          "auth_configuration",
          "Configure a referência protegida do token OpenCost.",
        );
      const token = await readSecret(q.secretRef);
      secrets.push(token);
      headers.Authorization = "Bearer " + token;
    }
    const response = await fetchBound(
      url.toString(),
      { signal, headers },
      q.allowPrivateNetwork,
    );
    if (!response.ok)
      throw new AppError(
        "upstream",
        `OpenCost respondeu HTTP ${response.status}. Confira endpoint e autorização.`,
      );
    const body = await response.json();
    assertActive(signal);
    return normalizeOpenCost(body, q, secrets);
  } catch (e) {
    assertActive(signal);
    if (e instanceof AppError) throw e;
    throw new AppError(
      "upstream",
      q.provider === "aws"
        ? "AWS: confira o perfil local/SSO, a sessão válida, ce:GetCostAndUsage e o acesso ao Cost Explorer."
        : q.provider === "gcp"
          ? "GCP: confira ADC, localização, exportação Cloud Billing, permissões BigQuery e limite de bytes. A consulta pode ter sido cobrada pelo provedor."
          : "OpenCost: confira o endpoint, a rede autorizada e o serviço de alocação.",
      502,
    );
  }
}
