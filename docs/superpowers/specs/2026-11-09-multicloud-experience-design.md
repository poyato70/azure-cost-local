# TESSERACT — experiência multicloud

Estado: aprovado pelo usuário em 09/11/2026. Direção escolhida pelo usuário: reformular identidade visual e organização completa das telas.

## Objetivo
Ser o espaço local do time FinOps para cadastrar conexões MCP, agentes e consultar custos com evidência verificável. Preservar os acessos existentes e a execução no notebook.

## Abordagens
1. Manter identidade BB e reorganizar telas: menor mudança visual, preserva familiaridade. Não foi a opção escolhida.
2. Reformular identidade e navegação, preservando os serviços existentes: opção escolhida. Permite corrigir fluxos sem reconstruir autenticação e integrações.
3. Reescrever a aplicação e seus serviços: descartada pelo risco de regressões e custo sem benefício demonstrado.

## Identidade e navegação propostas
Manter nome e símbolo geométrico TESSERACT, com marca própria: azul índigo como destaque, superfícies claras, texto escuro, espaçamento consistente e cores de status com rótulos. Amarelo passa a destaque secundário. Esta paleta é uma escolha proposta de implementação, não uma exigência do usuário.

Navegação por tarefas: Visão geral; Explorar custos; Planejar (previsões, budgets, compromissos); Assistentes; Conexões (acessos, MCPs e FinOps hubs); Diagnóstico. Preservar os recursos atuais dentro destes grupos. Escopo e período ficam visíveis nas consultas, sem exigir contexto Azure nas telas de cadastro ou consultas de outros provedores.

Cada resultado oferece gráfico, tabela e JSON; informa fonte, período, moeda, atualização, base de custo e correlação quando disponíveis. Carregamento, vazio, ausência de permissão, configuração incompleta e falha do provedor têm mensagens diferentes e ação de recuperação. Feedback fica ao lado da ação que o iniciou. Nenhuma afirmação de conexão financeira bem-sucedida decorre apenas de obter token ou listar tools.

## Consultas multicloud
Contrato comum de resultado com provedor, escopo, período, moeda, base e registros normalizados; manter resposta bruta sanitizada para inspeção. Serviços independentes da UI e do chat.

- AWS: Cost Explorer GetCostAndUsage, custos por serviço no período, paginação e identificação da métrica. Credenciais locais via fluxo suportado pelo SDK, sem segredos no navegador ou Git.
- GCP: consultar exportação Cloud Billing no BigQuery, projeto/dataset/tabela explicitamente configurados, consultas parametrizadas e limites de custo de execução. Exibir ausência de exportação/histórico sem fabricar valores.
- Kubernetes/OpenShift: consultar alocação OpenCost em endpoint configurado; testar compatibilidade e documentar implantação necessária para OpenShift. Não apresentar alocação como fatura do provedor. Não alegar integração nativa Red Hat validada sem evidência.
- Azure: preservar APIs atuais para custos, budgets, benefícios e forecast; MCP continua selecionável conforme capacidades reais.

Visão unificada agrupa valores compatíveis por moeda e base. Sem câmbio implícito. Kubernetes aparece em camada de alocação separada e nunca é somado automaticamente ao custo da nuvem subjacente. Fontes indisponíveis ficam explícitas; não entram como zero. Resultados parciais indicam cobertura.

## Segurança e integridade

Decisões técnicas da revisão: usar decimais e intervalos com fim exclusivo. AWS começa com UnblendedCost por perfil/SSO local; GCP usa Application Default Credentials e explicita custos e créditos da exportação. Guardar referências de configuração, sem importar arquivos inteiros de credenciais. Bases diferentes ficam identificadas e não produzem total consolidado quando incompatíveis. OpenCost admite autenticação opcional protegida no cofre e cancelamento.
Preservar cofre local e configurações. Novos segredos apenas no serviço local/cofre protegido. Validar endpoints e manter consentimento explícito para rede privada. Sanitizar erros upstream, JSON exibido e diagnóstico; não registrar tokens. Consultas somente de leitura. Validar escopo e seleção MCP sem fallback silencioso. Cancelar operações revogadas e impedir resultados antigos de substituir filtros atuais.

## Entregas e validação
1. Corrigir falhas confirmadas de concorrência, revogação, seleção e exposição de erro; atualizar testes afetados.
2. Nova estrutura visual e componentes de resultados com acessibilidade, busca e adaptação de largura.
3. Conectores AWS, GCP e OpenCost com testes de contrato e visão unificada.
4. Revisão técnica, testes de serviço, navegador, typecheck e build; documentação de configuração e limites; publicar mudanças significativas no GitHub e registrar cada commit no projeto Linear Tesseract.

Dados de teste identificados não demonstram consultas financeiras reais. Validação real depende de acesso do usuário aos provedores, sem solicitar senhas pelo chat. Aceite visual humano permanece separado dos testes automatizados.

Critérios obrigatórios: paginação AWS; seleção segura de tabela e limite de bytes BigQuery; intervalos e alocação OpenCost; falha parcial por fonte; prevenção de dupla contagem; preservação dos acessos atuais. Revisão independente do desenho concluída sem dúvidas materiais pendentes; decisões técnicas incorporadas acima.

## Limites
Sem compra de compromissos, alteração de recursos, conversão cambial automática, migração de hospedagem ou limpeza da cópia antiga no OneDrive. Não reconstruir integração HTTP corporativa sem respeitar seu contrato existente. Não prometer funcionamento financeiro real sem testar credenciais autorizadas.

## Fontes técnicas
- https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_GetCostAndUsage.html
- https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery
- https://opencost.io/docs/integrations/api/
