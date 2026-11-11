import { ArrowRight } from "lucide-react";
import type {
  McpProfile,
  PublicAccessProfile,
  PublicAgent,
} from "../../shared/connections.js";
import { describeMcp } from "../../shared/mcp-info.js";

type WorkspaceConnection = Omit<McpProfile, "tokenRef"> & {
  connected?: boolean;
};

export function WorkspaceHome({
  mcps,
  agents,
  accesses,
  loaded,
  onSelect,
  onInspect,
}: {
  mcps: WorkspaceConnection[];
  agents: PublicAgent[];
  accesses: PublicAccessProfile[];
  loaded: boolean;
  onSelect: (id: string) => void;
  onInspect: (id: string) => void;
}) {
  const accessesById = new Map(accesses.map((access) => [access.id, access]));
  const summary = [
    { id: "accesses", label: "Acessos", count: accesses.length },
    { id: "mcps", label: "Conexões MCP", count: mcps.length },
    { id: "agents", label: "Agentes", count: agents.length },
  ];

  return (
    <div className="workspace-home">
      <h2>Resumo dos cadastros</h2>
      {loaded ? (
        <div className="workspace-summary">
          {summary.map(({ id, label, count }) => (
            <button key={id} onClick={() => onSelect(id)}>
              {label} <strong>{count}</strong>
            </button>
          ))}
        </div>
      ) : (
        <p role="status">Aguardando os cadastros.</p>
      )}
      <h3>Vínculos das conexões MCP</h3>
      {loaded && !mcps.length && <p>Nenhuma conexão MCP cadastrada.</p>}
      {mcps.map((profile) => {
        const access = profile.accessId
          ? accessesById.get(profile.accessId)
          : undefined;
        const details = new Map(describeMcp(profile));
        const flow = [
          [
            "Acesso",
            access?.name ||
              (profile.accessId
                ? "Cadastro indisponível"
                : "Sem acesso vinculado"),
          ],
          [
            "Execução",
            profile.transport === "stdio"
              ? "Local · stdio"
              : "Endpoint · Streamable HTTP",
          ],
          ["Conexão MCP", profile.name],
          [
            profile.transport === "stdio"
              ? "Autenticação no provedor"
              : "Autenticação MCP",
            details.get(
              profile.transport === "stdio"
                ? "Autenticação Azure"
                : "Autenticação MCP",
            ),
          ],
          ["Provedor", details.get("Provider")],
        ];
        return (
          <article className="config-card" key={profile.id}>
            <div className="section-head">
              <h4>{profile.name}</h4>
              <button onClick={() => onInspect(profile.id)}>
                Analisar tools
              </button>
            </div>
            <ol
              className="workspace-flow"
              aria-label={`Vínculos de ${profile.name}`}
            >
              {flow.map(([label, value], index) => (
                <li key={label}>
                  {index > 0 && <ArrowRight size={16} aria-hidden="true" />}
                  <div>
                    <small>{label}</small>
                    <span>{value}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="fine">
              {profile.connected
                ? "Sessão MCP aberta"
                : "Sem sessão MCP aberta"}
              {" · "}
              {profile.approvedTools?.length || 0} tools permitidas
            </p>
          </article>
        );
      })}
    </div>
  );
}
