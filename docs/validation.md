# Validação do MVP — 01/11/2026

## Tesseract 0.4.0 — 09/11/2026

- `npm test`: **98 testes de serviço em 41 arquivos passaram**. Inclui filtro histórico por tag, catálogo MCP, recusa de resource não listado, cancelamento/revogação e sanitização de Bearer, CSP por hash e normalização CRLF do parser HTML.
- `npx playwright test`: **25 testes Edge passaram**. Inclui temas persistentes, breadcrumbs, popup Microsoft no shell Next, pixel readback de arestas 4D visíveis, navegação/abertura acessível, isolamento de Análise MCP, catálogo ligado ao executor, preenchimento pricing_get, filtros por tag sem consulta a cada tecla e regressões existentes.
- Build Next.js estático e compilação do serviço concluídos; verificação TypeScript passou. `npm audit --omit=dev`: zero vulnerabilidades. Auditoria completa mantém uma ocorrência baixa em dependência de desenvolvimento.
- Revisão independente encontrou e levou a correções de contexto MCP, consulta repetida por tag, cancelamento de leituras, servidor sem tools, limpeza de insight e retirada de comandos de desenvolvimento sem proxy implementado.
- Inspeção visual atual no navegador integrado: abertura 4D funcionando, temas escuro/claro, laboratório separado de configuração e layout estreito de 390 px. Capturas locais em `.superpowers/ux-v04`, fora do Git por política de preservação de contexto local.
- Bloqueio CSP da animação foi corrigido calculando hash após normalização CRLF→LF, sem liberar inline JS genericamente. O script da CDN só é permitido no frame isolado. Regressão de renderização confirma pixels visíveis.
- Inicialização por PowerShell agora aguarda health em IPv4 antes de abrir o navegador; evita atraso de fallback IPv6 de localhost. SDKs AWS/GCP carregados somente quando usados. Testes usam concorrência limitada para não sobrecarregar o notebook.
- Metadados existentes e cofre Windows preservados. Nenhuma migração destrutiva, compra ou modificação de infraestrutura executada. O original `D:\DEV\FinOps\Assets\tesseract-4d.html` foi mantido.
- **Pendências de aceite:** consultas financeiras reais, rede corporativa, permissões de provedores e avaliação visual do time. Descoberta de AWS/GCP não significa autenticação MCP universal; templates dinâmicos de resources e cruzamento genérico entre fontes não são alegados como disponíveis.

[Novo checklist humano 0.4.0](checklist-v0.4.0.md) · [Operação e limites](command-center-v0.4.md).

## Tesseract 0.3.0 — 09/11/2026

- 88 testes de serviço em 36 arquivos passaram (`npm test`). Incluem paginação AWS, erro AWS incompleto, créditos/contrato BigQuery, limite faturado/localização, cancelamento de job, sanitização de token refletido, precisão decimal, proteção CSRF e seleção MCP em tags.
- 19 testes Edge passaram (`npx playwright test`). Incluem visão multicloud com falha parcial, gráfico/tabela/JSON, preservação do formulário ao configurar Azure, resumo por base/camada, ausência de overflow de página em 390 px e descarte de tags do RG anterior.
- `npm run typecheck`, `npm run build` e revisão independente final sem problema material remanescente. Inspeção visual no navegador integrado em desktop e 390 px, com capturas locais em `.superpowers/ux`.
- `npm audit --omit=dev`: zero vulnerabilidades. Auditoria completa ainda informa uma vulnerabilidade baixa no conjunto de desenvolvimento. Build mantém aviso de bundle frontend maior que 500 kB; não houve erro de compilação.
- Credenciais, arquivo de configuração e cofre existentes preservados. Nenhuma compra, mudança de infraestrutura ou consulta financeira real executada nesta rodada.
- **Pendente de validação humana e ambiente:** login/autorização real AWS e ADC, exportação GCP, compatibilidade OpenCost/OpenShift, rede corporativa, conciliação financeira e aceite visual do time. A tarefa Linear permanece em andamento para este aceite.

Guia: [multicloud-guide.md](multicloud-guide.md). Desenho aprovado: [especificação](superpowers/specs/2026-11-09-multicloud-experience-design.md). Auditoria UX: [registro](ux-audit-2026-11-09.md).

## Confirmado nesta execução

- Node.js 24.20.0, npm 11.19.0, Copilot CLI 1.0.106-2 e SDK 1.0.28.
- 19 testes de serviço passando em sete arquivos: datas civis, ano/bissexto, decimais, moedas, comparação parcial, paginação externa, Retry-After, isolamento/invalidação de cache, estados PKCE, CSRF, cookies, encerramento de sessão e cancelamento upstream, budgets, recomendações modernas/legacy e escopo do chat.
- Quatro testes no Microsoft Edge passando: configuração sem senha/dados fictícios; moedas/budgets/chat com respostas de teste; erro 403 distinto de custo zero; resposta atrasada descartada após trocar RG.
- TypeScript sem erros e build de produção concluído. Aviso não bloqueante: pacote de interface aproximadamente 630 kB (191 kB gzip), principalmente gráficos; carregamento sob demanda pode ser evolução posterior.
- Auditoria npm das dependências de produção: zero vulnerabilidades após fixar zod 4.6.7, glob 14.0.2 e minimatch 11.0.1 via overrides. Não foi aplicado downgrade automático do SDK/servidor.
- Inspeção visual da tela inicial em 1440 px: sem sobreposição ou rolagem horizontal. Screenshot de configuração sem dados financeiros em diretório de visualizações do Codex.
- SDK conectado ao Copilot CLI instalado: autenticação existente confirmada como verdadeira; catálogo efetivo, após initializeAndValidate, contém somente `azure_query`. Sessão de verificação excluída; nenhum token/login foi impresso e nenhum custo Azure foi enviado nesse teste. Não foi feita chamada de inferência para esta verificação.
- Scripts PowerShell de início/parada passaram pelo parser sem erros.
- Revisão independente identificou seis problemas materiais; corrigidos com testes de regressão: moedas em objetos Reservations modernos, identificação de produto, comparação com período parcial, ciclo do budget, intenção de consulta RG e cancelamento de requisição upstream.

## Ainda não validado com a conta Azure

- Registro Entra do usuário, redirect URI, consentimento, login real e MFA.
- Acesso efetivo aos custos de subscription/RG e disponibilidade de benefícios por contrato.
- Conciliação entre API, dashboard, resposta do chat e portal com os mesmos filtros, períodos e moeda.
- Resposta de inferência do Copilot sobre dados Azure reais; a verificação de autenticação/catálogo não substitui este aceite.
- Cobertura/utilização de contratos existentes por APIs de billing e simulação horária própria não estão disponíveis nesta entrega. A interface declara essas limitações; mostra recomendações oficiais e atribuição amortizada quando autorizadas.

O usuário informou que possui os identificadores, mas ainda não os forneceu/configurou. A tela permite informá-los localmente sem compartilhar senha ou Client Secret. Testes financeiros usam dados sintéticos somente nos testes; não demonstram aceitação dos dados reais.

## Decisões de implementação

- Branch nova em pasta inicialmente sem código; sem worktree adicional e sem publicação externa.
- Cookie SameSite=Lax para permitir retorno OAuth por navegação; requisições de alteração/consulta POST exigem CSRF e origem local.
- Dados de benefícios existentes usam custos amortizados atribuídos ao escopo; não inventário global de pedidos de billing.
- Testes de navegador usam Edge instalado, evitando instalação de navegador adicional.
- Metadados de autoria Codex somente no comando de commit local, sem modificar identidade Git global do usuário.
- O registro operacional da execução fica preservado na documentação; aceite de integração permanece pendente, sem declaração de conclusão total.

## Correção de diagnóstico de login

O callback atingiu a aplicação, mas uma falha de acquireTokenByCode era ocultada pelo tratamento genérico de erros. Adicionado mapeamento seguro de códigos Microsoft/MSAL para mensagens úteis, sem retornar o payload bruto, authorization code, token ou URL. Em falha, o callback redireciona para o dashboard e apresenta a mensagem da sessão. A causa do login real anterior não pode ser recuperada retroativamente: requer nova tentativa; não houve replay de código recebido no chat.

Validação após correção: 22 testes de serviço, cinco testes Edge, typecheck e build passaram. Serviço reiniciado preservando somente Tenant ID e Client ID em memória/ambiente do processo. O novo teste de navegador demonstrou primeiro a ausência do aviso e depois a mensagem no dashboard. Login real continua pendente.

## Login em janela separada

Solicitação do usuário implementada: abrir popup durante o clique, antes das chamadas assíncronas; manter dashboard aberto; acompanhar sessão compartilhada por polling limitado a dez minutos; concluir em /auth/complete, removendo a query OAuth do endereço atual, e tentar fechar a janela. Polling permite concluir mesmo se a Microsoft separar o opener por política de navegador. Pop-up bloqueado mostra orientação, sem redirecionar a aba principal.

Diagnóstico ampliado para identificadores MSAL/Node seguros fora da lista anterior, incluindo causas de rede/certificado. A origem da falha real anterior permanece desconhecida; esta alteração não comprova login Azure bem-sucedido. Nenhuma URL/código de autorização recebido no chat foi reutilizado. Teste de popup usa respostas de autenticação simuladas; não credenciais reais.

## Causa confirmada de nonce_mismatch

A implementação enviava nonce em getAuthCodeUrl, mas omitia o mesmo nonce em acquireTokenByCode. O MSAL Node 7.1.2 instalado valida presença e correspondência ao processar o ID token; seu código local mostrou a rejeição quando o token contém nonce mas nenhum valor esperado foi fornecido. Corrigido passando o nonce original armazenado no fluxo para acquireTokenByCode. Preservadas validações de nonce, state, PKCE e tenant.

Teste de regressão reproduziu nonce_mismatch antes da correção e passou depois. Outro teste garante rejeição de nonce diferente, sem autenticar sessão. Após a correção: 25 testes passaram, typecheck e build passaram, serviço reiniciado. A confirmação de login real requer nova tentativa do usuário; nenhum código anterior foi reproduzido.


## Ampliação de 03/11/2026

Veja [conexões e agentes](connections-validation.md) para o estado atual: 42 testes de serviço e oito testes Edge; identidades salvas, Secrets DPAPI, MCPs e agente local. Os registros acima descrevem a versão anterior. O roteiro de instalação/migração está em [migration-windows.md](migration-windows.md). Publicação privada no GitHub autorizada pelo usuário em 03/11/2026; integração com contas reais continua pendente.


## Analista FinOps e Hub — 03/11/2026

Implementação descrita no [guia](finops-hub-guide.md): perfil rastreável, fonte Hub por API/MCP, comparação informativa bidirecional e evidência independente no chat. 57 testes do serviço e dez testes Edge passaram; typecheck/build e auditoria npm de produção passaram (zero vulnerabilidades reportadas). Inspeção da tela Hub em 1440 px sem rolagem horizontal. Serviço reiniciado com identificadores preservados; GET /api/hubs respondeu 200. Quatro achados da revisão independente foram corrigidos com regressões. Consultas reais ADX, exportações, conciliação financeira certificada e inferência com dados reais continuam pendentes.


## Usabilidade MCP e diagnóstico — 04/11/2026

Formulário gerado do schema, lista/quantidade de tools, aprovação separada de permissão Azure, execução com retorno visível, busca de subscriptions por nome/ID e diagnóstico por sessão. 59 testes de serviço (26 arquivos) e 13 testes Edge passaram; typecheck/build passaram. A inspeção visual verificou formulário hierárquico e resultado de pricing_get sintético. Endpoint de diagnóstico validado em execução local (HTTP 200 e evento de rota). Em teste de carga paralela, o teste Windows DPAPI de acessos excedeu 5s; orçamento desse arquivo ajustado para 15s, compatível com o teste de storage existente. Sem alteração de lógica DPAPI. O histórico real anterior não foi reconstruído; conta Azure e consultas reais não foram reexecutadas nesta mudança. Veja [guia](mcp-usability-diagnostics.md).

## Forecast e ARM MCP — 04/11/2026

67 testes de serviço em 29 arquivos e 14 testes Edge passaram; typecheck e build passaram. O build mantém aviso de tamanho do bundle, sem falha de compilação. Uma revisão independente final não encontrou achados materiais. O teste de navegador usa respostas simuladas: confirma apresentação separada de Actual/Forecast e configuração do preset ARM, sem comprovar valores financeiros ou login Azure.

Testes de serviço cobrem totais por moeda/estado, fim exclusivo, ausência de dados sem zero, rejeição de status desconhecido, paginação externa, escopo ARM, audience/permissão e transporte HTTP com initialize/list/call. Corrigida a classificação de rede que tratava IPv4 públicos como privados: a faixa IPv6 mapeada agora é checada separadamente; regressão mantém bloqueio de IPs privados, metadata e IPv4 mapeado em IPv6.

Teste público real sem credenciais confirmou metadados ARM HTTP 200 e initialize anônimo HTTP 401. Não foi realizada consulta financeira autenticada. Serviço local reiniciado preservando os identificadores públicos configurados; /api/health respondeu 200 com ok=true. O usuário informou autorização Entra e foi orientado a concluir o popup e testar descoberta/leitura. Consulte [operação e limites](forecast-arm-operation.md).


## Identidade TESSERACT — 06/11/2026

Nome provisório, símbolo azul, tokens da paleta fornecida, navegação azul/amarelo, gráficos e KPIs azuis, economia potencial verde e estados de budget com rótulos. Dashboard e conclusão de login compartilham a marca; título/favicon atualizados. 14 testes Edge passaram após correções; typecheck/build e diff-check passaram. Inspeção com fixtures em 1440, 1024 e 390 px sem overflow horizontal de página nas dez abas. Revisão independente apontou contraste em textos pequenos, corrigido com texto azul escuro e branco opaco na sidebar; barra de ações Hub ajustada para quebra de linha. Health local ok=true. Não houve consulta Azure real nesta alteração visual; aceite visual do usuário permanece aberto. Veja [identidade](tesseract-identity.md).


## Publicação da UX e teste preliminar — 06/11/2026

Nova conferência: 67 testes de serviço, 14 testes Edge, typecheck, build e diff-check passaram. Usuário autorizou publicar a identidade TESSERACT. Incluídos checklist e triagem sanitizada do relato preliminar; anexo bruto e identificadores do ambiente não foram incorporados. O relato comprova obtenção de token, leitura de inventário e pricing_get, mas a consulta de custos teve HTTP 429. Limitação de chamadas, clareza de provedor e diagnóstico são prioridades documentadas, ainda sem correção funcional nesta publicação.


## Correções para apresentação — versão 0.2.0, 06/11/2026

73 testes de serviço em 32 arquivos e 17 testes Edge passaram; typecheck/build e diff-check passaram. Testes novos cobrem cabeçalhos de throttling, repetição bloqueada, isolamento por acesso/escopo, cancelamento, concorrência preservando maior cooldown, bloqueio de seleção MCP ambígua, filtros RG/log, uso informado e revogação ativa. Revisão final independente encontrou concorrência no cooldown e cancelamento na revogação; ambos corrigidos com regressões. Inspeção das telas de MCPs/Agentes/Diagnóstico/Chat em 1440, 1024 e 390 px sem overflow horizontal de página. Uso Copilot é lido do evento assistant.usage do SDK instalado; Azure Chat Completions do campo usage validado. Tokens informados podem ser parciais e não são preço final. Sem nova consulta Azure real: a aplicação não remove quotas nem comprova obtenção do gasto após 429. Roteiro operacional em [apresentação](apresentacao-tesseract.md).


## Workspace MCP e conhecimento — versão 0.5.0, 10/11/2026

- `npm test`: 106 testes de serviço aprovados (46 arquivos). Inclui protocolo MCP HTTP real contra servidor local controlado, sem identidade Azure; aprovação/schema/annotations, credencial vinculada ao endpoint e ocultação do Bearer em tools, prompts, resources e resultados.
- `npm run typecheck` e `npm run build`: aprovados.
- `npm run test:e2e`: 30 testes Edge aprovados. Novos percursos: início por integrações, cadastro independente, edição com token protegido, investigação sem ação Copilot inadequada, conteúdo Markdown inerte e navegação em desktop/mobile.
- Revisão independente: dois achados funcionais/credenciais e dois achados de UX corrigidos. Testes reproduziram as falhas antes das correções. A revisão não acessou configurações .vscode do usuário.
- Conferência visual: capturas 1440×900 e 390×844; ausência de rolagem horizontal verificada. Ajuste de altura do cabeçalho mobile. Não equivale a aceite humano.
- Testes financeiros, importação GitHub e inferência usam fixtures/mocks quando indicado. Não comprovam acesso corporativo Azure/OpenShift, inferência real, conciliação de custos reais nem aprovação de rede.
- Configurações existentes preservadas. Aprovações antigas precisam de revisão porque o hash considera também annotations. Nenhuma movimentação/exclusão de arquivos do usuário.

Aceite operacional pendente: `docs/checklist-v0.5.0.md`. GitHub privado, OAuth genérico, topologia e auditoria diária não estão incluídos; ver `docs/workspace-v0.5.md`.


## Clareza MCP e descoberta — versão 0.5.1, 10/11/2026

- Causa da exclusão reproduzida em localhost: DELETE sem corpo com Content-Type JSON resultava em 500; sem esse header, 200. Cadastro temporário usado no diagnóstico removido, sem excluir conexões do usuário. Falha de criação relatada não reproduzida; validação agora indica campos e correlação.
- 113 testes de serviço (50 arquivos), typecheck e build aprovados. 32 testes Edge aprovados na rodada final, incluindo separação Integração/Análise, identidade, DELETE sem JSON vazio, catálogo não consultado e consumo de rascunho.
- Uma rodada detectou intermitência no teste preexistente de Escape no popup de boas-vindas. Repetição isolada 3/3 e nova suíte integral 32/32 passaram; Welcome não foi alterado. Manter monitoramento desse teste.
- Consulta real ao novo endpoint local de descoberta retornou HTTP 200 e com.microsoft/azure do MCP Registry. Conferência em Edge com resultado real visível, sem rolagem horizontal a 1440 px. Este teste valida o catálogo, não autenticação Azure ou execução das tools do servidor publicado.
- Revisão independente: identidade delegada indevidamente pronta, instrução de sucesso antiga, rascunho persistente e afirmação prematura de descoberta corrigidos. .vscode do usuário preservado.

Operação e aceite manual: `docs/mcp-clarity-v0.5.1.md`.


## Workspace e análise MCP — versão 0.5.2, 10/11/2026

- 114 testes de serviço e 32 testes Edge aprovados; build concluído. Foram verificados diagrama e navegação responsivos, estado MCP isolado por sessão, retorno Advisor truncado com prévia e seleção individual de resultados do Registry.
- Integração e Análise mantêm feedback ao lado da ação; respostas técnicas e detalhes de protocolo recolhidos. Resumos usam fixtures, sem reutilizar identificadores Azure do relato. As regras de aprovação foram preservadas.
- Busca real no Registry por com.microsoft/arm, azure-resource-manager e mcp.management.azure.com não retornou registros. Atalho ARM tem origem documentada separada, sem instalar ou autorizar uma conexão. Política Copilot não alterada.
- Aceite manual em Azure corporativo continua pendente. Ver docs/arm-mcp-copilot-policy.md.
