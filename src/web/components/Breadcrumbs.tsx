const paths: Record<string, string[]> = {
  multicloud: ["Explorar", "Visão multicloud"],
  costs: ["Explorar", "Custos", "Por escopo"],
  "tag-costs": ["Explorar", "Custos", "Por tag"],
  benefits: ["Planejar", "Compromissos"],
  forecast: ["Planejar", "Forecast"],
  budgets: ["Planejar", "Budgets"],
  agents: ["Assistentes", "Agentes", "Cadastro"],
  "agent-lab": ["Assistentes", "Agentes", "Avaliação"],
  chat: ["Assistentes", "Chat"],
  accesses: ["Conexões", "Acessos"],
  mcps: ["Conexões", "MCPs", "Integração"],
  "mcp-analysis": ["Conexões", "MCPs", "Análise"],
  discovery: ["Conexões", "MCPs", "Descoberta"],
  "api-lab": ["Conexões", "APIs", "Capacidades"],
  hubs: ["Conexões", "FinOps hub"],
  diagnostics: ["Operação", "Diagnóstico"],
  help: ["Ajuda", "Guia e referências"],
};
export function pageTitle(tab: string) {
  return paths[tab]?.at(-1) || "Tesseract";
}
export function Breadcrumbs({
  tab,
  onHome,
}: {
  tab: string;
  onHome: () => void;
}) {
  return (
    <nav aria-label="Caminho de navegação" className="breadcrumbs">
      <button onClick={onHome}>Tesseract</button>
      {(paths[tab] || []).map((p, i, a) => (
        <span key={p}>
          <span className="crumb-separator" aria-hidden="true">
            /
          </span>
          <span aria-current={i === a.length - 1 ? "page" : undefined}>
            {p}
          </span>
        </span>
      ))}
    </nav>
  );
}
