import { useEffect, useRef, useState } from "react";
import type { CloudResult, CloudQuery } from "../../shared/multicloud.js";
import { cloudQuerySchema } from "../../shared/multicloud.js";
import { consolidateCloudResults } from "../../shared/multicloud-summary.js";
import type { Scope, DateRange } from "../../shared/contracts.js";
import { api, manageRequest } from "../api.js";
import { CloudResults, providerNames } from "../components/CloudResults.js";
export function Multicloud({
  scope,
  period,
  onAzure,
}: {
  scope?: Scope;
  period: DateRange;
  onAzure: () => void;
}) {
  const [from, setFrom] = useState(period.from),
    [to, setTo] = useState(period.toExclusive);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({}),
    [profile, setProfile] = useState("default"),
    [account, setAccount] = useState("");
  const [project, setProject] = useState(""),
    [table, setTable] = useState(""),
    [location, setLocation] = useState("US"),
    [bytes, setBytes] = useState("1000000000"),
    [confirmed, setConfirmed] = useState(false);
  const [endpoint, setEndpoint] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [privateNetwork, setPrivateNetwork] = useState(false),
    [secretRef, setSecretRef] = useState("");
  const [results, setResults] = useState<CloudResult[]>([]),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [attempted, setAttempted] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setFrom(period.from);
    setTo(period.toExclusive);
  }, [period.from, period.toExclusive]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    setResults([]);
    setErrors({});
    setBusy(false);
    setAttempted(0);
  }, [scope]);
  const toggle = (p: string) => setEnabled((v) => ({ ...v, [p]: !v[p] }));
  async function load() {
    const selected = Object.keys(enabled).filter((p) => enabled[p]);
    if (!selected.length) return;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setResults([]);
    setErrors({});
    setAttempted(selected.length);
    await Promise.all(
      selected.map(async (provider) => {
        try {
          let result: CloudResult;
          if (provider === "azure") {
            if (!scope) throw new Error("Selecione o escopo Azure em Custos.");
            const r = await api.queryCosts(
              {
                scope,
                period: { ...period, from, toExclusive: to },
                basis: "ActualCost",
                groupBy: "ServiceName",
                granularity: "Daily",
              },
              c.signal,
            );
            if (r.meta.status !== "complete")
              throw new Error(
                "Azure retornou cobertura incompleta. Consulte Custos Azure e o diagnóstico antes de consolidar.",
              );
            result = {
              provider: "azure",
              scope: `${scope.subscriptionId}${scope.resourceGroup ? " / " + scope.resourceGroup : ""}`,
              from,
              toExclusive: to,
              basis: r.basis,
              layer: "billing",
              rows: r.rows.map((x) => ({ ...x, service: x.dimension })),
              totals: r.totals,
              raw: r,
              warnings: [
                ...r.meta.warnings,
                "Azure: período conforme Cost Management e filtros existentes. Bases AWS/GCP diferem; não somadas automaticamente.",
              ],
              queriedAt: r.meta.fetchedAt,
            };
          } else {
            const input =
              provider === "aws"
                ? {
                    provider,
                    from,
                    toExclusive: to,
                    profile,
                    ...(account ? { accountId: account } : {}),
                  }
                : provider === "gcp"
                  ? {
                      provider,
                      from,
                      toExclusive: to,
                      projectId: project,
                      table,
                      location,
                      maximumBytesBilled: Number(bytes),
                      confirmQueryCost: confirmed,
                    }
                  : {
                      provider,
                      from,
                      toExclusive: to,
                      endpoint,
                      currency,
                      allowPrivateNetwork: privateNetwork,
                      ...(secretRef ? { secretRef } : {}),
                    };
            const parsed = cloudQuerySchema.safeParse(input);
            if (!parsed.success)
              throw new Error(
                parsed.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; "),
              );
            result = await manageRequest<CloudResult>(
              "/multicloud/query",
              "POST",
              parsed.data as CloudQuery,
              c.signal,
            );
          }
          if (!c.signal.aborted) setResults((r) => [...r, result]);
        } catch (e) {
          if (!c.signal.aborted)
            setErrors((v) => ({ ...v, [provider]: (e as Error).message }));
        }
      }),
    );
    if (!c.signal.aborted) setBusy(false);
  }
  return (
    <div className="multicloud-page">
      <div className="section-head">
        <div>
          <span className="eyebrow">EXPLORAR / MULTICLOUD</span>
          <h2>Uma visão. Cada fonte verificável.</h2>
          <p>
            Consulte provedores em paralelo. Custos e alocações mantêm sua
            origem, moeda e base.
          </p>
        </div>
        <span className="badge">APIs de leitura</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <fieldset disabled={busy}>
          <legend>1. Escolha período e fontes</legend>
          <div className="cloud-dates">
            <label>
              Início multicloud
              <input
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Fim exclusivo multicloud
              <input
                type="date"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <p>
              GCP e OpenCost usam UTC. AWS usa datas do Cost Explorer. Azure
              preserva a interpretação do Cost Management.
            </p>
          </div>
          <div className="provider-grid">
            <section className="provider-card">
              <label className="consent">
                <input
                  type="checkbox"
                  checked={!!enabled.azure}
                  onChange={() => toggle("azure")}
                  disabled={!scope}
                />
                Consultar Azure
              </label>
              <p>Cost Management · custo real</p>
              <small>
                {scope
                  ? `${scope.subscriptionId} / ${scope.resourceGroup || "Toda subscription"}`
                  : "Defina um acesso e escopo na tela Custos."}
              </small>
              <button type="button" onClick={onAzure}>
                Configurar escopo Azure
              </button>
            </section>
            <section className="provider-card">
              <label className="consent">
                <input
                  type="checkbox"
                  checked={!!enabled.aws}
                  onChange={() => toggle("aws")}
                />
                Consultar AWS
              </label>
              <p>Cost Explorer · UnblendedCost</p>
              {enabled.aws && (
                <>
                  <label>
                    Perfil AWS
                    <input
                      required
                      value={profile}
                      onChange={(e) => setProfile(e.target.value)}
                    />
                  </label>
                  <label>
                    Conta AWS (opcional)
                    <input
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      placeholder="12 dígitos"
                    />
                  </label>
                  <small>
                    Perfil local/SSO já autenticado. Requer ce:GetCostAndUsage.
                    A API pode gerar cobrança.
                  </small>
                </>
              )}
            </section>
            <section className="provider-card">
              <label className="consent">
                <input
                  type="checkbox"
                  checked={!!enabled.gcp}
                  onChange={() => toggle("gcp")}
                />
                Consultar GCP
              </label>
              <p>Cloud Billing · exportação BigQuery</p>
              {enabled.gcp && (
                <>
                  <label>
                    Projeto BigQuery
                    <input
                      required
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                    />
                  </label>
                  <label>
                    Tabela Cloud Billing
                    <input
                      required
                      value={table}
                      onChange={(e) => setTable(e.target.value)}
                      placeholder="projeto.dataset.tabela"
                    />
                  </label>
                  <label>
                    Localização BigQuery
                    <input
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </label>
                  <label>
                    Limite de bytes faturados
                    <input
                      type="number"
                      min="1"
                      max="10000000000"
                      required
                      value={bytes}
                      onChange={(e) => setBytes(e.target.value)}
                    />
                  </label>
                  <label className="consent">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Autorizo a consulta BigQuery
                  </label>
                  <small>
                    Usa ADC local. Consultas podem gerar cobrança até o limite
                    informado; inclui créditos da exportação.
                  </small>
                </>
              )}
            </section>
            <section className="provider-card">
              <label className="consent">
                <input
                  type="checkbox"
                  checked={!!enabled.kubernetes}
                  onChange={() => toggle("kubernetes")}
                />
                Consultar Kubernetes / OpenShift
              </label>
              <p>OpenCost · alocação por namespace</p>
              {enabled.kubernetes && (
                <>
                  <label>
                    Endpoint OpenCost
                    <input
                      type="url"
                      required
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="http://localhost:9003"
                    />
                  </label>
                  <label>
                    Moeda configurada no OpenCost
                    <input
                      required
                      maxLength={3}
                      value={currency}
                      onChange={(e) =>
                        setCurrency(e.target.value.toUpperCase())
                      }
                    />
                  </label>
                  <label className="consent">
                    <input
                      type="checkbox"
                      checked={privateNetwork}
                      onChange={(e) => setPrivateNetwork(e.target.checked)}
                    />
                    Autorizar rede privada / loopback deste endpoint
                  </label>
                  <label>
                    Referência do token no cofre (opcional)
                    <input
                      value={secretRef}
                      onChange={(e) => setSecretRef(e.target.value)}
                      placeholder="Referência existente; nunca o token"
                    />
                  </label>
                  <small>
                    Requer OpenCost compatível no cluster. A alocação pode usar
                    preços de lista; não equivale à fatura Azure/AWS/GCP.
                  </small>
                </>
              )}
            </section>
          </div>
        </fieldset>
        <div className="actions">
          <button
            className="primary"
            disabled={busy || !Object.values(enabled).some(Boolean)}
          >
            {busy ? "Consultando fontes…" : "Consultar fontes selecionadas"}
          </button>
          {busy && (
            <button
              type="button"
              onClick={() => {
                controller.current?.abort();
                setBusy(false);
              }}
            >
              Cancelar consultas
            </button>
          )}
        </div>
      </form>
      <section className="coverage-panel" aria-live="polite">
        <strong>
          {attempted
            ? `${results.length} de ${attempted} fontes consultadas com sucesso`
            : "Nenhuma consulta executada"}
        </strong>
        <p>
          {busy
            ? "Consultas em andamento. Resultados chegam por fonte."
            : "Ausência de dados não é custo zero. Moedas, bases e alocações são mostradas separadamente para evitar dupla contagem."}
        </p>
        {Object.entries(errors).map(([provider, message]) => (
          <div className="error" role="alert" key={provider}>
            <strong>
              {providerNames[provider as keyof typeof providerNames]}
            </strong>
            <p>{message}</p>
            <small>
              Ajuste esta fonte e execute novamente. As outras consultas
              concluídas permanecem visíveis.
            </small>
          </div>
        ))}
      </section>
      {results.length > 0 && (
        <section className="cloud-summary" aria-label="Resumo por base e moeda">
          <h3>Resumo por base e moeda</h3>
          <p>
            Grupos com o mesmo período, moeda, camada e base. Não há total geral
            entre bases diferentes.
          </p>
          <div className="summary-grid">
            {consolidateCloudResults(results).map((g) => (
              <article
                key={[g.basis, g.currency, g.layer, g.from, g.toExclusive].join(
                  "|",
                )}
              >
                <span className="badge">
                  {g.layer === "allocation"
                    ? "Alocação separada"
                    : "Custo do provedor"}
                </span>
                <h4>
                  {g.currency} {g.amount}
                </h4>
                <p>{g.basis}</p>
                <small>
                  {g.from} → {g.toExclusive}
                </small>
              </article>
            ))}
          </div>
        </section>
      )}
      {results.map((r) => (
        <CloudResults key={r.provider} result={r} />
      ))}
    </div>
  );
}
