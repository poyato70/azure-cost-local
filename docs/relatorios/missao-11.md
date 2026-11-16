# Missão 11 — GitHub Actions, CI, segurança e qualidade contínua

## Identificação

- **Estado:** Concluída; PR #6 integrada à `main` e proteção de branch ativa.
- **Início:** 2026-11-16 00:39:38 -03:00.
- **Último registro:** 2026-11-16 01:46:57 -03:00.
- **Conclusão:** 2026-11-16 01:46:09 -03:00.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/missao-11-ci`.
- **Commit inicial:** `3977d1813944148c3c09876e128ae6412b374f3a` (`origin/main`).
- **Commit de implementação:** `371fb970fc68b4d4788f46df12629bf1d70b5ab1`.
- **PR:** [#6](https://github.com/poyato70/azure-cost-local/pull/6), integrada no commit `0dade49038b6d6542b6fe9281eab6193e3cefb7e`.

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
| 8. Commit, push e abrir PR                    | Concluída            | `4aad757`, `ceeedf6`, `ec94279`, `371fb97` / PR #6; revisão final de documentação.                           |
| 9. Validar CI GitHub e resolver falhas        | Concluída            | Run #43805732153: Linux e Windows aprovados no SHA final `b75d97a`, incluindo E2E MCP/axe.                   |
| 10. Proteger `main`, integrar e confirmar SHA | Concluída            | Checks obrigatórios configurados; PR #6 integrada e SHA `0dade490...` confirmado em `origin/main`.          |

- **Progresso do plano:** 10/10 etapas (100%; percentual de etapas concluídas).
- **Tempo efetivamente decorrido:** 1 h 7 min 19 s, de 00:39:38 a 01:46:57 -03:00.
- **Bloqueios:** nenhum.

## Implementação

- `.github/workflows/ci.yml`: PR/push/manual; permissões mínimas; concorrência cancela apenas runs de PR; Ubuntu 24.04 com npm ci, typecheck, produção, testes Vitest aplicáveis e audit high+; Windows 2025 com build, parser PowerShell, testes DPAPI/de serviço e jornada Playwright/axe via Chromium. Jobs têm timeout; artefatos de falha limitados a XML JUnit, traces e screenshots, retenção de 7 dias.
- Ações externas fixadas a SHAs completos: checkout v7.0.1, setup-node v7.1.0 e upload-artifact v6.0.0.
- `@axe-core/playwright` 4.11.0 e axe-core adicionados como dependência de desenvolvimento. Playwright alinhado com `@playwright/test` em 1.64.1 e `playwright-core` override para evitar tipos de versões distintas.
- `playwright.m10.config.ts` usa Chromium empacotado no CI e mantém Edge no modo local Windows.
- `tests/e2e/mission-10-mcp.spec.ts` valida axe no estado vazio e após resultado MCP; continua cobrindo servidor MCP Streamable HTTP real, autorização e resposta.
- `app/theme.css`: link de revisão ganhou cor ciano de contraste e sublinhado após o scan inicial detectar contraste 1,49:1 e ausência de indicador além da cor.
- `tests/server/service-scripts.test.ts`: evita uma segunda invocação PowerShell de parada após encerramento já confirmado.
- README e índice de relatórios documentam jobs e reprodução local.

## Validação local observada

| Verificação                         | Resultado                    | Evidência/limitação                                                                                                                                                                       |
| ----------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch/base/remote                  | Aprovado                     | `codex/missao-11-ci` baseada no SHA `3977d181...`, remoto `origin` GitHub esperado.                                                                                                       |
| `npm run typecheck`                 | Aprovado                     | Executado após alinhar versões Playwright.                                                                                                                                                |
| `npm run build`                     | Aprovado                     | Build Next otimizado e TypeScript servidor; estático `/` e `/_not-found`.                                                                                                                 |
| Suíte Vitest                        | Aprovado                     | 55 arquivos, 132 testes; duração 49,52 s. Inclui protocolo SDK MCP stdio real e testes registry/HTTP.                                                                                     |
| Windows service tests baseline      | Aprovado, lento              | 3/3; 45,07 s no conjunto, cenário timeout 16,288 s; repetição 43,70 s, timeout 16,240 s.                                                                                                  |
| Windows service tests após correção | Aprovado                     | 3/3 em 43,96 s; ciclo de vida 22,552 s, busy-port 3,970 s, timeout 16,371 s. O cenário crítico não ficou mais rápido; job serial/escopo focal reduz concorrência, não mascara limite.     |
| E2E MCP + axe                       | Aprovado                     | 1 teste, 28,1 s (11,7 s do caso); Chromium local. Fixture Streamable HTTP MCP real, jornada com resultado e erro, atividade, desconexão. axe sem violações nos estados vazio e resultado. |
| Responsividade e teclado            | Aprovado                     | O E2E mede 390×844, 768×1024 e 1280×720 sem overflow horizontal; movimento reduzido e foco por Tab validados.                                                                             |
| `npm audit --audit-level=high`      | Aprovado                     | 0 vulnerabilidades total (info, low, moderate, high, critical).                                                                                                                           |
| `git diff --check`                  | Aprovado                     | Sem erros de whitespace no diff local.                                                                                                                                                    |
| Parser workflow YAML                | Não executado                | Não havia actionlint/cmdlet YAML disponível no host; validação autoritativa pendente no Actions remoto.                                                                                   |
| GitHub Actions remoto               | Aprovado na run #43805732153 | Linux 55 s e Windows 2m45s; ambos os jobs passaram no SHA final antes do merge.                                                                                                         |
| Proteção `main`                     | Aprovado                     | API confirmou checks `Quality / Linux`, `PowerShell / Windows`, strict=true, enforce_admins=true e allow_force_pushes=false.                                                               |

### Investigação do teste Windows

As falhas remotas foram diagnosticadas: no runner, TEMP usa caminho curto (`C:\Users\RUNNER~1\...`), enquanto `service.ps1` resolve `$PSScriptRoot` para caminho canônico antes de calcular o hash do checkout. A fixture calculava o hash sem `realpath()`, por isso lia metadados em outra pasta; isso explica o campo ausente e arquivo não encontrado sem apontar erro no serviço ou flutuação. A fixture agora canonicaliza com `realpath()`. Três testes de serviço e três DPAPI passaram localmente com `pwsh` (53,73 s). O workflow usa execução serial e não eleva timeout de produto; a nova run remota confirmará a correção.

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
- Branch protection configurada após execução verde: checks `Quality / Linux` e `PowerShell / Windows` exigidos, enforcement administrativo ativo, force-push e exclusão desativados.

## Publicação

- **Commits/PR:** `4aad757`, `ceeedf6`, `ec94279`, `371fb97`, `b75d97a`; [PR #6 integrada](https://github.com/poyato70/azure-cost-local/pull/6).
- **Checks remotos:** [Run #43805732153 aprovada](https://github.com/poyato70/azure-cost-local/actions/runs/43805732153); Linux 129 testes, Windows 6 testes DPAPI/serviço e jornada MCP/axe.
- **Integração/commit remoto:** `0dade49038b6d6542b6fe9281eab6193e3cefb7e`, confirmado em `origin/main`.
- **Última verificação de segurança de segredo:** busca direcionada no diff, sem padrões de credenciais; `git diff --check` aprovado.

## Último registro

2026-11-16 01:46:57 -03:00 — CI #43805732153 aprovada no SHA final: Linux (129 testes, typecheck, build, audit) 55 s; Windows (build, parser, 6 testes e Playwright MCP/axe) 2m45s. Proteção exige `Quality / Linux` e `PowerShell / Windows`, enforcement administrativo ativo e force-push desabilitado. PR #6 integrada; merge SHA `0dade49038b6d6542b6fe9281eab6193e3cefb7e` confirmado em `origin/main`.
