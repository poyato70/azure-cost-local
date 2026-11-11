import { CloudDefaults } from "../components/CloudDefaults.js";
import { RegistrySearch } from "../components/RegistrySearch.js";
import { useState } from "react";
import { manageRequest } from "../api.js";
export function Discovery({
  onConfigure,
  onNavigate,
}: {
  onConfigure?: (draft: any) => void;
  onNavigate?: (tab: string) => void;
}) {
  const [url, setUrl] = useState(
      localStorage.getItem("tesseract-discovery-url") || "",
    ),
    [trust, setTrust] = useState(false),
    [result, setResult] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <h2>Descoberta de servidores MCP</h2>
      <CloudDefaults onConfigure={onConfigure} onNavigate={onNavigate} />
      <RegistrySearch onConfigure={onConfigure} />
      <article className="config-card">
        <h3>Azure Resource Manager MCP</h3>
        <p>
          Referência oficial Microsoft, separada dos resultados do Registry. Use
          o preset ARM para consultas de custos com login de usuário.
        </p>
        <p>
          Endpoint MCP: <code>https://mcp.management.azure.com</code>. Use-o em
          Integração; o endereço não é um manifesto nem uma URL-base de Registry
          documentada.
        </p>
        <div className="actions">
          <button
            className="primary"
            onClick={() =>
              onConfigure?.({
                name: "Azure Resource Manager MCP",
                preset: "arm",
                transport: "http",
                endpoint: "https://mcp.management.azure.com",
                authMode: "delegated",
                resourceContext: { scope: "" },
              })
            }
          >
            Preparar cadastro ARM
          </button>
          <a
            href="https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/CostManagementAndPricingTools.md"
            target="_blank"
            rel="noreferrer"
          >
            Configuração oficial ↗
          </a>
        </div>
      </article>
      <details>
        <summary>Referências e documentação dos providers</summary>
        <div className="provider-grid">
          {[
            ["Microsoft", "https://github.com/microsoft/mcp"],
            ["AWS", "https://awslabs.github.io/mcp/servers"],
            ["Google Cloud", "https://docs.cloud.google.com/mcp/overview"],
          ].map(([name, link]) => (
            <article className="provider-card" key={name}>
              <h3>{name}</h3>
              <a href={link} target="_blank" rel="noreferrer">
                Abrir catálogo oficial
              </a>
              <p>
                Confira transporte, endpoint e autenticação na documentação.
                Cadastre os presets compatíveis em Integração. Outros provedores
                podem exigir adaptador específico; a descoberta não instala
                pacotes.
              </p>
            </article>
          ))}
        </div>

        <h3>Servidores do catálogo curado</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fornecedor / servidor</th>
                <th>Transporte / uso</th>
                <th>Referência oficial</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Microsoft · Azure MCP",
                  "Local stdio ou HTTP implantado; pricing/inventário/serviços Azure",
                  "https://github.com/microsoft/mcp",
                ],
                [
                  "Microsoft · ARM MCP",
                  "HTTP remoto; autenticação delegada conforme preset",
                  "https://github.com/Azure/Azure-Resource-Manager-MCP",
                ],
                [
                  "Microsoft · Fabric / Power BI",
                  "HTTP ou stdio conforme preset; análise de dados",
                  "https://learn.microsoft.com/power-bi/developer/mcp/remote-mcp-server-get-started",
                ],
                [
                  "AWS · Billing and Cost Management",
                  "Confira transporte e autenticação AWS na origem; não herda Secret Entra",
                  "https://awslabs.github.io/mcp/servers",
                ],
                [
                  "AWS · Pricing",
                  "Estimativas de catálogo; não equivale ao gasto real",
                  "https://awslabs.github.io/mcp/servers",
                ],
                [
                  "Google Cloud · BigQuery",
                  "HTTP remoto; https://bigquery.googleapis.com/mcp; requer autenticação Google",
                  "https://docs.cloud.google.com/mcp/supported-products",
                ],
                [
                  "Google Cloud · Cloud Billing (Preview)",
                  "HTTP remoto; https://cloudbilling.googleapis.com/mcp; confira capacidades atuais",
                  "https://docs.cloud.google.com/mcp/supported-products",
                ],
              ].map(([name, description, url]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{description}</td>
                  <td>
                    <a href={url} target="_blank" rel="noreferrer">
                      Documentação
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <h3>Consultar manifesto personalizado</h3>
      <p>
        Adicione uma URL HTTPS de manifesto JSON. Formato:{" "}
        <code>
          {
            '{"servers":[{"name":"Nome","url":"https://origem/endpoint","description":"Descrição"}]}'
          }
        </code>
        . Não há navegação recursiva nem execução de comandos. Páginas HTML
        podem ser usadas como referência pelo navegador, mas não são manifestos.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setResult(undefined);
          try {
            const r = await manageRequest("/mcp-discovery", "POST", {
              url,
              trusted: trust,
            });
            setResult(r);
            localStorage.setItem("tesseract-discovery-url", url);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          URL do manifesto
          <input
            type="url"
            required
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setTrust(false);
            }}
          />
        </label>
        <label className="consent">
          <input
            type="checkbox"
            required
            checked={trust}
            onChange={(e) => setTrust(e.target.checked)}
          />
          Declaro que confio nesta origem e assumo o risco de avaliar seu
          conteúdo. Isso não desativa as proteções do Tesseract.
        </label>
        <button disabled={!trust || busy}>Descobrir manifesto</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <p>
            Fonte consultada: {result.source}. Nenhuma credencial enviada;
            nenhum servidor instalado ou executado.
          </p>
          {result.servers.map((s: any, i: number) => (
            <article className="config-card" key={i}>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <code>{s.url}</code>
              <p>
                Copie o endpoint para uma integração compatível e teste
                explicitamente. Não é prova de confiança ou autorização.
              </p>
            </article>
          ))}
        </>
      )}
    </>
  );
}
