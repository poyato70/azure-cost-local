import { useEffect, useState } from "react";
import { manageRequest } from "../api.js";
import type { KnowledgeDocument } from "../../shared/knowledge.js";
export function Knowledge() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    license: "",
    reviewed: false,
  });
  const reload = () =>
    manageRequest("/knowledge").then((d) => setDocs(d as KnowledgeDocument[]));
  useEffect(() => {
    void reload().catch((e) => setError(e.message));
  }, []);
  const term = search.toLocaleLowerCase("pt-BR");
  return (
    <div className="knowledge-workspace">
      <div className="section-head">
        <div>
          <h2>Conhecimento e skills</h2>
          <p>
            Versões revisadas, fontes explícitas e conteúdo pesquisável. Nenhum
            script é executado.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <details className="config-card">
        <summary>Importar Markdown do GitHub</summary>
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await manageRequest("/knowledge", "POST", form);
              await reload();
              setForm({ name: "", url: "", license: "", reviewed: false });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nome
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            URL do arquivo em commit imutável
            <input
              required
              type="url"
              placeholder="https://github.com/time/catalogo/blob/SHA-40/skills/finops/SKILL.md"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
          <p className="fine">
            No GitHub, abra o arquivo e pressione Y para obter a URL fixada ao
            commit. Apenas repositórios públicos nesta versão; máximo 32 kB por
            arquivo. Referências relativas não são importadas automaticamente.
          </p>
          <label>
            Licença / autorização de uso declarada
            <input
              required
              value={form.license}
              onChange={(e) => setForm({ ...form, license: e.target.value })}
            />
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={form.reviewed}
              onChange={(e) => setForm({ ...form, reviewed: e.target.checked })}
            />
            Revisei o conteúdo na origem e autorizo seu uso nos agentes aos
            quais eu o vincular.
          </label>
          <button className="primary" disabled={busy || !form.reviewed}>
            {busy ? "Importando…" : "Importar versão revisada"}
          </button>
        </form>
      </details>
      <label>
        Pesquisar no nome, caminho e conteúdo
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {!docs.length && (
        <p>
          Importe uma skill ou referência para começar. Depois, vincule a versão
          desejada em Agentes.
        </p>
      )}
      {docs
        .filter(
          (d) =>
            !term ||
            `${d.name} ${d.path} ${d.content}`
              .toLocaleLowerCase("pt-BR")
              .includes(term),
        )
        .map((d) => (
          <article className="config-card" key={d.id}>
            <h3>{d.name}</h3>
            <p>
              {d.path} · {d.license}
            </p>
            <p className="fine">
              Commit {d.commit} · importado em{" "}
              {new Date(d.importedAt).toLocaleString("pt-BR")}
            </p>
            <a href={d.url} target="_blank" rel="noreferrer">
              Ver fonte versionada ↗
            </a>
            <details>
              <summary>Conteúdo e integridade</summary>
              <p className="fine">SHA-256: {d.contentHash}</p>
              <pre>{d.content}</pre>
            </details>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await manageRequest("/knowledge/" + d.id, "DELETE");
                  await reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remover versão local
            </button>
          </article>
        ))}
    </div>
  );
}
