import { useState } from "react";
import {
  Orbit as Compass,
  Layers3 as CalendarClock,
  Sparkles as Bot,
  Waypoints as Plug,
  Radar as Activity,
  Aperture as CircleHelp,
  ChevronDown,
  Menu,
} from "lucide-react";
export function Navigation({
  tab,
  onSelect,
}: {
  tab: string;
  onSelect: (id: string) => void;
}) {
  const [mobile, setMobile] = useState(false);
  const groups = [
    {
      label: "Explorar",
      Icon: Compass,
      items: [
        ["multicloud", "Visão multicloud"],
        ["costs", "Custos"],
        ["tag-costs", "Por tag"],
      ],
    },
    {
      label: "Planejar",
      Icon: CalendarClock,
      items: [
        ["benefits", "Compromissos"],
        ["forecast", "Forecast"],
        ["budgets", "Budgets"],
      ],
    },
    {
      label: "Assistentes",
      Icon: Bot,
      items: [
        ["agents", "Agentes"],
        ["agent-lab", "Avaliação de agentes"],
        ["chat", "Chat"],
      ],
    },
    {
      label: "Conexões",
      Icon: Plug,
      items: [
        ["accesses", "Acessos"],
        ["mcps", "MCPs"],
        ["mcp-analysis", "Análise MCP"],
        ["discovery", "Descoberta MCP"],
        ["api-lab", "APIs — capacidades"],
        ["hubs", "FinOps hub"],
      ],
    },
    {
      label: "Operação",
      Icon: Activity,
      items: [["diagnostics", "Diagnóstico"]],
    },
    {
      label: "Ajuda",
      Icon: CircleHelp,
      items: [["help", "Guia e referências"]],
    },
  ];
  return (
    <>
      <button
        className="mobile-menu"
        aria-expanded={mobile}
        onClick={() => setMobile(!mobile)}
      >
        <Menu size={18} /> Menu
      </button>
      <nav
        className={`tree-nav ${mobile ? "mobile-open" : ""}`}
        aria-label="Navegação principal"
      >
        {groups.map(({ label, Icon, items }) => (
          <details open key={label} className="nav-tree-group">
            <summary>
              <Icon size={17} />
              {label}
              <ChevronDown size={14} />
            </summary>
            <div className="nav-children">
              {items
                .filter(([id]) => !["mcp-analysis", "discovery"].includes(id))
                .map(([id, name]) =>
                  id === "mcps" ? (
                    <div className="mcp-tree" key={id}>
                      <button
                        aria-label="MCPs"
                        aria-expanded={true}
                        onClick={() => onSelect("mcps")}
                      >
                        MCPs
                      </button>
                      <div className="nav-subchildren">
                        {[
                          ["mcps", "Integração"],
                          ["mcp-analysis", "Análise"],
                          ["discovery", "Descoberta"],
                        ].map(([child, title]) => (
                          <button
                            key={child}
                            className={tab === child ? "active" : ""}
                            aria-current={tab === child ? "page" : undefined}
                            onClick={() => {
                              onSelect(child);
                              setMobile(false);
                            }}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      key={id}
                      className={tab === id ? "active" : ""}
                      aria-current={tab === id ? "page" : undefined}
                      onClick={() => {
                        onSelect(id);
                        setMobile(false);
                      }}
                    >
                      {id === "mcps" ? "MCPs" : name}
                    </button>
                  ),
                )}
            </div>
          </details>
        ))}
      </nav>
    </>
  );
}
