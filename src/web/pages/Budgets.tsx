import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type {
  Scope,
  BudgetStatus,
  BudgetLocks,
} from "../../shared/contracts.js";
import { api, money } from "../api.js";
import { Empty, StatusPanel } from "../components/StatusPanel.js";
export function Budgets({ scope }: { scope?: Scope }) {
  const [result, setResult] = useState<BudgetStatus>(),
    [locks, setLocks] = useState<BudgetLocks>(),
    [locksError, setLocksError] = useState(""),
    [showAllTags, setShowAllTags] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const locksController = useRef<AbortController | null>(null);
  const chartData = useMemo(
    () =>
      (result?.items || [])
        .filter((b) => b.percent !== null)
        .map((b) => ({ name: b.name, percent: Number(b.percent) })),
    [result],
  );
  useEffect(() => {
    controller.current?.abort();
    setResult(undefined);
    setLocks(undefined);
    setLocksError("");
    setBusy(false);
    setError("");
    return () => {
      controller.current?.abort();
      locksController.current?.abort();
    };
  }, [scope]);
  async function loadLocks(all: boolean, signal: AbortSignal) {
    if (!scope) return;
    setLocksError("");
    try {
      const l = await api.getBudgetLocks(scope, all, signal);
      if (!signal.aborted) setLocks(l);
    } catch (e) {
      if (!signal.aborted) setLocksError((e as Error).message);
    }
  }
  async function load() {
    if (!scope) return;
    controller.current?.abort();
    locksController.current?.abort();
    const c = new AbortController();
    controller.current = c;
    locksController.current = c;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const [r] = await Promise.all([
        api.getBudgets(scope, c.signal),
        loadLocks(showAllTags, c.signal),
      ]);
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
            <>
              {chartData.length > 0 && (
                <div
                  className="chart"
                  aria-label="Gráfico de consumo dos budgets"
                >
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(160, chartData.length * 44 + 40)}
                  >
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid
                        horizontal={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        type="number"
                        domain={[
                          0,
                          (max: number) => Math.max(100, Math.ceil(max)),
                        ]}
                        tickFormatter={(v) => v + "%"}
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={160}
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip formatter={(v) => v + "% utilizado"} />
                      <ReferenceLine
                        x={80}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                      />
                      <ReferenceLine
                        x={100}
                        stroke="#dc2626"
                        strokeDasharray="4 4"
                      />
                      <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
                        {chartData.map((d) => (
                          <Cell
                            key={d.name}
                            fill={
                              d.percent >= 100
                                ? "#dc2626"
                                : d.percent >= 80
                                  ? "#f59e0b"
                                  : "var(--primary)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
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
            </>
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
      {(locks || locksError) && (
        <section aria-label="Travas orçamentárias">
          <div className="chart-head">
            <h3>Travas orçamentárias (tags)</h3>
            <label className="consent">
              <input
                type="checkbox"
                disabled={busy}
                checked={showAllTags}
                onChange={(e) => {
                  setShowAllTags(e.target.checked);
                  const c = new AbortController();
                  locksController.current?.abort();
                  locksController.current = c;
                  void loadLocks(e.target.checked, c.signal);
                }}
              />
              Mostrar todas as tags
            </label>
          </div>
          {locksError && (
            <p role="alert" className="error">
              {locksError}
            </p>
          )}
          {locks && (
            <>
              <p className="fine">
                Tags da subscription, do resource group e de{" "}
                {locks.resourcesScanned} recurso(s) cuja chave contém budget,
                orçamento, trava, lock, limite, teto ou cota. Somente leitura.
              </p>
              {locks.meta.warnings.map((w) => (
                <p className="notice" key={w}>
                  {w}
                </p>
              ))}
              {!locks.items.length ? (
                <Empty
                  title="Nenhuma tag de trava encontrada"
                  text="Marque Mostrar todas as tags para ver todas as chaves existentes."
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nível</th>
                        <th>Nome</th>
                        <th>Tag</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locks.items.map((t, i) => (
                        <tr key={i}>
                          <td>
                            {t.level === "subscription"
                              ? "Subscription"
                              : t.level === "resourceGroup"
                                ? "Resource group"
                                : "Recurso"}
                          </td>
                          <td>{t.name}</td>
                          <td>{t.key}</td>
                          <td>{t.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
