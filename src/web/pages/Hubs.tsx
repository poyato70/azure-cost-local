import { useEffect, useState, useRef } from "react";
import type { Scope, CostQuery } from "../../shared/contracts.js";
import type { HubProfile } from "../../shared/hubs.js";
import { manageRequest } from "../api.js";
const fresh = {
  name: "",
  accessId: "",
  transport: "api",
  endpoint: "",
  database: "Hub",
  schemaVersion: "v1_2",
  mcpConnectionId: "",
};
export function Hubs({
  accesses,
  mcps,
  scope,
  basis,
  onSelect,
  selected,
  onLogin,
}: {
  accesses: any[];
  mcps: any[];
  scope?: Scope;
  basis: CostQuery["basis"];
  onSelect: (id: string) => void;
  selected: string;
  onLogin: (id: string) => void;
}) {
  const requestRef = useRef<AbortController | null>(null);
  const [profiles, setProfiles] = useState<HubProfile[]>([]),
    [form, setForm] = useState<any>(fresh),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<any>(),
    [busy, setBusy] = useState(false);
  const load = () =>
    manageRequest("/hubs")
      .then((r) => setProfiles(Array.isArray(r) ? r : []))
      .catch((e) => setMessage(e.message));
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    requestRef.current?.abort();
    setResult(undefined);
    return () => {
      requestRef.current?.abort();
    };
  }, [scope, basis, selected]);
  const field = (k: string, v: string) =>
    setForm((f: any) => ({ ...f, [k]: v }));
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function query(operation: string) {
    if (!scope?.resourceGroup) {
      setMessage("Selecione subscription e resource group nos filtros.");
      return;
    }
    requestRef.current?.abort();
    const c = new AbortController();
    requestRef.current = c;
    setResult(undefined);
    setBusy(true);
    setMessage("");
    try {
      const r = await manageRequest(
        "/hubs/" + selected + "/query",
        "POST",
        { scope, basis, operation },
        c.signal,
      );
      if (!c.signal.aborted) setResult(r);
    } catch (e) {
      if (!c.signal.aborted) setMessage((e as Error).message);
    } finally {
      if (requestRef.current === c) setBusy(false);
    }
  }
  const cost = result?.hub || result?.arm || result;
  return (
    <>
      <h2>FinOps hub</h2>
      <p>
        Consulta por RG nos dois meses civis completos anteriores. Os filtros de
        datas gerais não alteram essa janela. Custos tradicionais e budgets
        continuam em Cost Management.
      </p>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <div className="settings-layout">
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { configurationVersion, ...f } = form;
              const r = await manageRequest(
                "/hubs" + (form.id ? "/" + form.id : ""),
                form.id ? "PATCH" : "POST",
                {
                  ...f,
                  mcpConnectionId:
                    form.transport === "mcp" ? form.mcpConnectionId : undefined,
                  expectedVersion: configurationVersion,
                },
              );
              await load();
              onSelect(r.id);
              setForm(fresh);
              setResult(undefined);
              setMessage(
                "Hub salvo. Acesso e dados serão verificados na consulta.",
              );
            });
          }}
        >
          <h3>{form.id ? "Editar Hub" : "Cadastrar Hub"}</h3>
          <label>
            Nome do Hub
            <input
              required
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label>
            Acesso do Hub
            <select
              aria-label="Acesso do Hub"
              required
              value={form.accessId}
              onChange={(e) => field("accessId", e.target.value)}
            >
              <option value="">Selecione</option>
              {accesses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Endpoint ADX
            <input
              type="url"
              required
              value={form.endpoint}
              placeholder="https://cluster.region.kusto.windows.net"
              onChange={(e) => field("endpoint", e.target.value)}
            />
          </label>
          <label>
            Transporte do Hub
            <select
              aria-label="Transporte do Hub"
              value={form.transport}
              onChange={(e) => field("transport", e.target.value)}
            >
              <option value="api">API Kusto</option>
              <option value="mcp">MCP ADX aprovado</option>
            </select>
          </label>
          {form.transport === "mcp" && (
            <label>
              MCP vinculado
              <select
                aria-label="MCP vinculado"
                required
                value={form.mcpConnectionId}
                onChange={(e) => field("mcpConnectionId", e.target.value)}
              >
                <option value="">Selecione</option>
                {mcps
                  .filter(
                    (m) => m.preset === "adx" && m.accessId === form.accessId,
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <small>
            Banco Hub · schema FOCUS v1_2. Requer Database Viewer e permissão no
            escopo Azure. Não implanta recursos. No modo usuário, consentimento
            ADX deve estar autorizado no Entra.
          </small>
          <button disabled={busy}>Salvar Hub</button>
          {form.id && (
            <button type="button" onClick={() => setForm(fresh)}>
              Cancelar edição
            </button>
          )}
        </form>
        <div>
          <label>
            Hub selecionado para consulta e chat
            <select
              aria-label="Hub selecionado"
              value={selected}
              onChange={(e) => {
                onSelect(e.target.value);
                setResult(undefined);
              }}
            >
              <option value="">Nenhum — chat usa fonte padrão</option>
              {profiles.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} · {h.transport}
                </option>
              ))}
            </select>
          </label>
          {profiles.map((h) => (
            <article key={h.id} className="settings-card">
              <strong>{h.name}</strong>
              <p>
                {h.endpoint} · {h.transport} · Hub / {h.schemaVersion}
              </p>
              <button onClick={() => onLogin(h.id)}>
                Autorizar ADX (usuário)
              </button>
              <button onClick={() => setForm(h)}>Editar</button>
              <button
                onClick={() =>
                  void run(async () => {
                    await manageRequest("/hubs/" + h.id, "DELETE");
                    await load();
                    if (selected === h.id) onSelect("");
                    setResult(undefined);
                  })
                }
              >
                Excluir
              </button>
            </article>
          ))}
          <div className="toolbar">
            <button
              disabled={!selected || busy}
              onClick={() => void query("costs")}
            >
              Consultar dois meses
            </button>
            <button
              disabled={!selected || busy}
              onClick={() => void query("reconcile")}
            >
              Conciliar com Cost Management
            </button>
            <button
              disabled={!selected || busy}
              onClick={() => void query("reservations")}
            >
              Reservations no Hub
            </button>
            <button
              disabled={!selected || busy}
              onClick={() => void query("savingsPlans")}
            >
              Savings Plans no Hub
            </button>
          </div>
          <p>
            Os benefícios disponíveis são exibidos por dataset; ausência não é
            zero. Recomendações são projeções. Consulta Hub selecionada também
            estará disponível no Chat.
          </p>
        </div>
      </div>
      {cost?.meta && (
        <section>
          <h3>{result?.arm && !result?.hub ? "Custos do Cost Management — Hub indisponível" : "Custos do Hub"}</h3>
          <p>
            {cost.meta.source} · {cost.meta.period.from} até{" "}
            {cost.meta.period.toExclusive} (exclusivo) · {cost.focusBasis}
          </p>
          {cost.meta.warnings.map((w: string) => (
            <p key={w} className="notice">
              {w}
            </p>
          ))}
          {!cost.rows.length && (
            <p>
              Sem linhas. Cobertura não comprovada; custo zero não pode ser
              afirmado.
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Moeda</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {cost.rows.map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.currency}</td>
                  <td>{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {result?.comparison && (
        <section>
          <h3>Conciliação informativa</h3>
          <p>{result.comparison.message}</p>
          {result.comparison.reasons?.map((x: string) => (
            <p key={x}>{x}</p>
          ))}
          {result.comparison.rows && (
            <table>
              <thead>
                <tr>
                  <th>Moeda</th>
                  <th>Hub</th>
                  <th>Cost Management</th>
                  <th>Diferença</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {result.comparison.rows.map((r: any) => (
                  <tr key={r.currency}>
                    <td>{r.currency}</td>
                    <td>{r.hub ?? "Indisponível"}</td>
                    <td>{r.costManagement ?? "Indisponível"}</td>
                    <td>{r.difference ?? "—"}</td>
                    <td>{r.percent ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {result?.datasets && (
        <section>
          <h3>Benefícios no Hub</h3>
          {result.warnings.map((w: string) => (
            <p key={w}>{w}</p>
          ))}
          {result.datasets.map((d: any) => (
            <article key={d.dataset}>
              <h4>
                {d.dataset} · {d.status}
              </h4>
              <p>{d.reason || d.warning}</p>
              {d.rows && (
                <pre
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {JSON.stringify(d.rows, null, 2)}
                </pre>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
