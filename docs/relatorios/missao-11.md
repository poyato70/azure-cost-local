# Missão 11 — GitHub Actions, CI, segurança e qualidade contínua

## Identificação

- **Estado:** Em execução; primeira run remota falhou com causas identificadas e correções locais validadas; segunda run pendente.
- **Início:** 2026-11-16 00:39:38 -03:00.
- **Último registro:** 2026-11-16 01:00:45 -03:00.
- **Conclusão:** Pendente.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/missao-11-ci`.
- **Commit inicial:** `3977d1813944148c3c09876e128ae6412b374f3a` (`origin/main`).
- **Commit de implementação:** Pendente.
- **PR / integração:** Pendente.

## Objetivo e escopo

Adicionar CI reproduzível em PRs para `main`, pushes na `main` e acionamento manual, com execução Linux de typecheck, build, testes, auditoria npm e jornada MCP real no navegador; job Windows focal para PowerShell/scripts de serviço; scanner automatizado axe nos estados cobertos pelo E2E. Sem credenciais externas, sem deploy e sem alterações a políticas corporativas.

## Plano e progresso

| Etapa                                         | Estado               | Evidência                                                                                                    |
| --------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1. Confirmar repositório e iniciar relatório  | Concluída            | Branch isolada em `origin/main`; outros checkouts/alterações foram preservados.                              |
| 2. Medir baseline e auditar dependências      | Concluída            | Teste Windows isolado repetido; `npm audit` sem vulnerabilidades; SDK e fixtures existentes examinados.      |
| 3. Implementar workflow Linux/Windows         | Concluída localmente | `.github/workflows/ci.yml`, permissões `contents: read`, concorrência, limites e artefatos reduzidos.        |
| 4. Habilitar Chromium CI e axe                | Concluída            | E2E usa Chromium sob CI; axe em estado vazio e resultado.                                                    |
| 5. Investigar timeout Windows                 | Concluída localmente | Duração medida antes/depois; job dedicado serial e remoção da parada duplicada.                              |
| 6. Rodar validações locais                    | Concluída            | Typecheck, build, 129 testes Linux aplicáveis, 6 testes Windows específicos e E2E passaram; npm audit limpo. |
| 7. Revisar segurança e documentação           | Concluída localmente | README, este relatório e índice atualizados; `git diff --check` limpo.                                       |
| 8. Commit, push e abrir PR                    | Concluída            | `4aad757` / PR #6; revisão subsequente em andamento.                                                         |
| 9. Validar CI GitHub e resolver falhas        | Em andamento         | Primeira run #43802384035 falhou; correções submetidas, aguardando segunda run.                              |
| 10. Proteger `main`, integrar e confirmar SHA | Pendente             | Branch sem proteção preexistente; requer CI aprovada e permissão administrativa.                             |

- **Progresso do plano:** 8/10 etapas (80%; percentual de etapas, não previsão de duração).
- **Tempo medido no último registro:** ~21 min desde 00:39:38 -03:00.
- **Bloqueios:** nenhum de implementação. Proteção de branch ainda sem configuração; permissão efetiva será verificada.

## Implementação

- `.github/workflows/ci.yml`: PR/push/manual; permissões mínimas; concorrência cancela apenas runs de PR; Ubuntu 24.04 com npm ci, typecheck, produção, Vitest, audit high+, Chromium/Playwright; Windows 2025 com parse PowerShell e teste direcionado serial. Jobs têm timeout; artefatos de falha limitados a XML JUnit e saída de Playwright, retenção de 7 dias.
- Ações externas fixadas a SHAs completos: checkout v7.0.1, setup-node v7.1.0 e upload-artifact v6.0.0.
- `@axe-core/playwright` 4.11.0 e axe-core adicionados como dependência de desenvolvimento. Playwright alinhado com `@playwright/test` em 1.64.1 e `playwright-core` override para evitar tipos de versões distintas.
- `playwright.m10.config.ts` usa Chromium empacotado no CI e mantém Edge no modo local Windows.
- `tests/e2e/mission-10-mcp.spec.ts` valida axe no estado vazio e após resultado MCP; continua cobrindo servidor MCP Streamable HTTP real, autorização e resposta.
- `app/theme.css`: link de revisão ganhou cor ciano de contraste e sublinhado após o scan inicial detectar contraste 1,49:1 e ausência de indicador além da cor.
- `tests/server/service-scripts.test.ts`: evita uma segunda invocação PowerShell de parada após encerramento já confirmado.
- README e índice de relatórios documentam jobs e reprodução local.

## Validação local observada

| Verificação                         | Resultado                        | Evidência/limitação                                                                                                                                                                       |
| ----------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch/base/remote                  | Aprovado                         | `codex/missao-11-ci` baseada no SHA `3977d181...`, remoto `origin` GitHub esperado.                                                                                                       |
| `npm run typecheck`                 | Aprovado                         | Executado após alinhar versões Playwright.                                                                                                                                                |
| `npm run build`                     | Aprovado                         | Build Next otimizado e TypeScript servidor; estático `/` e `/_not-found`.                                                                                                                 |
| Suíte Vitest                        | Aprovado                         | 55 arquivos, 132 testes; duração 49,52 s. Inclui protocolo SDK MCP stdio real e testes registry/HTTP.                                                                                     |
| Windows service tests baseline      | Aprovado, lento                  | 3/3; 45,07 s no conjunto, cenário timeout 16,288 s; repetição 43,70 s, timeout 16,240 s.                                                                                                  |
| Windows service tests após correção | Aprovado                         | 3/3 em 43,96 s; ciclo de vida 22,552 s, busy-port 3,970 s, timeout 16,371 s. O cenário crítico não ficou mais rápido; job serial/escopo focal reduz concorrência, não mascara limite.     |
| E2E MCP + axe                       | Aprovado                         | 1 teste, 28,1 s (11,7 s do caso); Chromium local. Fixture Streamable HTTP MCP real, jornada com resultado e erro, atividade, desconexão. axe sem violações nos estados vazio e resultado. |
| Responsividade e teclado            | Aprovado                         | O E2E mede 390×844, 768×1024 e 1280×720 sem overflow horizontal; movimento reduzido e foco por Tab validados.                                                                             |
| `npm audit --audit-level=high`      | Aprovado                         | 0 vulnerabilidades total (info, low, moderate, high, critical).                                                                                                                           |
| `git diff --check`                  | Aprovado                         | Sem erros de whitespace no diff local.                                                                                                                                                    |
| Parser workflow YAML                | Não executado                    | Não havia actionlint/cmdlet YAML disponível no host; validação autoritativa pendente no Actions remoto.                                                                                   |
| GitHub Actions remoto               | Reprovado na 1a run; 2a pendente | Run #43802384035 diagnosticada; correções aguardam nova execução.                                                                                                                         |
| Proteção `main`                     | Pendente                         | API indicou branch sem proteção e regrasets vazios antes desta mudança.                                                                                                                   |

### Investigação do teste Windows

O teste passou localmente tanto em Windows PowerShell 5.1 quanto em PowerShell 7.6.9. A primeira CI usou Windows PowerShell 5.1 e falhou em duas verificações (campo de log ausente na desserialização usada pelo teste e metadado não encontrado depois de health timeout). Em CI, o teste agora seleciona `pwsh`; os três testes de serviço e três testes DPAPI passaram localmente com esse host. A run remota ainda precisa confirmar a correção. Três medições do arquivo (45,07 s, 43,70 s, 43,96 s) confirmaram custo elevado de operações PowerShell; o caso “preserves a live process...” durou 16,24–16,37 s em todas as execuções. A primeira operação de ciclo de vida é que variou ~22,55–24,42 s. Portanto, não se aumentou timeout nem se declarou a falha como preexistente; ajustou-se a limpeza redundante e CI executa o arquivo serialmente com 20 min de limite de job. O host explícito `pwsh` passou o conjunto Windows específico local; o gate remoto é que confirmará comportamento sob runner Windows.

### Incidente de instalação local

Uma tentativa de `npm ci` simultânea às validações falhou com `EPERM` ao remover binário nativo `lightningcss` em uso, deixando `node_modules` incompleto. Não foi interrompido processo; `npm install --ignore-scripts --prefer-offline` restaurou os módulos em aproximadamente 2 min e as validações passaram depois disso. `npm ci` será validado no ambiente limpo do GitHub Actions. Scripts nativos não foram aprovados por política local.

## Reprodução local

```powershell
npm ci
npm run typecheck
npm run build
npx vitest run
npx playwright install chromium
$env:CI = 'true'
npx playwright test --config=playwright.m10.config.ts
npm audit --audit-level=high
```

No Windows, reproduza o gate de serviço com:

```powershell
npx vitest run tests/server/service-scripts.test.ts --pool=forks --maxWorkers=1 --reporter=verbose
```

Fixture MCP do E2E: `tests/fixtures/mcp-mission10-server.ts`. Não usa credenciais externas, opera dados temporários e implementa Streamable HTTP via SDK do projeto. Os testes Vitest de protocolo também exercitam servidor MCP SDK por stdio.

## Segurança, artefatos e limites

- Não existem secrets configurados/requeridos no workflow; nenhum token é escrito em log.
- Workflow tem apenas `contents: read`; ações pinadas por SHA; não usa `pull_request_target`.
- Artefatos são enviados apenas em falha e excluem logs da aplicação/fixture; permanecem 7 dias.
- `npm audit --audit-level=high` bloqueia high/critical e baseline não reportou advisories.
- axe cobre os estados vazio e resultado dentro da jornada MCP. Não é declaração de conformidade WCAG nem substitui teste manual completo.
- Linux validou 129 testes aplicáveis (53 arquivos); três operações dependentes de DPAPI são específicas de Windows. O job Windows validou esses três casos e os três testes de serviço, sem duplicar a suíte total.
- Branch protection ainda não habilitada: confirmar depois dos nomes dos checks reais e permissões do owner.

## Publicação

- **Commit/PR:** `4aad757`; [PR #6](https://github.com/poyato70/azure-cost-local/pull/6).
- **Checks remotos:** Run inicial #43802384035 falhou nos jobs Linux/Windows; correções enviadas, segunda run pendente.
- **Integração/commit remoto:** Pendente.
- **Última verificação de segurança de segredo:** busca direcionada no diff, sem padrões de credenciais; `git diff --check` aprovado.

## Último registro

2026-11-16 01:19:10 -03:00 — primeira CI real falhou e foi diagnosticada; Linux/Windows repartidos conforme dependência DPAPI; PowerShell 7 validado com 6/6 testes; aguardando segunda run. Build/typecheck, E2E/axe, 129 testes Linux, audit e diff passam localmente.
