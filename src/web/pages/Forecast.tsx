import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Scope, DateRange, CostQuery } from "../../shared/contracts.js";
import type { ForecastResult } from "../../shared/forecast.js";
import { api, money } from "../api.js";
export function Forecast({
  scope,
  period,
  basis,
  onMonth,
}: {
  scope?: Scope;
  period: DateRange;
  basis: CostQuery["basis"];
  onMonth: () => void;
}) {
  const [result, setResult] = useState<ForecastResult>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [includeActual, setIncludeActual] = useState(false);
  const active = useRef<AbortController | null>(null);
  const [currency, setCurrency] = useState("");
  const currencies = useMemo(
    () => [...new Set((result?.rows || []).map((r) => r.currency))],
    [result],
  );
  const activeCurrency = currencies.includes(currency)
    ? currency
    : currencies[0] || "";
  const chartData = useMemo(() => {
    const byDate = new Map<
      string,
      { date: string; actual?: number; forecast?: number }
    >();
    for (const r of result?.rows || []) {
      if (r.currency !== activeCurrency) continue;
      const key = r.date,
        item = byDate.get(key) || { date: key },
        value = (Number(r.amount) || 0) + 0;
      if (r.costStatus === "Forecast")
        item.forecast = (item.forecast || 0) + value;
      else item.actual = (item.actual || 0) + value;
      byDate.set(key, item);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [result, activeCurrency]);
  useEffect(() => {
    active.current?.abort();
    setResult(undefined);
    setError("");
    setBusy(false);
    return () => active.current?.abort();
  }, [scope, period, basis, includeActual]);
  async function run() {
    if (!scope) return;
    active.current?.abort();
    const c = new AbortController();
    active.current = c;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const r = await api.forecast(
        { scope, period, basis, includeActual },
        c.signal,
      );
      if (!c.signal.aborted) setResult(r);
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <h2>Previsão de custos — Forecast</h2>
      <p>
        Previsão calculada pelo Azure Cost Management para o período
        selecionado. Não é gasto realizado nem fatura. Use o mês atual para
        projetar o restante do mês; pode faltar histórico suficiente para a
        previsão.
      </p>
      <div className="toolbar">
        <button onClick={onMonth}>Usar mês atual na previsão</button>
        <label className="consent">
          <input
            type="checkbox"
            checked={includeActual}
            onChange={(e) => setIncludeActual(e.target.checked)}
          />
          Incluir realizados, apresentados separadamente
        </label>
        <button disabled={!scope || busy} onClick={() => void run()}>
          {busy ? "Consultando previsão…" : "Consultar previsão Azure"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <section aria-label="Resultado da previsão">
          <p>
            {result.meta.source} · {period.from} a {period.toExclusive}{" "}
            (exclusivo) · {result.basis}
          </p>
          {result.meta.warnings.map((w) => (
            <p className="notice" key={w}>
              {w}
            </p>
          ))}
          <h3>
            Valores previstos
            {result.meta.status === "partial" ? " — parciais" : ""}
          </h3>
          {!result.forecastTotals.length ? (
            <p>Previsão indisponível. Não é uma previsão de custo zero.</p>
          ) : (
            result.forecastTotals.map((t) => (
              <p key={t.currency}>
                {money(t.amount, t.currency)} ({t.currency})
              </p>
            ))
          )}
          {!!result.actualTotals.length && (
            <>
              <h3>Valores realizados retornados pelo Azure</h3>
              {result.actualTotals.map((t) => (
                <p key={t.currency}>
                  {money(t.amount, t.currency)} ({t.currency})
                </p>
              ))}
            </>
          )}
          {chartData.length > 0 && (
            <>
              <div className="chart-head">
                <h3>Evolução prevista</h3>
                {currencies.length > 1 && (
                  <label>
                    Moeda
                    <select
                      value={activeCurrency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      {currencies.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="chart" aria-label="Gráfico da previsão">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(s) => String(s).slice(5)}
                      fontSize={11}
                    />
                    <YAxis axisLine={false} tickLine={false} fontSize={11} />
                    <Tooltip
                      formatter={(v) => money(String(v), activeCurrency)}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      name="Realizado"
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.12}
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Previsto"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Moeda</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>
                    {r.costStatus === "Forecast" ? "Previsto" : "Realizado"}
                  </td>
                  <td>{r.currency}</td>
                  <td>{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
