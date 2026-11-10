import { useEffect, useRef, useState } from "react";
import { manageRequest } from "../api.js";
export function RegistrySearch({
  onConfigure,
}: {
  onConfigure?: (draft: any) => void;
}) {
  const [query, setQuery] = useState("com.microsoft/azure"),
    [result, setResult] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(cursor?: string) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    if (!cursor) setResult(undefined);
    try {
      const r = await manageRequest(
        "/mcp-registry/search",
        "POST",
        { query, cursor },
        c.signal,
      );
      if (!c.signal.aborted)
        setResult((old: any) =>
          cursor
            ? { ...r, servers: [...(old?.servers || []), ...r.servers] }
            : r,
        );
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="registry-search">
      <h3>Buscar no catálogo MCP</h3>
      <p>
        Consulta online ao MCP Registry oficial. Mostra servidores publicados,
        versões, pacotes e endpoints declarados — não apenas links de
        documentação.
      </p>
      <p className="fine">
        Publicação no Registry não é certificação de segurança nem garantia de
        autoria Microsoft/AWS/Google. Confira o publisher e o repositório. A
        busca não instala nem conecta servidores.
      </p>
      <form
        className="actions"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          Nome, publisher ou tecnologia
          <input
            type="search"
            minLength={2}
            maxLength={120}
            required
            value={query}
            onChange={(e) => {
              controller.current?.abort();
              setBusy(false);
              setQuery(e.target.value);
              setResult(undefined);
              setError("");
            }}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Buscando…" : "Buscar servidores"}
        </button>
      </form>
      <div className="actions">
        {[
          ["Microsoft", "com.microsoft/"],
          ["AWS", "awslabs"],
          ["Google / GCP", "google"],
          ["Kubernetes", "kubernetes"],
        ].map(([label, q]) => (
          <button
            key={q}
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
              setQuery(q);
              setResult(undefined);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <>
          <p role="status">
            {result.servers.length} servidor(es) recebido(s) · fonte:{" "}
            {result.source} · consulta em{" "}
            {new Date(result.queriedAt).toLocaleString("pt-BR")}
          </p>
          {!result.servers.length && (
            <p>
              Nenhum resultado nesta busca. O catálogo não cobre todos os
              servidores existentes; tente outro nome ou use uma fonte
              personalizada.
            </p>
          )}
          {result.servers.map((s: any, i: number) => (
            <article
              className="config-card"
              key={s.name + ":" + s.version + ":" + i}
            >
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <p>
                Versão: {s.version} · estado no catálogo: {s.status}
              </p>
              {s.repository && (
                <a href={s.repository} target="_blank" rel="noreferrer">
                  Conferir repositório declarado ↗
                </a>
              )}
              {(s.packages || []).map((p: any, i: number) => (
                <p className="fine" key={i}>
                  Pacote: {p.identifier}@{p.version} · registry:{" "}
                  {p.registryType} · transporte: {p.transport}
                </p>
              ))}
              {(s.remotes || []).map((r: any, i: number) => (
                <div key={i}>
                  <p className="fine">
                    Endpoint declarado: <code>{r.url}</code> · transporte:{" "}
                    {r.transport}
                  </p>
                  {r.transport === "streamable-http" && (
                    <button
                      onClick={() =>
                        onConfigure?.({
                          name: s.name,
                          preset: "custom",
                          transport: "http",
                          endpoint: r.url,
                          authMode: "none",
                          resourceContext: {},
                        })
                      }
                    >
                      Preparar cadastro HTTP
                    </button>
                  )}
                </div>
              ))}
              {s.name === "com.microsoft/azure" && (
                <button
                  onClick={() =>
                    onConfigure?.({
                      name: "Azure MCP",
                      preset: "azure",
                      transport: "stdio",
                      endpoint: "",
                      authMode: "application",
                      resourceContext: { namespace: "pricing" },
                    })
                  }
                >
                  Preparar cadastro Azure
                </button>
              )}
              <p className="fine">
                Preparar cadastro não inicia conexão. Revise autenticação e
                versão; o executor Azure usa a versão fixada pelo Tesseract.
                Outros pacotes stdio ainda exigem configuração fora desta
                aplicação.
              </p>
            </article>
          ))}
          {result.nextCursor && (
            <button
              disabled={busy}
              onClick={() => void search(result.nextCursor)}
            >
              Carregar mais resultados
            </button>
          )}
        </>
      )}
    </section>
  );
}
