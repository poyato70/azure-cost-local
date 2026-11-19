# Relatórios de missões — Tesseract 2.0

Este índice reúne o histórico versionado das missões do repositório. Os relatórios descrevem o estado e as evidências disponíveis em cada época; reconstruções são identificadas como tal.

| Missão | Título | Data | Status registrado | Relatório | Pull Request |
| 20 | Correção do status desatualizado no UX-07 | 2026-11-19 | PR #21 aberta; checks Linux/Windows em execução | [missao-20.md](missao-20.md) | [PR #21](https://github.com/poyato70/azure-cost-local/pull/21) |
| 18 | Reconciliação da fundação UX sobre Tesseract 2.1 | 2026-11-18 | UX-01–04 reconciliadas; PR #19 aberta; CI Linux/Windows aprovada; PR #17 encerrada como substituída; merge humano pendente | [missao-18.md](missao-18.md) | [PR #19](https://github.com/poyato70/azure-cost-local/pull/19) |
| 17 | Release 2.1, instalação corporativa e avaliação de segurança | 2026-11-18 | Candidato RC em validação local; release estável bloqueada pelo gate de dependências | [missao-17.md](missao-17.md) | — |
|---|---|---|---|---|---|
| 16 | Estabilização da consulta FinOps real e usabilidade operacional | 2026-11-18 | UX local validada; PR #16 draft; CI Windows aprovado, Linux bloqueado por auditoria de dependência; sem merge | [missao-16.md](missao-16.md) | [PR #16](https://github.com/poyato70/azure-cost-local/pull/16) |
| 15 | Integração FinOps real, contratos de dados e confiabilidade financeira | 2026-11-16 | Integrada à `main` via PR #14 e CI Linux/Windows aprovada; validação real Azure pendente | [missao-15.md](missao-15.md) | [PR #14](https://github.com/poyato70/azure-cost-local/pull/14) |
| 17-UX | UX-06 abertura Tesseract e UX-07 observabilidade read-only | 2026-11-18 | Reconciliada sobre a main 2.1 (`84d5fe9`); validação local aprovada; [PR #20](https://github.com/poyato70/azure-cost-local/pull/20) aberta, CI Linux e Windows aprovadas | [missao-17-ux-06-07.md](missao-17-ux-06-07.md) | — |
| 14 | Correlação FinOps entre servidores MCP com proveniência verificável | 2026-11-16 | Integrada à `main` via PR #12; CI Linux/Windows aprovada | [missao-14.md](missao-14.md) | [PR #12](https://github.com/poyato70/azure-cost-local/pull/12) |
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
