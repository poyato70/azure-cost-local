import { useEffect, useRef, useState } from "react";
import type { Scope, BudgetStatus } from "../../shared/contracts.js";
import { api, money } from "../api.js";
import { Empty, StatusPanel } from "../components/StatusPanel.js";
export function Budgets({ scope }: { scope?: Scope }) {
  const [result, setResult] = useState<BudgetStatus>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setResult(undefined);
    setBusy(false);
    setError("");
    return () => controller.current?.abort();
  }, [scope]);
  async function load() {
    if (!scope) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const r = await api.getBudgets(scope, c.signal);
      if (!c.signal.aborted) setResult(r);
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Budgets</h2>
          <p>Acompanhe limites e consumo do escopo selecionado.</p>
        </div>
        <button className="primary" disabled={!scope || busy} onClick={load}>
          {busy ? "Consultando…" : "Consultar budgets"}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <p className="budget-legend">
        Sinalização visual: atenção a partir de 80%; crítico a partir de 100%.
        Os alertas configurados no Azure permanecem independentes.
      </p>
      {result ? (
        <>
          {!result.items.length ? (
            <Empty
              title="Nenhum orçamento configurado"
              text="A consulta não encontrou budgets neste escopo."
            />
          ) : (
            <div className="budget-grid">
              {result.items.map((b) => (
                <article
                  className={`budget-card ${b.percent === null ? "unknown" : Number(b.percent) >= 100 ? "critical" : Number(b.percent) >= 80 ? "attention" : "normal"}`}
                  key={b.id}
                >
                  <span className="eyebrow">ORÇAMENTO</span>
                  <h3>{b.name}</h3>
                  <div className="budget-state">
                    {b.percent === null
                      ? "Consumo indisponível"
                      : Number(b.percent) >= 100
                        ? "Limite atingido ou excedido"
                        : Number(b.percent) >= 80
                          ? "Atenção ao consumo"
                          : "Abaixo de 80% do limite"}
                  </div>
                  <strong>
                    {b.spent === null
                      ? "Consumo indisponível"
                      : money(b.spent, b.currency)}{" "}
                    <small>
                      {b.spent === null
                        ? null
                        : `de ${money(b.amount, b.currency)}`}
                    </small>
                  </strong>
                  {b.percent !== null && (
                    <>
                      <progress
                        max="100"
                        value={Math.max(0, Math.min(100, Number(b.percent)))}
                      />
                      <p>{b.percent}% utilizado</p>
                    </>
                  )}
                  <p>{b.spendPeriodLabel}</p>
                  <p>
                    Vigência do orçamento: {b.period.from} a{" "}
                    {b.period.toExclusive}
                  </p>
                  <p>
                    Alertas: {b.thresholds.join("%, ")}
                    {b.thresholds.length ? "%" : "Não informados"}
                  </p>
                  {b.filters != null && (
                    <details>
                      <summary>Filtros do orçamento</summary>
                      <pre>{JSON.stringify(b.filters, null, 2)}</pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
          <StatusPanel meta={result.meta} />
        </>
      ) : (
        !error && (
          <Empty
            title="Seus limites, em perspectiva"
            text="Consulte os budgets da subscription ou do resource group selecionado."
          />
        )
      )}
    </>
  );
}
