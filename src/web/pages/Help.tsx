export function Help() {
  return (
    <>
      <h2>Ajuda Tesseract</h2>
      <p>
        Configure em Conexões. Verifique capacidades e teste leituras em Análise
        MCP ou APIs. Explore dados com período, moeda, base e origem explícitos.
      </p>
      {[
        [
          "MCP",
          "Protocolo que anuncia capacidades. Tools executam operações; prompts são templates; resources são conteúdos. Listar capacidades não comprova permissão sobre dados.",
        ],
        [
          "API e identidade",
          "API é o canal de consulta. Service Principal com Secret é uma identidade e pode consultar APIs com as permissões corretas. A compatibilidade MCP depende do servidor, transporte e autenticação.",
        ],
        [
          "Custos, previsão e budgets",
          "Custo real é realizado; amortizado distribui compromissos. Forecast é previsão. Budget é acompanhamento de limite e alerta, não bloqueio automático de consumo.",
        ],
        [
          "Tags",
          "Tags de governança são metadados, não bloqueios. Tags atuais de inventário podem diferir das tags históricas presentes na cobrança. Não presuma herança de tags do RG ou subscription.",
        ],
        [
          "Diagnóstico",
          "Correlacione tentativas pelo ID. HTTP bem-sucedido não garante sucesso operacional. Logs e JSON podem conter informações financeiras mesmo após remoção de credenciais.",
        ],
      ].map(([title, text]) => (
        <section className="help-topic" key={title}>
          <h3>{title}</h3>
          <p>{text}</p>
        </section>
      ))}
      <h3>Referências oficiais</h3>
      <ul>
        {[
          ["Azure", "https://learn.microsoft.com/azure/"],
          ["AWS", "https://docs.aws.amazon.com/"],
          ["Google Cloud", "https://cloud.google.com/docs"],
          [
            "OpenShift",
            "https://docs.redhat.com/en/products/openshift_container_platform",
          ],
          ["OpenCost", "https://opencost.io/docs/"],
          ["FinOps Foundation", "https://www.finops.org/"],
        ].map(([name, url]) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {name}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
