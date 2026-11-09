# TESSERACT 0.4.0 — checklist de validação

Data: 09/11/2026. Todos os itens abaixo são de aceite humano; não estão aprovados antecipadamente. Testes automatizados com fixtures não comprovam dados financeiros reais.

## Registro

Responsável: __________ Notebook/Windows: __________ Commit: __________
Conta/escopo (sem segredo): __________ Data/hora: __________
Para cada falha, registrar ID abaixo, passos, mensagem, correlação e evidência sem credenciais.

## Instalação e continuidade
- [ ] INS-01: `npm ci`, `npm run build`, `npm start`; abrir localhost:4317 e confirmar interface 0.4.0.
- [ ] INS-02: confirmar acessos, MCPs, agentes e Hubs existentes preservados; segredos não aparecem em formulários de leitura.
- [ ] INS-03: encerrar/iniciar com scripts PowerShell; `-SkipBuild` só depois de build concluído. Health deve responder ok=true.
- [ ] INS-04: novo notebook: recadastrar/reautenticar credenciais protegidas pelo Windows; não presumir portabilidade DPAPI.

## Interface e acessibilidade
- [ ] UX-01: abertura mostra popup 4D, créditos e OK; Escape fecha e foco retorna ao aplicativo.
- [ ] UX-02: tesseract possui 16 vértices/32 arestas, cubos concêntricos conectados e deformação por rotação XW/YW/ZW; não apenas giro 3D.
- [ ] UX-03: arrastar orbita câmera; roda do mouse altera zoom; redimensionamento não distorce a visualização.
- [ ] UX-04: com CDN bloqueada, mensagem no frame informa indisponibilidade; fechar o popup permite usar a aplicação.
- [ ] UX-05: movimento reduzido do sistema desativa animações decorativas/rotação contínua; ocultar/fechar frame não mantém animação visível.
- [ ] UX-06: opção de não mostrar abertura persiste; Sobre e créditos reabre a experiência.
- [ ] UX-07: tema escuro é padrão; Claro/Escuro alterna e persiste; conferir contraste nos formulários, gráficos, chat e logs nos dois temas.
- [ ] UX-08: árvore separa grupos, páginas e MCP > Integração/Análise/Descoberta; seleção sem brilho/borda luminosa.
- [ ] UX-09: breadcrumbs indicam tarefa real; botão Tesseract volta a Custos.
- [ ] UX-10: teclado alcança ações, submenus, tabs e dialog; foco é visível e dialog contém foco enquanto aberto.
- [ ] UX-11: revisar 1440, 1024 e 390 px: sem rolagem horizontal da página; menu mobile abre/recolhe e conteúdo permanece legível.
- [ ] UX-12: métricas de cadastros conferem com listas reais; conexão/autorização não são inferidas só da existência do cadastro.
- [ ] UX-13: insights não aparecem inventados; após resposta do chat, resumo mostra origem/correlação; mudança de contexto ou logout limpa resumo.

## Identidade e compatibilidade
- [ ] AUTH-01: login delegado em popup, retorno /auth/complete funcional, senha/MFA somente no provedor.
- [ ] AUTH-02: aplicação com Secret conecta sem login interativo quando permitido; obter token não comprova permissão de billing.
- [ ] AUTH-03: escolher MCP em Forecast/Budgets/Compromissos exibe limitação antes da consulta e bloqueia ação incompatível; identidade e filtros preservados.
- [ ] AUTH-04: botão explícito escolhe API; nenhuma troca silenciosa de fonte ou identidade.
- [ ] AUTH-05: revogar acesso/alterar configuração durante leitura cancela operação e não publica resposta antiga.

## MCP — Integração e Análise
- [ ] MCP-01: criar/configurar/testar/salvar e editar integração Microsoft; transporte/endpoints não confundem documentação GitHub com endpoint.
- [ ] MCP-02: analisar servidor mostra nome/versão, capacidades anunciadas, tools, prompts e resources, com ID de operação.
- [ ] MCP-03: testar servidor só de prompts/resources; ausência de tools não impede análise das outras capacidades.
- [ ] MCP-04: estados não anunciado, vazio, descoberto, parcial e erro são distinguíveis; catálogo não comprova permissão de dados.
- [ ] MCP-05: conferir paginação e limites; retorno parcial não deve ser apresentado como lista completa.
- [ ] MCP-06: pricing_get vazio usa BRL, Standard_D4s_v5, Virtual Machines, Compute e Consumption apenas nos campos existentes; valor explícito e região preservados.
- [ ] MCP-07: tools aninhadas apresentam schema; JSON avançado e formulário produzem argumentos equivalentes; tool exige aprovação por schema antes de executar.
- [ ] MCP-08: prompt listado pode ser obtido com argumentos; template retornado não é executado como instrução automaticamente.
- [ ] MCP-09: resource listado pode ser lido; URI não listada é recusada; limite de resposta não permite travar a interface.
- [ ] MCP-10: trocar conexão limpa catálogo/tools/resultado antigo; catálogo B nunca executa tool A silenciosamente.
- [ ] MCP-11: durante leitura, trocar contexto/sair da tela/revogar acesso impede resposta tardia de aparecer no novo contexto.
- [ ] MCP-12: consultar logs e correlacionar com operação; tokens, Bearer, senha e segredos não devem aparecer.

## MCP — Descoberta
- [ ] DSC-01: catálogo lista Microsoft, AWS e Google Cloud com referências oficiais e data; ler finalidade/transporte/autenticação antes de integrar.
- [ ] DSC-02: manifesto HTTPS personalizado exige declaração de confiança; mudar URL exige nova confirmação.
- [ ] DSC-03: manifesto válido segue formato documentado e lista até 50 servidores; página HTML retorna aviso de formato, sem fingir descoberta.
- [ ] DSC-04: rede privada não autorizada, metadados, credencial na URL, redirecionamento ou origem insegura são recusados.
- [ ] DSC-05: descoberta não instala/roda comandos nem envia credenciais; servidor listado não se torna integração aprovada automaticamente.
- [ ] DSC-06: conferir os limites de autenticação/adaptador por fornecedor. Catálogos AWS/GCP não significam autenticação universal implementada no registry Microsoft.

## Agentes, APIs e chat
- [ ] AGT-01: Cadastro e Avaliação são acessíveis; avaliação mostra runtime, tools configuradas, acessos, MCPs e limites, sem formulário de edição dominante.
- [ ] AGT-02: health do agente HTTP não é descrito como inferência ou prova financeira; contrato remoto não presume filtros locais enviados.
- [ ] AGT-03: teste de modelo avisa consumo antes da ação; retorno aparece junto ao cartão e logs; tokens financeiros não são estimados sem tarifa.
- [ ] API-01: catálogo de APIs identifica operações implementadas e autenticação; teste Azure respeita escopo e fonte API explicitamente selecionados.
- [ ] API-02: erro 403/429/timeout é falha e não custo zero; mudança de escopo/operação descarta leitura anterior.
- [ ] CHT-01: Copilot local e agente cadastrado consultam apenas tools autorizadas, com consentimento opcional/revogável por sessão/provedor.
- [ ] CHT-02: confirmar fonte, fases, correlação, retorno de tool, tokens reais quando informados e ausência de estimativa financeira inventada.
- [ ] CHT-03: após resposta, histórico/evidências continuam no chat; resumo no hero não cancela nem limpa a conversa ativa.

## Custos Azure e por tag
- [ ] CST-01: conciliar custo real/amortizado com Cost Management, mesmo escopo, período, moeda e base; nenhuma soma entre moedas.
- [ ] CST-02: gráficos e tabela conferem; JSON normalizado fica disponível para inspeção; nomes/valores financeiros ainda são confidenciais.
- [ ] TAG-01: chave/valor filtra tags registradas na cobrança; conferir body da operação e resultado no portal equivalente.
- [ ] TAG-02: custo por ResourceId no RG/subscription selecionado não inclui recursos de outro escopo; período e base continuam explícitos.
- [ ] TAG-03: editar rascunho depois da consulta não dispara novas chamadas até aplicar novo filtro/consultar.
- [ ] TAG-04: tags atuais, tags históricas e tags de RG/subscription não são tratadas como equivalentes nem herdadas automaticamente.
- [ ] TAG-05: ausência de tag/ResourceId ou histórico atrasado não comprova ausência de gasto; registrar cobertura e limitações.
- [ ] TAG-06: consulta direta por tag não afirma ter executado cruzamento entre inventário/MCP/APIs; esse caminho não deve ser apresentado como concluído.

## Forecast, budgets, benefícios e multicloud
- [ ] FIN-01: Forecast é separado do realizado; período futuro/limites e indisponibilidade são explícitos.
- [ ] FIN-02: budgets conferem com Consumption API e seus filtros; sem orçamento não significa consumo zero.
- [ ] FIN-03: Tags de governança são metadados ARM, não locks nem bloqueio de gastos; Mostrar todas inclui demais chaves.
- [ ] FIN-04: troca de RG durante leitura de budgets/tags descarta resposta anterior.
- [ ] FIN-05: Reservations/Savings Plans identificam recomendação oficial versus cenário e não compram compromissos.
- [ ] MCL-01: AWS perfil/SSO, GCP ADC/exportação e OpenCost autorizado retornam valores conciliáveis nas respectivas fontes.
- [ ] MCL-02: BigQuery exige autorização e limite de bytes antes do teste; cancelar job não garante ausência de cobrança.
- [ ] MCL-03: alocação OpenCost não é somada à fatura da nuvem; compatibilidade OpenShift/retencão/moeda são verificadas no ambiente.
- [ ] MCL-04: falha parcial preserva fontes bem-sucedidas; agrupamentos não misturam moedas, períodos, bases ou camadas incompatíveis.

## Segurança e aceite
- [ ] SEC-01: Host/Origin/CSRF continuam ativos; nenhuma credencial real ou cofre foi incluído no GitHub.
- [ ] SEC-02: shell Next usa scripts com hashes CSP; CDN Three.js é permitida somente no HTML do frame; sem liberação global de inline/eval.
- [ ] SEC-03: popup sandbox não recebe credenciais; sem CDN/WebGL o restante do sistema funciona.
- [ ] SEC-04: exportações/logs revisados antes de compartilhar; confirmar limpeza de insight e dados de sessão após logout.
- [ ] ACC-01: registrar aceite visual do time, consultas financeiras reais e pendências; não substituir por testes sintéticos.
