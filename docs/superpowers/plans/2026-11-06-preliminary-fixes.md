# Correções do teste preliminar — plano aprovado para apresentação

> **For agentic workers:** superpowers:executing-plans, execução contínua e uma revisão final independente.

**Goal:** corrigir PRE-01 a PRE-09 dentro das capacidades existentes e publicar versão testada para apresentação da equipe FinOps.
**Architecture:** cliente Azure com cooldown isolado por identidade/escopo, eventos seguros do chat, diagnóstico tabular e formulários esclarecidos. Preservar política de ferramentas, cofre e fontes financeiras. TESSERACT é o workspace local de acessos/MCPs/agentes/consultas FinOps; não afirmar hospedagem multiusuário nem suporte MCP arbitrário.
**Tech Stack:** TypeScript/Fastify/React/MSAL/MCP SDK/Copilot SDK atuais; sem novas dependências.
**Spec:** docs/teste-preliminar-2026-11-06.md e autorização explícita do usuário para implementar correções e publicar.

## Global Constraints
Não solicitar nova aprovação de escopo já autorizado; não criar infraestrutura nem alterar RBAC; nenhuma cobrança inferida por número de chamadas. Valores desconhecidos permanecem indisponíveis. Consentimento lembrado somente nesta sessão de navegador, por provedor, opt-in e revogável. Não inventar dropdowns de SKUs sem catálogo.

## Review Focus
429 com cabeçalhos múltiplos/ausentes: respeitar maior espera, cooldown isolado e cancelamento. Chat MCP sem seleção válida nunca cai em API silenciosamente. Eventos não expõem credenciais nem cadeia de raciocínio. Métricas só números reais fornecidos. Filtros de log não confundem HTTP 200 do transporte com sucesso de negócio.

## Tarefas
- [x] RED/GREEN: rate limit específico, cooldown de repetição, isolamento e cancelamento; preservar retry curto já testado.
- [x] Fonte efetiva/correlação, fases e uso de tokens por eventos documentados; não estimar dinheiro sem tarifa.
- [x] Diagnóstico compacto pesquisável/status/data; busca RG; defaults/opcionais MCP; local/remoto e caminho Copilot sem endpoint; autorização de contexto por sessão/provedor.
- [x] Testes significativos de UI/serviços; typecheck/build/Edge, inspeção visual, revisão final única e correção de achados.
- [x] Docs de apresentação, reinício preservando IDs, publicação GitHub e leitura SHA remoto.

Evidência: 73 serviço/17 Edge, build/typecheck; revisão final e um passe de correção com testes. Publicação autorizada em andamento; aceite financeiro real não foi declarado.
