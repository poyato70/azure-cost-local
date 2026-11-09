# Tesseract — navegação e laboratório de capacidades

Estado: aprovado em 09/11/2026 e ampliado pelo usuário para implementação direta de centro de inteligência com dark mode, Next.js, Tailwind, Framer Motion, componentes shadcn e animação 4D Three.js. Referência HTML preservada em Assets. Validação financeira e aceite visual humanos são separados da implementação.

## Objetivo
Separar cadastro de execução e dar ao time FinOps um espaço para testar, verificar, avaliar e listar capacidades reais de MCPs, agentes e APIs, com evidências legíveis. Preservar cofre, acessos, configurações, consultas e execução local.

## Abordagem e navegação
Alternativas consideradas: destacar melhor os grupos mantendo menu plano (menor mudança, continua misturando tarefas); árvore de navegação com páginas separadas (recomendada); reconstrução completa com novo framework (descartada por risco e ausência de benefício).

Proposta: árvore expansível, títulos e itens filhos com recuo e linha-guia discreta. Ícones minimalistas monocromáticos de biblioteca reconhecida para grupos principais, sem emoji. Seleção por fundo discreto e texto com contraste, sem borda luminosa, sombra ou relevo. Teclado, foco visível, aria-expanded e aria-current; no celular, menu recolhível em vez de longa faixa horizontal.

- Explorar: Visão multicloud; Custos > Por escopo / Por tag.
- Planejar: Forecast; Budgets; Compromissos.
- Assistentes: Agentes > Cadastro / Avaliação; Chat.
- Conexões: Acessos; MCPs > Integração / Análise / Descoberta; FinOps hub; APIs > Capacidades e testes.
- Operação: Diagnóstico.
- Ajuda: Guia Tesseract; Conceitos; Referências; Sobre e créditos.

## MCPs
**Integração:** criar, editar, vincular identidade, configurar transporte/contexto, testar negociação e salvar. Mostrar previamente autenticações suportadas. Sucesso de conexão não significa autorização para toda tool. Preservar presets Microsoft e padrões pricing_get existentes.

**Análise:** selecionar conexão salva e abrir laboratório com abas Visão geral, Tools, Prompts, Resources e Logs. Exibir identidade do servidor, versão/protocolo negociados e capacidades anunciadas; consultar catálogos com paginação e limites quando suportados. Diferenciar não anunciado, não implementado, vazio, erro e ainda não testado. Tools mostram schema, argumentos efetivos, tempo, correlação, resultado e erro operacional. Manter autorização de leitura por tool/schema; anunciar tools de escrita não autoriza execução. Prompts permitem listar e obter template com argumentos; conteúdo retornado é dado não confiável e nunca é executado automaticamente. Resources permitem listar e ler itens escolhidos sob limites de tamanho e autorização, sem buscar URLs arbitrárias retornadas pelo servidor.

Logs sanitizados por conexão/operação, com filtro e expansão de detalhes; sem tokens, senhas ou código OAuth. Cada tentativa distingue transporte, autenticação, descoberta e execução. Exportação exige ação explícita e aviso de que identificadores/valores financeiros podem ser confidenciais.

**Descoberta:** catálogo curado com origem, fornecedor, documentação, transporte, autenticação, finalidade e data de verificação. Fontes iniciais oficiais Microsoft, AWS e Google Cloud. Documentação GitHub não é endpoint MCP. Servidor listado não é automaticamente integrado nem comprovadamente seguro.

Fonte personalizada: URL HTTPS de catálogo/manifesto com formato documentado, confirmação explícita de confiança escolhida pelo usuário e aviso de responsabilidade. Não instalar ou executar comandos recebidos do catálogo, não seguir páginas/links em cascata, não enviar credenciais a uma origem nova e não remover validações de endpoint/TLS. Manifestos inválidos retornam diagnóstico; páginas HTML comuns podem ser salvas como referência, mas não anunciadas como descoberta protocolar bem-sucedida. Selecionar candidato leva à Integração para configuração e teste explícitos. A confiança declarada permite cadastrar a origem, não desativa proteções.

## Avaliação de agentes e APIs
Reutilizar testes existentes de agentes e acrescentar ficha com tipo de runtime, contrato, modelo, tools autorizadas, limites, consentimento, tempo e tokens reais quando disponíveis. Agente HTTP: health check prova disponibilidade, não capacidade financeira; contrato remoto e ausência de filtros locais enviados devem ficar explícitos. Não inferir tools de agentes que não exponham catálogo.

APIs: catálogo de operações implementadas Azure/AWS/GCP/OpenCost, pré-requisitos, identidade suportada, endpoint lógico e exemplos de leitura. Testes usam serviços existentes e escopo selecionado; não oferecer console HTTP arbitrário nem execução de escrita. Informar custo possível do teste BigQuery/Cost Explorer antes da chamada. Retornos com gráfico quando aplicável, tabela, JSON sanitizado, tempo, correlação e fonte.

## Compatibilidade antes do preenchimento
Separar identidade (usuário / aplicação com Secret) de canal (API / MCP). Forecast, Budgets e cartões Azure atuais mostram desde a entrada: operação disponível por API nesta versão, motivo e botão explícito para escolher API. Desabilitar consulta incompatível antes do envio, preservando filtros. Não trocar canal silenciosamente. Manter opção de configurar/testar MCP em sua área e informar que um MCP pode listar tags mesmo que o cartão atual não esteja ligado a ele.

Renomear “Travas orçamentárias (tags)” para “Tags de governança orçamentária”. Explicar que são metadados de subscription/RG/recursos e não budgets, locks ARM nem mecanismos que suspendem gastos. Mostrar regra usada para selecionar tags e permitir todas as tags. Fonte desta tela: ARM API; outros MCPs podem expor operações próprias de tags, verificadas no laboratório.

## Custos por tag
Primeira implementação Azure: filtros por chave/valor, escopo subscription/RG/recursos, período, custo real/amortizado e agrupamento. Preferir tags presentes nos registros de cobrança da Query API para consulta histórica. Comparar com inventário atual opcionalmente, com rótulos claros: tag atual não prova tag histórica, tags de RG/subscription não são herdadas automaticamente pelos recursos/faturas e nem todo gasto é atribuível a recurso com tag.

Cruzamento opcional de inventário por ARM/API ou MCP de leitura autorizado com custos por ResourceId: normalizar IDs, preservar fonte/correlação, separar não encontrados/sem tag e informar cobertura parcial, recursos removidos e limites de consulta. Usar apenas adaptadores explicitamente implementados e schemas compatíveis; não prometer cruzar qualquer MCP. Não extrapolar custo total de subscription a partir de subconjunto de recursos. Canais e filtros sempre explícitos; sem fallback silencioso. Esta primeira consulta por tag é Azure; AWS/GCP/OpenCost mantêm consultas atuais e limites documentados.

## Ajuda e apresentação
Ajuda contextual por tela: finalidade, configuração, autenticação, canal, significado do resultado, limitações e solução de erros. Glossário de MCP, API, Service Principal, tools/prompts/resources, custo real/amortizado, forecast, budgets e alocação. Links oficiais Azure, AWS, Google Cloud, OpenShift, OpenCost e FinOps Foundation, sem alegar homologação.

Boas-vindas com logo maior, nome Tesseract, versão e créditos confirmados: Everton Poyato / time FinOps; referência visual fornecida pelo usuário. Não atribuir autoria da imagem ou endosso corporativo sem comprovação. Modal acessível com OK, Escape, foco contido e devolvido; opção de não mostrar novamente e reabertura em Sobre. Animação proposta: transformação geométrica discreta do asset existente com CSS, sem incluir Three.js/GLSL/GSAP apenas para uma abertura. Logo lateral com pulso sutil ocasional; pausar quando página não visível e desativar com prefers-reduced-motion e opção de reduzir animações.

## Validação e publicação
Testes de navegação/teclado/mobile, bloqueio prévio de canal incompatível, paginação e ausência de capacidades MCP, argumentos/prompts/resources malformados, logs sem credenciais, validação de origem personalizada, cancelamento e revogação. Para tags: histórico versus atual, IDs com caixa diferente, recurso removido, ausência de tag, respostas parciais, moedas e bases separadas. Testes de serviços, navegador, typecheck/build e revisão independente; preservar dados locais. Publicar entregas significativas e registrar cada commit no Linear Tesseract/ARG-20. Aceite visual e consultas financeiras reais permanecem etapas humanas separadas.

## Fontes e constatações
- Código atual: registry.ts usa listTools, sem catálogo de prompts/resources; Budgets.getLocks lê tags via ARM; AzureCosts monta Query API sem filtro de tag.
- Microsoft: https://github.com/microsoft/mcp
- AWS: https://awslabs.github.io/mcp/servers
- Google Cloud: https://docs.cloud.google.com/mcp/overview
- Query e filtro tags: https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage
