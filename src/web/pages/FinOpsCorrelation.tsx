import { useEffect, useMemo, useState } from "react";
import { manageRequest } from "../api.js";

type Tool = {
  name: string;
  schemaHash: string;
  approved: boolean;
  reviewable: boolean;
  _meta?: Record<string, unknown>;
};
type Flow = {
  id: string;
  kind?: string;
  state: string;
  stage: string;
  error?: string;
  events: Array<{ time: string; stage: string; state: string; detail: string }>;
  correlation?: any;
  collection?: any;
};

const statusText: Record<string, string> = {
  awaiting_b_confirmation: "Aguardando autorização de inventário",
  approval_required: "Autorização anterior expirou; apenas inspeção disponível",
  running_a: "Consultando custos",
  running_b: "Consultando inventário",
  succeeded: "Concluído",
  failed: "Falha confirmada",
  indeterminate: "Resultado indeterminado — não repetir automaticamente",
};
const flowTitle = (value: Flow) =>
  value.correlation?.dataQuality?.completeness === "partial"
    ? "Coleta incompleta — reconciliação não concluída"
    : value.correlation?.status === "complete_with_discrepancies"
    ? "Concluído com divergências"
    : value.correlation?.status === "insufficient_data"
      ? "Dados insuficientes"
      : statusText[value.state] || value.state;
const sourceLabel = (value: Flow) => value.collection?.sourceMode === "azure-arm-mcp"
  ? `Azure ARM MCP · ${value.collection?.metric || "métrica não registrada"}`
  : "Demonstração sintética";

export function FinOpsCorrelation({ profiles }: { profiles: any[] }) {
  const [sourceMode, setSourceMode] = useState<"synthetic" | "azure-arm-mcp">("synthetic");
  const [metric, setMetric] = useState<"ActualCost" | "AmortizedCost">("ActualCost");
  const [serverA, setServerA] = useState("");
  const [serverB, setServerB] = useState("");
  const [toolA, setToolA] = useState("");
  const [toolB, setToolB] = useState("");
  const [toolsA, setToolsA] = useState<Tool[]>([]);
  const [toolsB, setToolsB] = useState<Tool[]>([]);
  const [scope, setScope] = useState("sub-01");
  const [from, setFrom] = useState("2026-10-01");
  const [toExclusive, setToExclusive] = useState("2026-11-01");
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flow, setFlow] = useState<Flow>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadTools = async (id: string, side: "A" | "B") => {
    if (!id) return;
    try {
      const result = await manageRequest<Tool[]>(
        `/mcp-connections/${id}/tools`,
        "GET",
      );
      const readable = result.filter((tool) => tool.reviewable && (
        sourceMode !== "azure-arm-mcp" ||
        (side === "A" ? tool.name === "query_costs" : tool.name === "execute_query")
      ));
      if (side === "A") setToolsA(readable);
      else setToolsB(readable);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const refreshHistory = async () => {
    try {
      setFlows(await manageRequest<Flow[]>("/finops-correlations", "GET"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void refreshHistory();
  }, []);
  const eligibleA = useMemo(
    () => toolsA.find((tool) => tool.name === toolA),
    [toolsA, toolA],
  );
  const eligibleB = useMemo(
    () => toolsB.find((tool) => tool.name === toolB),
    [toolsB, toolB],
  );

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await manageRequest<Flow>(
        "/finops-correlations",
        "POST",
        {
          serverA,
          toolA,
          serverB,
          toolB,
          scope,
          period: { from, toExclusive },
          sourceMode,
          ...(sourceMode === "azure-arm-mcp" ? { metric } : {}),
          idempotencyKey: crypto.randomUUID(),
          confirmedA: true,
        },
      );
      setFlow(created);
      await refreshHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const confirmB = async () => {
    if (!flow) return;
    setBusy(true);
    setError("");
    try {
      const result = await manageRequest<Flow>(
        `/mcp-orchestrations/${flow.id}/confirm`,
        "POST",
        {},
      );
      setFlow(result);
      await refreshHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const inspect = async (id: string) => {
    try {
      setFlow(await manageRequest<Flow>(`/mcp-orchestrations/${id}`, "GET"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section
      className="finops-correlation"
      aria-labelledby="finops-correlation-title"
    >
      <header className="page-heading">
        <div>
          <p className="eyebrow">ANÁLISE FINOPS · DUAS FONTES MCP</p>
          <h1 id="finops-correlation-title">
            Correlação de custos e inventário
          </h1>
          <p>
            Custos e inventário são consultados separadamente. A associação é
            local e exige provedor, escopo e ID compatíveis.
          </p>
        </div>
      </header>

      <section
        className="content-card correlation-card"
        aria-labelledby="finops-setup-title"
      >
        <h2 id="finops-setup-title">Configurar consulta</h2>
        <div className="toolbar compact">
          <label>
            Fonte de dados
            <select
              value={sourceMode}
              onChange={(event) => {
                const next = event.target.value as "synthetic" | "azure-arm-mcp";
                setSourceMode(next);
                setServerA(""); setServerB(""); setToolA(""); setToolB("");
                setToolsA([]); setToolsB([]);
                setScope(next === "synthetic" ? "sub-01" : "");
              }}
            >
              <option value="synthetic">Demonstração sintética</option>
              <option value="azure-arm-mcp">Azure ARM MCP · somente leitura (preview)</option>
            </select>
          </label>
          <label>
            {sourceMode === "azure-arm-mcp" ? "Conexão Azure ARM MCP" : "Servidor MCP de custos"}
            <select
              value={serverA}
              onChange={(event) => {
                const id = event.target.value;
                setServerA(id); setToolA(""); void loadTools(id, "A");
                if (sourceMode === "azure-arm-mcp") {
                  setServerB(id); setToolB(""); void loadTools(id, "B");
                  setScope(profiles.find((profile) => profile.id === id)?.resourceContext?.scope || "");
                }
              }}
            >
              <option value="">Selecione uma conexão</option>
              {profiles.filter((profile) => sourceMode !== "azure-arm-mcp" || profile.preset === "arm").map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ·{" "}
                  {profile.connected
                    ? "conectado"
                    : profile.status || "não validado"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tool de custos
            <select
              value={toolA}
              onChange={(event) => setToolA(event.target.value)}
              disabled={!toolsA.length}
            >
              <option value="">Selecione uma tool elegível</option>
              {toolsA.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name} ·{" "}
                  {tool.approved ? "aprovada" : "revisão necessária"}
                </option>
              ))}
            </select>
          </label>
          {sourceMode === "synthetic" ? <label>
            Servidor MCP de inventário
            <select
              value={serverB}
              onChange={(event) => {
                setServerB(event.target.value);
                setToolB("");
                void loadTools(event.target.value, "B");
              }}
            >
              <option value="">Selecione uma conexão</option>
              {profiles
                .filter((p) => p.id !== serverA)
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ·{" "}
                    {profile.connected
                      ? "conectado"
                      : profile.status || "não validado"}
                  </option>
                ))}
            </select>
          </label>
          : <p role="note">Custos e inventário serão consultados pela mesma conexão; cada tool mantém aprovação de schema própria.</p>}
          <label>
            Tool de inventário
            <select
              value={toolB}
              onChange={(event) => setToolB(event.target.value)}
              disabled={!toolsB.length}
            >
              <option value="">Selecione uma tool elegível</option>
              {toolsB.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name} ·{" "}
                  {tool.approved ? "aprovada" : "revisão necessária"}
                </option>
              ))}
            </select>
          </label>
          <label>
            {sourceMode === "azure-arm-mcp" ? "Escopo ARM cadastrado" : "Escopo sintético"}
            <input
              value={scope}
              maxLength={512}
              readOnly={sourceMode === "azure-arm-mcp"}
              onChange={(event) => setScope(event.target.value)}
            />
          </label>
          {sourceMode === "azure-arm-mcp" && <label>
            Métrica financeira
            <select value={metric} onChange={(event) => setMetric(event.target.value as "ActualCost" | "AmortizedCost")}>
              <option value="ActualCost">Custo real (ActualCost)</option>
              <option value="AmortizedCost">Custo amortizado (AmortizedCost)</option>
            </select>
          </label>}
          <label>
            De (inclusivo)
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            Até (exclusivo)
            <input
              type="date"
              value={toExclusive}
              onChange={(event) => setToExclusive(event.target.value)}
            />
          </label>
        </div>
        <p className="muted">
          {sourceMode === "azure-arm-mcp"
            ? "Integração Azure em preparação: conexão, schemas e RBAC são validados no momento da consulta. A consulta Resource Graph é fixa, somente leitura e limitada ao escopo cadastrado. Resultado não será classificado como real validado sem resposta autorizada do Azure."
            : "A e B exigem aprovação independente no Registry. A execução consulta o schema atual de cada tool; B pode exigir uma segunda confirmação antes da chamada."}
        </p>
        <button
          className="primary"
          onClick={() => void run()}
          disabled={
            busy ||
            !eligibleA?.approved ||
            !eligibleB?.approved ||
            !scope.trim() ||
            from >= toExclusive ||
            (sourceMode === "synthetic" && serverA === serverB) ||
            (sourceMode === "azure-arm-mcp" && (!serverA || serverA !== serverB || !/^\/subscriptions\//i.test(scope)))
          }
        >
          {busy ? "Executando…" : sourceMode === "azure-arm-mcp" ? "Consultar custos e inventário Azure" : "Executar correlação A → B"}
        </button>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </section>

      {flow && (
        <section
          className="content-card correlation-card"
          aria-labelledby="correlation-run-title"
        >
          <h2 id="correlation-run-title">Execução</h2>
          <p role="status">
            <strong>{flowTitle(flow)}</strong> · {sourceLabel(flow)} · etapa {flow.stage} · {flow.id}
          </p>
          {flow.state === "awaiting_b_confirmation" && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void confirmB()}
            >
              Autorizar e consultar inventário B
            </button>
          )}
          {flow.error && <p role="alert">{flow.error}</p>}
          <ol aria-label="Eventos da execução">
            {flow.events?.map((event, index) => (
              <li key={`${event.time}-${index}`}>
                <strong>
                  {event.stage}: {event.state}
                </strong>{" "}
                — {event.detail}
              </li>
            ))}
          </ol>
          {flow.correlation && <CorrelationResult result={flow.correlation} />}
        </section>
      )}

      <section
        className="content-card correlation-card"
        aria-labelledby="correlation-history-title"
      >
        <h2 id="correlation-history-title">Histórico desta sessão</h2>
        {flows.length ? (
          <ul>
            {flows.map((item) => (
              <li key={item.id}>
                <button onClick={() => void inspect(item.id)}>
                  {flowTitle(item)} · {sourceLabel(item)} · {item.id}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma correlação persistida nesta sessão.</p>
        )}
        <button onClick={() => void refreshHistory()}>
          Atualizar histórico
        </button>
      </section>
    </section>
  );
}

function CorrelationResult({ result }: { result: any }) {
  return (
    <div className="correlation-result">
      <h3>
        Resultado:{" "}
        {result.dataQuality?.sourceTotalReconciliation === "not_available"
          ? "correlação calculada; total da fonte não disponível para reconciliação"
          : result.status === "complete"
          ? "sem divergências"
          : result.status === "complete_with_discrepancies"
            ? "concluído com divergências"
            : "dados insuficientes"}
      </h3>
      {result.dataQuality && <p role="note" className={result.dataQuality.completeness === "partial" ? "error-text" : "muted"}>
        {result.dataQuality.completeness === "partial"
          ? "Coleta parcial: valores abaixo são provisórios e não representam reconciliação completa. "
          : "Total independente da fonte não disponibilizado; os totais abaixo foram calculados a partir das linhas retornadas. "}
        {result.dataQuality.note} {result.dataQuality.costClassification}
      </p>}
      <p>
        Escopo: {result.requestedScope}. Período: {result.requestedPeriod.from}{" "}
        até {result.requestedPeriod.toExclusive} (exclusivo). Valores mantidos
        separados por moeda.
      </p>
      <h4>Totais por moeda e período</h4>
      {result.totals.length ? (
        <ul>
          {result.totals.map((total: any) => (
            <li key={`${total.currency}-${total.period.from}`}>
              {total.currency} {total.amount} · {total.period.from} a{" "}
              {total.period.toExclusive}
            </li>
          ))}
        </ul>
      ) : (
        <p>Sem linhas financeiras válidas para totalizar.</p>
      )}
      <p>
        Associados: {result.associations.length} · Não associados:{" "}
        {result.unassociated.length} · Ambíguos: {result.ambiguous.length} · Não
        alocáveis: {result.nonAllocatable.length} · Inválidos:{" "}
        {result.invalidCosts.length + result.invalidInventory.length}
      </p>
      <details>
        <summary>Inspecionar linhas, identidade e proveniência</summary>
        {result.associations.map((association: any) => (
          <article key={`${association.resourceId}-${association.currency}`}>
            <h4>
              {association.provider} · {association.scope} ·{" "}
              {association.resourceId}
            </h4>
            <p>
              {association.currency} {association.amount} · linhas{" "}
              {association.costLineIds.join(", ")} · inventário{" "}
              {association.inventoryIds.join(", ")}
            </p>
            <p>
              Regra: {association.rule}. Evidências:{" "}
              {association.evidenceRefs.join(", ")}
            </p>
            {association.originalResourceIds?.length > 0 && (
              <p>IDs de recurso recebidos da fonte: {association.originalResourceIds.join(", ")}</p>
            )}
            {association.resources.map((resource: any) => (
              <p key={resource.inventoryId}>
                Recurso: {resource.name} ({resource.resourceType}) · ID de
                inventário {resource.resourceId}
                {resource.canonicalResourceId
                  ? ` · ID canônico ${resource.canonicalResourceId}`
                  : ""}
              </p>
            ))}
          </article>
        ))}
        {[
          ...result.unassociated,
          ...result.ambiguous,
          ...result.nonAllocatable,
        ].map((item: any, index: number) => (
          <article key={`${item.reason}-${index}`}>
            <strong>{item.reason}</strong>
            <p>
              {item.currency} {item.amount} · linhas{" "}
              {item.costLineIds.join(", ")} · evidências:{" "}
              {item.evidenceRefs.join(", ")}
            </p>
            {item.originalResourceId && <p>ID de recurso recebido da fonte: {item.originalResourceId}</p>}
            {item.inventoryIds?.length > 0 && (
              <p>Candidatos de inventário: {item.inventoryIds.join(", ")}</p>
            )}
          </article>
        ))}
        <h4>Registros inválidos</h4>
        {result.invalidCosts.length ? (
          <ul>
            {result.invalidCosts.map((item: any, index: number) => (
              <li key={`cost-${index}`}>
                Custos: linha {item.lineId || "sem ID"}, posição{" "}
                {item.rowIndex + 1} — {item.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma linha de custo inválida.</p>
        )}
        {result.invalidInventory.length ? (
          <ul>
            {result.invalidInventory.map((item: any, index: number) => (
              <li key={`inventory-${index}`}>
                Inventário: registro {item.inventoryId || "sem ID"}, posição{" "}
                {item.rowIndex + 1} — {item.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma linha de inventário inválida.</p>
        )}
        <h4>Recursos sem custo válido no período</h4>
        {result.inventoryWithoutCosts.length ? (
          <ul>
            {result.inventoryWithoutCosts.map((item: any) => (
              <li key={item.inventoryId}>
                {item.name} · {item.provider}/{item.scope}/{item.resourceId} ·{" "}
                {item.inventoryId}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum recurso adicional no inventário consultado.</p>
        )}
        <h4>Fontes da análise</h4>
        <p>
          Custos: {result.provenance.costs.serverId} /{" "}
          {result.provenance.costs.tool} / {result.provenance.costs.executionId}
        </p>
        <p>
          Inventário: {result.provenance.inventory.serverId} /{" "}
          {result.provenance.inventory.tool} /{" "}
          {result.provenance.inventory.executionId}
        </p>
      </details>
    </div>
  );
}
