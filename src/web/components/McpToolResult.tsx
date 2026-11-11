import { mcpPresentation } from "../../shared/mcp-presentation.js";

const categories: Record<string, string> = {
  HighAvailability: "Alta disponibilidade",
  Cost: "Custo",
  Performance: "Desempenho",
  Security: "Segurança",
  OperationalExcellence: "Excelência operacional",
};

const impacts: Record<string, string> = {
  High: "Alto",
  Medium: "Médio",
  Low: "Baixo",
};

function localized(labels: Record<string, string>, value?: string) {
  return value && Object.hasOwn(labels, value) ? labels[value] : value;
}

function safeLink(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    return undefined;
  }
}

function sourceLink(value: unknown, label: string) {
  const href = safeLink(value);
  return (
    href && (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    )
  );
}

export function McpToolResult({ result }: { result: any }) {
  const response = result.response?.result;
  const summary = mcpPresentation(response);
  const plain = (Array.isArray(response?.content) ? response.content : [])
    .filter(
      (item: any) =>
        item?.type === "text" &&
        typeof item.text === "string" &&
        !/^\s*(?:\{|\[)/.test(item.text),
    )
    .map((item: any) => item.text)
    .join("\n");
  return (
    <section aria-label="Resultado da tool">
      <h3>Resultado de {result.tool}</h3>
      <p>
        {result.connection} · {result.at} ·{" "}
        {result.response?.durationMs ?? result.durationMs} ms
        {result.response?.requestId && (
          <> · Operação {result.response.requestId}</>
        )}
      </p>
      {response?.partial === true && <p>O retorno técnico foi limitado a 128 kB.</p>}
      {summary?.kind === "advisor" ? (
        <>
          <p>Recomendações recebidas: {summary.count}. Exibindo até cinco.</p>
          {summary.items.map((item, index) => (
            <article className="config-card" key={index}>
              <strong>{item.title ?? "Recurso não informado"}</strong>
              <p>
                Categoria:{" "}
                {localized(categories, item.category) ?? "Não informada"}{" "}
                · Impacto:{" "}
                {localized(impacts, item.impact) ?? "Não informado"}
              </p>
              {item.description && <p>{item.description}</p>}
              {sourceLink(item.link, "Documentação da recomendação ↗")}
            </article>
          ))}
        </>
      ) : summary?.kind === "learn" ? (
        <>
          <p>Exemplos recebidos: {summary.count}. Exibindo até cinco.</p>
          {result.requestedLanguage && (
            <p>Filtro solicitado: {result.requestedLanguage}.</p>
          )}
          {summary.items.map((item, index) => (
            <article className="config-card" key={index}>
              {item.title && <strong>{item.title}</strong>}
              {item.language && <p>Linguagem retornada: {item.language}</p>}
              {item.description && <p>{item.description}</p>}
              {item.code && (
                <details>
                  <summary>Ver trecho de código</summary>
                  <pre>{item.code}</pre>
                </details>
              )}
              {sourceLink(item.link, "Abrir documentação ↗")}
            </article>
          ))}
        </>
      ) : plain ? (
        <p>{plain.slice(0, 600)}</p>
      ) : (
        <p>
          O servidor retornou dados. Abra a resposta técnica para consultar os
          detalhes.
        </p>
      )}
      <details>
        <summary>{response?.partial === true ? "Ver resposta técnica disponível" : "Ver resposta técnica completa"}</summary>
        <pre>{JSON.stringify(result.response, null, 2)}</pre>
      </details>
    </section>
  );
}
