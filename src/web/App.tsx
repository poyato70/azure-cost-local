import { useEffect, useMemo, useState, useRef } from "react";
import type {
  Scope,
  DateRange,
  CostQuery,
  Subscription,
} from "../shared/contracts.js";
import { api, type Bootstrap } from "./api.js";
import { ScopeFilters } from "./components/ScopeFilters.js";
import { Costs } from "./pages/Costs.js";
import { Budgets } from "./pages/Budgets.js";
import { Benefits } from "./pages/Benefits.js";
import { Chat } from "./pages/Chat.js";
const tabs = [
  { id: "costs", label: "Custos", icon: "◷" },
  { id: "benefits", label: "Compromissos", icon: "◇" },
  { id: "budgets", label: "Budgets", icon: "▤" },
  { id: "chat", label: "Chat", icon: "✳" },
];
export function App() {
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
    [tab, setTab] = useState("costs"),
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
    [info, setInfo] = useState(""),
    [groupBy, setGroupBy] = useState<CostQuery["groupBy"]>("ServiceName"),
    [granularity, setGranularity] = useState<CostQuery["granularity"]>("Daily");
  useEffect(() => {
    let active = true;
    api
      .bootstrap()
      .then((b) => {
        if (active) {
          setBoot(b);
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
  useEffect(() => {
    if (!boot?.authenticated) return;
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
  }, [boot?.authenticated]);
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
  async function connect() {
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
      await api.config(tenant.trim(), client.trim());
      const b = await api.bootstrap();
      setBoot(b);
      const login = await api.login();
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
                ? "Login Microsoft concluído. Selecione seu escopo para consultar."
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
  async function logout() {
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
        <a className="brand" href="/">
          <span className="brand-mark">
            A<span>↗</span>
          </span>
          <div>
            AZURE COST<small>VISÃO DA NUVEM</small>
          </div>
        </a>
        <div className="sidebar-section">WORKSPACE LOCAL</div>
        <nav aria-label="Navegação principal">
          {tabs.map((t) => (
            <button
              aria-label={t.label}
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.id === "chat" && <small>AI</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-light" /> Serviço no notebook
          <p>
            Conectado às fontes oficiais.
            <br />
            Você mantém o controle.
          </p>
          <span className="version">MVP · 0.1</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>Visão geral</strong>
          </span>
          <div className="topbar-right">
            <span className="badge">Somente leitura</span>
            <span className="avatar">{boot?.authenticated ? "✓" : "↗"}</span>
            {boot?.authenticated && <button onClick={logout}>Sair</button>}
          </div>
        </header>
        <div className="workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">CLAREZA PARA CADA DECISÃO</span>
              <h1>Sua nuvem, em perspectiva.</h1>
              <p>
                Custos, compromissos e conversas. Uma visão conectada ao Azure.
              </p>
            </div>
            <span className="workspace-label">● LOCAL / PESSOAL</span>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={() => setError("")}>Fechar</button>
            </div>
          )}
          {info && <p className="notice">{info}</p>}
          {!boot ? (
            <p role="status">Iniciando serviço local…</p>
          ) : (
            !boot.authenticated && (
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
            disabled={!boot?.authenticated}
          />
          <section className="content-card">
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
                <Costs query={query} connected={!!boot?.authenticated} />
              </>
            )}
            {tab === "budgets" && <Budgets scope={scope} />}{" "}
            {tab === "benefits" && <Benefits scope={scope} />}{" "}
            {tab === "chat" && <Chat scope={scope} basis={basis} />}
          </section>
          <footer className="page-footer">
            <span>Azure Cost · fontes oficiais, decisões informadas.</span>
            <span>America/Sao_Paulo · valores na moeda de origem</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
