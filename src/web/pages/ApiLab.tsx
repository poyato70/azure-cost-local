import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Decimal } from "decimal.js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CostQuery, CostResult } from "../../shared/contracts.js";
import {
  aggregateCostsByDate,
  aggregateCostsByDimension,
} from "../../shared/cost-presentation.js";
import { api, money } from "../api.js";
import { DiagnosticPanel } from "./Diagnostics.js";

export function ApiLab({
  query,
  setGroupBy,
  setGranularity,
  subscriptionLabel,
}: {
  query?: CostQuery;
  setGroupBy: (value: CostQuery["groupBy"]) => void;
  setGranularity: (value: CostQuery["granularity"]) => void;
  subscriptionLabel: string;
}) {
  const [op, setOp] = useState("costs");
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<"amount" | "dimension">("amount");
  const [ascending, setAscending] = useState(false);
  const [currency, setCurrency] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setResult(undefined);
    setError("");
    setCopyMessage("");
    setBusy(false);
    return () => controller.current?.abort();
  }, [query, op]);

  const costResult =
    op === "costs" ? (result as CostResult | undefined) : undefined;
  const currencies = useMemo(
    () =>
      [...new Set(costResult?.rows.map((row) => row.currency) || [])].sort(),
    [costResult],
  );
  useEffect(() => {
    if (currencies.length && !currencies.includes(currency))
      setCurrency(currencies[0]);
  }, [currencies, currency]);
  const series = useMemo(
    () =>
      costResult && currency ? aggregateCostsByDate(costResult, currency) : [],
    [costResult, currency],
  );
  const dimensions = useMemo(() => {
    if (!costResult || !currency) return [];
    return aggregateCostsByDimension(costResult, currency).sort((a, b) => {
      const order =
        sort === "amount"
          ? new Decimal(b.amount).comparedTo(a.amount)
          : a.dimension.localeCompare(b.dimension, "pt-BR");
      return ascending ? -order : order;
    });
  }, [costResult, currency, sort, ascending]);
  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, string>();
    for (const row of costResult?.rows || []) {
      const prior = new Decimal(totals.get(row.currency) || "0");
      totals.set(row.currency, prior.plus(row.amount).toString());
    }
    return [...totals].map(([code, amount]) => ({ code, amount }));
  }, [costResult]);

  async function copyTechnicalResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopyMessage("Detalhes técnicos copiados.");
    } catch {
      setCopyMessage("Não foi possível copiar os detalhes técnicos.");
    }
  }

  return (
    <>
      <section
        className="api-query-controls"
        aria-label="Parâmetros da consulta Azure"
      >
        <label>
          Agrupar por
          <select
            aria-label="Agrupar custos por"
            value={query?.groupBy || "ServiceName"}
            onChange={(event) =>
              setGroupBy(event.target.value as CostQuery["groupBy"])
            }
          >
            <option value="ServiceName">Serviço</option>
            <option value="ResourceId">Recurso</option>
          </select>
        </label>
        <label>
          Granularidade
          <select
            aria-label="Granularidade da consulta"
            value={query?.granularity || "Daily"}
            onChange={(event) =>
              setGranularity(event.target.value as CostQuery["granularity"])
            }
          >
            <option value="Daily">Diária</option>
            <option value="Monthly">Mensal</option>
          </select>
        </label>
        <label>
          Operação Azure
          <select value={op} onChange={(event) => setOp(event.target.value)}>
            <option value="costs">Custos</option>
            <option value="budgets">Budgets</option>
            <option value="tags">Tags atuais ARM</option>
          </select>
        </label>
      </section>
      <p className="api-query-context">
        Consulta Azure REST · Base{" "}
        {query?.basis === "AmortizedCost" ? "Amortizado" : "Real"} ·{" "}
        {subscriptionLabel || "Subscription selecionada"}
        {query?.scope.resourceGroup
          ? ` · RG ${query.scope.resourceGroup}`
          : " · Subscription inteira"}
      </p>
      <button
        type="button"
        className="primary api-test-button"
        disabled={!query || busy}
        onClick={async () => {
          if (!query) return;
          controller.current?.abort();
          const current = new AbortController();
          controller.current = current;
          setBusy(true);
          setError("");
          setResult(undefined);
          setCopyMessage("");
          try {
            const data =
              op === "costs"
                ? await api.queryCosts(query, current.signal)
                : op === "tags"
                  ? await api.getBudgetLocks(query.scope, true, current.signal)
                  : await api.getBudgets(query.scope, current.signal);
            if (!current.signal.aborted) setResult(data);
          } catch (cause) {
            if (!current.signal.aborted) setError((cause as Error).message);
          } finally {
            if (!current.signal.aborted) setBusy(false);
          }
        }}
      >
        {busy
          ? "Consultando Azure…"
          : op === "costs"
            ? "Consultar custos no escopo selecionado"
            : op === "tags"
              ? "Consultar tags no escopo selecionado"
              : "Consultar budgets no escopo selecionado"}
      </button>
      {!query && (
        <p>
          Conecte uma identidade e escolha subscription/RG antes da consulta
          Azure.
        </p>
      )}
      {busy && (
        <p className="api-state api-state--loading" role="status">
          Consulta em andamento. Aguarde a resposta da API Azure.
        </p>
      )}
      {error && (
        <p role="alert" className="error api-state">
          A consulta não foi concluída. {error}
        </p>
      )}
      {costResult && (
        <section
          className="api-finops-result"
          aria-label="Resultado financeiro Azure"
        >
          <header className="api-result-heading">
            <div>
              <span
                className={`api-result-state api-result-state--${costResult.meta.status}`}
              >
                {costResult.meta.status === "complete"
                  ? "Consulta completa"
                  : costResult.meta.status === "partial"
                    ? "Resultado parcial"
                    : "Indisponível"}
              </span>
              <h2>Custos no período</h2>
              <p>
                {costResult.meta.period?.from || query?.period.from} a{" "}
                {costResult.meta.period
                  ? new Date(
                      Date.parse(
                        `${costResult.meta.period.toExclusive}T00:00:00Z`,
                      ) - 86400000,
                    )
                      .toISOString()
                      .slice(0, 10)
                  : ""}{" "}
                · {query?.granularity === "Monthly" ? "mensal" : "diário"} ·{" "}
                {query?.groupBy === "ResourceId"
                  ? "por recurso"
                  : "por serviço"}
              </p>
            </div>
            <button
              type="button"
              className="copy-action"
              onClick={() => void copyTechnicalResult()}
              title="Copiar JSON técnico"
            >
              {copyMessage ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}{" "}
              Copiar detalhes
            </button>
            <span className="copy-feedback" role="status">
              {copyMessage}
            </span>
          </header>
          <div className="api-result-meta">
            <span>
              Escopo: {subscriptionLabel || "subscription selecionada"}
              {query?.scope.resourceGroup
                ? ` · ${query.scope.resourceGroup}`
                : " · inteira"}
            </span>
            <span>Fonte: {costResult.meta.source}</span>
            <span>Linhas retornadas: {costResult.rows.length}</span>
            <span>Paginação não informada pelo contrato desta resposta</span>
          </div>
          {totalsByCurrency.length ? (
            <div className="api-total-grid">
              {totalsByCurrency.map(({ code, amount }) => (
                <article className="metric" key={code}>
                  <span>
                    {costResult.meta.status === "complete"
                      ? "Total"
                      : "Subtotal · resultado parcial"}{" "}
                    · {code}
                  </span>
                  <strong>{money(amount, code)}</strong>
                  <small>
                    Base{" "}
                    {costResult.basis === "ActualCost" ? "Real" : "Amortizada"}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="api-empty-result">
              Azure não retornou linhas de custo para este escopo e período.
            </p>
          )}
          {costResult.meta.warnings.map((warning, index) => (
            <p className="notice" key={index}>
              {warning}
            </p>
          ))}
          {currency && series.length > 0 && (
            <>
              {currencies.length > 1 && (
                <label className="api-currency-select">
                  Moeda
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  >
                    {currencies.map((code) => (
                      <option key={code}>{code}</option>
                    ))}
                  </select>
                </label>
              )}
              <h3>Evolução · {currency}</h3>
              <div className="api-cost-chart">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient
                        id="apiCostFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--primary)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--primary)"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => value.slice(5)}
                      fontSize={11}
                    />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(value) => money(String(value), currency)}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="var(--primary)"
                      fill="url(#apiCostFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <h3>Detalhamento · {currency}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <button
                          className="table-sort"
                          onClick={() => {
                            setSort("dimension");
                            setAscending(
                              sort === "dimension" ? !ascending : true,
                            );
                          }}
                        >
                          {query?.groupBy === "ResourceId"
                            ? "Recurso"
                            : "Serviço"}
                        </button>
                      </th>
                      <th>
                        <button
                          className="table-sort"
                          onClick={() => {
                            setSort("amount");
                            setAscending(
                              sort === "amount" ? !ascending : false,
                            );
                          }}
                        >
                          Custo
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((item) => (
                      <tr key={item.dimension}>
                        <td>{item.dimension}</td>
                        <td>{money(item.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="api-provenance">
            Atualizado em{" "}
            {new Date(costResult.meta.fetchedAt).toLocaleString("pt-BR")} ·
            Período informado pela API em UTC; apresentação do escopo usa a
            configuração local.
          </p>
          <details className="api-technical-details">
            <summary>Detalhes técnicos</summary>
            <pre>{JSON.stringify(costResult, null, 2)}</pre>
          </details>
        </section>
      )}
      {result && !costResult && (
        <section className="api-result-panel">
          <div className="api-result-toolbar">
            <strong>Resultado da leitura</strong>
            <button
              type="button"
              className="copy-action"
              onClick={() => void copyTechnicalResult()}
            >
              <Copy size={16} aria-hidden="true" /> Copiar
            </button>
            <span className="copy-feedback" role="status">
              {copyMessage}
            </span>
          </div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
      <section
        className="api-capabilities-info"
        aria-labelledby="api-capabilities-title"
      >
        <div className="api-info-heading">
          <span className="api-info-badge">Informação</span>
          <h2 id="api-capabilities-title">APIs — capacidades e testes</h2>
        </div>
        <p>
          Azure aceita usuário ou aplicação com Secret, conforme RBAC e
          permissões de billing. AWS usa perfil local; GCP usa ADC; OpenCost usa
          endpoint autorizado. O canal desta página é API, explicitamente.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Operações implementadas</th>
                <th>Autenticação / requisito</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Azure</td>
                <td>Custos, forecast, budgets, tags, benefícios</td>
                <td>Usuário ou Service Principal + RBAC/billing</td>
              </tr>
              <tr>
                <td>AWS</td>
                <td>GetCostAndUsage</td>
                <td>
                  Perfil/SSO; teste em Visão multicloud; pode gerar cobrança
                </td>
              </tr>
              <tr>
                <td>GCP</td>
                <td>Consulta exportação Cloud Billing</td>
                <td>
                  ADC + BigQuery; teste em Visão multicloud com limite de bytes
                  e consentimento de cobrança
                </td>
              </tr>
              <tr>
                <td>Kubernetes/OpenShift</td>
                <td>OpenCost allocation</td>
                <td>OpenCost implantado; teste em Visão multicloud</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <details>
        <summary>Logs da operação</summary>
        <DiagnosticPanel />
      </details>
    </>
  );
}
