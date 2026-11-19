import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Check, CircleHelp, Minus, Plus, RefreshCw, Server, Waypoints } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { api, manageRequest } from "../api.js";
import { getObservationStatus, isEvidenceStale } from "./observabilityStatus.js";

type Health = { ok: boolean; app?: string };
type Profile = { id: string; name: string; preset: string; status?: string; connected?: boolean; transport?: string };
type Diagnostic = { time: string; source: string; operation: string; status: string; detail: string };
type Flow = { id: string; state: string; stage?: string; serverA?: { id: string; tool: string }; serverB?: { id: string; tool: string }; updatedAt?: string; error?: string; collection?: { sourceMode?: "synthetic" | "azure-arm-mcp" } };
type Snapshot = { health?: Health; profiles?: Profile[]; diagnostics?: Diagnostic[]; flows?: Flow[]; checkedAt?: string; errors: string[] };
type NodeId = "web" | "api" | "registry" | "orchestration" | "diagnostics";
type Node = { id: NodeId; title: string; summary: string; x: number; y: number; Icon: typeof Activity; state: "ok" | "unknown" | "stale" | "error"; statusLabel: string; evidence: string };
const GRAPH_WIDTH = 830;
const GRAPH_HEIGHT = 370;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/Bearer\s+\S+/gi, "Bearer [oculto]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token oculto]")
    .replace(/(client_secret|password|refresh_token|access_token|token|secret|code|state)=([^\s&]+)/gi, "$1=[oculto]")
    .replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, "https://[credencial]@")
    .replace(/(?:[A-Z]:\\|\\\\)[^\s]+/gi, "[caminho local]")
    .slice(0, 220);
}

export function GlobalObservability() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ errors: [] });
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [selected, setSelected] = useState<NodeId>("api");
  const [scale, setScale] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Bootstrap creates/resumes the local session cookie before session-scoped reads.
      await api.bootstrap();
    } catch {
      setSnapshot({ checkedAt: new Date().toISOString(), errors: ["Sessão local não pôde ser inicializada; estados de sessão não foram verificados."] });
      setLoading(false);
      return;
    }
    const [health, profiles, diagnostics, flows] = await Promise.allSettled([
      manageRequest<Health>("/health"),
      manageRequest<Profile[]>("/mcp-connections"),
      manageRequest<Diagnostic[]>("/diagnostics"),
      manageRequest<Flow[]>("/mcp-orchestrations"),
    ]);
    const errors: string[] = [];
    if (health.status === "rejected") errors.push("Saúde da API local não foi verificada.");
    if (profiles.status === "rejected") errors.push("Conexões MCP não puderam ser lidas.");
    if (diagnostics.status === "rejected") errors.push("Diagnósticos da sessão não puderam ser lidos.");
    if (flows.status === "rejected") errors.push("Fluxos da sessão não puderam ser lidos.");
    setSnapshot({
      health: health.status === "fulfilled" ? health.value : undefined,
      profiles: profiles.status === "fulfilled" && Array.isArray(profiles.value) ? profiles.value : undefined,
      diagnostics: diagnostics.status === "fulfilled" && Array.isArray(diagnostics.value) ? diagnostics.value : undefined,
      flows: flows.status === "fulfilled" && Array.isArray(flows.value) ? flows.value : undefined,
      checkedAt: new Date().toISOString(), errors,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const fit = () => {
      if (window.innerWidth <= 760) return;
      const fitScale = Math.max(
        0.25,
        Math.min(1, (map.clientWidth - 24) / GRAPH_WIDTH, (map.clientHeight - 24) / GRAPH_HEIGHT),
      );
      setScale(fitScale);
      setPan({
        x: Math.max(0, (map.clientWidth - GRAPH_WIDTH * fitScale) / 2),
        y: Math.max(0, (map.clientHeight - GRAPH_HEIGHT * fitScale) / 2),
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(map);
    fit();
    return () => observer.disconnect();
  }, []);

  const lastDiagnostic = snapshot.diagnostics?.at(-1);
  const nodes = useMemo<Node[]>(() => {
    const stale = isEvidenceStale(snapshot.checkedAt, clock);
    const freshness = stale ? "stale" : "current";
    const apiStatus = getObservationStatus(
      snapshot.health ? snapshot.health.ok ? "positive" : "negative" : snapshot.checkedAt ? "failed" : "unverified",
      freshness,
      { positive: "Endpoint respondeu ok=true", negative: "Endpoint respondeu ok=false", failed: "Falha ao ler /api/health" },
    );
    const connectionsStatus = getObservationStatus(
      snapshot.profiles ? "positive" : snapshot.checkedAt ? "failed" : "unverified",
      freshness,
      { positive: "Lista consultada", negative: "Resposta negativa ao ler a lista", failed: "Falha ao ler a lista de conexões" },
    );
    const flowsStatus = getObservationStatus(
      snapshot.flows ? "positive" : snapshot.checkedAt ? "failed" : "unverified",
      freshness,
      { positive: "Histórico consultado", negative: "Resposta negativa ao ler o histórico", failed: "Falha ao ler o histórico" },
    );
    const diagnosticsStatus = getObservationStatus(
      snapshot.diagnostics ? "positive" : snapshot.checkedAt ? "failed" : "unverified",
      freshness,
      { positive: "Eventos consultados", negative: "Resposta negativa ao ler diagnósticos", failed: "Falha ao ler diagnósticos" },
    );
    return [
      { id: "web", title: "Interface Tesseract", summary: "Aplicação web local", x: 20, y: 155, Icon: Activity, state: "ok", statusLabel: "Interface carregada", evidence: "A página está aberta nesta sessão do navegador." },
      { id: "api", title: "API local", summary: snapshot.health?.app || "Endpoint local · /api/health", x: 300, y: 155, Icon: Server, state: apiStatus.state, statusLabel: apiStatus.label, evidence: snapshot.health?.ok ? `GET /api/health respondeu ok=true às ${new Date(snapshot.checkedAt!).toLocaleTimeString("pt-BR")}. Isso confirma somente a resposta desse endpoint; não verifica o funcionamento de todos os serviços, conexões MCP, Azure ou consultas FinOps.` : snapshot.health ? "GET /api/health retornou ok=false." : "A leitura de /api/health falhou; não há evidência de disponibilidade." },
      { id: "registry", title: "Conexões MCP", summary: snapshot.profiles ? `${snapshot.profiles.length} configuração(ões) listada(s) nesta sessão` : "Lista indisponível", x: 580, y: 35, Icon: Waypoints, state: connectionsStatus.state, statusLabel: connectionsStatus.label, evidence: snapshot.profiles ? "GET /api/mcp-connections retornou configurações da sessão. Uma lista acessível não comprova que os servidores MCP estejam conectados ou operacionais." : "A consulta da lista falhou; o estado das conexões não foi verificado." },
      { id: "orchestration", title: "Fluxos registrados", summary: snapshot.flows ? `${snapshot.flows.length} registro(s) nesta sessão` : "Histórico indisponível", x: 580, y: 155, Icon: Waypoints, state: flowsStatus.state, statusLabel: flowsStatus.label, evidence: snapshot.flows ? "GET /api/mcp-orchestrations retornou registros da sessão/identidade atual; isso não inicia nem valida execuções." : "Não foi possível consultar o histórico." },
      { id: "diagnostics", title: "Diagnósticos", summary: snapshot.diagnostics ? `${snapshot.diagnostics.length} evento(s) nesta sessão` : "Dados indisponíveis", x: 580, y: 275, Icon: AlertTriangle, state: diagnosticsStatus.state, statusLabel: diagnosticsStatus.label, evidence: snapshot.diagnostics ? "GET /api/diagnostics retornou eventos em memória da sessão; última atividade: " + (lastDiagnostic ? new Date(lastDiagnostic.time).toLocaleString("pt-BR") : "nenhuma registrada") + "." : "Não foi possível ler os diagnósticos." },
    ];
  }, [snapshot, lastDiagnostic, clock]);
  const activeNode = nodes.find((node) => node.id === selected)!;
  const diagnostics = (snapshot.diagnostics || []).filter((item) =>
    !(/^GET\s/.test(item.operation) && /^2\d\d$/.test(item.status) && item.source === "Aplicação local"),
  );
  const flows = snapshot.flows || [];

  function zoom(factor: number) { setScale((current) => Math.max(0.25, Math.min(1.6, current * factor))); }
  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y });
  }

  return (
    <section className="observability" aria-labelledby="observability-title">
      <div className="observability-heading">
        <div><span className="eyebrow">EXPERIMENTO · SOMENTE LEITURA</span><h2 id="observability-title">Observabilidade global</h2><p>Mapa do serviço local e dos registros disponíveis nesta sessão.</p></div>
        <div className="observability-meta"><span>{snapshot.checkedAt ? `${clock - Date.parse(snapshot.checkedAt) > 60000 ? "Dados desatualizados · " : snapshot.errors.length > 0 ? "Consulta parcial · " : "Consulta concluída · "}${new Date(snapshot.checkedAt).toLocaleTimeString("pt-BR")}` : "Sem verificação"}</span><button type="button" className="neo-raised obs-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? "Atualizando…" : "Atualizar"}</button></div>
      </div>
      <p className="obs-readonly"><Check size={15} aria-hidden="true" /> Esta tela consulta endpoints existentes com GET. Não executa ferramentas nem altera conexões, rotas ou fluxos.</p>
      {snapshot.errors.length > 0 && <div role="status" className="obs-warning"><CircleHelp size={17} aria-hidden="true" />{snapshot.errors.join(" ")} Consulte o resultado e o momento da leitura no Inspector.</div>}
      <div className="obs-layout">
        <div className="obs-map-shell neo-raised">
          <div className="obs-map-tools" aria-label="Controles de mapa"><button type="button" className="neo-raised" aria-label="Aproximar mapa" onClick={() => zoom(1.15)}><Plus size={17} /></button><button type="button" className="neo-raised" aria-label="Afastar mapa" onClick={() => zoom(1 / 1.15)}><Minus size={17} /></button><span aria-live="polite">{Math.round(scale * 100)}%</span></div>
          <div className="obs-map" ref={mapRef} role="region" aria-label="Mapa de componentes. Arraste o fundo para mover; use os botões para zoom." tabIndex={0} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onWheel={(event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.08 : 1 / 1.08); }} onKeyDown={(event) => { const d = event.shiftKey ? 48 : 20; if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"].includes(event.key)) event.preventDefault(); if (event.key === "ArrowLeft") setPan((p) => ({ ...p, x: p.x + d })); if (event.key === "ArrowRight") setPan((p) => ({ ...p, x: p.x - d })); if (event.key === "ArrowUp") setPan((p) => ({ ...p, y: p.y + d })); if (event.key === "ArrowDown") setPan((p) => ({ ...p, y: p.y - d })); if (event.key === "+" || event.key === "=") zoom(1.1); if (event.key === "-") zoom(1 / 1.1); }}>
            <div className="obs-map-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
              <svg className="obs-edges" viewBox="0 0 830 370" aria-hidden="true"><path d="M250 190 C270 190 280 190 300 190"/><path d="M530 190 C550 190 560 71 580 71"/><path d="M530 190 C550 190 560 191 580 191"/><path d="M530 190 C550 190 560 311 580 311"/></svg>
              {nodes.map(({ Icon, ...node }) => <button type="button" key={node.id} className={`obs-node neo-raised is-${node.state}${selected === node.id ? " is-selected" : ""}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected(node.id)} aria-pressed={selected === node.id} aria-label={`${node.title}: ${node.statusLabel}. ${node.summary}`}><span className="obs-node-icon"><Icon size={19} aria-hidden="true" /></span><span className="obs-node-text"><strong>{node.title}</strong><small>{node.summary}</small></span><span className={`obs-state-dot is-${node.state}`} aria-hidden="true" /></button>)}
            </div>
          </div>
          <div className="obs-legend"><span><i className="is-ok" /> Evidência positiva consultada</span><span><i className="is-unknown" /> Não verificado</span><span><i className="is-stale" /> Evidência positiva desatualizada</span><span><i className="is-error" /> Resposta negativa ou leitura falhou, inclusive desatualizada</span><span className="obs-legend-note">O estado descreve somente o resultado da evidência e sua idade; não representa saúde integral do serviço.</span></div>
        </div>
        <div className="obs-inspector neo-raised" role="region" aria-labelledby="obs-inspector-title"><span className="eyebrow">INSPECTOR</span><h3 id="obs-inspector-title">{activeNode.title}</h3><p>{activeNode.summary}</p><div className="obs-inspector-state"><span className={`obs-state-dot is-${activeNode.state}`} aria-hidden="true" />{activeNode.statusLabel}</div><dl><div><dt>Origem</dt><dd>{activeNode.id === "web" ? "Navegador atual" : activeNode.id === "api" ? "GET /api/health" : activeNode.id === "registry" ? "GET /api/mcp-connections" : activeNode.id === "orchestration" ? "GET /api/mcp-orchestrations" : "GET /api/diagnostics"}</dd></div><div><dt>Consultado</dt><dd>{snapshot.checkedAt ? new Date(snapshot.checkedAt).toLocaleString("pt-BR") : "Ainda não"}</dd></div></dl><p className="obs-evidence">{activeNode.evidence}</p>
          {selected === "registry" && <div className="obs-inspector-section"><h4>Conexões MCP observadas</h4>{!snapshot.profiles ? <p>Estado desconhecido: a leitura das conexões falhou.</p> : snapshot.profiles.length === 0 ? <p>Nenhuma conexão configurada nesta sessão.</p> : <ul className="obs-flow-list">{snapshot.profiles.slice(0, 6).map((profile) => <li key={profile.id}><strong>{safeText(profile.name)}</strong><span>{profile.connected ? "Registro informa cliente conectado" : safeText(profile.status || "Estado não informado")} · {safeText(profile.transport || "transporte não informado")}</span></li>)}</ul>}</div>}
          <div className="obs-inspector-section"><h4>Fluxos registrados</h4>{!snapshot.flows ? <p>Estado desconhecido: a leitura do histórico falhou.</p> : flows.length === 0 ? <p>Nenhum fluxo registrado nesta sessão.</p> : <ul className="obs-flow-list">{flows.slice(0, 5).map((flow) => <li key={flow.id}>{flow.collection?.sourceMode === "synthetic" && <small className="obs-synthetic">Fixture sintética</small>}<strong>{safeText(flow.serverA?.tool || "Fluxo MCP")} → {safeText(flow.serverB?.tool || "Destino")}</strong><span>{safeText(flow.state)} · {flow.updatedAt ? new Date(flow.updatedAt).toLocaleString("pt-BR") : "sem data"}</span>{flow.error && <small>{safeText(flow.error)}</small>}</li>)}</ul>}</div>
          <div className="obs-inspector-section"><h4>Diagnósticos recentes</h4>{!snapshot.diagnostics ? <p>Estado desconhecido: a leitura dos diagnósticos falhou.</p> : diagnostics.length === 0 ? <p>Nenhum diagnóstico registrado nesta sessão.</p> : <ul className="obs-diagnostic-list">{diagnostics.slice(-4).reverse().map((item, index) => <li key={`${item.time}-${index}`}><strong>{safeText(item.source)} · {safeText(item.status)}</strong><span>{safeText(item.operation)} — {safeText(item.detail)}</span><time>{new Date(item.time).toLocaleString("pt-BR")}</time></li>)}</ul>}</div>
        </div>
      </div>
    </section>
  );
}
