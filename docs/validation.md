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
