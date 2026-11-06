# TESSERACT — roteiro rápido para apresentação

Versão 0.2.0, de 06/11/2026. Workspace local para cadastro de acessos, conexões MCP Microsoft, agentes com modelo configurado e consultas FinOps. Serviço e cofre executam no notebook; consultas e inferência podem acessar provedores remotos. Não há hospedagem corporativa multiusuário nesta entrega.

## Antes da apresentação

1. Inicie o serviço na pasta do projeto: `pwsh -File .\scripts\start.ps1` (não iniciar duas instâncias). Para reiniciar: `pwsh -File .\scripts\stop.ps1`, depois start. Abra http://localhost:4317 e atualize com Ctrl+F5.
2. Em Acessos, conecte o perfil autorizado. Token obtido não comprova permissão de todos os dados. O reinício preserva cadastros; sessões podem exigir reconexão.
3. Escolha uma subscription e RG conhecidos; a busca aceita trechos e preserva o item selecionado.
4. Confira qual provedor será usado. Copilot local precisa do CLI autenticado/política corporativa. Agente cadastrado usa um deployment Azure OpenAI/Foundry existente, endpoint real e credencial de inferência própria.

## Demonstração sugerida (8–10 minutos)

| Etapa | Mostrar | Resultado esperado |
|---|---|---|
| 1. Workspace | Identidade TESSERACT, Acessos, MCPs e Agentes | Distinguir serviço local, identidade Azure e provedor de IA. |
| 2. MCP | Conexão já configurada, transporte e tools descobertas/aprovadas | stdio = processo local com acesso à rede; HTTP = servidor remoto. Descoberta não comprova todas as permissões. |
| 3. Consulta de preço | pricing_get com SKU/região conhecidos | Formulário explica opcionais/defaults; retorno de varejo não é gasto real. |
| 4. Custos | Fonte APIs Azure, escopo conhecido e período fechado | Valor real quando a fonte responder. 429 mostra espera; não repetir cliques durante cooldown. |
| 5. Chat | Copilot local, autorização de contexto e pergunta no escopo escolhido | Contexto efetivo, fases, evidência e uso informado pelo provedor. Tokens ausentes não são zero. |
| 6. Diagnóstico | Filtrar por 429/status, pesquisar ID da pergunta, selecionar datas | Explicar diferença entre HTTP da rota e resultado financeiro; mostrar tentativas e correlação. |
| 7. Agentes | Alternar Copilot sem endpoint / agente com modelo Azure | Mostrar instruções, acessos e tools autorizados; não cadastrar endpoint de exemplo como se fosse real. |

Perguntas: “Quanto gastei neste resource group nos dois últimos meses completos?”, “Quais budgets existem neste escopo?”, “Qual a previsão deste mês?”. Use a fonte que realmente oferece essa capacidade. MCP somente com pricing_get não atende consulta de gastos. Forecast/benefícios/Hub dependem de disponibilidade e permissões específicas.

## Correções desta versão

- 429: maior espera válida em Retry-After e cabeçalhos Cost Management/Consumption; fallback conservador de 30s se ausentes/inválidos; cooldown isolado por sessão/identidade/versão/escopo. Esperas acima de 5s voltam ao usuário sem prender a pergunta; retentativas curtas continuam limitadas a três HTTPs. Uma resposta concorrente não encurta/apaga espera futura.
- Fonte: seleção MCP sem acesso/conexão válida é bloqueada, sem cair silenciosamente em APIs; divergência entre acesso selecionado e sessão é recusada. Metadados da fonte e tools são apresentados pelo serviço, independentes da narrativa do modelo.
- Chat: fases operacionais, tempo, interações de tools e tokens fornecidos por Copilot SDK/Azure Chat Completions. Podem ser parciais; não há medição de cobrança monetária. Não se expõe raciocínio interno, credenciais ou argumentos sensíveis no log.
- Autorização: opt-in por provedor, lembrança opcional somente na sessão de navegador e revogação. Revogar cancela a pergunta ativa; dados já enviados não podem ser recolhidos. Isso não substitui política corporativa nem cria contrato/EULA.
- Diagnóstico: tabela compacta com pesquisa, status e datas, ID de operação e tentativa. Continua em memória, sem auditoria persistente/exportação.
- Cadastro: opção clara de usar Copilot sem endpoint; modelo remoto explícito no agente; identificadores de tools preenchidos pelas seleções. Campos MCP mostram defaults publicados/omissão e ajuda em português; não foi inventado catálogo dinâmico de SKUs/regiões.

## Limites que devem permanecer claros

A aplicação não remove quotas Azure, não certifica conciliação de fatura e não inventa resultados para a demonstração. MCPs suportados continuam sendo os presets/políticas existentes; não foi adicionado executor arbitrário de comandos ou MCP genérico. Agentes deste cadastro usam modelos Azure compatíveis; perfis personalizados executados pelo Copilot e inferência local/offline não foram adicionados. Termos corporativos, hospedagem multiusuário, RBAC por membro e faturamento detalhado por pergunta permanecem evoluções distintas.

Se Azure retornar 429, mostre diagnóstico/tempo de espera e siga com cadastro e catálogo já disponível; não trate a limitação como sucesso financeiro. Testes automatizados usam fixtures; aceite de conta/dados reais continua com o [checklist](checklist-testes.md).

Validação técnica desta entrega: 73 testes de serviço, 17 testes Edge, typecheck e build passaram; inspeção visual em 1440/1024/390 px sem overflow horizontal de página nas telas verificadas. Dois achados da revisão final (cooldown concorrente e revogação ativa) foram corrigidos com regressões. Dados de inspeção são fixtures; nova consulta financeira real permanece pendente.
