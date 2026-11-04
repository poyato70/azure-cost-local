import { useEffect, useRef, useState } from "react";
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
