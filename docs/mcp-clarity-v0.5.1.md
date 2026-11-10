# MCPs — clareza e descoberta, versão 0.5.1

## O que mudou

- Integração mostra provider, transporte, execução, endpoint, autenticação, pacote e grupo de tools antes de salvar e no cadastro salvo. stdio usa stdin/stdout e **não possui endpoint HTTP**. A autenticação OAuth Client Credentials refere-se ao acesso da identidade de aplicação ao Azure, não a uma URL localhost do MCP.
- Identidade Azure é o cadastro selecionado em Acessos. Seu nome aparece junto ao MCP e há uma ação para conectar essa identidade. Usuário e aplicação são estados diferentes; MCP delegado exige usuário. Autorizar recurso MCP continua disponível para consentir o audience correto.
- Conectar e listar tools permanece em Integração. O passo seguinte é **Analisar tools**, uma ação explícita. Análise não oferece edição ou exclusão, não herda mensagens de Integração e não afirma descoberta antes de consultar o catálogo.
- Descoberta consulta online o [MCP Registry](https://registry.modelcontextprotocol.io/docs), com busca, paginação, versão, pacotes e endpoints declarados. Consulta real de `com.microsoft/azure` retornou HTTP 200 nesta máquina. O registro não certifica segurança nem comprova que uma publicação é um produto oficial de determinado fornecedor.
- Preparar cadastro preenche um rascunho e exige revisão. Não instala, executa nem autentica servidores. O executor Azure continua fixado à versão suportada no Tesseract, mesmo quando a versão do catálogo for diferente. Pacotes stdio arbitrários e OAuth genérico não foram habilitados.

## Falha de exclusão

A interface enviava `Content-Type: application/json` em DELETE sem corpo. O parser rejeitava JSON vazio e o tratamento genérico respondia 500. Foi reproduzido com uma conexão temporária: criação HTTP 200; exclusão com header JSON vazio HTTP 500; exclusão sem esse header HTTP 200. A conexão temporária foi removida e os cadastros anteriores foram preservados.

Pedidos sem corpo agora não declaram conteúdo JSON. Requisições JSON vazias recebem erro 400 específico com correlação. Erros de validação indicam campos; os demais erros conhecidos incluem o ID da operação. **A falha de criação relatada não foi reproduzida** em cópia isolada nem no teste controlado em localhost, portanto não se presume uma causa igual à exclusão. A nova mensagem/correlação permite identificar uma recorrência.

## Teste manual prioritário

- [ ] Em Integração, conferir `stdio_azure_advisor`: transporte stdio, execução local, sem endpoint HTTP, provider Azure, grupo advisor e nome da identidade.
- [ ] Conectar a identidade pelo botão do próprio MCP; depois Conectar e listar tools. Conferir mensagem e permanecer em Integração.
- [ ] Abrir Analisar tools; consultar o catálogo, aprovar e executar uma leitura.
- [ ] Confirmar que falhas de uma tela não reaparecem na outra e que Análise não mostra edição/exclusão.
- [ ] Criar uma conexão de teste e excluí-la; se houver nova falha de criação, registrar somente mensagem e correlação.
- [ ] Em Descoberta, buscar `com.microsoft/azure`, conferir resultados e preparar cadastro; sair e voltar não deve restaurar o rascunho consumido.
- [ ] Em rede corporativa, conferir acesso ao domínio registry.modelcontextprotocol.io. Se bloqueado, usar fonte personalizada autorizada; não desativar validação TLS ou proteções de endpoints.

Consultas Azure reais e permissões do usuário continuam dependendo de validação no ambiente de destino.
