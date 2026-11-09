import { useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { CloudResult } from "../../shared/multicloud.js";
export const providerNames = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  kubernetes: "Kubernetes / OpenShift",
};
export function CloudResults({ result }: { result: CloudResult }) {
  const [view, setView] = useState("chart"),
    [currency, setCurrency] = useState(result.totals[0]?.currency || "USD"),
    [search, setSearch] = useState("");
  const name = providerNames[result.provider];
  const rows = result.rows.filter(
    (r) =>
      r.currency === currency &&
      r.service.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const chart = useMemo(() => {
    const groups = new Map<string, Decimal>();
    for (const r of result.rows.filter((r) => r.currency === currency))
      groups.set(
        r.service,
        (groups.get(r.service) || new Decimal(0)).plus(r.amount),
      );
    return [...groups]
      .sort((a, b) => b[1].comparedTo(a[1]))
      .slice(0, 12)
      .map(([service, cost]) => ({ service, amount: cost.toNumber() }));
  }, [result, currency]);
  return (
    <article className="cloud-result">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            {result.layer === "allocation"
              ? "ALOCAÇÃO · NÃO SOMAR À FATURA"
              : "CUSTO DO PROVEDOR"}
          </span>
          <h3>
            {name} · {result.layer === "allocation" ? "alocação" : "custos"}
          </h3>
          <p className="scope-caption">{result.scope}</p>
        </div>
        <span className="badge">{result.basis}</span>
      </div>
      <div className="cloud-totals">
        {result.totals.length ? (
          result.totals.map((t) => (
            <div key={t.currency}>
              <small>{t.currency}</small>
              <strong>{new Decimal(t.amount).toFixed(2)}</strong>
            </div>
          ))
        ) : (
          <p>
            Sem registros no período. Isso não comprova ausência de cobrança
            fora desta fonte.
          </p>
        )}
      </div>
      <p className="evidence-caption">
        {result.from} → {result.toExclusive} (fim exclusivo) · Consultado em{" "}
        {new Date(result.queriedAt).toLocaleString("pt-BR")}
      </p>
      {result.warnings.map((w) => (
        <p className="notice" key={w}>
          {w}
        </p>
      ))}
      <div className="result-controls">
        <div
          className="view-switch"
          role="group"
          aria-label={`Visualização ${name}`}
        >
          {[
            ["chart", "Gráfico"],
            ["table", "Tabela"],
            ["json", "JSON"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={view === id}
              aria-label={`${label} ${name}`}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Moeda {name}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {result.totals.map((t) => (
              <option key={t.currency}>{t.currency}</option>
            ))}
          </select>
        </label>
      </div>
      {view === "chart" && (
        <>
          <p className="evidence-caption">
            Até 12 maiores serviços/namespace por moeda. Veja a tabela para
            todos os registros e precisão original.
          </p>
          {chart.length > 0 && (
            <div className="cloud-chart" aria-label={`Gráfico ${name}`}>
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, chart.length * 36)}
              >
                <BarChart
                  data={chart}
                  layout="vertical"
                  margin={{ left: 12, right: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="service"
                    type="category"
                    width={125}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="amount"
                    name={currency}
                    fill="#5b5ce2"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
      {view === "table" && (
        <>
          <label>
            Buscar serviço ou namespace
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="table-wrap">
            <table>
              <caption>
                {rows.length} registros · valores exatos na moeda de origem
              </caption>
              <thead>
                <tr>
                  <th>Data / início do período</th>
                  <th>Serviço / namespace</th>
                  <th>Moeda</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.service}</td>
                    <td>{r.currency}</td>
                    <td>{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {view === "json" && (
        <>
          <p>
            Resposta de consulta. Identificadores de recursos e valores podem
            ser confidenciais; revise antes de compartilhar.
          </p>
          <pre className="raw-data" tabIndex={0}>
            {JSON.stringify(result.raw, null, 2)}
          </pre>
        </>
      )}
    </article>
  );
}
