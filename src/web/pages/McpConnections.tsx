import { McpLab } from "./McpLab.js";
import {
  SchemaInputs,
  schemaDefaults,
  resolveSchema,
} from "../components/SchemaInputs.js";
import { useEffect, useState, useRef } from "react";
import type {
  McpProfile,
  PublicAccessProfile,
} from "../../shared/connections.js";
import { manageRequest } from "../api.js";
import { applyPricingDefaults } from "../components/pricing-defaults.js";
const defaults = {
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
  mode = "integration",
  onInspect,
  accesses,
  onChanged,
  onLogin,
}: {
  mode?: "integration" | "analysis";
  onInspect?: () => void;
  profiles: any[];
  accesses: PublicAccessProfile[];
  onChanged: () => void;
  onLogin: (id: string) => void;
}) {
  const [catalogBusy, setCatalogBusy] = useState(false);
  const reviewRef = useRef<HTMLElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
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
    [result, setResult] = useState<any>(),
    [argumentsValue, setArgumentsValue] = useState<Record<string, unknown>>({}),
    [advanced, setAdvanced] = useState(false),
    [execution, setExecution] = useState<{ kind: string; message: string }>(),
    [matrix, setMatrix] = useState<any[]>([]);
  useEffect(() => {
    void manageRequest("/mcp-presets").then((x) =>
      setMatrix(Array.isArray(x) ? x : []),
    );
  }, []);
  useEffect(() => {
    if (inspected && tools.length && mode !== "analysis")
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [inspected, tools.length]);
  useEffect(() => {
    if (notice)
      noticeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [notice]);
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
        response: r,
      });
      setExecution({
        kind: "success",
        message:
          "Consulta " +
          toolName +
          " concluída. Veja o retorno abaixo; esta chamada não comprova outras permissões Azure.",
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
          hidden={mode === "analysis"}
          onClick={() => {
            setForm(empty);
            setContext(JSON.stringify(empty.resourceContext, null, 2));
          }}
        >
          Nova conexão
        </button>
      </div>
      {notice && (
        <p className="notice" role="status" ref={noticeRef}>
          {notice}
        </p>
      )}
      {mode === "analysis" && (
        <McpLab
          externalBusy={busy}
          onBusy={setCatalogBusy}
          onTools={(items) => {
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
          {form.preset === "arm" && (
            <p className="notice">
              ARM MCP oficial (preview): use login de usuário e Autorizar
              recurso para consentir MCP.Access. Endpoint e header
              CostManagement são fixados pelo serviço. Em Recursos autorizados,
              informe scope completo /subscriptions/ID ou
              /subscriptions/ID/resourceGroups/NOME. Só leituras revisadas podem
              ser liberadas; os cartões do dashboard continuam na API direta.
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
          {["adx", "powerbi", "fabric", "arm"].includes(form.preset) && (
            <fieldset>
              <legend>Recursos autorizados</legend>
              {(form.preset === "arm"
                ? ["scope"]
                : form.preset === "adx"
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
                {p.preset} ·{" "}
                {p.transport === "stdio"
                  ? "Processo MCP local no notebook"
                  : "MCP remoto via HTTPS"}{" "}
                ·{" "}
                {p.authMode === "application"
                  ? "Identidade de aplicação"
                  : "Usuário delegado"}
              </p>
              <p>
                {p.status === "cadastrado" && inspected === p.id && tools.length
                  ? "Catálogo recebido; execute uma tool para verificar a leitura."
                  : p.status ||
                    "Cadastrado; servidor ainda não consultado nesta sessão."}
              </p>
              <p className="fine">
                {p.transport === "stdio"
                  ? "Pacote oficial iniciado no notebook; pode ser baixado no primeiro uso. Este processo consulta serviços Microsoft pela rede; não é um MCP hospedado pela Microsoft."
                  : `Servidor remoto: ${p.endpoint}. A aplicação local envia chamadas autenticadas para esse endpoint.`}
              </p>
              <small>
                {p.capability?.status === "unsupported"
                  ? p.capability.reason
                  : (inspected === p.id && tools.length) ||
                      (p.status && p.status !== "cadastrado")
                    ? "Servidor já respondeu. Permissão de leitura dos dados depende da tool executada; descoberta não comprova todas as permissões."
                    : "Ainda não testado nesta sessão. Clique em Conectar e listar tools."}
              </small>
              {inspected === p.id && notice && (
                <p className="access-feedback" role="status">
                  {notice}
                </p>
              )}
              <div className="actions">
                <button
                  disabled={working || p.capability?.status === "unsupported"}
                  onClick={() =>
                    void run(async () => {
                      setInspected(p.id);
                      onInspect?.();
                      setResult(undefined);
                      setExecution(undefined);
                      setTools([]);
                      setToolName("");
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
                      onInspect?.();
                      setNotice(
                        `Servidor respondeu e listou ${r.tools.length} tool(s): ${r.tools.map((t: any) => t.name).join(", ")}. Revise a lista abaixo, salve as tools permitidas e preencha uma consulta. Isso ainda não testa acesso aos dados.`,
                      );
                      return r;
                    })
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
                  disabled={working}
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
                  hidden={mode === "analysis"}
                  disabled={working}
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
        <section ref={reviewRef} className="tool-review">
          <h3>
            Tools descobertas ({tools.length}) —{" "}
            {profiles.find((p) => p.id === inspected)?.name}
          </h3>
          <p>
            Esta lista veio do servidor MCP. No grupo pricing, uma única tool
            pricing_get é esperada: ela consulta preços públicos, não despesas
            do RG. Para gastos, escolha APIs Azure ou configure um FinOps hub
            com dados carregados.
          </p>
          <p className="fine">
            Marque as tools que esta aplicação poderá executar e clique em
            Salvar tools permitidas. Só são liberadas operações de leitura
            reconhecidas. Se o schema mudar, será necessário revisar novamente.
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
                    ? "Leitura reconhecida — pode ser liberada para uso"
                    : "Bloqueada — operação ainda não revisada nesta aplicação"}{" "}
                  ·{" "}
                  {t.name === "pricing_get"
                    ? "Consulta preços por SKU; não retorna gasto real."
                    : "Confira a descrição e os parâmetros definidos pelo servidor."}
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
            disabled={working}
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
              })
            }
          >
            Salvar tools permitidas
          </button>

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
                  Os campos abaixo foram lidos do schema de {selectedTool.name}.
                  * indica obrigatório. Campos vazios opcionais são omitidos.
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
            <button disabled={!toolName || working} type="submit">
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
            {result && (
              <section aria-label="Resultado da tool">
                <h3>Resultado de {result.tool}</h3>
                <p>
                  Conexão: {result.connection} · {result.at} ·{" "}
                  {result.durationMs} ms
                </p>
                <p>Retorno recebido do MCP:</p>
                {result.response?.result?.content
                  ?.filter((c: any) => c.type === "text")
                  .map((c: any, i: number) => (
                    <pre key={i}>{c.text}</pre>
                  ))}
                <details>
                  <summary>Ver resposta técnica completa</summary>
                  <pre>{JSON.stringify(result.response, null, 2)}</pre>
                </details>
              </section>
            )}
          </form>
        </section>
      )}
      <details>
        <summary>Matriz de autenticação documentada</summary>
        {matrix.map((p) => (
          <div key={p.id}>
            <h3>{p.name}</h3>
            {p.modes.map((m: any, i: number) => (
              <p key={i} className="fine">
                {m.transport} / {m.authMode}:{" "}
                {m.status === "pending"
                  ? "Suporte sujeito a teste por operação"
                  : m.status === "unsupported"
                    ? "Não suportado"
                    : "Disponível"}{" "}
                — {m.reason}
              </p>
            ))}
          </div>
        ))}
      </details>
    </>
  );
}
