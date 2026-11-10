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
      label: "Workspace",
      Icon: Compass,
      items: [
        ["home", "Início"],
        ["investigations", "Investigações"],
      ],
    },
    {
      label: "Conexões",
      Icon: Plug,
      items: [
        ["mcps", "MCPs"],
        ["mcp-analysis", "Análise MCP"],
        ["discovery", "Descoberta MCP"],
        ["accesses", "Acessos"],
        ["api-lab", "APIs — capacidades"],
      ],
    },
    {
      label: "Agentes e conhecimento",
      Icon: Bot,
      items: [
        ["agents", "Agentes"],
        ["knowledge", "Conhecimento e skills"],
        ["agent-lab", "Avaliação de agentes"],
        ["chat", "Chat"],
      ],
    },
    {
      label: "Análises financeiras",
      Icon: CalendarClock,
      items: [
        ["costs", "Custos"],
        ["tag-costs", "Por tag"],
        ["forecast", "Forecast"],
        ["budgets", "Budgets"],
        ["benefits", "Compromissos"],
        ["multicloud", "Visão multicloud"],
        ["hubs", "FinOps hub"],
      ],
    },
    {
      label: "Operação e ajuda",
      Icon: Activity,
      items: [
        ["diagnostics", "Diagnóstico"],
        ["help", "Guia e referências"],
      ],
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
