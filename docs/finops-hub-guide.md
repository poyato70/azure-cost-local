# Usar o Analista FinOps e FinOps hub

Ampliação de 03/11/2026. A execução continua local; o Hub consultado fica em Azure Data Explorer. Não foi instalado o plugin global FinOps Toolkit/Awesome Copilot e nenhum recurso Azure foi criado.

## Perfil e conexão

1. Em **Agentes**, clique **Usar perfil Analista FinOps**. O rascunho contém instruções próprias em português, fontes com revisão fixa e versão do template. Configure endpoint/deployment do modelo, credencial de inferência, acessos autorizados e, para MCP, os vínculos de conexão. Salve. A ferramenta `finops_hub` deve permanecer autorizada na lista avançada (um nome por linha).
2. Em **Acessos**, cadastre/conecte a identidade que possui acesso à subscription e ao banco ADX. Cost Management Reader não substitui Database Viewer no banco. Application Secret é do acesso Entra; chave do modelo é outra credencial.
3. Abra **FinOps hub**, informe nome, acesso, raiz HTTPS do cluster ADX público e transporte **API Kusto** ou **MCP ADX aprovado**. Banco `Hub` e schema `v1_2` estão fixados nesta versão. Não suporta aqui emulador local, Fabric Eventhouse, sovereign cloud, alteração de schema nem ingestão automática.
4. Em modo usuário/API, use **Autorizar ADX (usuário)** para consentimento específico. Configure no Entra as permissões delegadas necessárias e o retorno local do aplicativo público; o login continua em popup. Em modo aplicação, o token do cluster é obtido sem popup. Permissões efetivas de banco precisam existir.
5. Se usar MCP: cadastre previamente preset ADX, vinculado ao mesmo acesso. Contexto requer `clusterUri` (mesma raiz do Hub), `database: Hub`, `tenant` (Tenant ID) e `subscription` (Subscription ID), com nomes e valores esperados pelo schema da ferramenta. Descubra/aprove `kusto_query` por nome/schema. O executor local usa Secret explícito; não herda login Azure CLI. HTTP próprio requer audience `api://ID` do servidor MCP, distinta da audience ADX usada pelo serviço downstream.

A configuração do Hub é metadado versionado no mesmo armazenamento protegido de configurações, fora do repositório. Ao migrar notebook, recadastre os acessos primeiro, depois MCPs, Hubs e agentes; Secrets DPAPI não são portáveis por cópia simples. Nenhum endpoint/modelo é escolhido automaticamente a partir do nome de perfil.

## Consultar e comparar

Selecione subscription e **resource group** nos filtros, depois o Hub. **Consultar dois meses** usa dois meses civis completos anteriores em America/Sao_Paulo. Em 03/11/2026: de 01/09/2026 até 01/11/2026 exclusivo. Os filtros gerais de datas não alteram essa operação específica; o aviso da tela explicita isso.

A consulta usa função `Costs_v1_2()` e filtros fixos do serviço. Retorna BilledCost ou EffectiveCost por mês/moeda. Ausência de linhas é apresentada como cobertura desconhecida, não como gasto zero. Exportações podem chegar com atraso ou estar incompletas; a consulta não afirma completude só por retornar linhas.

**Conciliar com Cost Management** consulta as duas fontes separadamente no mesmo escopo, janela e base escolhida. A tabela preserva valores, diferença absoluta e percentual; denominador zero não gera percentual. Falha de uma fonte preserva a outra. O resultado é uma **comparação informativa**, não uma certificação de conciliação: equivalência de datas/categorias/ajustes e cobertura completa não foram comprovadas. Mesmo diferença zero não prova equivalência. Valores já agregados pelo ADX refletem o tipo financeiro do dataset; o serviço mantém as strings recebidas e calcula diferenças com Decimal.js.

O Hub selecionado nesta área torna-se a origem explícita no **Chat**, para Copilot local ou agente cadastrado. O modelo só recebe ferramentas de negócio com operações `costs`, `reconcile`, `reservations`, `savingsPlans`; não escolhe KQL, destino, banco ou credencial. Para comparação, peça “compare com Cost Management”. Os dados/evidências do serviço são apresentados independentemente do texto do modelo. Custos, Compromissos e Budgets tradicionais continuam com as fontes anteriores; não ocorre fallback silencioso.

## Reservations e Savings Plans

Os botões da área Hub mostram separadamente:

- Custos atribuídos ao RG para o tipo de desconto, a partir de Costs.
- Recomendações Reservations via Recommendations quando existentes e atribuídas ao RG; são projeções e podem estar ausentes mesmo havendo recomendações em outro escopo.
- Linhas de CommitmentDiscountUsage quando disponíveis, limitadas a 100 registros e ao tipo de benefício selecionado. Essas linhas não certificam cobertura nem utilização agregada.

Recomendações Savings Plans não têm template de schema certificado nesta versão e são identificadas como indisponíveis. Não se inferem percentuais, economia realizada, simulação horária, preços contratuais, compras ou atribuição de pedidos de billing ao RG. Recomendações sem moeda verificável não são somadas a custos. Uma fonte/dataset inacessível não é substituído por zero. Detalhes de datasets aparecem como evidência; a síntese do agente deve preservar essas limitações.

## Evidência e limites de validação

57 testes do serviço e dez testes Edge passaram; typecheck/build passaram; auditoria npm de produção sem vulnerabilidades reportadas. O protocolo MCP foi exercitado contra servidor HTTP local sintético, com envelope oficial Azure MCP `status/results/items`; REST Kusto usa transporte simulado nos testes de serviço. A revisão independente encontrou quatro falhas materiais, corrigidas com regressões: retorno MCP, edição concorrente, preservação parcial simétrica e evidência financeira no chat.

Ainda pendem: login/Database Viewer reais, schema v1_2 efetivo, exportações ingeridas, consulta RG com dado real e conciliação com portal, modelos e inferência sobre esses dados. Testes sintéticos não substituem esse aceite. Teste novo deve ser feito localmente; não envie Secret, token ou URL OAuth pelo chat.

Fontes rastreáveis: [estudo de viabilidade](finops-toolkit-awesome-copilot-feasibility.md), [modelo Hub Microsoft](https://learn.microsoft.com/en-us/cloud-computing/finops/toolkit/hubs/data-model), [comando Kusto oficial](https://github.com/microsoft/mcp/blob/main/tools/Azure.Mcp.Tools.Kusto/src/Commands/QueryCommand.cs). Os arquivos de template registram as revisões das instruções utilizadas.
