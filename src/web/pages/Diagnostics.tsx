import { useEffect, useState } from "react";
import { manageRequest } from "../api.js";
export function DiagnosticPanel() {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      setRows(await manageRequest("/diagnostics"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <h2>Diagnóstico</h2>
      <p>
        Histórico desta sessão, mantido somente na memória do serviço. Mostra
        login, rotas locais, retorno HTTP do Azure e operações MCP. Tokens,
        Secrets, senha e URL OAuth não são registrados. A lista começa após esta
        atualização; ações anteriores não podem ser reconstruídas.
      </p>
      <div className="actions">
        <button onClick={() => void load()}>Atualizar diagnóstico</button>
        <button
          onClick={() =>
            void manageRequest("/diagnostics", "DELETE").then(load)
          }
        >
          Limpar histórico
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!rows.length && (
        <p>
          Nenhuma operação registrada nesta sessão. Reproduza a ação e clique em
          Atualizar diagnóstico.
        </p>
      )}
      {[...rows].reverse().map((r, i) => (
        <article className="config-card" key={i}>
          <strong>
            {r.source} · {r.status}
          </strong>
          <p>
            {new Date(r.time).toLocaleString("pt-BR")} · {r.operation}
          </p>
          <p>{r.detail}</p>
        </article>
      ))}
    </>
  );
}
