# Missão 17 — Release 2.1, instalação corporativa e validação de segurança

## Identificação

- **Estado:** Preparação local de candidato RC; release estável bloqueada.
- **Início observado:** 2026-11-18 10:34 -03:00.
- **Última atualização observada:** 2026-11-18 15:24 -03:00.
- **Tempo decorrido medido:** 4 h 50 min.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/missao-17-corporate-release`.
- **HEAD inicial:** `00c598f1143df3327896e58802415e9f4478b250`.
- **Base:** branch da PR #16 (`codex/missao-16-finops-ux`), commit `00c598f`; não baseada na `main` atualizada.
- **Checkout principal preservado:** `D:\DEV\FinOps\Tesseract`, `main`, seis alterações staged; não tocado.
- **Worktree M16 preservado:** `D:\DEV\FinOps\Tesseract-missao-16`, branch `codex/missao-16-finops-ux`.
- **Stash M13:** `codex-preserve-before-mission-13` preservado e não aplicado.
- **PR #16:** continua draft; página consultada mostra Linux bloqueado pelo audit e Windows aprovado, sem merge.
- **Porta operacional 4317:** nenhum serviço M17 foi iniciado nela.
- **Armazenamento operacional:** não foi lido, inicializado, recuperado, migrado ou alterado. O pré-flight observou apenas a existência do diretório, sem ler conteúdo.

## Objetivo e limite

Preparar o Tesseract 2.1 para avaliação Windows corporativa, com pré-flight sanitizado, scripts de instalação/atualização, identificação de versão, testes e documentação. A tarefa não foi concluída integralmente: o gate de segurança continua falhando e a rede do ambiente não resolve os registries. Não houve consulta Azure, alteração de credenciais/permissões, tag, release ou merge.

## Plano e acompanhamento

| Etapa | Estado | Evidência |
|---|---|---|
| 1. Confirmar estado, PR #16 e grafo de dependências | Concluída | Worktrees/HEAD confirmados; PR #16 draft; advisory primário retirado e auditoria atual sem alertas |
| 2. Preflight, instalação, versão e scripts de manutenção | Concluída localmente | Pré-flight, instalação e atualização revisados; testes PowerShell/unitários aprovados; sem alterar configuração corporativa |
| 3. Documentação e validação local | Concluída parcialmente | Typecheck, build, Vitest serial, Playwright, SBOM, diff-check e auditoria local aprovados; preflight de rede bloqueado por DNS; instalação limpa em estação corporativa não demonstrada |
| 4. PR, CI, tag e release 2.1.0 | Parcial | Commit e branch publicados; PR #18 draft empilhada sobre PR #16; CI Linux/Windows aprovada; sem merge/tag/release por gates corporativos e revisão pendentes |

- **Progresso do plano:** 2 de 4 etapas concluídas integralmente (50%); etapas 3 e 4 parciais. A preparação de PR/CI foi concluída, mas não a avaliação corporativa nem a promoção.
- **Tempo decorrido:** medição anterior da missão: 4 h 50 min (10:34–15:24, -03:00). Nesta continuação, o acompanhamento da CI mediu 3 min 10 s, de 18:34:07 a 18:37:17 UTC. Não há estimativa de tempo restante.

## Implementação local

- `package.json` e `package-lock.json`: candidato `2.1.0-rc.1`; requisito Node declarado para 22.21+ na linha 22 ou 24.6+ na linha 24 e npm 9+.
- `src/shared/version.ts`, `src/server/app.ts`, `src/web/App.tsx`: versão única exibida na interface e incluída em `/api/health`; preserva `app: "Tesseract 2.0"` para compatibilidade dos scripts existentes.
- `service.ps1`: passa `NODE_USE_ENV_PROXY=1` ao processo de serviço somente quando a variável não foi definida; restaura o ambiente do processo chamador.
- `preflight.ps1`, `scripts/preflight-core.psm1`: verificações sanitizadas de plataforma, Node/npm, políticas, TLS, registry, conectividade, capacidade local, porta e componente nativo; exportação sem sobrescrever arquivos. `-SkipAzureEndpointChecks` evita qualquer probe Azure nesta avaliação; falha de DNS em endpoint opcional vira aviso, mas falha do registry requerido bloqueia instalação.
- `install.ps1`: executa o pré-flight, impede reinstalar sob serviço do checkout ativo, usa `npm ci`, constrói e confere os artefatos; não instala MCPs nem aprova scripts nativos.
- `update.ps1`: exige `main` limpa e fast-forward, recusa serviço ativo, valida build em worktree temporária e recompila após atualizar.
- CI: passa a analisar scripts `.ps1`/`.psm1` e executar teste sanitizado do pré-flight no Windows.
- README, CHANGELOG e avaliação corporativa documentam instalação, arquitetura, fluxos, destinos de rede, persistência, limitações e o bloqueio atual.

## Segurança, dependências e rede

### Auditoria e SBOM

- Auditorias atualizadas em 18/11/2026: `npm audit --audit-level=high` e `npm audit --omit=dev --audit-level=high` **aprovadas**, ambas exit 0 e com zero vulnerabilidades reportadas.
- A página do [advisory GitHub GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) foi atualizada em 18/11/2026 e declara explicitamente que o advisory foi retirado. A razão publicada aponta o parecer no repositório upstream picomatch; não há patch de dependência neste trabalho.
- A árvore local ainda resolve `picomatch@4.0.7`, mas a auditoria npm atual não sinaliza vulnerabilidade. Não executei `npm audit fix`, não alterei exceções nem removi o gate. A CI remota precisa confirmar o resultado no commit publicado.
- `npm sbom --sbom-format=cyclonedx`: **aprovado**; CycloneDX 1.5 com 374 componentes e 11 identificadores/expressões de licença, sem componente sem metadado de licença no SBOM. Isso não substitui revisão legal das licenças.
- SBOM local ignorado pelo Git: `test-results/mission-17/tesseract-2.1-rc1.cdx.json`.

### Proxy e TLS

- Node v24.20.0 reconhece `--use-env-proxy`; o pré-flight confirmou a opção e a faixa mínima. A documentação oficial classifica o suporte incorporado a proxy como **Active Development**, então requer validação na rede corporativa.
- O serviço preserva `NODE_USE_ENV_PROXY=0` explícito. Teste PowerShell executa a expressão usada pelo serviço para confirmar tanto o opt-out quanto o padrão `1`.
- **Limitação relevante:** clientes construídos sobre `fetch`/HTTP global podem usar o proxy configurado. Já os conectores via `fetchBound` utilizam `undici.Agent` dedicado com validação e pinning DNS para reduzir SSRF; esse dispatcher não consome `HTTP_PROXY`/`HTTPS_PROXY`. Forçar proxy nesse caminho exige desenho que preserve o pinning e proteção contra DNS rebinding. Não afirmar compatibilidade com redes proxy-only para MCPs HTTP, modelos/agentes, Hub e endpoints customizados.
- Nenhum proxy, CA, TLS, ExecutionPolicy ou permissão corporativa foi alterado. Nenhum certificado foi instalado.

### Pré-flight real desta estação

- Comando: `pwsh.exe -NoProfile -File .\preflight.ps1 -Port 4318 -NetworkTimeoutSeconds 2 -SkipAzureEndpointChecks -ExportReport`.
- **Aprovados:** Windows 64-bit, PowerShell 7.6.9, Node v24.20.0, suporte CLI de proxy, npm 11.19.0, npx/Git, TLS estrito, política RemoteSigned, escrita no checkout, espaço em disco, porta 4318 livre e carregamento de `koffi`.
- **Bloqueados:** resolução DNS/conectividade do registry npm, único bloqueio de rede obrigatório para instalação; o MCP Registry opcional falhou por DNS e ficou como aviso. Nenhum `Authorization` foi enviado. A falha não comprova falha Azure ou de autenticação.
- **Omitidos de propósito:** endpoints Azure; nenhum tenant ou credencial foi consultado.
- **Relatório sanitizado:** `test-results/mission-17/tesseract-preflight-2026-11-18_15-20-15.txt`. Reporta apenas presença do diretório operacional; não inspeciona ACL nem conteúdo.
- **Limite:** rede corporativa, proxy, CA de inspeção e acesso do Node/Undici a endpoints não puderam ser validados nesta máquina.

## Instalação, operação e migração

- `npm ci` foi executado no worktree isolado no início da missão com o lockfile então presente; sem atualização de dependências. O npm alertou que scripts nativos não estavam aprovados por allowlist; o teste de carregamento de `koffi` passou.
- A instalação ponta a ponta via `install.ps1` não foi declarada validada nesta rodada: o pré-flight atual termina antes de `npm ci` por DNS de registry. Não foi feita instalação limpa numa estação gerenciada.
- Playwright e testes de serviço usaram fixtures e `LOCALAPPDATA` temporário; nenhum teste foi direcionado ao armazenamento operacional.
- A suíte cobriu start/status/stop, porta ocupada, timeout de health, DPAPI em fixture, isolamento e journeys com servidores MCP reais controlados. Não foi executado `update.ps1` contra `main`, pois requer clone `main` limpa e fetch remoto; sua validação nesta missão foi revisão e parsing.
- DPAPI permanece por usuário/estação; credenciais não foram transferidas. Migração operacional/histórico não foi executada.

## Validações realmente executadas

| Comando/procedimento | Resultado | Evidência e limites |
|---|---|---|
| `npm run typecheck` | Aprovado | Executado no worktree M17 |
| `npm run build` | Aprovado | Next produção e compilação TypeScript; gerou `dist/server/main.js`, `dist/web/index.html` e arquivos estáticos |
| `npx vitest run` (workers padrão) | Reprovado por timeout sob concorrência | 194 passaram; três timeouts em subprocessos `tsx` frios nos testes de isolamento |
| `npx vitest run tests/storage/data-directory-isolation.test.ts --pool=forks --maxWorkers=1` | Aprovado | 7/7; sem alterar timeouts |
| `npx vitest run --pool=forks --maxWorkers=1` | Aprovado | 66 arquivos, 197/197 testes. A execução serial final passou inclusive subprocessos M12/M13 e scripts Windows |
| `npx playwright test --config=playwright.m10.config.ts --reporter=list` com `CI=true` | Aprovado | 3/3 journeys: M10, M12 A→B e M14; Chromium e fixtures MCP reais, execução total 1,4 min |
| Parser PowerShell | Aprovado | parser PowerShell em 12 scripts/módulos; os testes também executaram lifecycle de start/status/stop |
| `npm audit --audit-level=high` (18/11/2026, após retirada do advisory) | Aprovado | Exit 0; zero vulnerabilidades reportadas |
| `npm audit --omit=dev --audit-level=high` (18/11/2026) | Aprovado | Exit 0; zero vulnerabilidades reportadas |
| `npm sbom --sbom-format=cyclonedx` | Aprovado | SBOM gerado em `test-results/mission-17/`; fora do Git |
| Pré-flight com `-SkipAzureEndpointChecks` | Bloqueado parcialmente | DNS registry npm bloqueado, MCP Registry opcional em aviso; Azure não acessado |
| `git diff --check` | Aprovado | Sem whitespace error antes do commit M17 e após a atualização de evidências |
| CI M17 no commit `6b6f83e` — workflow dispatch #44371113566 | Aprovado | Linux e Windows; build, typecheck, unit/protocol, audit, testes PowerShell, jornadas Playwright e accessibility concluíram com sucesso. PR #18 tem base M16 e o workflow não dispara automaticamente para essa base, por isso foi executado manualmente na branch M17 |
| CI PR #16, tentativa 2 do run #44314448772 | Aprovado | Linux e Windows concluídos com sucesso após retirada do advisory; PR continua draft e aguarda validações/revisão já registradas |

## PR, CI e publicação

- A [PR #16](https://github.com/poyato70/azure-cost-local/pull/16) continua draft. Após a retirada do advisory, a tentativa 2 do run #44314448772 passou em Linux e Windows. O usuário apresentou capturas de uma consulta manual de Azure Cost Management com status `complete` e linhas de dados para o período selecionado; esta missão não repetiu a chamada nem copiou valores financeiros. Revisão humana e validação do bundle operacional continuam pendentes.
- Commit M17 `6b6f83ed07f6be0d864376db8d2594180e16972f` foi enviado à branch `codex/missao-17-corporate-release`.
- A [PR #18](https://github.com/poyato70/azure-cost-local/pull/18) foi aberta em draft, base `codex/missao-16-finops-ux`, head M17. O workflow `CI` seleciona PRs com base `main`, então a execução #44371113566 foi disparada por `workflow_dispatch` no commit acima; Linux e Windows passaram. A CI executada é evidência do commit M17, porém não aparece como check de PR enquanto a base for M16.
- Nenhum merge, tag ou GitHub Release foi feito. A PR draft prepara revisão técnica e não aprova a versão estável.
- A integração sequencial da PR #16 e o rebase/preparação da 2.1 sobre a `main` atual continuam necessários. Ainda faltam checks associados à PR #18 após retarget/rebase para `main`, validação de instalação em estação corporativa e decisão humana sobre a limitação de proxy dos conectores `fetchBound`.

## Parecer e pendências

**O bloqueio de auditoria foi resolvido por retirada oficial do advisory**, sem mudança de dependências, e CI Linux/Windows passou nos commits M16 e M17. O usuário informou sucesso no teste manual da consulta Azure e apresentou capturas da resposta. A preparação para release estável segue bloqueada: PRs #16 e #18 permanecem draft; preflight não alcançou registry por DNS; proxy-only não cobre o transporte Undici que protege endpoints contra SSRF; instalação e rede corporativa não foram comprovadas em estação gerenciada; o bundle operacional e a revisão humana ainda estão pendentes.

Próximos passos necessários: validação humana do bundle operacional e aprovação para integrar a PR #16; decidir como tratar proxy para `fetchBound` mantendo segurança SSRF; repetir pré-flight/instalação em estação corporativa autorizada; após merge M16, rebasear M17 sobre `main`, confirmar checks de PR Linux/Windows e revisão, e somente então considerar merge, tag e release.

## Registros solicitados após push

- Linear: criada a issue [ARG-24 — Tesseract 2.1 RC e gates corporativos](https://linear.app/arg-2/issue/ARG-24/tesseract-21-rc-conclusao-m17-e-gates-de-avaliacao-corporativa), em `In Progress`, no projeto Tesseract. O workspace correspondente à conexão ativa foi usado; a outra conexão Linear disponível exigia reautenticação.
- Notion: criada e relida a página privada draft [Tesseract 2.1 — visão técnico-executiva](https://app.notion.com/p/41caeac1fa1d8190a6f0c7c437b36395?pvs=204), com diagrama de papéis/fluxo e limites de avaliação.
- E-mail enviado para `poyato@bb.com.br`, com status do push, PRs e resultados Linear/Notion, seguido da cópia integral do texto da página do Notion. A mensagem enviada foi relida para confirmar corpo e destinatário.


## Atualização de integração — 18/11/2026

- A PR #16 foi integrada à `main` no commit `0fa1c7b0f4b72bce261ad339312be6f3b8dbcd63`, após os checks `Quality / Linux` e `PowerShell / Windows` aprovados no HEAD `00c598f1143df3327896e58802415e9f4478b250`.
- A PR #18 foi redirecionada para `main` e permanece em draft. A execução CI previamente aprovada da M17 refere-se ao commit `6b6f83ed07f6be0d864376db8d2594180e16972f`, não ao HEAD posterior da PR. A integração depende de checks atuais e revisão.
- A limitação de compatibilidade proxy-only nos conectores `fetchBound`, a instalação em estação corporativa e a aprovação institucional permanecem pendentes; nenhuma dessas lacunas foi validada por este registro documental.
