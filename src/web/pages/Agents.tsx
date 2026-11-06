import { finopsTemplate } from "../../server/agents/finops-template.js";
import { useState } from "react";
import type {
  PublicAgent,
  PublicAccessProfile,
} from "../../shared/connections.js";
import { manageRequest } from "../api.js";
const fresh = {
  name: "",
  description: "",
  instructions:
    "Consulte apenas os dados autorizados. Informe período, moeda, escopo e fonte.",
  provider: "azure-chat-v1",
  endpoint: "",
  model: "",
  modelCredential: { kind: "apiKey" },
  allowedAccessIds: [] as string[],
  mcpConnectionIds: [] as string[],
  allowedTools: ["azure_query"],
  limits: { toolCalls: 10, timeoutMs: 120000, responseChars: 8000 },
};
export function Agents({
  profiles,
  accesses,
  mcps,
  onChanged,
  onOpenChat,
}: {
  profiles: PublicAgent[];
  accesses: PublicAccessProfile[];
  mcps: any[];
  onChanged: () => void;
  onOpenChat?: () => void;
}) {
  const [setup, setSetup] = useState<"custom" | "copilot">("custom");
  const [form, setForm] = useState<any>(fresh),
    [keyAction, setKeyAction] = useState("keep"),
    [key, setKey] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [toolNames, setToolNames] = useState("azure_query");
  const field = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    try {
      const r = await fn();
      onChanged();
      setNotice(r?.message || "Operação concluída.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function toggle(fieldName: string, value: string) {
    setForm((f: any) => ({
      ...f,
      [fieldName]: f[fieldName].includes(value)
        ? f[fieldName].filter((x: string) => x !== value)
        : [...f[fieldName], value],
    }));
  }
  return (
    <>
      <button
        onClick={() => {
          setForm({ ...fresh, ...finopsTemplate() });
          setToolNames("azure_query\nfinops_hub");
          setKey("");
          setKeyAction("keep");
        }}
      >
        Usar perfil Analista FinOps
      </button>
      {form.templateSource && (
        <p>
          Perfil {form.templateSource.id} · versão {form.templateSource.version}{" "}
          · adaptação rastreável Microsoft FinOps Toolkit / Awesome Copilot
        </p>
      )}
      <div className="section-head">
        <div>
          <h2>Agentes e provedores de IA</h2>
          <p>
            Configure modelo, instruções e ferramentas. A execução é
            independente do Copilot CLI.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(fresh);
            setKey("");
            setKeyAction("keep");
            setToolNames("azure_query");
          }}
        >
          Novo agente
        </button>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section
        className="provider-choice"
        aria-label="Como usar a inteligência artificial"
      >
        <h3>Qual provedor você quer usar?</h3>
        <div className="actions">
          <button
            className={setup === "copilot" ? "primary" : ""}
            onClick={() => setSetup("copilot")}
          >
            Usar Copilot local (sem endpoint)
          </button>
          <button
            className={setup === "custom" ? "primary" : ""}
            onClick={() => setSetup("custom")}
          >
            Configurar agente com modelo Azure
          </button>
        </div>
        <p>
          Copilot local usa o CLI autenticado no notebook e a conta GitHub
          permitida pela empresa. Não exige cadastro de endpoint Azure nem chave
          de modelo neste formulário; a inferência não é garantidamente offline.
        </p>
      </section>
      {setup === "copilot" ? (
        <section className="notice">
          <h3>Copilot já é uma opção do chat</h3>
          <p>
            Abra Chat e escolha Copilot local. Use Verificar Copilot para
            conferir a autenticação do CLI. Não é necessário salvar um agente
            para esse modo. Licença e política corporativa continuam aplicáveis.
          </p>
          <button onClick={onOpenChat}>Ir para o chat com Copilot</button>
        </section>
      ) : (
        <>
          <div className="settings-layout">
            <form
              className="settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await manageRequest(
                    "/agents" + (form.id ? "/" + form.id : ""),
                    form.id ? "PATCH" : "POST",
                    {
                      ...form,
                      allowedTools: toolNames
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                      keyAction:
                        keyAction === "replace"
                          ? { kind: "replace", value: key }
                          : { kind: keyAction },
                    },
                  );
                  setKey("");
                  setKeyAction("keep");
                  setForm(fresh);
                });
              }}
            >
              <h3>{form.id ? "Editar agente" : "Cadastrar agente"}</h3>
              <p className="fine">
                Este cadastro usa um modelo remoto Azure OpenAI/Foundry. O
                serviço local executa as tools. Solicite ao responsável por IA o
                endpoint real e o nome do deployment; eles não são descobertos
                automaticamente. O exemplo abaixo não é uma configuração pronta.
              </p>
              <label>
                Nome do agente
                <input
                  required
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <label>
                Descrição
                <input
                  value={form.description}
                  onChange={(e) => field("description", e.target.value)}
                />
              </label>
              <label>
                Instruções
                <textarea
                  rows={4}
                  aria-label="Instruções"
                  value={form.instructions}
                  onChange={(e) => field("instructions", e.target.value)}
                />
              </label>
              <label>
                Endpoint Azure OpenAI / Foundry
                <input
                  type="url"
                  required
                  value={form.endpoint}
                  onChange={(e) => field("endpoint", e.target.value)}
                  placeholder="https://recurso.openai.azure.com"
                />
              </label>
              <label>
                Deployment / modelo
                <input
                  required
                  value={form.model}
                  onChange={(e) => field("model", e.target.value)}
                />
              </label>
              <label>
                Credencial do modelo
                <select
                  value={form.modelCredential.kind}
                  onChange={(e) =>
                    field(
                      "modelCredential",
                      e.target.value === "apiKey"
                        ? { kind: "apiKey" }
                        : { kind: "entra", accessId: "" },
                    )
                  }
                >
                  <option value="apiKey">Chave de inferência</option>
                  <option value="entra">Acesso Entra salvo</option>
                </select>
              </label>
              {form.modelCredential.kind === "apiKey" ? (
                <>
                  <label>
                    Chave do modelo
                    <select
                      value={keyAction}
                      onChange={(e) => setKeyAction(e.target.value)}
                    >
                      <option value="keep">Manter / cadastrar depois</option>
                      <option value="replace">Cadastrar / substituir</option>
                      <option value="remove">Remover</option>
                    </select>
                  </label>
                  {keyAction === "replace" && (
                    <label>
                      Valor da chave de inferência
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                      />
                    </label>
                  )}
                </>
              ) : (
                <label>
                  Acesso Entra para inferência
                  <select
                    required
                    value={form.modelCredential.accessId}
                    onChange={(e) =>
                      field("modelCredential", {
                        kind: "entra",
                        accessId: e.target.value,
                      })
                    }
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
              <fieldset>
                <legend>Acessos de dados autorizados</legend>
                {accesses.map((a) => (
                  <label className="consent" key={a.id}>
                    <input
                      type="checkbox"
                      checked={form.allowedAccessIds.includes(a.id)}
                      onChange={() => toggle("allowedAccessIds", a.id)}
                    />
                    {a.name}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Conexões MCP autorizadas</legend>
                {mcps.map((p) => (
                  <label className="consent" key={p.id}>
                    <input
                      type="checkbox"
                      checked={form.mcpConnectionIds.includes(p.id)}
                      onChange={() => toggle("mcpConnectionIds", p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Ferramentas autorizadas</legend>
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={toolNames.split("\n").includes("azure_query")}
                    onChange={(e) =>
                      setToolNames((x) =>
                        e.target.checked
                          ? [
                              ...new Set([...x.split("\n"), "azure_query"]),
                            ].join("\n")
                          : x
                              .split("\n")
                              .filter((t) => t !== "azure_query")
                              .join("\n"),
                      )
                    }
                  />
                  Consultar APIs de custos e budgets
                </label>
                {mcps
                  .filter((p) => form.mcpConnectionIds.includes(p.id))
                  .flatMap((p) =>
                    (p.approvedTools || []).map((t: any) => {
                      const key = "mcp:" + p.id + ":" + t.name;
                      return (
                        <label className="consent" key={key}>
                          <input
                            type="checkbox"
                            checked={toolNames.split("\n").includes(key)}
                            onChange={(e) =>
                              setToolNames((x) =>
                                e.target.checked
                                  ? [...new Set([...x.split("\n"), key])].join(
                                      "\n",
                                    )
                                  : x
                                      .split("\n")
                                      .filter((t) => t !== key)
                                      .join("\n"),
                              )
                            }
                          />
                          {p.name} · {t.name}
                        </label>
                      );
                    }),
                  )}
              </fieldset>
              <p className="fine">
                Ao marcar ferramentas, seus identificadores são preenchidos
                automaticamente. A aprovação na conexão MCP continua necessária;
                isto não preenche endpoint, modelo ou permissões.
              </p>
              <details>
                <summary>Identificadores avançados</summary>
                <label>
                  Ferramentas (uma por linha)
                  <textarea
                    rows={3}
                    value={toolNames}
                    onChange={(e) => setToolNames(e.target.value)}
                  />
                </label>
              </details>
              <small>
                API: azure_query. MCP: mcp:ID-DA-CONEXÃO:NOME-DA-FERRAMENTA. A
                ferramenta precisa estar aprovada na conexão.
              </small>
              <div className="limits">
                <label>
                  Máximo de consultas
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.limits.toolCalls}
                    onChange={(e) =>
                      field("limits", {
                        ...form.limits,
                        toolCalls: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Tempo máximo (segundos)
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={form.limits.timeoutMs / 1000}
                    onChange={(e) =>
                      field("limits", {
                        ...form.limits,
                        timeoutMs: Number(e.target.value) * 1000,
                      })
                    }
                  />
                </label>
              </div>
              <button className="primary" disabled={busy}>
                Salvar agente
              </button>
            </form>
            <div>
              {profiles.map((a) => (
                <article className="config-card" key={a.id}>
                  <h3>{a.name}</h3>
                  <p>
                    {a.model} · v{a.configurationVersion}
                  </p>
                  <small>
                    {a.endpoint}
                    <br />
                    {a.description}
                  </small>
                  <p>
                    {a.allowedAccessIds.length} acesso(s) ·{" "}
                    {a.mcpConnectionIds.length} MCP(s)
                  </p>
                  <div className="actions">
                    <button
                      onClick={() => {
                        const {
                          configurationVersion,
                          modelCredential,
                          ...rest
                        } = a;
                        setForm({
                          ...rest,
                          expectedVersion: configurationVersion,
                          modelCredential:
                            modelCredential.kind === "apiKey"
                              ? { kind: "apiKey" }
                              : modelCredential,
                        });
                        setKey("");
                        setKeyAction("keep");
                        setToolNames(a.allowedTools.join("\n"));
                      }}
                    >
                      Editar
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          manageRequest(
                            "/agents/" + a.id + "/duplicate",
                            "POST",
                            {},
                          ),
                        )
                      }
                    >
                      Duplicar
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          manageRequest("/agents/" + a.id, "DELETE"),
                        )
                      }
                    >
                      Excluir
                    </button>
                  </div>
                  <p className="fine">
                    O teste envia uma mensagem sintética ao modelo e pode gerar
                    consumo.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        manageRequest(
                          "/agents/" + a.id + "/test-model",
                          "POST",
                          {
                            consent: true,
                          },
                        ),
                      )
                    }
                  >
                    Testar inferência (com consumo)
                  </button>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
