import { useEffect, useMemo, useState } from "react";
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import { manageRequest } from "../api.js";
export function DiagnosticPanel() {
  const [rows, setRows] = useState<DiagnosticEvent[]>([]),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  async function load() {
    try {
      setRows(await manageRequest("/diagnostics"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const filtered = useMemo(
    () =>
      [...rows].reverse().filter((r) => {
        const text = [r.source, r.operation, r.status, r.detail, r.requestId]
          .join(" ")
          .toLocaleLowerCase();
        const time = Date.parse(r.time);
        return (
          (!search || text.includes(search.toLocaleLowerCase())) &&
          (!status || r.status === status) &&
          (!from || time >= Date.parse(from)) &&
          (!to || time <= Date.parse(to) + 59999)
        );
      }),
    [rows, search, status, from, to],
  );
  return (
    <>
      <h2>Diagnóstico</h2>
      <p>
        Log operacional desta sessão, mantido na memória do serviço. Tokens,
        Secrets, senha e URL OAuth não são registrados. HTTP 200 do chat
        confirma abertura do fluxo, não sucesso da consulta financeira.
      </p>
      <div className="toolbar diagnostic-filters">
        <label>
          Pesquisar no log
          <input
            type="search"
            aria-label="Pesquisar no log"
            placeholder="Operação, mensagem, ID da pergunta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Status do log
          <select
            aria-label="Status do log"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {[...new Set(rows.map((r) => r.status))].sort().map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Log de
          <input
            type="datetime-local"
            aria-label="Log de"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Log até
          <input
            type="datetime-local"
            aria-label="Log até"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="actions">
        <button onClick={() => void load()}>Atualizar diagnóstico</button>
        <button
          onClick={() =>
            void manageRequest("/diagnostics", "DELETE")
              .then(load)
              .catch((e) => setError(e.message))
          }
        >
          Limpar histórico
        </button>
        <button
          onClick={() => {
            setSearch("");
            setStatus("");
            setFrom("");
            setTo("");
          }}
        >
          Limpar filtros
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="fine">
        {filtered.length} de {rows.length} eventos · horários locais do
        navegador · correlacione pelo ID da operação/pergunta. Tentativa indica
        HTTP enviado; eventos de espera/código podem pertencer à mesma
        tentativa.
      </p>
      {!rows.length ? (
        <p>
          Nenhuma operação registrada nesta sessão. Reproduza a ação e clique em
          Atualizar diagnóstico.
        </p>
      ) : !filtered.length ? (
        <p>Nenhum evento corresponde aos filtros.</p>
      ) : (
        <div className="table-wrap diagnostic-log">
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                <th>Origem / operação</th>
                <th>Status</th>
                <th>Correlação</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td>{new Date(r.time).toLocaleString("pt-BR")}</td>
                  <td>
                    <strong>{r.source}</strong>
                    <br />
                    {r.operation}
                  </td>
                  <td>
                    <span
                      className={
                        /^(429|4\d\d|5\d\d|forbidden|upstream|throttled)$/.test(
                          r.status,
                        )
                          ? "log-status failed"
                          : "log-status"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.requestId || "—"}
                    {r.attempt ? ` · tentativa ${r.attempt}` : ""}
                  </td>
                  <td>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
