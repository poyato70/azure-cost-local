import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { CostQuery, CostResult } from "../../shared/contracts.js";
import { api, money } from "../api.js";
import { Empty, StatusPanel } from "../components/StatusPanel.js";
export function Costs({
  query,
  connected,
}: {
  query?: CostQuery;
  connected: boolean;
}) {
  const [result, setResult] = useState<CostResult>(),
    [comparison, setComparison] = useState<
      { currency: string; delta: string; percent: string | null }[]
    >([]),
    [currency, setCurrency] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [compareError, setCompareError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    setResult(undefined);
    setComparison([]);
    setError("");
    setCompareError("");
    if (!version || !query || !connected) return;
    const c = new AbortController();
    setBusy(true);
    api
      .queryCosts(query, c.signal)
      .then(async (r) => {
        if (c.signal.aborted) return;
        setResult(r);
        setCurrency(r.totals[0]?.currency || "");
        try {
          const comparison = await api.compare(query, c.signal);
          if (!c.signal.aborted) {
            setComparison(comparison.comparison);
            if (comparison.warnings?.length)
              setCompareError(comparison.warnings.join(" "));
          }
        } catch (e) {
          if (!c.signal.aborted)
            setCompareError(
              "Comparação anterior indisponível: " + (e as Error).message,
            );
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => {
      c.abort();
      setBusy(false);
    };
  }, [query, version, connected]);
  const data = useMemo(() => {
    const byDate = new Map<string, Decimal>();
    for (const r of result?.rows || [])
      if (r.currency === currency)
        byDate.set(
          r.date,
          (byDate.get(r.date) || new Decimal(0)).plus(r.amount),
        );
    return [...byDate]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, amount: v.toNumber() }));
  }, [result, currency]);
  const table = useMemo(() => {
    const groups = new Map<string, Decimal>();
    for (const r of result?.rows || [])
      if (r.currency === currency)
        groups.set(
          r.dimension,
          (groups.get(r.dimension) || new Decimal(0)).plus(r.amount),
        );
    return [...groups].sort((a, b) => b[1].comparedTo(a[1]));
  }, [result, currency]);
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Custos da nuvem</h2>
          <p>Entenda seu consumo, com a origem de cada valor.</p>
        </div>
        <button
          className="primary"
          disabled={!query || !connected || busy}
          onClick={() => setVersion((v) => v + 1)}
        >
          {busy ? "Consultando…" : "Consultar custos"}
        </button>
      </div>
      <p className="explanation">
        Real: cobranças registradas no período. Amortizado: distribui o custo
        dos compromissos ao longo do uso. Valores podem ser revisados até o
        fechamento.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {busy && <p role="status">Consultando o Azure…</p>}
      {result ? (
        <>
          <div className="metric-grid" data-testid="totals">
            {result.totals.map((t) => {
              const c = comparison.find((x) => x.currency === t.currency);
              return (
                <article className="metric" key={t.currency}>
                  <span>Total · {t.currency}</span>
                  <strong>{money(t.amount, t.currency)}</strong>
                  <small>
                    {c
                      ? `${c.percent === null ? "Sem base percentual" : `${Number(c.percent) > 0 ? "+" : ""}${c.percent}%`} · ${money(c.delta, t.currency)} vs. período anterior`
                      : busy
                        ? "Comparação em consulta"
                        : "Comparação indisponível"}
                  </small>
                </article>
              );
            })}
            {!result.totals.length && (
              <Empty
                title="Sem registros de custo neste período"
                text="O Azure retornou uma consulta vazia para este escopo."
              />
            )}
          </div>
          {compareError && <p className="notice">{compareError}</p>}
          {result.totals.length > 0 && (
            <>
              <div className="chart-head">
                <h3>Evolução do consumo</h3>
                <label>
                  Moeda
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
              <div className="chart">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#2d7964"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="#2d7964"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e8eeeb" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(s) => s.slice(5)}
                      fontSize={11}
                    />
                    <YAxis axisLine={false} tickLine={false} fontSize={11} />
                    <Tooltip formatter={(v) => money(String(v), currency)} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#2d7964"
                      strokeWidth={2.5}
                      fill="url(#fillCost)"
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
                        {query?.groupBy === "ResourceId"
                          ? "Recurso"
                          : "Serviço"}
                      </th>
                      <th>Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map(([name, value]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>{money(value.toString(), currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <StatusPanel meta={result.meta} />
        </>
      ) : (
        !busy && !error && <Empty />
      )}
    </>
  );
}
