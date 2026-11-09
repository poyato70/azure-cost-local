import { motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/button.js";
export function CommandHero({
  accesses,
  mcps,
  agents,
  onChat,
  onExplore,
  insight,
}: {
  insight?: { text: string; source: string; requestId: string };
  accesses: number;
  mcps: number;
  agents: number;
  onChat: () => void;
  onExplore: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="command-hero relative overflow-hidden rounded-3xl p-6 md:p-9"
    >
      <div className="hero-overline">
        FINANCIAL INTELLIGENCE / LOCAL WORKSPACE
      </div>
      <div className="hero-split">
        <div>
          <h2>
            Veja além
            <br />
            <span>da próxima dimensão.</span>
          </h2>
          <p>
            Explore seus custos. Conecte conhecimento.
            <br />
            Transforme perguntas em evidências.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onChat}>
              Explorar com IA <span aria-hidden="true">↗</span>
            </Button>
            <Button variant="outline" onClick={onExplore}>
              Explorar múltiplas nuvens
            </Button>
          </div>
        </div>
        <div className="insight-spotlight">
          <span className="insight-label">INSIGHTS DE IA</span>
          <h3>
            {insight
              ? "Última resposta do assistente"
              : "Sua próxima descoberta começa com uma pergunta."}
          </h3>
          <p>
            {insight
              ? insight.text.slice(0, 320)
              : "Use o chat com uma fonte autorizada. Nenhum insight financeiro é gerado automaticamente."}
          </p>
          {insight && (
            <small>
              {insight.source} · {insight.requestId} · confira as evidências no
              chat
            </small>
          )}
          <button className="insight-question" onClick={onChat}>
            Quanto gastei no RG nos dois últimos meses? <span>↗</span>
          </button>
        </div>
      </div>
      <div className="hero-kpis">
        {[
          [accesses, "Acessos cadastrados"],
          [mcps, "Conexões MCP"],
          [agents, "Agentes disponíveis"],
        ].map(([n, label]) => (
          <div key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
            <small>Cadastros locais · conexão não presumida</small>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
