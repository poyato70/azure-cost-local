import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Check, CircleHelp, Minus, Plus, RefreshCw, Server, Waypoints } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { api, manageRequest } from "../api.js";

type Health = { ok: boolean; app?: string };
type Profile = { id: string; name: string; preset: string; status?: string; connected?: boolean; transport?: string };
type Diagnostic = { time: string; source: string; operation: string; status: string; detail: string };
type Flow = { id: string; state: string; stage?: string; serverA?: { id: string; tool: string }; serverB?: { id: string; tool: string }; updatedAt?: string; error?: string; collection?: { sourceMode?: "synthetic" | "azure-arm-mcp" } };
type Snapshot = { health?: Health; profiles?: Profile[]; diagnostics?: Diagnostic[]; flows?: Flow[]; checkedAt?: string; errors: string[] };
type NodeId = "web" | "api" | "registry" | "orchestration" | "diagnostics";
type Node = { id: NodeId; title: string; summary: string; x: number; y: number; Icon: typeof Activity; state: "ok" | "unknown" | "stale" | "error"; evidence: string };
const GRAPH_WIDTH = 1150;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/Bearer\s+\S+/gi, "Bearer [oculto]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token oculto]")
    .replace(/(client_secret|password|refresh_token|access_token|token|secret|code|state)=([^\s&]+)/gi, "$1=[oculto]")
    .replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, "https://[credencial]@")
    .replace(/(?:[A-Z]:\\|\\\\)[^\s]+/gi, "[caminho local]")
    .slice(0, 220);
}

const labelState = (state: Node["state"]) => ({ ok: "Verificado", unknown: "Não verificado", stale: "Desatualizado", error: "Falha de leitura" })[state];

export function GlobalObservability() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ errors: [] });
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [selected, setSelected] = useState<NodeId>("api");
  const [scale, setScale] = useState(0.6);
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
      setScale(Math.max(0.45, Math.min(1, (map.clientWidth - 24) / GRAPH_WIDTH)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(map);
    fit();
    return () => observer.disconnect();
  }, []);

  const lastDiagnostic = snapshot.diagnostics?.at(-1);
  const nodes = useMemo<Node[]>(() => {
    const stale = Boolean(snapshot.checkedAt && clock - Date.parse(snapshot.checkedAt) > 60000);
    const apiState: Node["state"] = snapshot.health ? (stale ? "stale" : snapshot.health.ok ? "ok" : "error") : snapshot.checkedAt ? "error" : "unknown";
    const connectionsState: Node["state"] = snapshot.profiles ? (stale ? "stale" : "ok") : snapshot.checkedAt ? "error" : "unknown";
    return [
      { id: "web", title: "Interface Tesseract", summary: "Aplicação web local", x: 70, y: 155, Icon: Activity, state: "ok", evidence: "Interface carregada nesta sessão do navegador." },
      { id: "api", title: "API local", summary: snapshot.health?.app || "Fastify · /api/health", x: 350, y: 155, Icon: Server, state: apiState, evidence: snapshot.health?.ok ? `Resposta positiva recebida às ${new Date(snapshot.checkedAt!).toLocaleTimeString("pt-BR")}.` : "Sem resposta positiva observada neste carregamento." },
      { id: "registry", title: "Conexões MCP", summary: snapshot.profiles ? `${snapshot.profiles.length} configuração(ões) nesta sessão` : "Estado indisponível", x: 630, y: 80, Icon: Waypoints, state: connectionsState, evidence: snapshot.profiles ? `${snapshot.profiles.filter((p) => p.connected).length} conexão(ões) com cliente ativo nesta sessão; leitura de perfis via GET.` : "A origem não respondeu; estado desconhecido." },
      { id: "orchestration", title: "Fluxos registrados", summary: snapshot.flows ? `${snapshot.flows.length} fluxo(s) nesta sessão` : "Histórico indisponível", x: 630, y: 230, Icon: Waypoints, state: snapshot.flows ? (stale ? "stale" : "ok") : snapshot.checkedAt ? "error" : "unknown", evidence: snapshot.flows ? "Histórico consultado por endpoint GET, limitado à sessão/identidade atual." : "Não foi possível consultar o histórico." },
      { id: "diagnostics", title: "Diagnósticos", summary: snapshot.diagnostics ? `${snapshot.diagnostics.length} evento(s) nesta sessão` : "Dados indisponíveis", x: 910, y: 155, Icon: AlertTriangle, state: snapshot.diagnostics ? (stale ? "stale" : "ok") : snapshot.checkedAt ? "error" : "unknown", evidence: snapshot.diagnostics ? "Eventos de memória da sessão; última atividade: " + (lastDiagnostic ? new Date(lastDiagnostic.time).toLocaleString("pt-BR") : "nenhuma registrada") + "." : "Não foi possível ler os diagnósticos." },
    ];
  }, [snapshot, lastDiagnostic, clock]);
  const activeNode = nodes.find((node) => node.id === selected)!;
  const diagnostics = (snapshot.diagnostics || []).filter((item) =>
    !(/^GET\s/.test(item.operation) && /^2\d\d$/.test(item.status) && item.source === "Aplicação local"),
  );
  const flows = snapshot.flows || [];

  function zoom(factor: number) { setScale((current) => Math.max(0.45, Math.min(1.6, current * factor))); }
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
        <div className="observability-meta"><span>{snapshot.checkedAt ? `${clock - Date.parse(snapshot.checkedAt) > 60000 ? "Desatualizado · " : "Verificado · "}${new Date(snapshot.checkedAt).toLocaleTimeString("pt-BR")}` : "Sem verificação"}</span><button type="button" className="neo-raised obs-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? "Atualizando…" : "Atualizar"}</button></div>
      </div>
      <p className="obs-readonly"><Check size={15} aria-hidden="true" /> Esta tela consulta endpoints existentes com GET. Não executa ferramentas nem altera conexões, rotas ou fluxos.</p>
      {snapshot.errors.length > 0 && <div role="status" className="obs-warning"><CircleHelp size={17} aria-hidden="true" />{snapshot.errors.join(" ")} Os componentes afetados aparecem como não verificados.</div>}
      <div className="obs-layout">
        <div className="obs-map-shell neo-raised">
          <div className="obs-map-tools" aria-label="Controles de mapa"><button type="button" className="neo-raised" aria-label="Aproximar mapa" onClick={() => zoom(1.15)}><Plus size={17} /></button><button type="button" className="neo-raised" aria-label="Afastar mapa" onClick={() => zoom(1 / 1.15)}><Minus size={17} /></button><span aria-live="polite">{Math.round(scale * 100)}%</span></div>
          <div className="obs-map" ref={mapRef} role="region" aria-label="Mapa de componentes. Arraste o fundo para mover; use os botões para zoom." tabIndex={0} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onWheel={(event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.08 : 1 / 1.08); }} onKeyDown={(event) => { const d = event.shiftKey ? 48 : 20; if (event.key === "ArrowLeft") setPan((p) => ({ ...p, x: p.x + d })); if (event.key === "ArrowRight") setPan((p) => ({ ...p, x: p.x - d })); if (event.key === "ArrowUp") setPan((p) => ({ ...p, y: p.y + d })); if (event.key === "ArrowDown") setPan((p) => ({ ...p, y: p.y - d })); if (event.key === "+" || event.key === "=") zoom(1.1); if (event.key === "-") zoom(1 / 1.1); }}>
            <div className="obs-map-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
              <svg className="obs-edges" viewBox="0 0 1100 330" aria-hidden="true"><path d="M230 190 C280 190 300 190 350 190"/><path d="M560 180 C590 160 600 120 630 115"/><path d="M560 200 C590 210 600 230 630 245"/><path d="M840 115 C890 125 870 180 910 190"/><path d="M840 245 C890 235 870 200 910 190"/></svg>
              {nodes.map(({ Icon, ...node }) => <button type="button" key={node.id} className={`obs-node neo-raised is-${node.state}${selected === node.id ? " is-selected" : ""}`} style={{ left: node.x, top: node.y }} onClick={() => setSelected(node.id)} aria-pressed={selected === node.id} aria-label={`${node.title}: ${labelState(node.state)}. ${node.summary}`}><span className="obs-node-icon"><Icon size={19} aria-hidden="true" /></span><span className="obs-node-text"><strong>{node.title}</strong><small>{node.summary}</small></span><span className={`obs-state-dot is-${node.state}`} aria-hidden="true" /></button>)}
            </div>
          </div>
          <div className="obs-legend"><span><i className="is-ok" /> Verificado</span><span><i className="is-unknown" /> Não verificado</span><span><i className="is-stale" /> Desatualizado</span><span><i className="is-error" /> Falha de leitura</span><span className="obs-legend-note">Estados são acompanhados por texto no inspector.</span></div>
        </div>
        <div className="obs-inspector neo-raised" role="region" aria-labelledby="obs-inspector-title"><span className="eyebrow">INSPECTOR</span><h3 id="obs-inspector-title">{activeNode.title}</h3><p>{activeNode.summary}</p><div className="obs-inspector-state"><span className={`obs-state-dot is-${activeNode.state}`} aria-hidden="true" />{labelState(activeNode.state)}</div><dl><div><dt>Origem</dt><dd>{activeNode.id === "web" ? "Navegador atual" : "/api/health · /api/mcp-connections · /api/mcp-orchestrations · /api/diagnostics"}</dd></div><div><dt>Verificado</dt><dd>{snapshot.checkedAt ? new Date(snapshot.checkedAt).toLocaleString("pt-BR") : "Ainda não"}</dd></div></dl><p className="obs-evidence">{activeNode.evidence}</p>
          {selected === "registry" && <div className="obs-inspector-section"><h4>Conexões MCP observadas</h4>{!snapshot.profiles ? <p>Estado desconhecido: a leitura das conexões falhou.</p> : snapshot.profiles.length === 0 ? <p>Nenhuma conexão configurada nesta sessão.</p> : <ul className="obs-flow-list">{snapshot.profiles.slice(0, 6).map((profile) => <li key={profile.id}><strong>{safeText(profile.name)}</strong><span>{profile.connected ? "Cliente ativo nesta sessão" : safeText(profile.status || "Não verificado")} · {safeText(profile.transport || "transporte não informado")}</span></li>)}</ul>}</div>}
          <div className="obs-inspector-section"><h4>Fluxos registrados</h4>{!snapshot.flows ? <p>Estado desconhecido: a leitura do histórico falhou.</p> : flows.length === 0 ? <p>Nenhum fluxo registrado nesta sessão.</p> : <ul className="obs-flow-list">{flows.slice(0, 5).map((flow) => <li key={flow.id}>{flow.collection?.sourceMode === "synthetic" && <small className="obs-synthetic">Fixture sintética</small>}<strong>{safeText(flow.serverA?.tool || "Fluxo MCP")} → {safeText(flow.serverB?.tool || "Destino")}</strong><span>{safeText(flow.state)} · {flow.updatedAt ? new Date(flow.updatedAt).toLocaleString("pt-BR") : "sem data"}</span>{flow.error && <small>{safeText(flow.error)}</small>}</li>)}</ul>}</div>
          <div className="obs-inspector-section"><h4>Diagnósticos recentes</h4>{!snapshot.diagnostics ? <p>Estado desconhecido: a leitura dos diagnósticos falhou.</p> : diagnostics.length === 0 ? <p>Nenhum diagnóstico registrado nesta sessão.</p> : <ul className="obs-diagnostic-list">{diagnostics.slice(-4).reverse().map((item, index) => <li key={`${item.time}-${index}`}><strong>{safeText(item.source)} · {safeText(item.status)}</strong><span>{safeText(item.operation)} — {safeText(item.detail)}</span><time>{new Date(item.time).toLocaleString("pt-BR")}</time></li>)}</ul>}</div>
        </div>
      </div>
    </section>
  );
}
