import { Waypoints, ScanLine, Sparkles, BookOpen } from "lucide-react";
export function WorkspaceHome({
  mcps,
  agents,
  onSelect,
}: {
  mcps: any[];
  agents: any[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="workspace-home">
      <p className="eyebrow">MCP INTEGRATION & AI WORKSPACE FOR FINOPS</p>
      <h2>
        Conecte capacidades.
        <br />
        Investigue com evidências.
      </h2>
      <p>
        Do servidor à resposta do agente: veja o que está conectado, escolha o
        que pode ser executado e confira o retorno.
      </p>
      <div className="workspace-journey">
        {[
          {
            id: "mcps",
            Icon: Waypoints,
            name: "1. Conectar",
            text: "Cadastre o endpoint, configure sua identidade e descubra capacidades.",
          },
          {
            id: "mcp-analysis",
            Icon: ScanLine,
            name: "2. Explorar e testar",
            text: "Revise schemas, aprove tools e inspecione o resultado bruto.",
          },
          {
            id: "agents",
            Icon: Sparkles,
            name: "3. Configurar agente",
            text: "Vincule modelo, conexões, tools e conhecimento revisado.",
          },
          {
            id: "knowledge",
            Icon: BookOpen,
            name: "4. Conhecimento",
            text: "Importe skills e referências do GitHub em versões imutáveis.",
          },
        ].map(({ id, Icon, name, text }) => (
          <button
            key={id}
            className="journey-card"
            onClick={() => onSelect(id)}
          >
            <Icon size={22} />
            <strong>{name}</strong>
            <span>{text}</span>
          </button>
        ))}
      </div>
      <div className="section-head">
        <h3>Seu workspace</h3>
        <button onClick={() => onSelect("investigations")}>
          Abrir investigação ↗
        </button>
      </div>
      {!mcps.length && (
        <p>
          Nenhum MCP cadastrado. Comece por Conectar; o cadastro não exige login
          Azure para MCPs HTTP independentes.
        </p>
      )}
      {mcps.map((p) => (
        <article className="config-card" key={p.id}>
          <div className="section-head">
            <h3>{p.name}</h3>
            <button onClick={() => onSelect("mcp-analysis")}>
              Inspecionar
            </button>
          </div>
          <p>
            {p.preset} · {p.transport} · {p.status || "cadastrado"}
          </p>
          <small>
            {p.approvedTools?.length || 0} tools aprovadas · status de conexão
            não comprova acesso aos dados.
          </small>
        </article>
      ))}
      <p className="fine">
        {agents.length} agente(s) cadastrado(s). Consultas financeiras e
        multicloud permanecem disponíveis em Análises financeiras.
      </p>
    </div>
  );
}
