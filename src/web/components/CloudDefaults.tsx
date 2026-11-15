import { useEffect, useRef, useState } from "react";
import { cloudDefaults } from "../../shared/cloud-defaults.js";
import {
  parseAzureAiResourceId,
  validateAzureAiUsagePeriod,
} from "../../shared/azure-ai-usage.js";
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
    request.current?.abort();
    setBusy(false);
    const parsedResource = parseAzureAiResourceId(resourceId);
    if (parsedResource.error) {
      setError(parsedResource.error);
      setUsage(undefined);
      return;
    }
    const periodError = validateAzureAiUsagePeriod(from, toExclusive);
    if (periodError) {
      setError(periodError);
      setUsage(undefined);
      return;
    }
    if (parsedResource.extractedFromPortal) {
      setResourceId(parsedResource.resourceId);
      setError("Resource ID extraído da página do portal Azure.");
    } else {
      setError("");
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setUsage(undefined);
    try {
      const result = await manageRequest<UsageResult>(
        "/cloud/azure-ai-usage",
        "POST",
        { resourceId: parsedResource.resourceId, from, toExclusive },
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
          className="settings-form azure-ai-usage"
          aria-busy={busy}
          onSubmit={(e) => {
            e.preventDefault();
            void loadUsage();
          }}
        >
          <label>
            Resource ID da conta Azure OpenAI
            <input
              required
              disabled={busy}
              value={resourceId}
              aria-invalid={!!error && !parseAzureAiResourceId(resourceId).resourceId}
              aria-describedby="azure-ai-resource-help"
              onChange={(e) => {
                setResourceId(e.target.value);
                setError("");
              }}
              placeholder="/subscriptions/00000000-0000-4000-8000-000000000000/resourceGroups/rg-openai/providers/Microsoft.CognitiveServices/accounts/conta-openai"
            />
            <small id="azure-ai-resource-help">
              Cole esse caminho de Visão geral, ou uma URL HTTPS de portal.azure.com
              aberta diretamente nessa conta. Não aceitamos URLs arbitrárias.
            </small>
          </label>
          <label>
            Início (UTC)
            <input
              required
              disabled={busy}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Fim exclusivo (UTC; não incluído no intervalo)
            <input
              required
              disabled={busy}
              type="date"
              value={toExclusive}
              onChange={(e) => setToExclusive(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy} aria-busy={busy}>
            {busy ? "Consultando…" : "Consultar tokens"}
          </button>
          {error && (
            <p
              role={error.startsWith("Resource ID extraído") ? "status" : "alert"}
              className={error.startsWith("Resource ID extraído") ? "notice" : "error"}
              aria-live="polite"
            >
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
