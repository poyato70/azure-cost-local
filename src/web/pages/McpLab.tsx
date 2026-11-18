import { useEffect, useRef, useState } from "react";
import { manageRequest } from "../api.js";
import { DiagnosticPanel } from "./Diagnostics.js";
import {
  capabilityManifest,
  exampleArguments,
  powershellInfo,
  sanitizeExport,
  sanitizeSchemaForExport,
  sanitizeText,
  vscodeConfig,
} from "../components/mcp-export.js";

const catalogStatus: Record<string, string> = {
  not_advertised: "Não anunciado pelo servidor",
  empty: "Nenhum item disponível",
  discovered: "Itens descobertos",
  partial: "Lista parcial",
  error: "Consulta indisponível",
};
type Group = "tools" | "resources" | "prompts";
const groupLabel: Record<Group, string> = {
  tools: "Tools",
  resources: "Resources",
  prompts: "Prompts",
};

function itemName(kind: Group, item: any) {
  return kind === "resources" ? item.name || item.uri : item.name;
}
function objectText(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}
function structuredSchema(schema: any) {
  if (!schema || typeof schema !== "object") return "Schema não informado.";
  const rows: string[] = [];
  const walk = (node: any, path: string, depth: number) => {
    if (depth > 5) {
      rows.push(
        `${"  ".repeat(depth)}… estrutura mais profunda no JSON original`,
      );
      return;
    }
    if (node.$ref)
      rows.push(
        `${"  ".repeat(depth)}${path || "Schema"}: referência ${node.$ref}`,
      );
    for (const key of ["oneOf", "anyOf", "allOf"])
      if (Array.isArray(node[key]))
        rows.push(
          `${"  ".repeat(depth)}${path || "Schema"}: ${key} (${node[key].length} variantes; ver JSON original)`,
        );
    const required = new Set(Array.isArray(node.required) ? node.required : []);
    for (const [name, property] of Object.entries(node.properties || {}) as [
      string,
      any,
    ][]) {
      const current = path ? `${path}.${name}` : name;
      const type =
        property.type ||
        (property.properties ? "object" : "tipo não declarado");
      rows.push(
        `${"  ".repeat(depth)}${current} · ${type}${required.has(name) ? " · obrigatório" : " · opcional"}${property.description ? ` · ${property.description}` : ""}`,
      );
      if (property.properties) walk(property, current, depth + 1);
      if (property.items)
        rows.push(
          `${"  ".repeat(depth + 1)}${current}[] · ${(property.items as any).type || "item definido no schema"}`,
        );
      for (const feature of [
        "enum",
        "const",
        "format",
        "minimum",
        "maximum",
        "minLength",
        "maxLength",
        "pattern",
      ])
        if (property[feature] !== undefined)
          rows.push(
            `${"  ".repeat(depth + 1)}${feature}: ${JSON.stringify(property[feature])}`,
          );
    }
    if (!Object.keys(node.properties || {}).length && node.type)
      rows.push(`${"  ".repeat(depth)}${path || "Schema"} · ${node.type}`);
  };
  walk(schema, "", 0);
  return rows.length
    ? rows.join("\n")
    : "Schema sem propriedades declaradas; consulte o JSON original para metadados e keywords adicionais.";
}

export function McpLab({
  profiles,
  id,
  setId,
  onTools,
  externalBusy,
  onBusy,
}: {
  externalBusy: boolean;
  onBusy: (busy: boolean) => void;
  onTools: (items: any[]) => void;
  profiles: any[];
  id: string;
  setId: (id: string) => void;
}) {
  const [catalog, setCatalog] = useState<any>(),
    [result, setResult] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [area, setArea] = useState<"explore" | "replicate">("explore"),
    [group, setGroup] = useState<Group>("tools"),
    [selected, setSelected] = useState<any>(),
    [exportKind, setExportKind] = useState<
      "vscode" | "powershell" | "manifest"
    >("vscode"),
    [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const profile = profiles.find((item) => item.id === id);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
    setCatalog(undefined);
    setResult(undefined);
    setError("");
    setArgs({});
    setSelected(undefined);
    setNotice("");
    return () => {
      controller.current?.abort();
      onBusy(false);
    };
  }, [id]);
  async function run(path: string, body: any = {}) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setResult(undefined);
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const response = await manageRequest(
        `/mcp-connections/${id}/${path}`,
        "POST",
        body,
        c.signal,
      );
      if (c.signal.aborted) return;
      if (path === "catalog") {
        setCatalog(response);
        onTools(response.tools || []);
        setGroup("tools");
        setSelected((response.tools || [])[0]);
      } else setResult(response);
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  const currentItems =
    group === "tools"
      ? catalog?.tools || []
      : group === "resources"
        ? catalog?.resources?.items || []
        : catalog?.prompts?.items || [];
  const currentStatus =
    group === "tools"
      ? catalog
        ? currentItems.length
          ? "discovered"
          : catalog.capabilities?.tools
            ? "empty"
            : "not_advertised"
        : "not_verified"
      : catalog?.[group]?.status ||
        (catalog ? "not_advertised" : "not_verified");
  const rawSchema = selected?.inputSchema;
  const generated = exampleArguments(rawSchema);
  const exportText = profile
    ? exportKind === "vscode"
      ? vscodeConfig(profile) ||
        "Exemplo informativo — o transporte/preset desta conexão não tem uma configuração Copilot suportada identificada."
      : exportKind === "powershell"
        ? powershellInfo(profile)
        : capabilityManifest(profile, catalog)
    : "Selecione uma conexão para preparar a exportação.";
  const canCopyExport = Boolean(
    profile && (exportKind !== "vscode" || vscodeConfig(profile)),
  );
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copiado para a área de transferência.`);
    } catch {
      setNotice(
        "Não foi possível acessar a área de transferência. Selecione e copie o conteúdo manualmente.",
      );
    }
  }
  return (
    <section className="mcp-inspector ux03-inspector">
      <h2>Inspector de capacidades MCP</h2>
      <p className="ux03-intro">
        Inspecione o que o servidor anunciou. Explorar e copiar não aprova nem
        executa tools.
      </p>
      <label>
        Conexão para análise
        <select
          disabled={busy || externalBusy}
          value={id}
          onChange={(event) => setId(event.target.value)}
        >
          <option value="">Selecione</option>
          {profiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div
        className="ux03-primary-tabs"
        role="group"
        aria-label="Área do Inspector"
      >
        <button
          type="button"
          aria-pressed={area === "explore"}
          onClick={() => setArea("explore")}
        >
          Explorar MCP
        </button>
        <button
          type="button"
          aria-pressed={area === "replicate"}
          onClick={() => setArea("replicate")}
        >
          Replicar / Exportar
        </button>
      </div>
      {!catalog && (
        <button
          className="primary"
          disabled={!id || busy || externalBusy}
          aria-busy={busy}
          onClick={() => void run("catalog")}
        >
          {busy ? "Consultando capacidades…" : "Descobrir capacidades MCP"}
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="ux03-notice">
          {notice}
        </p>
      )}
      {catalog && (
        <p role="status" className="ux03-discovery-state">
          <strong>
            {catalog.server?.name || profile?.name || "Servidor MCP"}
          </strong>{" "}
          · {catalog.tools?.length || 0} tools retornadas · Estado: descoberta
          concluída. Isso não comprova autorização de execução.
        </p>
      )}

      {area === "explore" && catalog && (
        <div className="ux03-explorer">
          <div
            className="ux03-segments"
            role="group"
            aria-label="Tipo de capacidade"
          >
            {(Object.keys(groupLabel) as Group[]).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={group === kind}
                onClick={() => {
                  setGroup(kind);
                  setSelected(undefined);
                }}
              >
                {groupLabel[kind]}
              </button>
            ))}
          </div>
          <div className="ux03-status-line">
            <span
              className={`ux03-status-dot is-${currentStatus}`}
              aria-hidden="true"
            />
            <strong>
              {catalogStatus[currentStatus] ||
                (currentStatus === "not_verified"
                  ? "Ainda não descoberto"
                  : currentStatus)}
            </strong>
            <span>
              {group === "tools"
                ? `${currentItems.length} ferramentas anunciadas`
                : `${currentItems.length} itens retornados`}
            </span>
          </div>
          {group === "resources" &&
            catalog.resourceTemplates?.items?.length > 0 && (
              <p className="ux03-note">
                Templates retornados: {catalog.resourceTemplates.items.length}.
                A descoberta atual do servidor não solicita templates
                separadamente; só são exibidos se já vierem no retorno.
              </p>
            )}
          {group === "resources" && !catalog.resourceTemplates && (
            <p className="ux03-note">
              Resource templates não são solicitados pelo contrato de descoberta
              atual.
            </p>
          )}
          {currentItems.length === 0 ? (
            <div className="ux03-empty" role="status">
              {currentStatus === "not_advertised"
                ? `O servidor não anunciou ${groupLabel[group]}.`
                : currentStatus === "error"
                  ? `A consulta de ${groupLabel[group]} está indisponível.`
                  : currentStatus === "empty"
                    ? `O servidor anunciou ${groupLabel[group]}, mas não retornou itens.`
                    : "Nenhum item foi retornado nesta descoberta."}
            </div>
          ) : (
            <div className="ux03-inspection-grid">
              <nav
                className="ux03-item-list"
                aria-label={`Itens descobertos: ${groupLabel[group]}`}
              >
                {currentItems.map((item: any, index: number) => {
                  const label = itemName(group, item) || `Item ${index + 1}`;
                  const active = selected === item;
                  return (
                    <button
                      key={`${label}-${index}`}
                      type="button"
                      className={active ? "is-selected" : ""}
                      aria-pressed={active}
                      onClick={() => setSelected(item)}
                    >
                      <strong>{label}</strong>
                      <span>
                        {item.description ||
                          (group === "resources"
                            ? item.uri
                            : group === "prompts"
                              ? `${item.arguments?.length || 0} argumentos`
                              : "Tool descoberta")}
                      </span>
                    </button>
                  );
                })}
              </nav>
              {selected && (
                <article className="ux03-detail">
                  <div className="ux03-detail-head">
                    <div>
                      <span className="ux03-eyebrow">
                        {groupLabel[group]} · descoberto
                      </span>
                      <h3>{itemName(group, selected) || "Item sem nome"}</h3>
                    </div>
                    <span className="ux03-auth-state">
                      {group === "tools"
                        ? selected.approved
                          ? "Aprovação configurada"
                          : selected.reviewable
                            ? "Requer aprovação"
                            : "Sem estado de aprovação"
                        : "Inspeção"}
                    </span>
                  </div>
                  {selected.description && <p>{selected.description}</p>}
                  <p className="ux03-note">
                    Origem:{" "}
                    {catalog.server?.name || profile?.name || "Servidor MCP"}
                  </p>
                  {group === "tools" && (
                    <>
                      <h4>Input Schema</h4>
                      <p className="ux03-note">
                        Contrato de entrada anunciado pelo servidor. Não é um
                        payload.
                      </p>
                      <div
                        className="ux03-inner-tabs"
                        role="group"
                        aria-label="Visualização do schema"
                      >
                        <details open>
                          <summary>Estruturada</summary>
                          <pre>{structuredSchema(rawSchema)}</pre>
                        </details>
                        <details>
                          <summary>JSON original sanitizado</summary>
                          <pre>
                            {objectText(
                              sanitizeSchemaForExport(rawSchema || {}),
                            )}
                          </pre>
                          <button
                            type="button"
                            onClick={() =>
                              void copy(
                                objectText(
                                  sanitizeSchemaForExport(rawSchema || {}),
                                ),
                                "Schema sanitizado",
                              )
                            }
                          >
                            Copiar schema JSON
                          </button>
                        </details>
                      </div>
                      {selected.outputSchema ? (
                        <details className="ux03-schema-block">
                          <summary>Output Schema · contrato de saída</summary>
                          <pre>
                            {objectText(
                              sanitizeSchemaForExport(selected.outputSchema),
                            )}
                          </pre>
                        </details>
                      ) : (
                        <p className="ux03-note">
                          Output Schema não fornecido pelo servidor.
                        </p>
                      )}
                      <details className="ux03-schema-block">
                        <summary>Input JSON · exemplo sintético</summary>
                        {generated.value !== undefined ? (
                          <>
                            <pre>{objectText(generated.value)}</pre>
                            <p className="ux03-note">
                              Exemplo sintético para edição manual; não enviado
                              ao servidor.
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                void copy(
                                  objectText(generated.value),
                                  "Exemplo JSON",
                                )
                              }
                            >
                              Copiar exemplo
                            </button>
                          </>
                        ) : (
                          <p>
                            {generated.reason ||
                              "Não foi possível gerar um exemplo seguro para este schema."}
                          </p>
                        )}
                      </details>
                      {(selected.annotations || selected._meta) && (
                        <details className="ux03-schema-block">
                          <summary>Metadados adicionais · sanitizados</summary>
                          <pre>
                            {objectText(
                              sanitizeExport({
                                annotations: selected.annotations,
                                _meta: selected._meta,
                              }),
                            )}
                          </pre>
                        </details>
                      )}
                    </>
                  )}
                  {group === "resources" && (
                    <>
                      <p>
                        <strong>URI:</strong>{" "}
                        <code>
                          {sanitizeText(
                            String(selected.uri || "Não informado"),
                          )}
                        </code>
                      </p>
                      {selected.mimeType && (
                        <p>
                          <strong>Tipo de mídia:</strong> {selected.mimeType}
                        </p>
                      )}
                      {selected._meta && (
                        <details>
                          <summary>Metadados sanitizados</summary>
                          <pre>
                            {objectText(sanitizeExport(selected._meta))}
                          </pre>
                        </details>
                      )}
                      <button
                        type="button"
                        disabled={busy || externalBusy}
                        onClick={() =>
                          void run("inspect", {
                            kind: "resource",
                            name: selected.uri,
                          })
                        }
                      >
                        Ler resource
                      </button>
                    </>
                  )}
                  {group === "prompts" && (
                    <>
                      {Array.isArray(selected.arguments) &&
                      selected.arguments.length > 0 ? (
                        <>
                          <h4>Argumentos do prompt</h4>
                          <pre>
                            {objectText(sanitizeExport(selected.arguments))}
                          </pre>
                          <label>
                            Argumentos JSON para leitura
                            <textarea
                              aria-label="Argumentos JSON do prompt"
                              value={args[selected.name] ?? "{}"}
                              onChange={(event) =>
                                setArgs((previous) => ({
                                  ...previous,
                                  [selected.name]: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </>
                      ) : (
                        <p>Este prompt não declarou argumentos.</p>
                      )}
                      <button
                        type="button"
                        disabled={busy || externalBusy}
                        onClick={() => {
                          try {
                            const input = selected.arguments?.length
                              ? JSON.parse(args[selected.name] ?? "{}")
                              : {};
                            void run("inspect", {
                              kind: "prompt",
                              name: selected.name,
                              ...(selected.arguments?.length
                                ? { arguments: input }
                                : {}),
                            });
                          } catch {
                            setError("Argumentos JSON inválidos.");
                          }
                        }}
                      >
                        Ler template do prompt
                      </button>
                    </>
                  )}
                  {selected._meta && group !== "tools" && (
                    <details>
                      <summary>Metadados sanitizados</summary>
                      <pre>{objectText(sanitizeExport(selected._meta))}</pre>
                    </details>
                  )}
                </article>
              )}
            </div>
          )}
          {catalog.resourceTemplates?.items?.length > 0 &&
            group === "resources" && (
              <details>
                <summary>Resource templates retornados</summary>
                <pre>
                  {objectText(sanitizeExport(catalog.resourceTemplates.items))}
                </pre>
              </details>
            )}
          <details>
            <summary>Detalhes do servidor e da consulta</summary>
            <pre>
              {objectText(
                sanitizeExport({
                  server: catalog.server,
                  capabilities: catalog.capabilities,
                  requestId: catalog.requestId,
                }),
              )}
            </pre>
          </details>
        </div>
      )}

      {area === "replicate" && (
        <section className="ux03-export-panel" aria-label="Replicar e exportar">
          <p>
            <strong>{profile?.name || "Conexão não selecionada"}</strong> ·
            Configuração {profile ? "salva" : "não verificada"}; capacidades{" "}
            {catalog ? "descobertas" : "não verificadas"}.
          </p>
          <div
            className="ux03-segments"
            role="group"
            aria-label="Formato de exportação"
          >
            {(
              [
                ["vscode", "VS Code · Copilot"],
                ["powershell", "PowerShell · informativo"],
                ["manifest", "Manifesto Tesseract"],
              ] as const
            ).map(([kind, label]) => (
              <button
                type="button"
                key={kind}
                aria-pressed={exportKind === kind}
                onClick={() => setExportKind(kind)}
              >
                {label}
              </button>
            ))}
          </div>
          {exportKind === "powershell" && (
            <p className="ux03-warning">
              <strong>Somente informativo:</strong> não há neste fluxo um
              cliente PowerShell atual com formato documentado e importação
              reproduzível. O formato legado do AI Shell não é apresentado como
              compatibilidade.
            </p>
          )}
          {exportKind === "vscode" && (
            <p className="ux03-note">
              Modelo do formato nativo Copilot `mcpServers`. URLs e
              configurações de transporte são sanitizadas; autenticação deve ser
              configurada diretamente no cliente. A sintaxe não comprova
              conexão.
            </p>
          )}
          {exportKind === "manifest" && (
            <p className="ux03-note">
              Formato próprio `tesseract.capability-manifest` v1.0; não é padrão
              MCP. Sem descoberta, declara estado não verificado.
            </p>
          )}
          <pre
            className="ux03-export-code"
            tabIndex={0}
            aria-label="Conteúdo de exportação para revisar e copiar"
          >
            {exportText}
          </pre>
          <button
            type="button"
            disabled={!profile || !canCopyExport}
            onClick={() =>
              void copy(
                exportText,
                exportKind === "manifest"
                  ? "Manifesto sanitizado"
                  : exportKind === "powershell"
                    ? "Texto informativo"
                    : "Configuração sanitizada",
              )
            }
          >
            {exportKind === "powershell"
              ? "Copiar texto informativo"
              : `Copiar ${exportKind === "manifest" ? "manifesto" : "configuração"}`}
          </button>
        </section>
      )}
      {result && (
        <section aria-label="Evidência de leitura MCP">
          <details open>
            <summary>Retorno da leitura · conteúdo não executado</summary>
            <pre>{objectText(sanitizeExport(result))}</pre>
          </details>
        </section>
      )}
      <details>
        <summary>Logs e correlação</summary>
        <DiagnosticPanel />
      </details>
    </section>
  );
}
