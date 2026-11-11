import { useEffect, useRef, useState } from "react";
import { cloudDefaults } from "../../shared/cloud-defaults.js";
import { manageRequest } from "../api.js";

type UsageResult = {
  source: string;
  metrics: {
    metric: string;
    total: number | null;
    points: { time: string; tokens: number }[];
  }[];
};

export function CloudDefaults({
  onConfigure,
  onNavigate,
}: {
  onConfigure?: (draft: any) => void;
  onNavigate?: (tab: string) => void;
}) {
  const [provider, setProvider] = useState("Azure");
  const [selected, setSelected] = useState("Azure Cost Management");
  const [resourceId, setResourceId] = useState("");
  const [from, setFrom] = useState("");
  const [toExclusive, setToExclusive] = useState("");
  const [usage, setUsage] = useState<UsageResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => request.current?.abort(), []);
  const entries = cloudDefaults.filter((entry) => entry.provider === provider);
  const entry = entries.find(({ name }) => name === selected) ?? entries[0];

  async function loadUsage() {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setUsage(undefined);
    try {
      const result = await manageRequest<UsageResult>(
        "/cloud/azure-ai-usage",
        "POST",
        { resourceId: resourceId.trim(), from, toExclusive },
        controller.signal,
      );
      if (!controller.signal.aborted) setUsage(result);
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section className="config-card">
      <h3>Conexões padrão de nuvem</h3>
      <label>
        Provedor cloud
        <select
          value={provider}
          disabled={busy}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option>Azure</option>
          <option>AWS</option>
          <option>GCP</option>
        </select>
      </label>
      <label>
        Integração cloud
        <select
          value={entry.name}
          disabled={busy}
          onChange={(e) => setSelected(e.target.value)}
        >
          {entries.map(({ name }) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <dl className="mcp-details">
        <div>
          <dt>Conexão</dt>
          <dd>{entry.connectionType}</dd>
        </div>
        <div>
          <dt>Transporte</dt>
          <dd>{entry.transport}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            {entry.target
              ? "Padrão · requer configuração ou acesso ativo"
              : "Referência · integração pendente"}
          </dd>
        </div>
        <div>
          <dt>
            Capacidades{" "}
            {entry.target
              ? "disponíveis na integração"
              : "documentadas no provedor"}
          </dt>
          <dd>{entry.supports.join(", ")}</dd>
        </div>
        <div>
          <dt>Pré-requisitos</dt>
          <dd>{entry.prerequisite}</dd>
        </div>
      </dl>
      {entry.target === "arm" && (
        <button
          onClick={() =>
            onConfigure?.({
              name: entry.name,
              preset: "arm",
              transport: "http",
              endpoint: "https://mcp.management.azure.com",
              authMode: "delegated",
              resourceContext: { scope: "" },
            })
          }
        >
          Configurar Cost Management
        </button>
      )}
      {entry.target === "advisor" && (
        <button
          onClick={() =>
            onConfigure?.({
              name: entry.name,
              preset: "azure",
              transport: "stdio",
              authMode: "application",
              resourceContext: { namespace: "advisor" },
            })
          }
        >
          Configurar Advisor
        </button>
      )}
      {entry.target &&
        ["costs", "benefits", "multicloud"].includes(entry.target) && (
          <button onClick={() => onNavigate?.(entry.target!)}>
            Abrir {entry.name}
          </button>
        )}
      {entry.target === "azure-ai" && (
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            void loadUsage();
          }}
        >
          <label>
            ID do recurso Azure OpenAI
            <input
              required
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              placeholder="/subscriptions/…/resourceGroups/…/providers/Microsoft.CognitiveServices/accounts/…"
            />
          </label>
          <label>
            Início (UTC)
            <input
              required
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Fim exclusivo (UTC)
            <input
              required
              type="date"
              value={toExclusive}
              onChange={(e) => setToExclusive(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Consultando…" : "Consultar tokens"}
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {usage && (
            <div role="status">
              <p>Fonte: {usage.source}</p>
              {usage.metrics.map((metric) => (
                <p key={metric.metric}>
                  {metric.metric === "ProcessedPromptTokens"
                    ? "Entrada"
                    : "Saída"}
                  :{" "}
                  {metric.total === null
                    ? "Sem dados"
                    : metric.total.toLocaleString("pt-BR")}{" "}
                  tokens
                </p>
              ))}
              <details>
                <summary>Série diária e dados brutos normalizados</summary>
                <pre>{JSON.stringify(usage.metrics, null, 2)}</pre>
              </details>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
