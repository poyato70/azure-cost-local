import { useEffect, useRef, useState } from "react";
import { manageRequest } from "../api.js";
import { DiagnosticPanel } from "./Diagnostics.js";
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
    [busy, setBusy] = useState(false),
    [args, setArgs] = useState("{}");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
    setCatalog(undefined);
    setResult(undefined);
    setError("");
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
      const r = await manageRequest(
        `/mcp-connections/${id}/${path}`,
        "POST",
        body,
        c.signal,
      );
      if (c.signal.aborted) return;
      if (path === "catalog") {
        setCatalog(r);
        onTools(r.tools || []);
      } else setResult(r);
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <section>
      <h2>Laboratório de capacidades MCP</h2>
      <p>
        Capacidade anunciada, descoberta e leitura testada são evidências
        diferentes. Conteúdos de prompts e resources não são executados.
      </p>
      <label>
        Conexão para análise
        <select
          disabled={busy || externalBusy}
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Selecione</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!id || busy || externalBusy}
        onClick={() => void run("catalog")}
      >
        {busy ? "Consultando…" : "Listar capacidades, prompts e resources"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {catalog && (
        <>
          <h3>Servidor e capacidades anunciadas</h3>
          <pre>
            {JSON.stringify(
              {
                server: catalog.server,
                capabilities: catalog.capabilities,
                requestId: catalog.requestId,
              },
              null,
              2,
            )}
          </pre>
          <p>
            {catalog.tools?.length || 0} tools; execute leituras permitidas no
            painel de tools abaixo.
          </p>
          <label>
            Argumentos do prompt (JSON)
            <textarea value={args} onChange={(e) => setArgs(e.target.value)} />
          </label>
          {["prompts", "resources"].map((kind) => (
            <section key={kind}>
              <h3>{kind}</h3>
              <p>
                Estado: {catalog[kind]?.status} {catalog[kind]?.message}
              </p>
              {catalog[kind]?.items?.map((item: any, i: number) => (
                <article className="config-card" key={i}>
                  <strong>{item.name || item.uri}</strong>
                  <p>{item.description}</p>
                  <details>
                    <summary>Schema / metadados</summary>
                    <pre>{JSON.stringify(item, null, 2)}</pre>
                  </details>
                  <button
                    disabled={busy || externalBusy}
                    onClick={() => {
                      try {
                        const a = JSON.parse(args);
                        void run("inspect", {
                          kind: kind === "prompts" ? "prompt" : "resource",
                          name: kind === "prompts" ? item.name : item.uri,
                          ...(kind === "prompts" ? { arguments: a } : {}),
                        });
                      } catch {
                        setError("Argumentos JSON inválidos.");
                      }
                    }}
                  >
                    Ler {kind === "prompts" ? "template" : "resource listado"}
                  </button>
                </article>
              ))}
            </section>
          ))}
        </>
      )}
      {result && (
        <section aria-label="Evidência de leitura MCP">
          <h3>Retorno da leitura</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
      <details>
        <summary>Logs e correlação</summary>
        <DiagnosticPanel />
      </details>
    </section>
  );
}
