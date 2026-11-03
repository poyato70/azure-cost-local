import { useEffect, useState } from "react";
import type {
  McpProfile,
  PublicAccessProfile,
} from "../../shared/connections.js";
import { manageRequest } from "../api.js";
const defaults = {
  azure: { endpoint: "", transport: "stdio" },
  adx: { endpoint: "", transport: "stdio" },
  foundry: { endpoint: "https://mcp.ai.azure.com", transport: "http" },
  fabric: {
    endpoint: "https://api.fabric.microsoft.com/v1/mcp/core",
    transport: "http",
  },
  powerbi: {
    endpoint: "https://api.fabric.microsoft.com/v1/mcp/powerbi",
    transport: "http",
  },
};
const empty = {
  name: "",
  preset: "azure",
  transport: "stdio",
  endpoint: "",
  audience: "",
  accessId: "",
  authMode: "application",
  resourceContext: { namespace: "pricing" },
  allowPrivateNetwork: false,
};
export function McpConnections({
  profiles,
  accesses,
  onChanged,
  onLogin,
}: {
  profiles: any[];
  accesses: PublicAccessProfile[];
  onChanged: () => void;
  onLogin: (id: string) => void;
}) {
  const [form, setForm] = useState<any>(empty),
    [context, setContext] = useState(
      JSON.stringify(empty.resourceContext, null, 2),
    ),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tools, setTools] = useState<any[]>([]),
    [inspected, setInspected] = useState(""),
    [chosen, setChosen] = useState<string[]>([]),
    [toolName, setToolName] = useState(""),
    [args, setArgs] = useState("{}"),
    [result, setResult] = useState<unknown>(),
    [matrix, setMatrix] = useState<any[]>([]);
  useEffect(() => {
    void manageRequest("/mcp-presets").then((x) =>
      setMatrix(Array.isArray(x) ? x : []),
    );
  }, []);
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setNotice("");
    try {
      const r = await fn();
      onChanged();
      return r;
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (k: string, v: unknown) =>
    setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Servidores MCP</h2>
          <p>
            Conexões reais do protocolo MCP, com autenticação e ferramentas por
            serviço.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(empty);
            setContext(JSON.stringify(empty.resourceContext, null, 2));
          }}
        >
          Nova conexão
        </button>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="settings-layout">
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await manageRequest(
                "/mcp-connections" + (form.id ? "/" + form.id : ""),
                form.id ? "PATCH" : "POST",
                {
                  ...form,
                  endpoint: form.endpoint || undefined,
                  audience: form.audience || undefined,
                  accessId: form.accessId || undefined,
                  resourceContext: JSON.parse(context),
                },
              );
              setNotice(
                "Conexão salva. Teste a autenticação e revise as ferramentas.",
              );
              setForm(empty);
              return r;
            });
          }}
        >
          <h3>{form.id ? "Editar MCP" : "Cadastrar MCP"}</h3>
          <label>
            Nome
            <input
              required
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label>
            Serviço
            <select
              aria-label="Serviço"
              value={form.preset}
              onChange={(e) => {
                const preset = e.target.value as keyof typeof defaults;
                setForm({
                  ...empty,
                  ...defaults[preset],
                  preset,
                  authMode:
                    defaults[preset].transport === "stdio"
                      ? "application"
                      : "delegated",
                });
                setContext(
                  JSON.stringify(
                    preset === "adx"
                      ? { clusterUri: "", database: "" }
                      : preset === "powerbi"
                        ? { modelId: "" }
                        : preset === "fabric"
                          ? { workspaceId: "" }
                          : preset === "azure"
                            ? { namespace: "pricing" }
                            : {},
                    null,
                    2,
                  ),
                );
              }}
            >
              {Object.keys(defaults).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Transporte
            <select
              value={form.transport}
              onChange={(e) => field("transport", e.target.value)}
            >
              <option value="stdio">Local · stdio (servidor oficial)</option>
              <option value="http">HTTP remoto</option>
            </select>
          </label>
          {form.transport === "http" && (
            <label>
              Endpoint MCP
              <input
                type="url"
                required
                value={form.endpoint}
                onChange={(e) => field("endpoint", e.target.value)}
              />
            </label>
          )}
          {form.transport === "http" &&
            ["azure", "adx"].includes(form.preset) && (
              <label>
                Audience do servidor MCP próprio (api://ID do aplicativo)
                <input
                  required
                  value={form.audience || ""}
                  onChange={(e) => field("audience", e.target.value)}
                />
              </label>
            )}
          <label>
            Acesso vinculado
            <select
              required
              value={form.accessId}
              onChange={(e) => field("accessId", e.target.value)}
            >
              <option value="">Selecione</option>
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
              value={form.authMode}
              onChange={(e) => field("authMode", e.target.value)}
            >
              <option value="delegated">Usuário delegado</option>
              <option value="application">Identidade de aplicação</option>
            </select>
          </label>
          <label>
            Contexto de recursos (JSON)
            <textarea
              rows={5}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </label>
          <small>
            Os nomes dos campos devem corresponder aos parâmetros das
            ferramentas. ADX exige clusterUri/database; Power BI exige modelId.
            Azure local: namespace
            pricing/advisor/optimization/subscription/group.
          </small>
          <label className="consent">
            <input
              type="checkbox"
              checked={form.allowPrivateNetwork}
              onChange={(e) => field("allowPrivateNetwork", e.target.checked)}
            />
            Autorizar rede privada / loopback deste endpoint
          </label>
          <button className="primary" disabled={busy}>
            Salvar MCP
          </button>
          <small>
            Teste de servidor stdio pode baixar a versão oficial fixada: Azure
            3.0.0 ou Fabric 1.7.0. Nenhum comando livre é aceito.
          </small>
        </form>
        <div>
          {profiles.map((p) => (
            <article className="config-card" key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {p.preset} · {p.transport} · {p.authMode}
              </p>
              <p>{p.status || "cadastrado"}</p>
              <small>
                {p.capability?.status}: {p.capability?.reason}
              </small>
              <div className="actions">
                <button
                  disabled={busy || p.capability?.status === "unsupported"}
                  onClick={() =>
                    void run(async () => {
                      const r = await manageRequest(
                        "/mcp-connections/" + p.id + "/test",
                        "POST",
                        {},
                      );
                      setTools(r.tools);
                      setChosen(
                        r.tools
                          .filter((t: any) => t.approved)
                          .map((t: any) => t.name),
                      );
                      setInspected(p.id);
                      setNotice(r.message);
                      return r;
                    })
                  }
                >
                  Testar / descobrir
                </button>
                {p.transport === "http" && p.authMode === "delegated" && (
                  <button onClick={() => onLogin(p.id)}>
                    Autorizar recurso
                  </button>
                )}
                <button
                  onClick={() => {
                    const {
                      id,
                      name,
                      preset,
                      transport,
                      endpoint,
                      accessId,
                      authMode,
                      audience,
                      resourceContext,
                      approvedTools,
                      configurationVersion,
                      allowPrivateNetwork,
                    } = p;
                    setForm({
                      id,
                      name,
                      preset,
                      transport,
                      endpoint: endpoint || "",
                      accessId: accessId || "",
                      authMode,
                      audience,
                      approvedTools,
                      allowPrivateNetwork,
                      expectedVersion: configurationVersion,
                    });
                    setContext(JSON.stringify(resourceContext, null, 2));
                  }}
                >
                  Editar
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      manageRequest(
                        "/mcp-connections/" + p.id + "/disconnect",
                        "POST",
                        {},
                      ),
                    )
                  }
                >
                  Desconectar
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      manageRequest("/mcp-connections/" + p.id, "DELETE"),
                    )
                  }
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {inspected && (
        <section className="tool-review">
          <h3>Ferramentas descobertas</h3>
          <p className="fine">
            Somente ferramentas conhecidas de leitura podem ser aprovadas.
            Aprovação é vinculada ao schema.
          </p>
          {tools.map((t) => (
            <label className="tool-row" key={t.name}>
              <input
                type="checkbox"
                disabled={!t.reviewable}
                checked={chosen.includes(t.name)}
                onChange={(e) =>
                  setChosen((x) =>
                    e.target.checked
                      ? [...x, t.name]
                      : x.filter((n) => n !== t.name),
                  )
                }
              />
              <span>
                <strong>{t.name}</strong>
                <small>
                  {t.reviewable
                    ? "Elegível para aprovação"
                    : "Bloqueada pela política"}{" "}
                  · {t.description}
                </small>
              </span>
            </label>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await manageRequest(
                  "/mcp-connections/" + inspected + "/approve-tools",
                  "POST",
                  { names: chosen },
                );
                setNotice(
                  "Aprovação salva. Conexão anterior encerrada; o próximo teste usará a nova revisão.",
                );
              })
            }
          >
            Salvar ferramentas aprovadas
          </button>
          <div className="settings-form">
            <h3>Consulta de teste</h3>
            <label>
              Ferramenta
              <select
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
              >
                <option value="">Selecione</option>
                {tools
                  .filter((t) => chosen.includes(t.name))
                  .map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
              </select>
            </label>
            <label>
              Argumentos JSON
              <textarea
                value={args}
                onChange={(e) => setArgs(e.target.value)}
              />
            </label>
            <button
              disabled={!toolName || busy}
              onClick={() =>
                void run(async () => {
                  const r = await manageRequest(
                    "/mcp-connections/" + inspected + "/call",
                    "POST",
                    { name: toolName, arguments: JSON.parse(args) },
                  );
                  setResult(r);
                  return r;
                })
              }
            >
              Executar leitura aprovada
            </button>
            {result !== undefined && (
              <pre>{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
        </section>
      )}
      <details>
        <summary>Matriz de autenticação documentada</summary>
        {matrix.map((p) => (
          <div key={p.id}>
            <h3>{p.name}</h3>
            {p.modes.map((m: any, i: number) => (
              <p key={i} className="fine">
                {m.transport} / {m.authMode}: {m.status} — {m.reason}
              </p>
            ))}
          </div>
        ))}
      </details>
    </>
  );
}
