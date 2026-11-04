# Validação do MVP — 01/11/2026

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
