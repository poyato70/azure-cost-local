# Conexões e agentes — validação de 03/11/2026

## Implementado

Acessos nomeados e versionados; modo usuário com popup/PKCE e modo aplicação com Client Secret; Secrets DPAPI CurrentUser em armazenamento local; áreas Azure/ADX/Foundry/Fabric/Power BI; descoberta e execução MCP com aprovação por nome/schema; seletor API/MCP sem fallback; agentes executados no serviço local com modelo Azure Chat Completions v1; seletor Copilot local/Agente cadastrado.

A fonte API mantém os cartões de custos/budgets/benefícios. A fonte MCP fornece ferramentas aprovadas no painel e no chat. Os cartões não convertem preços de catálogo/Advisor em gasto real: quando não há adapter equivalente de Cost Management, apresentam indisponibilidade e permitem escolher API explicitamente.

## Evidência técnica

42 testes do serviço passaram, incluindo Windows DPAPI sintético com reinício, versões/rotação, autenticação de aplicação simulada, protocolo MCP HTTP initialize/list/call contra servidor local sintético, schema alterado, resultado MCP isError, restrição de endpoint/audience, vínculo de identidade, escopo de consultas e loop do agente. Os oito testes Microsoft Edge passaram após corrigir nomes acessíveis dos seletores e atualizar mocks das rotas de configuração. Inspeção visual de MCPs em 1440 px: sem sobreposição/rolagem horizontal. Typecheck e build passaram. Auditoria npm de produção: zero vulnerabilidades reportadas. O build apresenta aviso de tamanho do pacote da interface.

A revisão independente encontrou seis problemas materiais, corrigidos: audiência de token em host personalizado, escopo MCP, preservação de chave ao mudar host de modelo, confusão de identidade delegada/aplicação, invalidação de sessão em rotação e isError MCP tratado como sucesso. Teste KQL reproduziu a falha antes da correção. Os demais casos estão cobertos por regressões locais sintéticas.

## Matriz de aceite real

| Capacidade | Estado |
|---|---|
| API Cost Management, budgets e benefícios com conta | Pendente de login e conciliação com portal |
| Aplicação com Secret e custos reais | Pendente de cadastro local e RBAC |
| Azure/ADX MCP local | Implementado; execução do pacote oficial e consulta real pendentes |
| Azure/ADX HTTP próprio | Implementado; requer servidor e audience de entrada próprios; pendente |
| Foundry MCP remoto delegado | Cadastro/conexão/descoberta implementados; consultas bloqueadas até adapter de ferramentas revisado |
| Foundry MCP remoto app-only | Não suportado nesta versão |
| Fabric / Power BI | Implementados com subconjunto de ferramentas de leitura; autenticação, ferramentas reais e contexto pendentes |
| Agente local com ferramenta real | Loop sintético passou; endpoint, deployment e credencial reais pendentes |
| Copilot com novos MCPs | Mediação implementada; aceite com serviço real pendente |

Ferramentas desconhecidas ficam bloqueadas, mesmo com readOnlyHint. ADX usa gramática conservadora: tabela, take/count/project/sort/order; funções/estágios adicionais exigem expansão revisada. Contexto de recursos deve corresponder aos argumentos da ferramenta; descoberta global incompatível com o contexto é recusada. Microsoft pode alterar schemas e autenticação dos serviços em preview.

Não foram publicados Secrets, alterados RBAC, criados recursos Azure ou configurados Teams. O agente é executado localmente, mas inferência e dados necessários são enviados ao provedor escolhido após consentimento. Execução local não significa inferência offline.

Fontes verificadas: [Azure MCP](https://github.com/microsoft/mcp/tree/main/servers/Azure.Mcp.Server), [Foundry MCP](https://learn.microsoft.com/en-us/azure/foundry/mcp/get-started), [Power BI MCP](https://learn.microsoft.com/pt-br/power-bi/developer/mcp/remote-mcp-server-get-started). O guia Power BI passou a recomendar Fabric IQ para consumo de modelos semânticos; o endpoint Power BI solicitado continua como preset desta versão.
