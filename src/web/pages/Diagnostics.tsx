import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import { sanitizeDiagnosticText } from "../../shared/diagnostic-sanitizer.js";
import { manageRequest } from "../api.js";
export function DiagnosticPanel() {
  const [rows, setRows] = useState<DiagnosticEvent[]>([]),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
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
  const logText = useMemo(
    () =>
      [
        "Tesseract — log de diagnóstico",
        `Exportado em: ${new Date().toISOString()}`,
        `Eventos visíveis: ${filtered.length} de ${rows.length}`,
        "",
        ...filtered.map((r) => {
          const time = new Date(r.time).toISOString();
          const request = r.requestId
            ? ` #${r.requestId}${r.attempt ? `:${r.attempt}` : ""}`
            : "";
          return sanitizeDiagnosticText(
            `${time} [${r.status}] ${r.source}/${r.operation}${request}${r.detail ? ` — ${r.detail}` : ""}`,
          );
        }),
        "",
      ].join("\n"),
    [filtered, rows.length],
  );
  function exportLog() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const filename = `tesseract-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.log`;
    const url = URL.createObjectURL(
      new Blob([logText], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
      <div className="diagnostic-export-toolbar" aria-label="Ações do log">
        <button
          type="button"
          className="copy-action"
          disabled={!filtered.length}
          aria-label="Copiar eventos visíveis do diagnóstico"
          onClick={() => {
            void navigator.clipboard
              .writeText(logText)
              .then(() =>
                setCopyMessage(
                  "Eventos visíveis copiados para a área de transferência.",
                ),
              )
              .catch(() => setCopyMessage("Não foi possível copiar o log."));
          }}
        >
          {copyMessage.startsWith("Eventos visíveis copiados") ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          Copiar visíveis
        </button>
        <button
          type="button"
          className="copy-action"
          disabled={!filtered.length}
          aria-label="Exportar eventos visíveis para arquivo de log"
          onClick={exportLog}
        >
          <Download size={16} aria-hidden="true" />
          Exportar visíveis
        </button>
        <span className="copy-feedback" role="status">
          {copyMessage}
        </span>
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
        <div
          className="terminal-log"
          role="log"
          aria-label="Log de diagnóstico"
        >
          {filtered.map((r, i) => (
            <div
              key={i}
              className={
                /^(429|4\d\d|5\d\d|forbidden|upstream|throttled)$/.test(
                  r.status,
                )
                  ? "term-line failed"
                  : "term-line"
              }
            >
              <span className="term-time">
                {new Date(r.time).toLocaleTimeString("pt-BR")}
              </span>{" "}
              <span className="term-status">[{r.status}]</span>{" "}
              <span className="term-src">
                {r.source}/{r.operation}
              </span>
              {r.requestId ? (
                <span className="term-id">
                  {" "}
                  #{r.requestId}
                  {r.attempt ? `:${r.attempt}` : ""}
                </span>
              ) : null}
              {r.detail ? <span> — {r.detail}</span> : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
