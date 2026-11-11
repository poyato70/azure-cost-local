import { McpDetails, McpIdentity } from "../components/McpDetails.js";
import { ArmScopePicker } from "../components/ArmScopePicker.js";
import { McpLab } from "./McpLab.js";
import {
  SchemaInputs,
  schemaDefaults,
  resolveSchema,
} from "../components/SchemaInputs.js";
import { useEffect, useState } from "react";
import { McpToolResult } from "../components/McpToolResult.js";
import type {
  McpProfile,
  PublicAccessProfile,
} from "../../shared/connections.js";
import { manageRequest } from "../api.js";
import { applyPricingDefaults } from "../components/pricing-defaults.js";
const defaults = {
  kubernetes: { endpoint: "", transport: "http" },
  custom: { endpoint: "", transport: "http" },
  arm: { endpoint: "https://mcp.management.azure.com", transport: "http" },
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
  initialConnectionId,
  initialDraft,
  onDraftConsumed,
  activeAccessId,
  azureAuthenticated,
  principalKind,
  onConnectAccess,
  mode = "integration",
  onInspect,
  accesses,
  onChanged,
  onLogin,
}: {
  mode?: "integration" | "analysis";
  initialConnectionId?: string;
  initialDraft?: any;
  onDraftConsumed?: () => void;
  activeAccessId?: string;
  azureAuthenticated?: boolean;
  principalKind?: string;
  onConnectAccess?: (id: string, mode: "user" | "application") => void;
  onInspect?: (id?: string) => void;
  profiles: any[];
  accesses: PublicAccessProfile[];
  onChanged: () => void;
  onLogin: (id: string) => void;
}) {
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  useEffect(() => {
    if (initialDraft) onDraftConsumed?.();
  }, [initialDraft, onDraftConsumed]);
  const [token, setToken] = useState("");
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [form, setForm] = useState<any>({ ...empty, ...initialDraft }),
    [context, setContext] = useState(
      JSON.stringify(
        initialDraft?.resourceContext || empty.resourceContext,
        null,
        2,
      ),
    ),
    [notice, setNotice] = useState(""),
    [noticeTarget, setNoticeTarget] = useState("form"),
    [busy, setBusy] = useState(false),
    [tools, setTools] = useState<any[]>([]),
    [inspected, setInspected] = useState(initialConnectionId || ""),
    [chosen, setChosen] = useState<string[]>([]),
    [toolName, setToolName] = useState(""),
    [args, setArgs] = useState("{}"),
    [result, setResult] = useState<any>(),
    [argumentsValue, setArgumentsValue] = useState<Record<string, unknown>>({}),
    [advanced, setAdvanced] = useState(false),
    [execution, setExecution] = useState<{ kind: string; message: string }>(),
    [matrix, setMatrix] = useState<any[]>([]);
  const independent = ["kubernetes", "custom"].includes(form.preset);
  useEffect(() => {
    if (mode === "analysis") {
      void manageRequest("/mcp-presets")
        .then((x) => setMatrix(Array.isArray(x) ? x : []))
        .catch(() => setMatrix([]));
    }
  }, [mode]);
  async function run(fn: () => Promise<any>, target = "form") {
    setBusy(true);
    setNoticeTarget(target);
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
  let contextFields: Record<string, string> = {};
  try {
    const parsed = JSON.parse(context);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      contextFields = parsed;
  } catch {
    /* O editor avançado pode estar incompleto. */
  }
  const setContextField = (name: string, value: string) =>
    setContext(JSON.stringify({ ...contextFields, [name]: value }, null, 2));
  const selectedTool = tools.find((t) => t.name === toolName);
  const selectionDirty = tools.some(
    (t) => chosen.includes(t.name) !== !!t.approved,
  );
  function chooseTool(name: string) {
    setToolName(name);
    const value = applyPricingDefaults(
      name,
      tools.find((t) => t.name === name)?.inputSchema,
      schemaDefaults(tools.find((t) => t.name === name)?.inputSchema) || {},
      true,
    );
    setArgumentsValue(value);
    setArgs(JSON.stringify(value, null, 2));
    setResult(undefined);
    setExecution(undefined);
    setAdvanced(false);
  }
  async function executeTool(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(undefined);
    setExecution({
      kind: "pending",
      message: "Executando " + toolName + " no servidor selecionado…",
    });
    const start = Date.now();
    try {
      const argumentsData = applyPricingDefaults(
        toolName,
        selectedTool?.inputSchema,
        advanced ? JSON.parse(args) : argumentsValue,
      );
      setArgumentsValue(argumentsData);
      setArgs(JSON.stringify(argumentsData, null, 2));
      const r = await manageRequest(
        "/mcp-connections/" + inspected + "/call",
        "POST",
        { name: toolName, arguments: argumentsData },
      );
      setResult({
        tool: toolName,
        connection: profiles.find((p) => p.id === inspected)?.name,
        at: new Date().toLocaleString("pt-BR"),
        durationMs: Date.now() - start,
        requestedLanguage:
          typeof argumentsData.language === "string"
            ? argumentsData.language
            : undefined,
        response: r,
      });
      setExecution({
        kind: "success",
        message: "Consulta concluída.",
      });
      onChanged();
    } catch (e) {
      setExecution({
        kind: "error",
        message:
          (e as Error).message +
          " Consulte Diagnóstico para identificar a etapa que falhou.",
      });
    } finally {
      setBusy(false);
    }
  }
  const field = (k: string, v: unknown) =>
    setForm((f: any) => ({ ...f, [k]: v }));
  const working = busy || catalogBusy;
  const connectIdentity = (p: any) =>
    p.transport === "http" && p.authMode === "delegated"
      ? onLogin(p.id)
      : onConnectAccess?.(
          p.accessId,
          p.authMode === "application" ? "application" : "user",
        );
  const identityProps = {
    accesses,
    activeAccessId,
    principalKind,
    onConnect: connectIdentity,
  };
  return (
    <>
      <div className="section-head">
        <div>
          <h2>
            {mode === "analysis"
              ? "Inspeção e execução de tools"
              : "Conexões MCP"}
          </h2>
          <p>
            {mode === "integration"
              ? "Cada conexão guarda a configuração para acessar um servidor MCP."
              : "Consulte as operações do servidor, aprove as leituras e teste uma consulta."}
          </p>
        </div>
        <button
          hidden={mode === "analysis"}
          onClick={() => {
            setForm(empty);
            setNotice("");
            setResult(undefined);
            setToken("");
            setTokenConfigured(false);
            setContext(JSON.stringify(empty.resourceContext, null, 2));
          }}
        >
          Nova conexão
        </button>
      </div>
      {mode === "analysis" && profiles.find((p) => p.id === inspected) && (
        <section className="config-card">
          <McpDetails profile={profiles.find((p) => p.id === inspected)} />
          <McpIdentity
            profile={profiles.find((p) => p.id === inspected)}
            {...identityProps}
          />
        </section>
      )}
      {mode === "analysis" && (
        <McpLab
          externalBusy={busy}
          onBusy={setCatalogBusy}
          onTools={(items) => {
            setCatalogLoaded(true);
            setToolName("");
            setArgumentsValue({});
            setArgs("{}");
            setResult(undefined);
            setExecution(undefined);
            setTools(items);
            setChosen(
              items.filter((t: any) => t.approved).map((t: any) => t.name),
            );
          }}
          profiles={profiles}
          id={inspected}
          setId={(id) => {
            setCatalogLoaded(false);
            setNotice("");
            setInspected(id);
            setTools([]);
            setChosen([]);
            setToolName("");
            setResult(undefined);
            setExecution(undefined);
          }}
        />
      )}
      <div
        className={
          mode === "analysis"
            ? "settings-layout mcp-analysis-layout"
            : "settings-layout"
        }
      >
        <form
          hidden={mode === "analysis"}
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await manageRequest(
                "/mcp-connections" + (form.id ? "/" + form.id : ""),
                form.id ? "PATCH" : "POST",
                {
                  ...form,
                  tokenAction: token
                    ? { kind: "replace", value: token }
                    : { kind: "keep" },
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
              setContext(JSON.stringify(empty.resourceContext, null, 2));
              setTokenConfigured(false);
              setToken("");
              return r;
            });
          }}
        >
          <h3>{form.id ? "Editar MCP" : "Cadastrar MCP"}</h3>
          <McpDetails profile={{ ...form, resourceContext: contextFields }} />
          {form.preset === "arm" && (
            <p className="notice">
              Após salvar, use Autorizar recurso para entrar com o usuário Azure
              e consentir MCP.Access. O escopo escolhido delimita as consultas.
            </p>
          )}
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
                setToken("");
                setTokenConfigured(false);
                const preset = e.target.value as keyof typeof defaults;
                setForm({
                  ...empty,
                  ...defaults[preset],
                  preset,
                  authMode: ["custom", "kubernetes"].includes(preset)
                    ? "none"
                    : defaults[preset].transport === "stdio"
                      ? "application"
                      : "delegated",
                });
                setContext(
                  JSON.stringify(
                    preset === "arm"
                      ? { scope: "" }
                      : preset === "adx"
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
              {!independent && (
                <option value="stdio">Local · stdio (servidor oficial)</option>
              )}
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
          {!independent && (
            <label>
              Identidade Azure (cadastro em Acessos)
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
          )}
          <label>
            Autenticação
            <select
              value={form.authMode}
              onChange={(e) => field("authMode", e.target.value)}
            >
              {independent ? (
                <>
                  <option value="none">Sem autenticação no endpoint MCP</option>
                  <option value="bearer">Token Bearer próprio do MCP</option>
                </>
              ) : (
                <>
                  <option value="delegated">Usuário delegado</option>
                  {form.preset !== "arm" && (
                    <option value="application">Identidade de aplicação</option>
                  )}
                </>
              )}
            </select>
          </label>
          {independent && (
            <p className="notice">
              Conecte um servidor MCP Streamable HTTP já iniciado. Não use a URL
              da API Kubernetes diretamente. Configure o acesso ao cluster e
              modo de leitura no servidor MCP. A aplicação não instala
              servidores nem herda o login Azure. OAuth automático não está
              disponível neste conector.
            </p>
          )}
          {independent && form.authMode === "bearer" && (
            <label>
              Token do endpoint MCP{" "}
              {tokenConfigured ? "(já protegido; deixe vazio para manter)" : ""}
              <input
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
          )}
          {form.preset === "azure" && form.transport === "stdio" && (
            <label>
              Grupo de tools a carregar
              <select
                aria-label="Grupo de tools a carregar"
                value={contextFields.namespace || "pricing"}
                onChange={(e) =>
                  setContext(
                    JSON.stringify({ namespace: e.target.value }, null, 2),
                  )
                }
              >
                <option value="pricing">Preços de catálogo (pricing)</option>
                <option value="advisor">Recomendações Advisor (advisor)</option>
                <option value="optimization">Otimização (optimization)</option>
                <option value="subscription">
                  Inventário de subscriptions (subscription)
                </option>
                <option value="group">
                  Inventário de resource groups (group)
                </option>
              </select>
              <small>
                Seleciona o grupo carregado pelo servidor, não uma lista manual
                de tools. pricing costuma descobrir apenas pricing_get. Não
                consulta gastos reais.
              </small>
            </label>
          )}
          {mode === "integration" && form.preset === "arm" && (
            <ArmScopePicker
              key={`${azureAuthenticated}:${activeAccessId}:${principalKind}`}
              authenticated={!!azureAuthenticated}
              identity={
                accesses.find((access) => access.id === activeAccessId)?.name ||
                "a sessão ativa"
              }
              scope={contextFields.scope || ""}
              onChange={(value) => setContextField("scope", value)}
            />
          )}
          {["adx", "powerbi", "fabric"].includes(form.preset) && (
            <fieldset>
              <legend>Recursos autorizados</legend>
              {(form.preset === "adx"
                ? ["clusterUri", "database", "tenant", "subscription"]
                : form.preset === "powerbi"
                  ? ["modelId", "workspaceId"]
                  : ["workspaceId"]
              ).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    value={contextFields[k] || ""}
                    onChange={(e) => setContextField(k, e.target.value)}
                  />
                </label>
              ))}
            </fieldset>
          )}
          <details>
            <summary>Contexto de recursos — configuração avançada</summary>
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
              ferramentas. ADX exige clusterUri/database; Power BI exige
              modelId. Azure local: namespace
              pricing/advisor/optimization/subscription/group.
            </small>
          </details>
          {form.transport === "http" && (
            <label className="consent">
              <input
                type="checkbox"
                checked={form.allowPrivateNetwork}
                onChange={(e) => field("allowPrivateNetwork", e.target.checked)}
              />
              Autorizar rede privada / loopback deste endpoint
            </label>
          )}
          <button className="primary" disabled={working}>
            Salvar MCP
          </button>
          {noticeTarget === "form" && notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <small>
            Teste de servidor stdio pode baixar a versão oficial fixada: Azure
            3.0.0 ou Fabric 1.7.0. Nenhum comando livre é aceito.
          </small>
        </form>
        <div>
          {profiles
            .filter(() => mode === "integration")
            .map((p) => (
              <article className="config-card" key={p.id}>
                <h3>{p.name}</h3>
                <McpDetails profile={p} />
                <McpIdentity profile={p} {...identityProps} />
                <p className="fine">
                  Estado: {p.status || "cadastrado"}. O cadastro não inicia uma
                  conexão; use Conectar e listar tools para descobrir o
                  catálogo.
                </p>
                <div className="actions">
                  <button onClick={() => onInspect?.(p.id)}>
                    Analisar tools
                  </button>
                  <button
                    className="primary"
                    disabled={working || p.capability?.status === "unsupported"}
                    onClick={() =>
                      void run(async () => {
                        const r = await manageRequest(
                          "/mcp-connections/" + p.id + "/test",
                          "POST",
                          {},
                        );
                        setNotice(
                          `Servidor respondeu e listou ${r.tools.length} tool(s). Abra Analisar tools para revisar as operações e testar uma consulta.`,
                        );
                      }, p.id)
                    }
                  >
                    Conectar e listar tools
                  </button>
                  {p.transport === "http" && p.authMode === "delegated" && (
                    <button onClick={() => onLogin(p.id)}>
                      Autorizar recurso
                    </button>
                  )}
                  <button
                    hidden={mode === "analysis"}
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
                      setToken("");
                      setTokenConfigured(!!p.tokenConfigured);
                      setForm({
                        id,
                        name,
                        preset,
                        transport,
                        endpoint: endpoint || "",
                        accessId: accessId || "",
                        authMode: preset === "arm" ? "delegated" : authMode,
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
                    disabled={working}
                    onClick={() =>
                      void run(async () => {
                        await manageRequest(
                          "/mcp-connections/" + p.id + "/disconnect",
                          "POST",
                          {},
                        );
                        setNotice("Conexão encerrada.");
                      }, p.id)
                    }
                  >
                    Desconectar
                  </button>
                  <button
                    hidden={mode === "analysis"}
                    disabled={working}
                    onClick={() =>
                      void run(
                        () =>
                          manageRequest("/mcp-connections/" + p.id, "DELETE"),
                        p.id,
                      )
                    }
                  >
                    Excluir
                  </button>
                </div>
                {noticeTarget === p.id && notice && (
                  <p className="access-feedback" role="status">
                    {notice}
                  </p>
                )}
              </article>
            ))}
        </div>
      </div>

      {mode === "analysis" && inspected && !catalogLoaded && (
        <p className="notice">
          Catálogo ainda não consultado. Clique em Listar capacidades, prompts e
          resources para consultar este servidor.
        </p>
      )}
      {mode === "analysis" && inspected && catalogLoaded && (
        <section className="tool-review" id="mcp-tools">
          <h3>
            Tools descobertas ({tools.length}) —{" "}
            {profiles.find((p) => p.id === inspected)?.name}
          </h3>
          <p>
            Catálogo recebido deste servidor MCP.{" "}
            {tools.length === 0
              ? "O servidor não anunciou tools nesta consulta."
              : "Revise as operações antes de liberar seu uso."}
          </p>
          {tools.some((t) => t.name === "pricing_get") && (
            <p className="fine">
              pricing_get consulta preços de catálogo; não retorna o gasto real
              do RG. Para gastos reais via MCP, avalie o ARM MCP oficial.
            </p>
          )}
          {tools.length > 0 && (
            <p>
              Selecione as operações que quer testar, salve a seleção e escolha
              uma delas em Executar uma consulta. Os parâmetros são preenchidos
              na hora da consulta.
            </p>
          )}
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
                    ? "Leitura disponível para aprovação."
                    : ["custom", "kubernetes"].includes(
                          profiles.find((p) => p.id === inspected)?.preset,
                        )
                      ? "Indisponível para aprovação pela política de leitura desta conexão. A operação precisa ser declarada como leitura pelo servidor e passar pelas regras do Tesseract."
                      : "Indisponível para aprovação. Esta operação não está na lista de leituras permitidas para o tipo de conexão."}
                  <details>
                    <summary>Descrição original e schema</summary>
                    <p>{t.description}</p>
                    <pre>{JSON.stringify(t.inputSchema, null, 2)}</pre>
                  </details>
                </small>
              </span>
            </label>
          ))}
          {selectionDirty && (
            <p role="alert" className="notice">
              Há alterações na seleção. Clique em Salvar tools permitidas para
              liberá-las em Executar uma consulta.
            </p>
          )}
          <button
            className={selectionDirty ? "primary" : undefined}
            disabled={working || !selectionDirty}
            onClick={() =>
              void run(async () => {
                await manageRequest(
                  "/mcp-connections/" + inspected + "/approve-tools",
                  "POST",
                  { names: chosen },
                );
                setTools((prev) =>
                  prev.map((t) => ({
                    ...t,
                    approved: chosen.includes(t.name),
                  })),
                );
                chooseTool("");
                setNotice(
                  "Tools permitidas salvas. Selecione uma tool abaixo, preencha os campos e execute a consulta.",
                );
              }, "approval")
            }
          >
            Salvar tools permitidas
          </button>
          {noticeTarget === "approval" && notice && (
            <p className="access-feedback" role="status">
              {notice}
            </p>
          )}

          <form className="settings-form" onSubmit={executeTool}>
            <h3>Executar uma consulta</h3>
            <label>
              Tools
              <select
                aria-label="Tools"
                value={toolName}
                onChange={(e) => chooseTool(e.target.value)}
              >
                <option value="">Selecione uma tool permitida</option>
                {tools
                  .filter((t) => t.approved)
                  .map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
              </select>
            </label>
            {chosen.some((n) => !tools.find((t) => t.name === n)?.approved) && (
              <p>
                Há alterações na seleção. Salve as tools permitidas antes de
                executá-las.
              </p>
            )}
            {selectedTool && (
              <>
                <p>
                  Preencha os campos marcados com *. Deixe os opcionais em
                  branco para usar o comportamento padrão do servidor.
                  {selectedTool.name === "pricing_get" &&
                    " Para pricing_get, campos vazios usam BRL, Standard_D4s_v5, Virtual Machines, Compute e Consumption, quando presentes no schema. Região não tem padrão."}
                </p>
                {!advanced && (
                  <SchemaInputs
                    key={toolName}
                    schema={selectedTool.inputSchema}
                    value={argumentsValue}
                    fallbackValues={
                      toolName === "pricing_get"
                        ? applyPricingDefaults(
                            toolName,
                            selectedTool.inputSchema,
                            {},
                          )
                        : undefined
                    }
                    onChange={(v) => {
                      setArgumentsValue(v);
                      setArgs(JSON.stringify(v, null, 2));
                    }}
                  />
                )}
                {!resolveSchema(
                  selectedTool.inputSchema,
                  selectedTool.inputSchema,
                )?.properties && (
                  <p>
                    O schema usa uma estrutura avançada. Abra o JSON e o schema
                    original para preencher; esta estrutura ainda não possui
                    formulário automático.
                  </p>
                )}
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={advanced}
                    onChange={(e) => setAdvanced(e.target.checked)}
                  />
                  Usar JSON avançado
                </label>
                {advanced && (
                  <label>
                    Argumentos JSON
                    <textarea
                      rows={7}
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            <button
              className="primary"
              disabled={!toolName || working}
              type="submit"
            >
              {working ? "Aguarde…" : "Executar tool selecionada"}
            </button>
            {execution && (
              <p
                role={execution.kind === "error" ? "alert" : "status"}
                className={"access-feedback " + execution.kind}
              >
                {execution.message}
              </p>
            )}
            {result && <McpToolResult result={result} />}
          </form>
        </section>
      )}
      {mode === "analysis" &&
        inspected &&
        (() => {
          const profile = profiles.find((p) => p.id === inspected);
          const preset = matrix.find((p) => p.id === profile?.preset);
          const currentMode = preset?.modes.find(
            (m: any) =>
              m.transport === profile.transport &&
              m.authMode === profile.authMode,
          );
          if (!currentMode) return null;
          return (
            <details>
              <summary>Compatibilidade de autenticação desta conexão</summary>
              <p>
                {preset.name} · {currentMode.transport} · {currentMode.authMode}
              </p>
              <p>{currentMode.reason}</p>
              {currentMode.status === "pending" && (
                <p>
                  Use o teste de conexão e a execução de uma leitura para
                  verificar a configuração em uso.
                </p>
              )}
            </details>
          );
        })()}
    </>
  );
}
