# Teste preliminar do usuário — 06/11/2026

Triagem do relato anexado pelo usuário, anterior à execução do checklist formal. Este registro resume evidências e propostas; não declara que os cenários foram reproduzidos nesta rodada. Identificadores do tenant, aplicativo, assinatura, perfis e recursos foram omitidos. O anexo bruto não foi adicionado ao repositório.

## Evidências relatadas

| Área | Evidência do relato | Conclusão e limite |
|---|---|---|
| Aplicação Entra | Conectar aplicação e Testar Secret concluídos | Credencial foi aceita para obtenção de token; isso não valida todas as permissões financeiras. |
| Inventário | Subscriptions e resource groups responderam 200 | Leitura desses inventários funcionou no escopo observado. |
| MCP Azure local | tools/list retornou pricing_get; tools/call retornou status 200 e preços | Uma chamada real Pricing funcionou. Não comprova consulta de gasto, budgets nem funcionamento do ARM MCP remoto. |
| Agente cadastrado | Formulário exigiu endpoint e agente não foi salvo | A tentativa pretendia usar Copilot; o formulário atual configura outro provedor. Nenhuma inferência por esse agente foi comprovada. |
| Copilot | Catálogo azure_query, duas interações com tools, resposta sem valor inventado | Na pergunta relatada foi exposta a ferramenta de APIs diretas. O MCP pricing_get não é a fonte da consulta de gasto nesse log. |
| Consulta financeira | Microsoft.CostManagement/query retornou 429 | A consulta foi limitada pelo serviço; não retornou custo confiável. O relato não comprova erro de Secret nem de MCP, nem elimina a necessidade de validar autorização em nova consulta. |

O relatório também mostra dois eventos para a mesma operação final (falha HTTP e código do provedor). Não se deve contar cada linha do diagnóstico como uma chamada HTTP distinta. O cliente atual permite até três tentativas HTTP por operação; duas interações do modelo podem gerar múltiplas tentativas reais.

## Prioridades propostas, ainda não implementadas

| ID | Prioridade | Problema / ação proposta | Aceite sugerido |
|---|---|---|---|
| PRE-01 | Alta | Tratar 429 com cabeçalhos de espera específicos do Cost Management, além de Retry-After; impedir repetição imediata da mesma consulta pelo modelo durante a espera. | Fixture com cabeçalhos de rate limit, cancelamento e isolamento por identidade/escopo; mensagem com tempo de nova tentativa; depois uma leitura real controlada. |
| PRE-02 | Alta | Esclarecer Copilot local versus agente com endpoint de inferência. | Usuário consegue escolher Copilot sem preencher endpoint Azure; formulário de agente explica o que precisa e não usa endpoint de exemplo como configuração real. |
| PRE-03 | Alta | Mostrar a fonte efetiva da pergunta, e não só a conexão cadastrada na página. | Evidência identifica APIs/Hub/MCP, provedor, tool e escopo realmente usados; ausência de tool de custos é explícita. Investigar a seleção no momento da requisição relatada. |
| PRE-04 | Média | Diagnóstico compacto com pesquisa, status, período e correlação por pergunta/operação/tentativa. | 200 da rota de chat não se confunde com sucesso financeiro; eventos duplicados semanticamente continuam distinguíveis. |
| PRE-05 | Média | Campos MCP indicam obrigatório/opcional, default declarado no schema e valor omitido; exemplos em português. | Não inventar SKU/região padrão; listas só quando suportadas por enum/catálogo comprovado. |
| PRE-06 | Média | Exibir transporte/processo MCP e provedor de inferência em linguagem clara. | Local stdio, remoto HTTP e modelo remoto aparecem como dimensões distintas. |
| PRE-07 | Média | Busca de RG; ajustar exemplo de subscription para genuv. | Busca por nome/trecho, preservação da seleção e aviso se RG estiver ausente. |
| PRE-08 | Média | Progresso do chat por fases e métricas de consumo quando disponíveis. | Mostrar início da tool, consulta, espera por limite e conclusão, sem cadeia de raciocínio nem credenciais. Tokens reais, estimativas e cobrança efetiva aparecem separados. |
| PRE-09 | Média | Revisar autorização de envio de contexto ao provedor. | Qualquer preferência persistida é explícita, revogável e compatível com política corporativa; não substituir silenciosamente autorização por um aceite genérico. |

## Esclarecimentos às dúvidas

### MCP local ou hospedado?

O preset azure/stdio inicia o pacote oficial `@azure/mcp@3.0.0` no notebook através de npm exec; o pacote pode ser baixado e reutilizado do cache npm. O processo MCP é local, mas consulta serviços Azure pela rede. Isso é diferente do ARM MCP remoto em `https://mcp.management.azure.com`. A conexão observada era local/stdio.

### Defaults e listas de SKU/região

O formulário lê inputSchema e preenche defaults declarados. Se o servidor não publica default/enum, o cliente não conhece automaticamente uma escolha válida nem um catálogo completo. A UX precisa explicar essa distinção. A resposta relatada veio em USD, mas isso sozinho não estabelece um default universal. Filter é um filtro avançado opcional: pode permanecer omitido quando os outros filtros necessários já foram fornecidos; não é preciso inventar uma expressão. A resposta Pricing incluiu modalidades Windows/Linux/Spot/Low Priority; comparações precisam identificar a modalidade, sem tratar todas como equivalentes.

### Por que o agente exige Azure OpenAI/Foundry?

O cadastro atual só aceita o provedor `azure-chat-v1`, endpoint e deployment/modelo explícitos. A execução do agente ocorre no serviço local, mas a inferência usa o endpoint configurado; ele não é um perfil do GitHub Copilot CLI e não descobre deployments automaticamente. Para usar o Copilot instalado/autenticado, selecione Copilot local no chat; não é necessário salvar esse agente. Suportar perfis personalizados executados pelo Copilot seria uma evolução própria, não uma configuração já disponível.

As seleções de tools gravam os identificadores locais correspondentes; a seção avançada permite nomes explícitos. Isso não preenche endpoint, modelo, credencial ou permissões Azure. Não há requisito de obter uma chave impessoal apenas para usar a opção Copilot local.

### Conta corporativa Copilot e execução local

Copilot local significa integração com o CLI no notebook, não inferência garantidamente offline. Uso corporativo depende da conta e da política da organização. A documentação atual recomenda OAuth interativo e informa que PAT com Copilot Requests é vinculado a conta pessoal, não uma credencial de organização genérica. Não se deve confundir essa autenticação GitHub com Client Secret Entra ou chave Azure OpenAI. BYOK/offline existentes no CLI não são opções configuradas por este formulário atual e não foram validados nesta aplicação.

### Diagnóstico, progresso e consentimento

Diagnóstico é o histórico operacional seguro desta sessão, em memória; não é um arquivo persistente de auditoria. O consentimento atual autoriza enviar contexto ao provedor do modelo, algo diferente de autenticar o acesso Azure. Uma tela de termos/aceite persistido pode ser desenhada, mas não está implementada e não prova autorização corporativa para qualquer envio de dados. O progresso pode expor fases de execução, sem exibir raciocínio interno do modelo.

### Tokens e custo por pergunta

O log mostra Copilot como provedor e duas interações com tools; ele não contém tokens, créditos ou preço final. A aplicação ainda não registra essas métricas. Uma pergunta pode gerar várias inferências e várias chamadas Azure; 429 é limitação operacional, não medida de cobrança. Uma evolução deve separar duração, chamadas/tentativas, uso retornado pelo provedor, estimativa com tarifa/versionamento e cobrança efetiva. Se o provedor não informar uso/preço, apresentar indisponível em vez de inventar custo zero.

## Análise de 429 no código

`src/server/azure/http.ts` trata 429/503 com até três tentativas. Lê somente Retry-After; quando ausente, espera 1s e 2s. A documentação oficial também prevê cabeçalhos como `x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after` e a referência Query cita `x-ms-ratelimit-microsoft.consumption-retry-after`. A correção deve respeitar os limites aplicáveis retornados e não reiniciar a mesma operação imediatamente pelo modelo. O anexo não contém esses cabeçalhos: a dimensão da quota e a espera exata permanecem desconhecidas; não é possível atribuir a origem do primeiro 429 à política de retry.

Fontes: [automação Cost Management](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/manage-automation), [Query API e 429](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage?view=rest-cost-management-2023-03-01), [autenticação Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli).

## Próxima rodada

Publicar a identidade aprovada e o checklist separadamente do futuro trabalho funcional. Priorizar PRE-01/PRE-02/PRE-03, então executar os casos financeiros reais do [checklist](checklist-testes.md). O teste preliminar não aprova os 76 casos nem substitui conciliação com o portal. Nesta publicação não foram alteradas credenciais, permissões, configuração de agentes ou política de retry.


## Implementação posterior autorizada — 06/11/2026

As correções de comportamento/clareza PRE-01 a PRE-09 foram tratadas na versão seguinte: cabeçalhos/cooldown de 429, bloqueio de fonte ambígua, fases/uso informado do chat, log pesquisável, busca RG, ajuda de defaults MCP, execução local/remota explícita e consentimento revogável por sessão/provedor. O [roteiro de apresentação](apresentacao-tesseract.md) descreve os resultados e limites. Não foram adicionados catálogo dinâmico de SKUs, inferência offline, persona Copilot cadastrável, cobrança monetária, EULA corporativa ou servidor multiusuário. A triagem acima preserva o estado observado no teste original; não equivale a reexecução financeira real.
