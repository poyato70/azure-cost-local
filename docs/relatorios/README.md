# Relatórios de missões — Tesseract 2.0

Este índice reúne o histórico versionado das missões do repositório. Os relatórios descrevem o estado e as evidências disponíveis em cada época; reconstruções são identificadas como tal.

| Missão | Título | Data | Status registrado | Relatório | Pull Request |
|---|---|---|---|---|---|
| 04–05 | MCP Inspector e instalação automatizada | 2026-11-13 | Relatório fonte: implementação local; publicação não comprovada no registro da época | [missao-04-05.md](missao-04-05.md) | — |
| 06 | Consolidação do workspace MCP e operações | 2026-11-13 | Integrada à `main` conforme PR #1 | [missao-06.md](missao-06.md) | [PR #1](https://github.com/poyato70/azure-cost-local/pull/1) |
| 07 | Correções de instalação corporativa | 2026-11-15 | Integrada à `main` conforme PR #2 | [missao-07.md](missao-07.md) | [PR #2](https://github.com/poyato70/azure-cost-local/pull/2) |
| 08 | Governança de relatórios e rastreabilidade | 2026-11-15 | Implementação concluída; estado atual na PR #3 | [missao-08.md](missao-08.md) | [PR #3](https://github.com/poyato70/azure-cost-local/pull/3) |
| 09 | Redesign visual e mapa operacional | 2026-11-15 | Implementação local; QA visual bloqueada | [missao-09.md](missao-09.md) | — |

## Criar relatório de nova missão

Copie `TEMPLATE.md` ou use o gerador, que cria um arquivo novo e recusa sobrescrita:

```powershell
.\scripts\new-mission-report.ps1 -Mission 09 -Title "Título da missão"
```

Atualize o índice manualmente após revisar data e estado. Resultados precisam de evidência; `test-results/` continua ignorado e reservado a evidências temporárias.
