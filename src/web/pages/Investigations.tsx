import { useMemo, useState } from "react";
import type { PublicAgent } from "../../shared/connections.js";
import { Chat } from "./Chat.js";
export function Investigations({
  mcps,
  agents,
  onAzure,
}: {
  mcps: any[];
  agents: PublicAgent[];
  onAzure: () => void;
}) {
  const [id, setId] = useState("");
  const connections = mcps.filter((p) =>
    ["custom", "kubernetes"].includes(p.preset),
  );
  const eligible = agents.filter(
    (a) => a.provider !== "http-agent-v1" && a.mcpConnectionIds.includes(id),
  );
  const selection = useMemo(
    () => ({
      accessId: "00000000-0000-4000-8000-000000000000",
      source: "mcp" as const,
      mcpConnectionId: id,
    }),
    [id],
  );
  return (
    <>
      <h2>Investigações com MCPs</h2>
      <p>
        Escolha uma conexão independente e um agente autorizado. O modelo recebe
        a pergunta, o conhecimento vinculado e os resultados das tools
        permitidas.
      </p>
      <label>
        Conexão MCP independente
        <select
          aria-label="Conexão MCP independente"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Selecione</option>
          {connections.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {id && !eligible.length && (
        <p className="notice">
          Nenhum agente local vinculado. Em Agentes, configure um modelo,
          vincule este MCP e selecione suas tools aprovadas.
        </p>
      )}
      {id && eligible.length > 0 && (
        <Chat
          key={id}
          independent
          agents={eligible}
          selection={selection}
          basis="ActualCost"
          selectedSource="mcp"
          connectionLabel={connections.find((p) => p.id === id)?.name}
        />
      )}
      <div className="config-card">
        <h3>Investigações Azure / Copilot</h3>
        <p>
          Use o chat com acesso Azure, escopo e fonte selecionados para
          consultas de custos reais, ARM MCP e Copilot local.
        </p>
        <button onClick={onAzure}>Abrir chat Azure / Copilot</button>
      </div>
    </>
  );
}
