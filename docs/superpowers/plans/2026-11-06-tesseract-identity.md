# Identidade TESSERACT — plano

> **For agentic workers:** executar com superpowers:executing-plans em sessão contínua; revisão final única.

**Goal:** aplicar identidade completa TESSERACT aprovada.
**Architecture:** tokens CSS compartilhados, componente Brand único, asset azul no public e classes de status locais. Serviços de negócio independentes da identidade.
**Tech Stack:** React/TypeScript/Vite/CSS/Playwright existentes, sem novas dependências.
**Spec:** docs/superpowers/specs/2026-11-06-tesseract-identity-design.md

## Global Constraints
Paleta e escopo no design aprovado; sem alterar dados/permissões/endpoints nem o nome técnico do repositório. Preservar checklist não publicado preexistente. Imagem original não é sobrescrita.

## Review Focus
Contraste de amarelo e status pequenos; sidebar acessível em notebook baixo; sem totais/estado verde inventados; nome antigo em popup/título; asset carregado no build e mobile.

## Tarefa única — identidade e validação
- [x] Gerar asset a partir do símbolo fornecido com imagem original preservada.
- [x] Componente Brand e título/favicon; dashboard e popup.
- [x] Substituir cores antigas por tokens semânticos; gráficos azuis, economia verde, budgets com rótulos de atenção/crítico/desconhecido.
- [x] Conferir build/typecheck e testes Edge existentes; inspeção visual desktop/notebook, incluindo budgets por fixtures.
- [x] Revisão independente final única; um passe de correções materiais; documentação e reinício do serviço.

Mudanças visuais reversíveis serão verificadas com fluxos existentes e inspeção; não criar testes que apenas espelham cores/CSS. Não publicar automaticamente: finalizar localmente com resultado revisável.

Resultado: build/typecheck e 14 testes Edge passaram. Inspeção em 1440/1024/390 px sem overflow horizontal de página. Revisão de contraste corrigida; serviço local health ok. Sem publicação GitHub nesta etapa.

Publicação posteriormente solicitada pelo usuário em 06/11/2026: incluir identidade aprovada, checklist e triagem sanitizada do teste preliminar. Nova rodada de 67 testes de serviço, 14 Edge, typecheck/build passou antes da publicação.
