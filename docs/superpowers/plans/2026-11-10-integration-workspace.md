# Tesseract: workspace de integrações FinOps

Autorização: proposta de reposicionamento aprovada em 10/11/2026. Preservar os serviços financeiros e arquivos locais do usuário; não migrar nem apagar configurações.

## Entregas

1. Conexões HTTP MCP independentes de Azure: preset Kubernetes/OpenShift e HTTP personalizado, token Bearer protegido no cofre ou sem autenticação. Não aceitar comandos arbitrários nem presumir OAuth universal. Preservar validação de endpoints e revogação.
2. Exploração: catálogo, teste por schema, aprovação explícita vinculada ao contrato; evidências de servidor, operação e correlação. Testar protocolo real com servidor local controlado.
3. Conhecimento: importar Markdown público do GitHub por commit imutável, pesquisar, revisar e vincular a um agente. Não executar scripts importados. Conteúdo enviado ao modelo somente por vínculo explícito; agentes HTTP não recebem skills locais.
4. Workspace inicial orientado a conexões, explorador, agentes e conhecimento; análises financeiras preservadas como capacidade secundária. Checklist de aceite e limites publicados.

## Validação

Testes de serviço para credenciais, troca de endpoint, schema alterado, MCP real controlado e conhecimento versionado; typecheck, build e testes de navegador pertinentes. Testes locais não comprovam acesso corporativo real.

## Decisões

- Trabalhar em branch separada no checkout existente, preservando .vscode do usuário. Nenhuma movimentação de arquivos.
- Gateway independente, topologia, sincronização diária e instalação automática fora desta entrega.
- GitHub privado: não reutilizar tokens de modelos ou Azure; importação privada exige integração de credenciais própria em entrega posterior.
- Revisão final independente antes de publicar. Publicação GitHub e registro Linear já autorizados pelo usuário.

## Progresso

- Planejamento e inspeção: concluídos. Base c5b04a2; .vscode/settings.json e .vscode/mcp.json pertencem ao usuário e não integrarão o commit.

- Entregas 1–4: implementadas; testes locais controlados concluídos. 106 serviços, 30 Edge, typecheck e build aprovados.
- Revisão independente final: achados sobre teste de inferência sem Azure e redaction de saídas MCP reproduzidos e corrigidos. Ajustes de UX associados ao percurso (ação Copilot e indicação de token protegido) também reproduzidos/corrigidos.
- Testes antigos que pressupunham Custos como página inicial foram atualizados para navegar até a área financeira antes dos filtros; as expectativas financeiras foram preservadas.
- Limite de aceite: ambiente corporativo real pendente; checklist separado, sem alegar consulta financeira real.
