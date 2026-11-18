import { useState } from "react";
import {
  NeoButton,
  NeoGauge,
  NeoSearch,
  NeoSegmentedControl,
  NeoSurface,
  NeoToggle,
} from "../components/ui/neo.js";

type Capability = "tools" | "resources" | "prompts";
type Binary = "closed" | "open";

function GaugeExample({ value }: { value?: number }) {
  return (
    <NeoGauge
      value={value}
      label={value === undefined ? "Sem dados" : "Consumo"}
      status={value === undefined ? "Sem métrica real" : "Demonstração"}
    />
  );
}

export function NeumorphicLab() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState<Binary>("open");
  const [closed, setClosed] = useState<Binary>("closed");
  const [capability, setCapability] = useState<Capability>("tools");
  return (
    <main className="neo-lab" data-neo-theme={theme} aria-labelledby="neo-lab-title">
      <header>
        <span className="map-eyebrow">TESSERACT · LABORATÓRIO VISUAL</span>
        <h1 id="neo-lab-title">Côncavo e convexo</h1>
        <p>
          Estudo de profundidade baseado na identidade atual. Os controles são
          locais e não conectam, executam ou alteram qualquer servidor.
        </p>
        <button className="neo-theme-toggle" type="button" aria-pressed={theme === "light"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Tema {theme === "dark" ? "escuro" : "claro"} · alternar</button>
      </header>
      <div className="neo-lab-notice" role="note">
        Valores de gauges e rótulos desta página são fixtures visuais, nunca
        métricas operacionais.
      </div>
      <div className="neo-lab-grid">
        <section className="neo-lab-card" aria-labelledby="lab-buttons">
          <h2 id="lab-buttons">Botões e superfícies</h2>
          <div className="neo-lab-row">
            <NeoButton aria-label="Adicionar">＋</NeoButton>
            <NeoButton aria-label="Confirmar">✓</NeoButton>
            <NeoButton aria-label="Fechar" disabled>×</NeoButton>
            <NeoButton aria-label="Carregando" loading>Carregando</NeoButton>
          </div>
          <div className="neo-lab-row">
            <span className="neo-surface-sample"><NeoSurface depth="raised" style={{ width: 92, height: 54 }} aria-hidden="true" />Convexa</span>
            <span className="neo-surface-sample"><NeoSurface depth="recessed" style={{ width: 92, height: 54 }} aria-hidden="true" />Côncava</span>
            <span className="neo-surface-sample"><NeoSurface depth="flat" style={{ width: 92, height: 54, border: "1px dashed #697383" }} aria-hidden="true" />Plana</span>
          </div>
          <p>Tab até o botão abaixo para conferir foco.</p>
          <NeoButton>Exemplo com foco acessível</NeoButton>
        </section>

        <section className="neo-lab-card" aria-labelledby="lab-controls">
          <h2 id="lab-controls">Busca, toggle e seleção</h2>
          <div className="neo-lab-row">
            <NeoSearch label="Buscar no laboratório" placeholder="Buscar…" value={query} onChange={setQuery} />
          </div>
          <div className="neo-lab-row">
            <NeoToggle checked={enabled} onChange={setEnabled} label="Alternar demonstração" />
            <span aria-live="polite">{enabled ? "Ligado" : "Desligado"}</span>
          </div>
          <h2>Segmented Closed / Open</h2>
          <NeoSegmentedControl
            label="Estado Closed ou Open"
            options={[{ value: "closed", label: "Closed" }, { value: "open", label: "Open" }]}
            value={open}
            onChange={setOpen}
          />
          <p>O segmento côncavo acompanha a seleção atual.</p>
          <NeoSegmentedControl
            label="Estado Closed ou Open, posição oposta"
            options={[{ value: "closed", label: "Closed" }, { value: "open", label: "Open" }]}
            value={closed}
            onChange={setClosed}
          />
        </section>

        <section className="neo-lab-card" aria-labelledby="lab-capabilities">
          <h2 id="lab-capabilities">Capacidades MCP</h2>
          <NeoSegmentedControl
            label="Capacidade MCP demonstrativa"
            options={[
              { value: "tools", label: "Tools", detail: "fixture" },
              { value: "resources", label: "Resources", detail: "fixture" },
              { value: "prompts", label: "Prompts", detail: "fixture" },
            ]}
            value={capability}
            onChange={setCapability}
          />
          <p aria-live="polite">Selecionado: {capability}</p>
        </section>

        <section className="neo-lab-card neo-lab-card--gauges" aria-labelledby="lab-gauges">
          <h2 id="lab-gauges">Gauge circular · fixtures</h2>
          <div className="neo-lab-gauges">
            {[0, 25, 70, 100].map((value) => (
              <GaugeExample key={value} value={value} />
            ))}
            <GaugeExample />
          </div>
        </section>
      </div>
    </main>
  );
}
