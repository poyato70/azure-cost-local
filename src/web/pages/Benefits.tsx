import { useEffect, useRef, useState } from "react";
import type { Scope, BenefitAnalysis } from "../../shared/contracts.js";
import { api, money } from "../api.js";
import { Empty, StatusPanel } from "../components/StatusPanel.js";
export function Benefits({ scope }: { scope?: Scope }) {
  const [kind, setKind] = useState<BenefitAnalysis["kind"]>("reservation"),
    [view, setView] = useState("recommendations"),
    [result, setResult] = useState<BenefitAnalysis>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setResult(undefined);
    setError("");
    setBusy(false);
    return () => controller.current?.abort();
  }, [scope, kind]);
  async function load() {
    if (!scope) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const r = await api.analyzeBenefits(scope, kind, c.signal);
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
          <h2>Compromissos de consumo</h2>
          <p>
            Compare recomendações oficiais com os benefícios atribuídos ao seu
            ambiente.
          </p>
        </div>
        <button className="primary" disabled={!scope || busy} onClick={load}>
          {busy ? "Analisando…" : "Analisar benefícios"}
        </button>
      </div>
      <div className="toolbar">
        <label>
          Tipo
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as BenefitAnalysis["kind"])}
          >
            <option value="reservation">Reservations</option>
            <option value="savingsPlan">Savings Plans</option>
          </select>
        </label>
        <div className="segmented">
          <button
            className={view === "recommendations" ? "selected" : ""}
            onClick={() => setView("recommendations")}
          >
            Simular contratação
          </button>
          <button
            className={view === "existing" ? "selected" : ""}
            onClick={() => setView("existing")}
          >
            Benefícios existentes
          </button>
        </div>
      </div>
      <p className="notice">
        Cenários oficiais usam histórico de consumo. Não some economias de
        alternativas ou benefícios sobrepostos.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {result ? (
        <>
          {view === "recommendations" ? (
            <>
              {!result.scenarios.length ? (
                <Empty
                  title="Nenhuma recomendação disponível"
                  text="Verifique as limitações retornadas pelo Azure abaixo."
                />
              ) : (
                <div className="budget-grid">
                  {result.scenarios.map((s, i) => (
                    <article className="budget-card" key={i}>
                      <span className="eyebrow">RECOMENDAÇÃO OFICIAL</span>
                      <h3>
                        {s.term === "P1Y"
                          ? "1 ano"
                          : s.term === "P3Y"
                            ? "3 anos"
                            : s.term}
                      </h3>
                      <p>
                        {s.sku || "SKU não informado"} ·{" "}
                        {s.location || "Região não informada"}
                      </p>
                      <p>
                        Quantidade recomendada: {s.quantity ?? "Não informada"}
                      </p>
                      <small>{s.id}</small>
                      <span>Economia estimada na janela histórica</span>
                      <strong
                        className={
                          s.estimatedSavings !== null && s.currency
                            ? "potential-savings"
                            : undefined
                        }
                      >
                        {s.estimatedSavings !== null && s.currency
                          ? money(s.estimatedSavings, s.currency)
                          : "Moeda/valor não informado"}
                      </strong>
                      <p>
                        Compromisso por hora:{" "}
                        {s.commitment !== null && s.currency
                          ? money(s.commitment, s.currency)
                          : "Não informado"}
                      </p>
                      <p>
                        Cobertura projetada: {s.coverage ?? "Não informada"}
                        {s.coverage !== null ? "%" : ""}
                      </p>
                      <p>
                        Utilização projetada: {s.utilization ?? "Não informada"}
                        {s.utilization !== null ? "%" : ""}
                      </p>
                      <details>
                        <summary>Premissas e referência</summary>
                        {s.assumptions.map((a, j) => (
                          <p key={j}>{a}</p>
                        ))}
                        <p>
                          Sem benefício:{" "}
                          {s.costWithout && s.currency
                            ? money(s.costWithout, s.currency)
                            : "Não informado"}
                        </p>
                        <p>
                          Com benefício:{" "}
                          {s.costWith && s.currency
                            ? money(s.costWith, s.currency)
                            : "Não informado"}
                        </p>
                      </details>
                    </article>
                  ))}
                </div>
              )}
              <p className="notice">
                Simulação detalhada indisponível sem dados horários e preços
                contratuais.
              </p>
            </>
          ) : (
            <>
              {!result.existing.length ? (
                <Empty
                  title="Sem benefícios atribuídos disponíveis"
                  text="Ausência neste escopo não comprova ausência de contratos na conta."
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Benefício</th>
                        <th>Custo amortizado atribuído</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.existing.map((b, i) => (
                        <tr key={i}>
                          <td>{String(b.name)}</td>
                          <td>
                            {b.amortizedCost != null && b.currency
                              ? money(
                                  String(b.amortizedCost),
                                  String(b.currency),
                                )
                              : "Não informado"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <StatusPanel meta={result.meta} />
        </>
      ) : (
        !error && (
          <Empty
            title="Planeje o próximo compromisso"
            text="Consulte recomendações baseadas no seu consumo real, sem efetuar compras."
          />
        )
      )}
    </>
  );
}
