import { useEffect, useRef, useState } from "react";
import type { CostQuery } from "../../shared/contracts.js";
import { api } from "../api.js";
import { DiagnosticPanel } from "./Diagnostics.js";
export function ApiLab({ query }: { query?: CostQuery }) {
  const [op, setOp] = useState("costs"),
    [result, setResult] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setResult(undefined);
    setError("");
    setBusy(false);
    return () => controller.current?.abort();
  }, [query, op]);
  return (
    <>
      <h2>APIs — capacidades e testes</h2>
      <p>
        Azure aceita usuário ou aplicação com Secret, conforme RBAC e permissões
        de billing. AWS usa perfil local; GCP usa ADC; OpenCost usa endpoint
        autorizado. O canal desta página é API, explicitamente.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Operações implementadas</th>
              <th>Autenticação / requisito</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Azure</td>
              <td>Custos, forecast, budgets, tags, benefícios</td>
              <td>Usuário ou Service Principal + RBAC/billing</td>
            </tr>
            <tr>
              <td>AWS</td>
              <td>GetCostAndUsage</td>
              <td>
                Perfil/SSO; teste em Visão multicloud; pode gerar cobrança
              </td>
            </tr>
            <tr>
              <td>GCP</td>
              <td>Consulta exportação Cloud Billing</td>
              <td>
                ADC + BigQuery; teste em Visão multicloud com limite de bytes e
                consentimento de cobrança
              </td>
            </tr>
            <tr>
              <td>Kubernetes/OpenShift</td>
              <td>OpenCost allocation</td>
              <td>OpenCost implantado; teste em Visão multicloud</td>
            </tr>
          </tbody>
        </table>
      </div>
      <label>
        Operação Azure
        <select value={op} onChange={(e) => setOp(e.target.value)}>
          <option value="costs">Custos</option>
          <option value="budgets">Budgets</option>
          <option value="tags">Tags atuais ARM</option>
        </select>
      </label>
      <button
        disabled={!query || busy}
        onClick={async () => {
          if (!query) return;
          controller.current?.abort();
          const c = new AbortController();
          controller.current = c;
          setBusy(true);
          setError("");
          setResult(undefined);
          try {
            const data =
              op === "costs"
                ? await api.queryCosts(query, c.signal)
                : op === "tags"
                  ? await api.getBudgetLocks(query.scope, true, c.signal)
                  : await api.getBudgets(query.scope, c.signal);
            if (!c.signal.aborted) setResult(data);
          } catch (e) {
            if (!c.signal.aborted) setError((e as Error).message);
          } finally {
            if (!c.signal.aborted) setBusy(false);
          }
        }}
      >
        Testar leitura API no escopo selecionado
      </button>
      {!query && (
        <p>
          Conecte uma identidade e escolha subscription/RG antes do teste Azure.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      <details>
        <summary>Logs da operação</summary>
        <DiagnosticPanel />
      </details>
    </>
  );
}
