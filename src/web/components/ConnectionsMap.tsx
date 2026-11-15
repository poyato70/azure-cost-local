import {
  Activity,
  ArrowRight,
  Boxes,
  Check,
  CircleDashed,
  Cloud,
  CloudCog,
  ExternalLink,
  RefreshCw,
  Server,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import {
  buildMapIntegrations,
  catalogProfileCount,
  mapProviders,
  type MapIntegration,
  type MapProfile,
  type MapProvider,
} from "./connections-map-model.js";

const providerIcons = {
  Azure: CloudCog,
  AWS: Cloud,
  GCP: Cloud,
  Personalizado: Server,
} satisfies Record<MapProvider, LucideIcon>;

const targetTabs: Record<string, string> = {
  costs: "costs",
  benefits: "benefits",
  multicloud: "multicloud",
  "azure-ai": "discovery",
};

function statusLabel(profile?: MapProfile) {
  if (!profile) return "Sem cadastro";
  return profile.connected
    ? "Conectado nesta sessão"
    : "Cadastro salvo · sem conexão ativa nesta sessão";
}

function eventTone(event: DiagnosticEvent) {
  if (/error|fail|401|403|429|5\d\d|forbidden|blocked/i.test(event.status))
    return "is-error";
  if (/success|sucesso|conectado|concluído/i.test(event.status))
    return "is-success";
  return "is-pending";
}

function CapabilityDetail({ integration }: { integration: MapIntegration }) {
  const profile = integration.profile;
  return (
    <section className="map-detail" aria-labelledby="map-detail-title">
      <div className="map-column-heading">
        <span className="map-step">03</span>
        <div>
          <h3 id="map-detail-title">Métricas e capacidades</h3>
          <p>Saídas descritas para a integração selecionada</p>
        </div>
      </div>

      <div className="map-selected-summary">
        <span className="map-integration-icon" aria-hidden="true">
          <Boxes size={17} />
        </span>
        <div>
          <strong>{integration.name}</strong>
          <span>{integration.category}</span>
        </div>
      </div>

      <div className="map-capability-list">
        {integration.supports.length ? (
          integration.supports.map((capability) => (
            <div className="map-capability" key={capability}>
              <Check size={14} aria-hidden="true" />
              <span>{capability}</span>
            </div>
          ))
        ) : (
          <p className="map-empty-copy">
            As capacidades ainda não foram descobertas neste mapa. Analise o
            servidor para consultar as tools anunciadas por ele.
          </p>
        )}
      </div>

      <div className="map-fact-list">
        <div>
          <span>Disponibilidade no produto</span>
          <strong>
              {profile || integration.target === "arm" || integration.target === "advisor"
              ? "Fluxo presente; requer configuração"
              : "Referência de catálogo"}
          </strong>
        </div>
        <div>
          <span>Estado da conexão</span>
          <strong>{statusLabel(profile)}</strong>
        </div>
        {profile && (
          <div>
            <span>Compatibilidade prevista</span>
            <strong>
              {profile.capability?.status === "unsupported"
                ? "Não suportada por este preset"
                : profile.capability?.status === "pending"
                  ? "Pendente de teste real"
                  : "Consulte configuração salva"}
            </strong>
          </div>
        )}
      </div>

      <details className="map-requirements">
        <summary>Dependências e pré-requisitos</summary>
        <p>{integration.prerequisite}</p>
        {profile?.capability?.reason && <p>{profile.capability.reason}</p>}
      </details>
    </section>
  );
}

export function ConnectionsMap({
  profiles,
  accessesCount,
  azureAuthenticated,
  events,
  activityLoading = false,
  loginPending = false,
  onRefreshActivity,
  onConfigure,
  onConnect,
  onAuthorize,
  onInspect,
  onNavigate,
}: {
  profiles: MapProfile[];
  accessesCount: number;
  azureAuthenticated: boolean;
  events: DiagnosticEvent[];
  activityLoading?: boolean;
  loginPending?: boolean;
  onRefreshActivity: () => void;
  onConfigure: (draft: Record<string, unknown>) => void;
  onConnect: (id: string) => Promise<any>;
  onAuthorize: (id: string) => void;
  onInspect: (id: string) => void;
  onNavigate: (tab: string) => void;
}) {
  const providers = mapProviders(profiles);
  const [provider, setProvider] = useState<MapProvider>("Azure");
  const [integrationId, setIntegrationId] = useState("");
  const [connectingId, setConnectingId] = useState("");
  const [connectionFeedback, setConnectionFeedback] = useState<{
    kind: "pending" | "success" | "error";
    message: string;
  }>();
  const integrations = buildMapIntegrations(provider, profiles);
  const integration =
    integrations.find((item) => item.id === integrationId) || integrations[0];
  const recentEvents = [...events].reverse().slice(0, 5);

  useEffect(() => {
    if (!providers.includes(provider)) setProvider("Azure");
  }, [provider, profiles]);

  function selectProvider(next: MapProvider) {
    setProvider(next);
    setIntegrationId("");
    setConnectionFeedback(undefined);
  }

  async function connectProfile(id: string) {
    setConnectingId(id);
    setConnectionFeedback({
      kind: "pending",
      message: "Conectando ao servidor e listando tools…",
    });
    try {
      const result = await onConnect(id);
      setConnectionFeedback({
        kind: "success",
        message: `Servidor respondeu e listou ${result?.tools?.length ?? 0} tool(s). Acesso aos dados ainda precisa ser validado numa chamada permitida.`,
      });
    } catch (error) {
      setConnectionFeedback({
        kind: "error",
        message: (error as Error).message,
      });
    } finally {
      setConnectingId("");
    }
  }

  function configure(integration: MapIntegration) {
    const preset =
      integration.target === "arm"
        ? {
            preset: "arm",
            transport: "http",
            endpoint: "https://mcp.management.azure.com",
            authMode: "delegated",
            resourceContext: { scope: "" },
          }
        : integration.target === "advisor"
          ? {
              preset: "azure",
              transport: "stdio",
              authMode: "application",
              resourceContext: { namespace: "advisor" },
            }
          : undefined;
    if (preset)
      onConfigure({
        name: integration.name,
        ...preset,
      });
  }

  if (!integration) return null;

  return (
    <section
      className="connections-map"
      aria-labelledby="connections-map-title"
    >
      <header className="connections-map-header">
        <div>
          <span className="map-eyebrow">INVENTÁRIO OPERACIONAL</span>
          <h2 id="connections-map-title">Mapa de conexões</h2>
          <p>
            Catálogo, configurações salvas e atividade desta sessão, com estados
            apresentados separadamente.
          </p>
        </div>
        <div className="map-state-legend" aria-label="Legenda do mapa">
          <span>
            <i className="legend-dot legend-dot--catalog" />
            Catálogo
          </span>
          <span>
            <i className="legend-dot legend-dot--preset" />
            Preset disponível
          </span>
          <span>
            <i className="legend-dot legend-dot--saved" />
            Configurado
          </span>
          <span>
            <i className="legend-dot legend-dot--live" />
            Ativo nesta sessão
          </span>
        </div>
      </header>

      <div className="connections-map-layout">
        <div className="connections-map-main">
          <section
            className="map-provider-column"
            aria-labelledby="map-providers-title"
          >
            <div className="map-column-heading">
              <span className="map-step">01</span>
              <div>
                <h3 id="map-providers-title">Provedor</h3>
                <p>Origens no catálogo local</p>
              </div>
            </div>
            <div
              className="map-provider-list"
              role="group"
              aria-label="Selecionar provedor"
            >
              {providers.map((item) => {
                const Icon = providerIcons[item];
                const count = catalogProfileCount(item, profiles);
                const selected = item === provider;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`map-provider-node${selected ? " is-selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => selectProvider(item)}
                  >
                    <span className="map-node-icon">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="map-node-copy">
                      <strong>{item}</strong>
                      <small>
                        {count} cadastro{count === 1 ? "" : "s"} MCP
                      </small>
                    </span>
                    {selected ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      <ArrowRight size={15} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="map-provider-context" role="status">
              <span
                className={`map-status-mark${provider === "Azure" && azureAuthenticated ? " is-live" : ""}`}
              />
              <span>
                {provider === "Azure"
                  ? azureAuthenticated
                    ? "Sessão Azure autenticada"
                    : `${accessesCount} acesso${accessesCount === 1 ? "" : "s"} salvo${accessesCount === 1 ? "" : "s"}; sessão sem autenticação`
                  : "Catálogo disponível; acesso específico não verificado"}
              </span>
            </div>
          </section>

          <section
            className="map-integration-column"
            aria-labelledby="map-integrations-title"
          >
            <div className="map-column-heading">
              <span className="map-step">02</span>
              <div>
                <h3 id="map-integrations-title">Integração</h3>
                <p>{integrations.length} itens documentados ou cadastrados</p>
              </div>
            </div>
            <div
              className="map-integration-list"
              role="group"
              aria-label={`Integrações de ${provider}`}
            >
              {integrations.map((item) => {
                const selected = item.id === integration.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    className={`map-integration-node${selected ? " is-selected" : ""}`}
                    onClick={() => {
                      setIntegrationId(item.id);
                      setConnectionFeedback(undefined);
                    }}
                  >
                    <span className="map-integration-icon">
                      <Waypoints size={16} aria-hidden="true" />
                    </span>
                    <span className="map-node-copy">
                      <strong>{item.name}</strong>
                      <small>{item.category}</small>
                    </span>
                    <span
                      className={`map-integration-state${item.profile?.connected ? " is-live" : item.profile ? " is-saved" : ""}`}
                    >
                      {item.profile?.connected
                        ? "Ativa"
                        : item.profile
                          ? "Salva"
                          : item.target === "arm" || item.target === "advisor"
                            ? "Configurar"
                            : item.target
                              ? "Fluxo disponível"
                              : "Referência"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <CapabilityDetail integration={integration} />

          <section
            className="map-actions"
            aria-label="Ações da integração selecionada"
          >
            {integration.profile ? (
              <>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => onInspect(integration.profile!.id)}
                >
                  Analisar tools
                </button>
                  {integration.profile.transport === "http" &&
                  integration.profile.authMode === "delegated" && (
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={loginPending}
                      aria-busy={loginPending}
                      onClick={() => onAuthorize(integration.profile!.id)}
                    >
                      {loginPending
                        ? "Aguardando autorização…"
                        : "Autorizar recurso"}
                    </button>
                  )}
                {!integration.profile.connected &&
                  integration.profile.capability?.status !== "unsupported" && (
                    <button
                      className="button-primary"
                      type="button"
                      disabled={!!connectingId}
                      aria-busy={connectingId === integration.profile.id}
                      onClick={() =>
                        void connectProfile(integration.profile!.id)
                      }
                    >
                      {connectingId === integration.profile.id
                        ? "Conectando…"
                        : "Conectar e listar tools"}
                    </button>
                  )}
              </>
            ) : integration.target === "arm" ||
              integration.target === "advisor" ? (
              <button
                className="button-primary"
                type="button"
                onClick={() => configure(integration)}
              >
                Preparar cadastro MCP
              </button>
            ) : integration.target && targetTabs[integration.target] ? (
              <button
                className="button-primary"
                type="button"
                onClick={() => onNavigate(targetTabs[integration.target!])}
              >
                Abrir fluxo no Tesseract{" "}
                <ExternalLink size={15} aria-hidden="true" />
              </button>
            ) : (
              <p>
                Esta referência não possui um fluxo de execução direta nesta
                versão.
              </p>
            )}
            {connectionFeedback && (
              <p
                className={`map-action-feedback is-${connectionFeedback.kind}`}
                role={connectionFeedback.kind === "error" ? "alert" : "status"}
              >
                {connectionFeedback.message}
              </p>
            )}
            <span className="map-action-caption">
              {integration.profile
                ? "O status ativo vem da sessão local do serviço."
                : "O item de catálogo não representa uma conexão autenticada."}
            </span>
          </section>
        </div>

        <aside className="map-activity" aria-labelledby="map-activity-title">
          <div className="map-activity-heading">
            <div className="map-activity-icon">
              <Activity size={17} aria-hidden="true" />
            </div>
            <div>
              <h3 id="map-activity-title">Atividade recente</h3>
              <p>Eventos registrados pelo serviço nesta sessão</p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Atualizar atividade"
              title="Atualizar atividade"
              disabled={activityLoading}
              onClick={onRefreshActivity}
            >
              <RefreshCw
                size={15}
                className={activityLoading ? "is-spinning" : undefined}
                aria-hidden="true"
              />
            </button>
          </div>
          {recentEvents.length ? (
            <ol className="map-event-list" aria-live="polite">
              {recentEvents.map((event, index) => (
                <li
                  className={`map-event ${eventTone(event)}`}
                  key={`${event.time}:${event.requestId || index}`}
                >
                  <span className="map-event-marker" aria-hidden="true" />
                  <time dateTime={event.time}>
                    {new Date(event.time).toLocaleTimeString("pt-BR")}
                  </time>
                  <strong>
                    {event.source} · {event.operation}
                  </strong>
                  <span className="map-event-status">{event.status}</span>
                  {event.detail && <p>{event.detail}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="map-activity-empty" role="status">
              <CircleDashed size={20} aria-hidden="true" />
              <strong>Nenhuma operação registrada</strong>
              <p>
                Os eventos aparecerão aqui depois que uma ação real for
                executada.
              </p>
            </div>
          )}
          <button
            className="button-ghost map-open-diagnostics"
            type="button"
            onClick={() => onNavigate("diagnostics")}
          >
            Abrir diagnóstico completo{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </aside>
      </div>
    </section>
  );
}
