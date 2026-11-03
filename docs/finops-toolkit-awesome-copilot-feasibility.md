# Viabilidade: Microsoft FinOps Toolkit e Awesome Copilot

Análise de 03/11/2026, posterior à publicação da versão `f2fd0bc` no repositório privado `poyato70/azure-cost-local`. Escopo: análise de documentação, código público e compatibilidade com a aplicação; nenhuma integração, plugin ou infraestrutura adicional foi instalado.

## Parecer

**Ambos são aproveitáveis. O FinOps Toolkit tem maior impacto nas funcionalidades financeiras; Awesome Copilot contribui principalmente com instruções, skills e apoio ao desenvolvimento.** A adoção requer seleção e adaptação. Instalar um plugin no notebook não faz o chat desta aplicação carregá-lo.

Proposta: manter Cost Management para a experiência atual e budgets; preparar uma integração opcional FinOps hubs para histórico, FOCUS e análises de compromissos. Usar conteúdo revisado dos agentes como instruções explícitas, preservando a autorização de ferramentas no servidor. Não é necessário substituir React/Fastify nem hospedar a interface para isso.

## Fatos comprovados nas fontes

| Recurso | O que foi confirmado | Utilidade para este projeto |
|---|---|---|
| FinOps hubs | Plataforma extensível com dados normalizados, exportações e consulta via ADX/Fabric | Fonte analítica adicional para histórico e consolidação |
| Agent plugin Toolkit | Agentes FinOps/CFO/database/hubs/capacity, comandos e skill KQL; configura Azure MCP em namespace Kusto read-only | Conteúdo e catálogo para adaptar aos agentes |
| Modelo de dados | Funções Hub versionadas e dados de custos, preços, recomendações e compromissos | Base para adapters com contrato estável |
| Open data | Mapeamentos de regiões/serviços/unidades e dados de elegibilidade/flexibilidade | Enriquecimento e apoio à análise de Reservations/Savings Plans |
| Optimization Engine | Solução implantável para recomendações adicionais | Evolução possível; não é uma biblioteca TypeScript pronta para importar |
| Awesome Copilot | Coleção comunitária de agentes, instruções, skills, plugins e outros recursos | Conteúdo reutilizável após revisão e atribuição |

Fontes: [hubs](https://microsoft.github.io/finops-toolkit/hubs), [agent plugin](https://microsoft.github.io/finops-toolkit/agent-plugin), [modelo de dados](https://learn.microsoft.com/en-us/cloud-computing/finops/toolkit/hubs/data-model), [open data](https://microsoft.github.io/finops-toolkit/open-data), [Optimization Engine](https://microsoft.github.io/finops-toolkit/optimization-engine), [Awesome Copilot](https://github.com/github/awesome-copilot).

O código do plugin Toolkit define `npx @azure/mcp@latest` com `--namespace kusto --read-only`. Sua skill espera `Costs()`, `Prices()`, `Recommendations()` e `Transactions()`, autenticação Azure CLI e Database Viewer para as consultas. Esse fluxo padrão é diferente da aplicação, que usa acesso salvo e credenciais explícitas. Fonte: [manifesto MCP](https://github.com/microsoft/finops-toolkit/blob/4190b4c5167670c8aad016eac42e52ced3c62fe1/src/templates/agent-plugin/.mcp.json), [skill](https://github.com/microsoft/finops-toolkit/blob/4190b4c5167670c8aad016eac42e52ced3c62fe1/src/templates/agent-plugin/skills/finops-toolkit/SKILL.md).

## Compatibilidade com a versão publicada

| Área atual | Avaliação | Mudança necessária |
|---|---|---|
| Agente cadastrado | Boa para instruções textuais | Adaptar um perfil FinOps em português; manter ferramentas cadastradas e não importar permissões do arquivo |
| Chat Copilot | Plugin externo não é carregado automaticamente | Importação controlada ou instruções explícitas; não habilitar descoberta global indiscriminadamente |
| MCP ADX | Infraestrutura de protocolo já existe | Adapter para funções Hub e queries predefinidas, versionamento e parâmetros de escopo |
| Cartões de custos | Sem adapter FinOps hubs atualmente | Normalizar resposta Hub para contrato de custos com origem, moeda, período e atualização |
| Budgets | API atual continua necessária | Toolkit não substitui automaticamente leitura dos budgets configurados na subscription/RG |
| Benefícios | Potencial para enriquecer análise | Validar disponibilidade de preços, recomendações, detalhes de uso e compras; impedir dupla contagem |
| Power BI/Fabric | Pode consultar dados de modelos autorizados | Validar schema/modelo, permissões e cálculo; incorporar relatório visual é projeto separado de MCP |

Evidência local: `src/server/chat/tools.ts` desabilita skills/config discovery e MCPs externos do Copilot. `src/server/mcp/tool-policy.ts` permite um subconjunto KQL que **não aceita `Costs()` nem os estágios where/summarize/extend necessários aos exemplos do Toolkit**. Isso é limite intencional de autorização da versão, não falha a contornar ativando todos os comandos. O agente local também não tem importador de SKILL.md, arquivos de referência ou comandos slash.

A [consulta mensal do Toolkit](https://github.com/microsoft/finops-toolkit/blob/4190b4c5167670c8aad016eac42e52ced3c62fe1/src/queries/catalog/monthly-cost-trend.kql) usa funções/estágios fora desse subconjunto. A adaptação recomendada é uma ferramenta de negócio, por exemplo `finops_hub_costs`, que recebe período/RG permitidos e executa template revisado no backend. Endpoint, banco, tenant e identidade permanecem fixados pelo cadastro, nunca pelo modelo.

## Execução no notebook: dois cenários

**Aplicação local consultando hub na nuvem:** maior aderência à arquitetura atual. A interface/serviço continuam no notebook; os dados ficam em ADX/Fabric. Requer hub existente ou implantação separada, dados exportados e acesso ao banco. RBAC de Cost Management não concede automaticamente acesso ao banco. Eventhouse Fabric exige validar o endpoint e o fluxo de token específicos; não presumir que o preset Fabric já fornece qualquer consulta KQL. [Documentação hubs](https://learn.microsoft.com/en-us/cloud-computing/finops/toolkit/hubs/finops-hubs-overview).

**Hub de laboratório também local:** existe guia oficial no código com emulador Kusto Linux em Docker, PowerShell 7, pelo menos 16 GB disponíveis ao contêiner e arquivos FOCUS Parquet. O endpoint do emulador não tem autenticação. A aplicação precisaria de adapter local explícito, limitado a loopback, sem enviar tokens Azure; os presets Microsoft autenticados atuais não atendem esse caso. Exports/ingestão devem ser preparados separadamente do chat de leitura. [Guia local](https://github.com/microsoft/finops-toolkit/blob/4190b4c5167670c8aad016eac42e52ced3c62fe1/docs-mslearn/toolkit/hubs/run-hubs-locally.md).

O emulador é destinado a desenvolvimento/testes, não produção. Além da memória do contêiner, é necessário espaço e memória para Windows, Docker e arquivos. Não executei benchmark nem instalação neste notebook. [Limites oficiais do emulador](https://learn.microsoft.com/en-us/azure/data-explorer/kusto-emulator-overview).

## Awesome Copilot: seleção proposta

- **azure-pricing:** útil para preços públicos e estimativas; não comprova gasto real nem preço contratado. Adaptar seu raciocínio a uma ferramenta de preço revisada, mantendo estimativas separadas de despesas. [Arquivo da skill](https://github.com/github/awesome-copilot/blob/8178d1939a203f691067073dcab2a3f1e14072d3/skills/azure-pricing/SKILL.md).
- **Azure Principal Architect:** apoio a decisões de arquitetura e evolução Teams/hospedagem. Seu arquivo é instrução para Copilot, não um agente já executável no nosso runtime. [Arquivo do agente](https://github.com/github/awesome-copilot/blob/8178d1939a203f691067073dcab2a3f1e14072d3/agents/azure-principal-architect.agent.md).
- Skills de implantação e scripts podem ajudar o desenvolvimento futuro, mas não devem entrar automaticamente no chat financeiro de leitura. A própria coleção orienta inspecionar agentes e documentação antes da instalação. [Coleção](https://github.com/github/awesome-copilot).

Não há evidência nesta análise de que Awesome Copilot forneça por si só um backend de custos, credenciais Azure, licença Copilot ou um endpoint de modelo.

## Proposta de evolução — ainda não implementada

1. Criar perfil FinOps com instruções selecionadas e rastreáveis, sem instalar plugins globalmente. Registrar fonte, revisão, licença e referências importadas. Valor imediato com menor mudança.
2. Separar na configuração **origem dos dados** (Cost Management/FinOps hub/modelo Power BI) de **meio de acesso** (API/MCP). Criar adapter Hub inicialmente só para consulta de custos de subscription/RG em dois meses civis completos. Preferir função Hub versionada compatível com o schema instalado.
3. Validar template de leitura com período exclusivo, escopo, moeda, freshness e comparação contra Cost Management. BilledCost/EffectiveCost FOCUS precisam de conciliação; não assumir equivalência universal com ActualCost/AmortizedCost em qualquer filtro.
4. Acrescentar templates de compromissos/economias conforme os datasets efetivamente ingeridos. Não somar alternativas de compra, tratar projeção como projeção e manter budgets na API existente.
5. Avaliar depois histórico/consolidação, relatórios executivos e eventual publicação Teams. Implantação de hub/Optimization Engine e Power BI incorporado requerem decisões próprias de custo, acesso e operação.

## Pendências para decisão e prova de conceito

Verificar se há FinOps hub/ADX/Fabric disponível; contrato/exportação FOCUS compatível; schema/release e meses carregados; permissões de banco e origem; capacidade do notebook para o cenário Docker; acesso/licença do modelo; catálogo de queries aprovado. Se houver somente conta MOSA/PAYG, confirmar disponibilidade de exportação FOCUS antes de escolher hubs modernos: o guia de hubs registra essa restrição.

Aceite mínimo proposto: a mesma pergunta de RG em dois meses, nos caminhos API e Hub, retorna valores conciliados ou diferenças explicadas, com moeda, período, escopo, fonte e horário de atualização; alteração de perfil cancela consulta; nenhum agente ganha shell/escrita por importar uma skill.

Os sites e o código podem evoluir em ritmos diferentes: a página inicial anuncia v15, enquanto parte do Microsoft Learn ainda apresenta conteúdo anterior e o link público do novo agent plugin retornou 404 nesta consulta. Por isso também foi lido o documento no repositório. Snapshots consultados: Toolkit `4190b4c5167670c8aad016eac42e52ced3c62fe1`; Awesome Copilot `8178d1939a203f691067073dcab2a3f1e14072d3`.
