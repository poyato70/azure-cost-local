import { useEffect, useRef, useState } from "react";
import type {
  Scope,
  CostQuery,
  CostResult,
  ChatEvent,
} from "../../shared/contracts.js";
import { api, money } from "../api.js";
import type { PublicAgent, DataSelection } from "../../shared/connections.js";
export function Chat({
  scope,
  basis,
  agents = [],
  selection,
  selectedSource,
  connectionLabel,
}: {
  selectedSource?: "api" | "mcp";
  connectionLabel?: string;
  agents?: PublicAgent[];
  selection?: DataSelection;
  scope?: Scope;
  basis: CostQuery["basis"];
}) {
  const [runtime, setRuntime] = useState<"copilot" | "agent">("copilot"),
    [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [entries, setEntries] = useState<
      { role: string; text: string; result?: CostResult; evidence?: unknown }[]
    >([]);
  const actualSource = selectedSource || selection?.source || "api";
  const mcpReady =
    actualSource !== "mcp" ||
    (selection?.source === "mcp" && !!selection.mcpConnectionId);
  const consentKey = `tesseract:context:v1:${runtime === "copilot" ? "copilot" : "agent:" + agentId + ":" + (agents.find((a) => a.id === agentId)?.configurationVersion || 0)}`;
  const [remember, setRemember] = useState(false),
    [progress, setProgress] = useState<string[]>([]);
  useEffect(() => {
    let saved = false;
    try {
      saved = sessionStorage.getItem(consentKey) === "yes";
    } catch {}
    setConsent(saved);
    setRemember(saved);
  }, [consentKey]);
  function authorize(allowed: boolean, keep = remember) {
    if (!allowed) {
      controller.current?.abort();
      setBusy(false);
      setProgress([
        "Autorização revogada; execução cancelada. Dados já enviados ao provedor não podem ser recolhidos.",
      ]);
    }
    setConsent(allowed);
    setRemember(keep);
    try {
      if (allowed && keep) sessionStorage.setItem(consentKey, "yes");
      else sessionStorage.removeItem(consentKey);
    } catch {}
  }
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setEntries([]);
    setBusy(false);
    setProgress([]);
    return () => controller.current?.abort();
  }, [scope, basis, runtime, agentId, selection, actualSource]);
  async function send() {
    if (!message.trim() || !consent) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setProgress(["Enviando pergunta ao serviço local…"]);
    const question = message;
    setMessage("");
    setEntries((e) => [...e, { role: "Você", text: question }]);
    try {
      await api.ask(
        {
          message: question,
          scope,
          basis,
          consent: true,
          runtime,
          agentId: runtime === "agent" ? agentId : undefined,
          selection,
        },
        (e) => {
          if (c.signal.aborted) return;
          if (e.type === "progress")
            setProgress((x) => [...x.slice(-7), e.message]);
          if (e.type === "context")
            setEntries((x) => [
              ...x,
              {
                role: "Contexto efetivo da consulta",
                text: `${e.runtime} · fonte: ${e.source} · tools: ${e.tools.join(", ")} · operação ${e.requestId || "sem ID"} · ${e.scope?.resourceGroup || "subscription inteira"}`,
              },
            ]);
          if (e.type === "usage")
            setEntries((x) => [
              ...x,
              {
                role: "Uso desta pergunta",
                text: `${e.provider} · ${(e.durationMs / 1000).toFixed(1)}s · ${e.toolCalls} interação(ões) com tools (inclui tentativas) · tokens de entrada: ${e.inputTokens ?? "não informado"} · saída: ${e.outputTokens ?? "não informado"}. Tokens informados pelo provedor; podem ser parciais. Custo monetário indisponível; contagem de tools não é cobrança.`,
              },
            ]);
          if (e.type === "text")
            setEntries((x) => [
              ...x,
              {
                role:
                  runtime === "copilot"
                    ? "Copilot"
                    : agents.find((a) => a.id === agentId)?.name || "Agente",
                text: e.text,
              },
            ]);
          if (
            e.type === "hubEvidence" ||
            e.type === "mcpEvidence" ||
            e.type === "forecastEvidence"
          )
            setEntries((x) => [
              ...x,
              {
                role:
                  e.type === "forecastEvidence"
                    ? "Previsão oficial Azure (não é gasto realizado)"
                    : e.type === "mcpEvidence"
                      ? "Retorno MCP"
                      : "Evidência FinOps hub",
                text: "Resultado do serviço, independente do texto do modelo",
                evidence: e.result,
              },
            ]);
          if (e.type === "error")
            setEntries((x) => [...x, { role: "Aviso", text: e.message }]);
          if (e.type === "result" && "totals" in e.result)
            setEntries((x) => [
              ...x,
              {
                role: "Dados consultados",
                text: "Resultado verificado no serviço de custos",
                result: e.result as CostResult,
              },
            ]);
        },
        c.signal,
      );
    } catch (e) {
      if (!c.signal.aborted)
        setEntries((x) => [
          ...x,
          { role: "Aviso", text: (e as Error).message },
        ]);
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <label>
          Assistente do chat
          <select
            value={runtime}
            onChange={(e) => setRuntime(e.target.value as any)}
          >
            <option value="copilot">Copilot local</option>
            <option value="agent">Agente cadastrado</option>
          </select>
        </label>
        {runtime === "agent" && (
          <label>
            Agente cadastrado
            <select
              aria-label="Agente cadastrado"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Selecione</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <small>
          Fonte:{" "}
          {selection?.hubId
            ? "FinOps hub selecionado (dois meses civis completos)"
            : actualSource === "mcp"
              ? `MCP selecionado · ${connectionLabel || "selecione uma conexão"}`
              : "APIs Azure"}
        </small>
      </div>
      <p className="notice">
        {runtime === "copilot"
          ? "Copilot local: CLI no notebook, usando a conta GitHub autenticada e a política corporativa. O modelo pode executar remotamente; não requer endpoint Azure neste modo."
          : "Agente cadastrado: tools no serviço local, inferência no endpoint Azure configurado. Selecione um agente com modelo e credencial válidos."}
      </p>
      {!mcpReady && (
        <p className="error" role="alert">
          Conecte um acesso salvo e selecione uma conexão MCP antes de
          perguntar. Nenhuma consulta por APIs será usada automaticamente.
        </p>
      )}
      <div className="section-head">
        <div>
          <h2>Converse com seus custos</h2>
          <p>
            {runtime === "copilot"
              ? "GitHub Copilot local"
              : "Agente executado no serviço local"}{" "}
            · consultas de leitura no escopo selecionado
          </p>
        </div>
        <button
          onClick={() => {
            setStatus("Verificando…");
            void api
              .chatStatus()
              .then((s) => setStatus(s.message))
              .catch((e) => setStatus(e.message));
          }}
        >
          Verificar Copilot
        </button>
      </div>
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      <div className="chat-area">
        {!entries.length ? (
          <div className="chat-intro">
            <span className="empty-icon">✳</span>
            <h3>Uma pergunta. Dados com contexto.</h3>
            <p>
              O chat consulta as mesmas fontes do dashboard e informa período,
              moeda e origem.
            </p>
            <button
              className="suggestion"
              onClick={() =>
                setMessage(
                  "Quanto gastei no resource group nos dois últimos meses?",
                )
              }
            >
              Quanto gastei nos dois últimos meses? ↗
            </button>
          </div>
        ) : (
          entries.map((e, i) => (
            <article
              className={"chat-message " + (e.role === "Você" ? "user" : "")}
              key={i}
            >
              <strong>{e.role}</strong>
              <p>{e.text}</p>
              {e.evidence !== undefined && (
                <details>
                  <summary>Ver dados e avisos da consulta</summary>
                  <pre
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {JSON.stringify(e.evidence, null, 2)}
                  </pre>
                </details>
              )}
              {e.result && (
                <div>
                  {e.result.totals.map((t) => (
                    <div key={t.currency}>{money(t.amount, t.currency)}</div>
                  ))}
                  {e.result.meta.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                  <small>
                    {e.result.meta.period?.from} a{" "}
                    {e.result.meta.period?.toExclusive} (fim exclusivo) ·{" "}
                    {e.result.meta.source}
                  </small>
                </div>
              )}
            </article>
          ))
        )}
      </div>
      {(busy || progress.length > 0) && (
        <div className="chat-progress" role="status">
          <strong>{busy ? "Em execução" : "Execução encerrada"}</strong>
          <ol>
            {progress.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="chat-compose">
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => authorize(e.target.checked)}
          />
          {runtime === "copilot"
            ? "Autorizo enviar o contexto necessário ao GitHub Copilot"
            : "Autorizo enviar o contexto necessário ao provedor do agente"}
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => authorize(consent, e.target.checked)}
          />
          Lembrar autorização para este provedor nesta sessão do navegador
        </label>
        {consent && (
          <button onClick={() => authorize(false, false)}>
            Revogar autorização de contexto
          </button>
        )}
        <p className="fine">
          Nomes de recursos, pergunta e resultados podem ser enviados ao{" "}
          {runtime === "copilot"
            ? "GitHub Copilot"
            : "provedor de inferência do agente"}
          . A autorização é por provedor, pode ser revogada e não substitui a
          política corporativa. Nenhuma senha ou Secret é enviado ao modelo. Uso
          de tokens depende do provedor; valores ausentes não são custo zero.
        </p>
        <label className="sr-only" htmlFor="question">
          Sua pergunta
        </label>
        <textarea
          id="question"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Pergunte sobre custos, budgets ou compromissos…"
          maxLength={4000}
        />
        <div className="compose-footer">
          <small>
            “Dois últimos meses” usa os dois meses civis completos anteriores.
          </small>
          <button
            className="primary"
            disabled={
              !consent ||
              !message.trim() ||
              busy ||
              !scope ||
              !mcpReady ||
              (runtime === "agent" && (!agentId || !selection))
            }
            onClick={send}
          >
            {busy ? "Consultando…" : "Enviar pergunta"}
          </button>
          {busy && (
            <button
              onClick={() => {
                controller.current?.abort();
                setBusy(false);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </>
  );
}
