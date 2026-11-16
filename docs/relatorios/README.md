# Relatórios de missões — Tesseract 2.0

Este índice reúne o histórico versionado das missões do repositório. Os relatórios descrevem o estado e as evidências disponíveis em cada época; reconstruções são identificadas como tal.

| Missão | Título | Data | Status registrado | Relatório | Pull Request |
|---|---|---|---|---|---|
| 13 | Persistência, recuperação e rastreabilidade da orquestração MCP | 2026-11-16 | Integrada à `main` após CI Linux/Windows aprovada; backup original perdido e não recuperado | [missao-13.md](missao-13.md) | [PR #10](https://github.com/poyato70/azure-cost-local/pull/10) |
| 04–05 | MCP Inspector e instalação automatizada | 2026-11-13 | Relatório fonte: implementação local; publicação não comprovada no registro da época | [missao-04-05.md](missao-04-05.md) | — |
| 06 | Consolidação do workspace MCP e operações | 2026-11-13 | Integrada à `main` conforme PR #1 | [missao-06.md](missao-06.md) | [PR #1](https://github.com/poyato70/azure-cost-local/pull/1) |
| 07 | Correções de instalação corporativa | 2026-11-15 | Integrada à `main` conforme PR #2 | [missao-07.md](missao-07.md) | [PR #2](https://github.com/poyato70/azure-cost-local/pull/2) |
| 08 | Governança de relatórios e rastreabilidade | 2026-11-15 | Implementação concluída; estado atual na PR #3 | [missao-08.md](missao-08.md) | [PR #3](https://github.com/poyato70/azure-cost-local/pull/3) |
| 09 | Redesign visual e mapa operacional | 2026-11-15 | QA responsivo aprovado; teste Windows tratado; PR #4 integrada à `main` | [missao-09.md](missao-09.md) | [PR #4](https://github.com/poyato70/azure-cost-local/pull/4) |
| 10 | Validação MCP ponta a ponta e auditoria funcional do Mapa de Conexões | 2026-11-15 | Integrada à `main` via PR #5 | [missao-10.md](missao-10.md) | [PR #5](https://github.com/poyato70/azure-cost-local/pull/5) |
| 11 | GitHub Actions, CI, segurança e qualidade contínua | 2026-11-16 | Integrada à `main`; proteção ativa | [missao-11.md](missao-11.md) | [PR #6](https://github.com/poyato70/azure-cost-local/pull/6) |
| 12 | Orquestração MCP e visualização de operações no Mapa de Conexões | 2026-11-16 | Integrada à `main`; CI Linux/Windows aprovada | [missao-12.md](missao-12.md) | [PR #8](https://github.com/poyato70/azure-cost-local/pull/8) |

## Criar relatório de nova missão

Copie `TEMPLATE.md` ou use o gerador, que cria um arquivo novo e recusa sobrescrita:

```powershell
.\scripts\new-mission-report.ps1 -Mission 09 -Title "Título da missão"
```

Atualize o índice manualmente após revisar data e estado. Resultados precisam de evidência; `test-results/` continua ignorado e reservado a evidências temporárias.
