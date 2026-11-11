import { WorkspaceHome } from "./pages/WorkspaceHome.js";
import { Knowledge } from "./pages/Knowledge.js";
import { Investigations } from "./pages/Investigations.js";
import { Breadcrumbs, pageTitle } from "./components/Breadcrumbs.js";
import { CommandHero } from "./components/CommandHero.js";
import { ThemeControl } from "./components/ThemeControl.js";
import { Navigation } from "./components/Navigation.js";
import { Welcome } from "./components/Welcome.js";
import { Help } from "./pages/Help.js";
import { TagCosts } from "./pages/TagCosts.js";
import { ApiLab } from "./pages/ApiLab.js";
import { Discovery } from "./pages/Discovery.js";
import { Brand } from "./components/Brand.js";
import { Multicloud } from "./pages/Multicloud.js";
import { Forecast } from "./pages/Forecast.js";
import { DiagnosticPanel } from "./pages/Diagnostics.js";
import { Hubs } from "./pages/Hubs.js";
import { useEffect, useMemo, useState, useRef } from "react";
import type {
  Scope,
  DateRange,
  CostQuery,
  Subscription,
} from "../shared/contracts.js";
import { api, manageRequest, selectDataSource, type Bootstrap } from "./api.js";
import { ScopeFilters } from "./components/ScopeFilters.js";
import { Costs } from "./pages/Costs.js";
import { Budgets } from "./pages/Budgets.js";
import { Benefits } from "./pages/Benefits.js";
import { Chat } from "./pages/Chat.js";
import type {
  PublicAccessProfile,
  PublicAgent,
} from "../shared/connections.js";
import { Accesses } from "./pages/Accesses.js";
import { McpConnections } from "./pages/McpConnections.js";
import { Agents } from "./pages/Agents.js";
const tabs: { id: string; label: string; group?: string }[] = [
  { id: "multicloud", label: "Visão multicloud", group: "EXPLORAR" },
  { id: "costs", label: "Custos" },
  { id: "benefits", label: "Compromissos", group: "PLANEJAR" },
  { id: "forecast", label: "Forecast" },
  { id: "budgets", label: "Budgets" },
  { id: "agents", label: "Agentes", group: "ASSISTENTES" },
  { id: "chat", label: "Chat" },
  { id: "accesses", label: "Acessos", group: "CONEXÕES" },
  { id: "mcps", label: "MCPs" },
  { id: "hubs", label: "FinOps hub" },
  { id: "diagnostics", label: "Diagnóstico", group: "OPERAÇÃO" },
];
export function App() {
  const [insight, setInsight] = useState<{
    text: string;
    source: string;
    requestId: string;
  }>();
  const [connectionFeedback, setConnectionFeedback] = useState<{
    id: string;
    kind: "pending" | "success" | "error";
    message: string;
  }>();
  const [hubId, setHubId] = useState("");
  const [analysisMcpId, setAnalysisMcpId] = useState("");
  const [mcpDraft, setMcpDraft] = useState<any>();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [accesses, setAccesses] = useState<PublicAccessProfile[]>([]),
    [mcpProfiles, setMcpProfiles] = useState<any[]>([]),
    [agentProfiles, setAgentProfiles] = useState<PublicAgent[]>([]),
    [chosenAccess, setChosenAccess] = useState(""),
    [accessMode, setAccessMode] = useState<"user" | "application">("user"),
    [source, setSource] = useState<"api" | "mcp">("api"),
    [mcpId, setMcpId] = useState("");
  const reloadSettings = async () => {
    try {
      const [a, m, g] = await Promise.all([
        manageRequest("/accesses"),
        manageRequest("/mcp-connections"),
        manageRequest("/agents"),
      ]);
      setAccesses(Array.isArray(a) ? a : []);
      setMcpProfiles(Array.isArray(m) ? m : []);
      setAgentProfiles(Array.isArray(g) ? g : []);
      setSettingsLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    selectDataSource({ source, mcpConnectionId: mcpId || undefined });
  }, [source, mcpId]);
  const [loginPending, setLoginPending] = useState(false);
  const loginTimer = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  useEffect(
    () => () => {
      if (loginTimer.current) clearInterval(loginTimer.current);
    },
    [],
  );
  const [boot, setBoot] = useState<Bootstrap>(),
    [error, setError] = useState(""),
    [tab, setTab] = useState("home"),
    [subs, setSubs] = useState<Subscription[]>([]),
    [sub, setSub] = useState(""),
    [groups, setGroups] = useState<string[]>([]),
    [group, setGroup] = useState(""),
    [period, setPeriod] = useState<DateRange>({
      from: "",
      toExclusive: "",
      timeZone: "America/Sao_Paulo",
    }),
    [basis, setBasis] = useState<CostQuery["basis"]>("ActualCost"),
    [tenant, setTenant] = useState(""),
    [client, setClient] = useState(""),
    [info, setPageInfo] = useState<{ tab: string; message: string }>(),
    [groupBy, setGroupBy] = useState<CostQuery["groupBy"]>("ServiceName"),
    [granularity, setGranularity] = useState<CostQuery["granularity"]>("Daily");
  const setInfo = (message: string) =>
    setPageInfo(message ? { tab, message } : undefined);
  useEffect(() => {
    setPageInfo(undefined);
  }, [tab]);
  useEffect(() => {
    if (tab !== "home" || !settingsLoaded) return;
    const controller = new AbortController();
    let checking = false;
    const refreshConnections = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const profiles = await manageRequest(
          "/mcp-connections",
          "GET",
          undefined,
          controller.signal,
        );
        if (!controller.signal.aborted && Array.isArray(profiles)) {
          setMcpProfiles(profiles);
        }
      } catch {
        // Keep the last snapshot until the next refresh.
      } finally {
        checking = false;
      }
    };
    void refreshConnections();
    const timer = setInterval(() => void refreshConnections(), 15000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [tab, settingsLoaded]);
  useEffect(() => {
    setHubId("");
  }, [boot?.activeAccessId, boot?.authenticated]);
  useEffect(() => {
    let active = true;
    api
      .bootstrap()
      .then((b) => {
        if (active) {
          setBoot(b);
          if (b.activeAccessId) setChosenAccess(b.activeAccessId);
          void reloadSettings();
          setPeriod(b.period);
          setTenant(b.tenantId);
          setClient(b.clientId);
          if (b.loginError) setError(b.loginError.message);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  const needsAzureInventory = [
    "costs",
    "tag-costs",
    "forecast",
    "budgets",
    "benefits",
    "chat",
    "hubs",
    "api-lab",
  ].includes(tab);
  useEffect(() => {
    if (!boot?.authenticated || !needsAzureInventory) return;
    const c = new AbortController();
    api
      .subscriptions(c.signal)
      .then((s) => {
        setSubs(s);
        setSub(s[0]?.id || "");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [boot?.authenticated, needsAzureInventory]);
  useEffect(() => {
    setGroup("");
    setGroups([]);
    if (!sub) return;
    const c = new AbortController();
    api
      .groups(sub, c.signal)
      .then(setGroups)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [sub]);
  const scope = useMemo<Scope | undefined>(
    () =>
      boot?.authenticated && sub
        ? {
            tenantId: boot.tenantId,
            subscriptionId: sub,
            ...(group ? { resourceGroup: group } : {}),
          }
        : undefined,
    [boot, sub, group],
  );
  const query = useMemo<CostQuery | undefined>(
    () => (scope ? { scope, period, basis, groupBy, granularity } : undefined),
    [scope, period, basis, groupBy, granularity],
  );
  const chatSelection = useMemo(
    () =>
      boot?.activeAccessId
        ? {
            hubId: hubId || undefined,
            accessId: boot.activeAccessId,
            source,
            mcpConnectionId: mcpId || undefined,
          }
        : undefined,
    [boot?.activeAccessId, source, mcpId, hubId],
  );
  useEffect(
    () => setInsight(undefined),
    [
      scope,
      basis,
      source,
      mcpId,
      hubId,
      period,
      boot?.activeAccessId,
      boot?.authenticated,
    ],
  );
  async function connect(
    accessId?: string,
    mode: "user" | "application" = "user",
    inline = false,
  ) {
    if (accessId && mode === "application") {
      setError("");
      setInfo("");
      if (inline)
        setConnectionFeedback({
          id: accessId,
          kind: "pending",
          message: "Conectando aplicação…",
        });
      try {
        const r = await manageRequest(
          "/accesses/" + accessId + "/connect",
          "POST",
          {
            mode,
          },
        );
        const b = await api.bootstrap();
        setBoot(b);
        const detail = r?.accessName
          ? `"${r.accessName}" (client ${r.clientId}, tenant ${r.tenantId}) — token ARM válido até ${new Date(r.expiresAt).toLocaleString("pt-BR")}.`
          : "";
        if (inline)
          setConnectionFeedback({
            id: accessId,
            kind: "success",
            message: "Aplicação conectada com sucesso. " + detail,
          });
        else
          setInfo(
            "Identidade de aplicação conectada " +
              detail +
              " Nenhum login de usuário foi solicitado.",
          );
      } catch (e) {
        if (inline)
          setConnectionFeedback({
            id: accessId,
            kind: "error",
            message: (e as Error).message,
          });
        else setError((e as Error).message);
      }
      return;
    }
    if (loginPending) return;
    setError("");
    const popup = window.open(
      "about:blank",
      "azure-cost-login",
      "popup=yes,width=560,height=760",
    );
    if (!popup) {
      setError(
        "Permita pop-ups para localhost para abrir o login em uma janela separada.",
      );
      return;
    }
    const note = popup.document.createElement("p");
    note.textContent = "Preparando o login Microsoft…";
    popup.document.body.append(note);
    setLoginPending(true);
    setInfo(
      "Conclua o login na janela separada. O dashboard será atualizado automaticamente.",
    );
    try {
      let login: { url: string };
      if (accessId)
        login = await manageRequest(
          "/accesses/" + accessId + "/connect",
          "POST",
          { mode },
        );
      else {
        await api.config(tenant.trim(), client.trim());
        const b = await api.bootstrap();
        setBoot(b);
        login = await api.login();
      }
      popup.location.assign(login.url);
      popup.focus();
      const started = Date.now();
      let checking = false;
      loginTimer.current = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          const current = await api.bootstrap();
          if (current.authenticated || current.loginError) {
            clearInterval(loginTimer.current);
            loginTimer.current = undefined;
            setLoginPending(false);
            setBoot(current);
            setError(current.loginError?.message || "");
            setInfo(
              current.authenticated
                ? "Login Microsoft concluído."
                : "A tentativa de login não foi concluída. Veja a mensagem acima.",
            );
          } else if (Date.now() - started > 600000) {
            clearInterval(loginTimer.current);
            loginTimer.current = undefined;
            setLoginPending(false);
            setInfo(
              "A tentativa de login expirou. Você pode iniciar uma nova janela.",
            );
          }
        } catch (e) {
          clearInterval(loginTimer.current);
          loginTimer.current = undefined;
          setLoginPending(false);
          setError((e as Error).message);
        } finally {
          checking = false;
        }
      }, 1000);
    } catch (e) {
      popup.close();
      setLoginPending(false);
      setInfo("");
      setError((e as Error).message);
    }
  }
  async function openResourceLogin(id: string, kind = "mcp-connections") {
    const popup = window.open(
      "about:blank",
      "azure-cost-login",
      "popup=yes,width=560,height=760",
    );
    if (!popup) {
      setError("Permita pop-ups para localhost.");
      return;
    }
    try {
      const r = await manageRequest(
        "/" + kind + "/" + id + "/login",
        "POST",
        {},
      );
      popup.location.assign(r.url);
      setInfo("Autorize o recurso na janela separada.");
      let checking = false;
      const started = Date.now();
      const timer = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          const b = await api.bootstrap();
          if (
            b.authenticated ||
            b.loginError ||
            Date.now() - started > 600000
          ) {
            clearInterval(timer);
            setBoot(b);
            setError(b.loginError?.message || "");
            setInfo(b.authenticated ? "Recurso autorizado." : "");
            void reloadSettings();
          }
        } finally {
          checking = false;
        }
      }, 1000);
    } catch (e) {
      popup.close();
      setError((e as Error).message);
    }
  }
  async function logout() {
    setInsight(undefined);
    try {
      await api.logout();
      setBoot(await api.bootstrap());
      setSub("");
      setSubs([]);
      setInfo("Sessão encerrada. Dados em memória foram limpos.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-section">WORKSPACE LOCAL</div>
        <Navigation tab={tab} onSelect={setTab} />
        <Welcome />

        <div className="sidebar-bottom">
          <div className="local-light" /> Serviço no notebook
          <span className="version">MVP · 0.5.2</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <Breadcrumbs tab={tab} onHome={() => setTab("home")} />
          <div className="topbar-right">
            <ThemeControl />
            <span className="badge">Somente leitura</span>
            <span className="avatar">{boot?.authenticated ? "✓" : "↗"}</span>
            {boot?.authenticated && <button onClick={logout}>Sair</button>}
          </div>
        </header>
        <div className="workspace">
          {["costs", "multicloud"].includes(tab) && (
            <CommandHero
              insight={insight}
              accesses={accesses.length}
              mcps={mcpProfiles.length}
              agents={agentProfiles.length}
              onChat={() => setTab("chat")}
              onExplore={() => setTab("multicloud")}
            />
          )}

          <div className="page-heading">
            <div>
              <span className="eyebrow">WORKSPACE FINOPS</span>
              <h1>
                {tab === "multicloud"
                  ? "FinOps sem fronteiras."
                  : pageTitle(tab)}
              </h1>
            </div>
            <span className="workspace-label">● WORKSPACE LOCAL</span>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={() => setError("")}>Fechar</button>
            </div>
          )}
          {info?.tab === tab && <p className="notice">{info.message}</p>}
          {!boot ? (
            <p role="status">Iniciando serviço local…</p>
          ) : (
            !boot.authenticated &&
            ![
              "home",
              "knowledge",
              "investigations",
              "accesses",
              "mcps",
              "agents",
              "diagnostics",
              "help",
              "mcps",
              "mcp-analysis",
              "discovery",
              "agent-lab",
              "multicloud",
            ].includes(tab) && (
              <section className="setup">
                <div className="setup-copy">
                  <span className="eyebrow">COMECE PELA CONEXÃO</span>
                  <h2>Conecte sua conta Azure</h2>
                  <p>
                    Entre pela página oficial da Microsoft, com sua conta e MFA.
                    Sua senha permanece com a Microsoft.
                  </p>
                  <ul>
                    <li>Dados reais do seu escopo autorizado</li>
                    <li>Nenhuma alteração na sua infraestrutura</li>
                    <li>Identificadores mantidos somente nesta execução</li>
                  </ul>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void connect();
                  }}
                >
                  <label>
                    Tenant ID
                    <input
                      value={tenant}
                      onChange={(e) => setTenant(e.target.value)}
                      placeholder="Identificador do diretório"
                      required
                      pattern="[0-9a-fA-F-]{36}"
                    />
                  </label>
                  <label>
                    Application (Client) ID
                    <input
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      placeholder="Identificador do aplicativo público"
                      required
                      pattern="[0-9a-fA-F-]{36}"
                    />
                  </label>
                  <button
                    className="primary"
                    type="submit"
                    disabled={loginPending}
                  >
                    {loginPending
                      ? "Aguardando login…"
                      : "Entrar com Microsoft"}{" "}
                    <span>↗</span>
                  </button>
                  <small>
                    Callback: http://localhost:4317/api/auth/callback
                    <br />
                    Aplicativo público no Entra · sem Client Secret
                  </small>
                </form>
              </section>
            )
          )}
          {accesses.length > 0 &&
            ![
              "home",
              "knowledge",
              "investigations",
              "accesses",
              "mcps",
              "agents",
              "diagnostics",
              "help",
              "mcps",
              "mcp-analysis",
              "discovery",
              "agent-lab",
              "multicloud",
            ].includes(tab) && (
              <section className="connection-toolbar">
                <label>
                  Acesso salvo
                  <select
                    value={chosenAccess}
                    onChange={(e) => {
                      setChosenAccess(e.target.value);
                      const a = accesses.find((x) => x.id === e.target.value);
                      if (a) setAccessMode(a.preferredMode);
                    }}
                  >
                    <option value="">Selecione um acesso</option>
                    {accesses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Autenticação
                  <select
                    value={accessMode}
                    onChange={(e) => setAccessMode(e.target.value as any)}
                  >
                    <option value="user">Usuário</option>
                    <option value="application">Aplicação com Secret</option>
                  </select>
                </label>
                <button
                  disabled={!chosenAccess || loginPending}
                  onClick={() => void connect(chosenAccess, accessMode)}
                >
                  Conectar acesso
                </button>
                <label>
                  Fonte dos dados
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as any)}
                  >
                    <option value="api">APIs Azure</option>
                    <option value="mcp">Servidor MCP</option>
                  </select>
                </label>
                {source === "mcp" && (
                  <label>
                    Conexão MCP
                    <select
                      value={mcpId}
                      onChange={(e) => setMcpId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {mcpProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <small>
                  Serviço da aplicação: local · Identidade:{" "}
                  {boot?.principalKind === "application"
                    ? "aplicação"
                    : "usuário"}{" "}
                  · Acesso ativo:{" "}
                  {accesses.find((a) => a.id === boot?.activeAccessId)?.name ||
                    "login pessoal existente / desconectado"}
                </small>
              </section>
            )}
          {source === "mcp" &&
            ["costs", "forecast", "budgets", "benefits", "chat"].includes(
              tab,
            ) && (
              <section className="notice" role="status">
                <strong>Fonte selecionada: servidor MCP.</strong>
                <p>
                  {tab === "chat"
                    ? "No chat, o MCP oferece somente as tools descobertas e permitidas. A tool pricing_get consulta preços de catálogo; não comprova o gasto do RG. Confira as capacidades em Conexões > MCPs > Análise."
                    : "Esta operação usa APIs Azure nesta versão. Uma identidade de aplicação com Secret pode consultar essas APIs quando tem as permissões necessárias. O canal MCP selecionado ainda não está conectado a este cartão; isso não é falha do Secret ou do login. Escolha APIs Azure para continuar, ou avalie o servidor em Conexões > MCPs > Análise."}
                </p>
                <button
                  onClick={() => {
                    setSource("api");
                    setHubId("");
                  }}
                >
                  Usar APIs Azure para consultar gastos
                </button>
                <button onClick={() => setTab("diagnostics")}>
                  Ver diagnóstico
                </button>
              </section>
            )}
          {![
            "home",
            "knowledge",
            "investigations",
            "accesses",
            "mcps",
            "agents",
            "diagnostics",
            "help",
            "mcps",
            "mcp-analysis",
            "discovery",
            "agent-lab",
            "multicloud",
          ].includes(tab) && (
            <ScopeFilters
              subscriptions={subs}
              subscription={sub}
              setSubscription={setSub}
              groups={groups}
              group={group}
              setGroup={setGroup}
              period={period}
              setPeriod={setPeriod}
              basis={basis}
              setBasis={setBasis}
              disabled={
                !boot?.authenticated ||
                (source === "mcp" &&
                  ["costs", "forecast", "budgets", "benefits"].includes(tab))
              }
            />
          )}
          <div hidden={tab !== "multicloud"}>
            <section className="content-card">
              <Multicloud
                scope={scope}
                period={period}
                onAzure={() => setTab("costs")}
              />
            </section>
          </div>
          <section className="content-card" hidden={tab === "multicloud"}>
            {tab === "home" && (
              <WorkspaceHome
                mcps={mcpProfiles}
                agents={agentProfiles}
                accesses={accesses}
                loaded={settingsLoaded}
                onSelect={setTab}
                onInspect={(id) => {
                  setAnalysisMcpId(id);
                  setTab("mcp-analysis");
                }}
              />
            )}
            {tab === "knowledge" && <Knowledge />}
            {tab === "investigations" && (
              <Investigations
                mcps={mcpProfiles}
                agents={agentProfiles}
                onAzure={() => setTab("chat")}
              />
            )}
            {tab === "help" && <Help />}
            {tab === "discovery" && (
              <Discovery
                onNavigate={setTab}
                onConfigure={(draft) => {
                  setMcpDraft(draft);
                  setTab("mcps");
                }}
              />
            )}
            {tab === "tag-costs" &&
              (source === "api" ? (
                <TagCosts query={query} />
              ) : (
                <p>
                  Escolha APIs Azure para consultar tags históricas da cobrança.
                </p>
              ))}
            {tab === "api-lab" &&
              (source === "api" ? (
                <ApiLab query={query} />
              ) : (
                <p>Escolha APIs Azure antes de testar nesta página.</p>
              ))}
            {tab === "agent-lab" && (
              <section>
                <h2>Avaliação de agentes</h2>
                <p>
                  Use Testar modelo nos cartões abaixo. Saúde do endpoint HTTP
                  não comprova acesso financeiro. Confira runtime, acesso,
                  ferramentas autorizadas e limites antes de testar; veja a
                  execução completa no Chat e correlacione com Diagnóstico.
                </p>
              </section>
            )}
            {tab === "diagnostics" && <DiagnosticPanel />}
            {tab === "hubs" && (
              <Hubs
                key={boot?.activeAccessId}
                accesses={accesses}
                mcps={mcpProfiles}
                scope={scope}
                basis={basis}
                selected={hubId}
                onSelect={setHubId}
                onLogin={(id) => void openResourceLogin(id, "hubs")}
              />
            )}
            {tab === "accesses" && (
              <Accesses
                profiles={accesses}
                onChanged={() => void reloadSettings()}
                connectionFeedback={connectionFeedback}
                onConnect={(id, mode) => void connect(id, mode, true)}
              />
            )}
            {["mcps", "mcp-analysis"].includes(tab) && (
              <McpConnections
                key={tab}
                initialConnectionId={
                  tab === "mcp-analysis" ? analysisMcpId : undefined
                }
                initialDraft={tab === "mcps" ? mcpDraft : undefined}
                onDraftConsumed={() => setMcpDraft(undefined)}
                activeAccessId={boot?.activeAccessId}
                azureAuthenticated={boot?.authenticated}
                principalKind={boot?.principalKind}
                onConnectAccess={(id, mode) => void connect(id, mode)}
                mode={tab === "mcp-analysis" ? "analysis" : "integration"}
                onInspect={(id) => {
                  setAnalysisMcpId(id || "");
                  setTab("mcp-analysis");
                }}
                profiles={mcpProfiles}
                accesses={accesses}
                onChanged={() => void reloadSettings()}
                onLogin={(id) => void openResourceLogin(id)}
              />
            )}
            {["agents", "agent-lab"].includes(tab) && (
              <Agents
                evaluationOnly={tab === "agent-lab"}
                onOpenChat={() => setTab("chat")}
                profiles={agentProfiles}
                accesses={accesses}
                mcps={mcpProfiles}
                onChanged={() => void reloadSettings()}
              />
            )}
            {tab === "forecast" && (
              <fieldset className="channel-guard" disabled={source === "mcp"}>
                <Forecast
                  key={boot?.activeAccessId + "|" + source}
                  scope={scope}
                  period={period}
                  basis={basis}
                  onMonth={() => {
                    const parts = new Intl.DateTimeFormat("en-CA", {
                      timeZone: "America/Sao_Paulo",
                      year: "numeric",
                      month: "2-digit",
                    }).formatToParts(new Date());
                    const y = Number(
                        parts.find((p) => p.type === "year")!.value,
                      ),
                      m =
                        Number(parts.find((p) => p.type === "month")!.value) -
                        1;
                    setPeriod({
                      from: new Date(Date.UTC(y, m, 1))
                        .toISOString()
                        .slice(0, 10),
                      toExclusive: new Date(Date.UTC(y, m + 1, 1))
                        .toISOString()
                        .slice(0, 10),
                      timeZone: "America/Sao_Paulo",
                    });
                  }}
                />
              </fieldset>
            )}
            {tab === "costs" && (
              <>
                <div className="toolbar compact">
                  <label>
                    Detalhar por
                    <select
                      value={groupBy}
                      onChange={(e) =>
                        setGroupBy(e.target.value as CostQuery["groupBy"])
                      }
                    >
                      <option value="ServiceName">Serviço</option>
                      <option value="ResourceId">Recurso</option>
                    </select>
                  </label>
                  <label>
                    Série
                    <select
                      value={granularity}
                      onChange={(e) =>
                        setGranularity(
                          e.target.value as CostQuery["granularity"],
                        )
                      }
                    >
                      <option value="Daily">Diária</option>
                      <option value="Monthly">Mensal</option>
                    </select>
                  </label>
                  <button onClick={() => boot && setPeriod(boot.period)}>
                    Dois meses completos
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date().toLocaleDateString("en-CA", {
                        timeZone: "America/Sao_Paulo",
                      });
                      const to = new Date(today + "T00:00:00Z");
                      to.setUTCDate(to.getUTCDate() + 1);
                      const from = new Date(to);
                      from.setUTCDate(from.getUTCDate() - 60);
                      setPeriod({
                        from: from.toISOString().slice(0, 10),
                        toExclusive: to.toISOString().slice(0, 10),
                        timeZone: "America/Sao_Paulo",
                      });
                    }}
                  >
                    Últimos 60 dias
                  </button>
                </div>
                <Costs
                  key={boot?.activeAccessId + "|" + source + "|" + mcpId}
                  query={query}
                  connected={!!boot?.authenticated && source === "api"}
                />
              </>
            )}
            {tab === "budgets" && (
              <fieldset className="channel-guard" disabled={source === "mcp"}>
                <Budgets
                  key={boot?.activeAccessId + "|" + source + "|" + mcpId}
                  scope={scope}
                />
              </fieldset>
            )}{" "}
            {tab === "benefits" && (
              <fieldset className="channel-guard" disabled={source === "mcp"}>
                <Benefits
                  key={boot?.activeAccessId + "|" + source + "|" + mcpId}
                  scope={scope}
                />
              </fieldset>
            )}{" "}
            {tab === "chat" && (
              <Chat
                onInsight={setInsight}
                key={
                  boot?.activeAccessId +
                  "|" +
                  source +
                  "|" +
                  mcpId +
                  "|" +
                  hubId
                }
                scope={scope}
                basis={basis}
                selectedSource={source}
                connectionLabel={mcpProfiles.find((p) => p.id === mcpId)?.name}
                agents={agentProfiles}
                selection={chatSelection}
              />
            )}
          </section>
          <footer className="page-footer">
            <span>TESSERACT · FinOps e IA, decisões informadas.</span>
            <span>America/Sao_Paulo · valores na moeda de origem</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
