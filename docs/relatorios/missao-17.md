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
| 1. Confirmar estado, PR #16 e grafo de dependências | Concluída | Worktrees/HEAD confirmados; PR #16 ainda draft; advisory primário consultado e retirada confirmada |
| 2. Preflight, instalação, versão e scripts de manutenção | Concluída localmente | Pré-flight, instalação e atualização revisados; testes PowerShell/unitários aprovados; sem alterar configuração corporativa |
| 3. Documentação e validação local | Concluída parcialmente | Typecheck, build, Vitest serial, Playwright, SBOM, diff-check e auditoria local atuais aprovados; preflight de rede bloqueado por DNS; instalação limpa em estação corporativa não demonstrada |
| 4. PR, CI, tag e release 2.1.0 | Em andamento, sem promoção | Auditoria atual passou após retirada do advisory; PR #16 não integrada; CI remota atual e instalação corporativa ainda precisam ser observadas |

- **Progresso do plano:** 2 de 4 etapas concluídas (50%); etapa 3 parcial; etapa 4 em andamento sem promoção.
- **Tempo decorrido:** a medição anterior era 4 h 50 min (10:34–15:24, -03:00). Esta continuação começou após esse marco; tempo adicional será registrado ao concluir, sem previsão restante.

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
| `git diff --check` | Aprovado | Sem whitespace error após revisão final |

## PR, CI e publicação

- A [PR #16](https://github.com/poyato70/azure-cost-local/pull/16) continua draft. A última execução remota registrada anteriormente tinha Quality/Linux bloqueado pelo advisory e Windows aprovado. O advisory foi retirado depois; essa execução remota é histórica e ainda precisa ser revalidada na CI.
- Branch M17 deriva da cabeça da PR #16 e ainda não está na `main`. A CI remota para M17 não foi executada.
- Até este marco não havia commit, push ou PR M17. Nenhum merge, tag ou GitHub Release foi feito. A publicação de uma PR draft da M17 é preparação para revisão e não aprova a versão.
- A integração sequencial da PR #16 e o rebase/preparação da 2.1 sobre a `main` atual continuam necessários. Ainda faltam CI remota atual aprovada, validação de instalação em estação corporativa e decisão humana sobre a limitação de proxy dos conectores `fetchBound`.

## Parecer e pendências

**A auditoria local deixou de bloquear após a retirada oficial do advisory**, sem mudança de dependências. A preparação para release estável continua bloqueada: PR #16 permanece draft e não integrada; o preflight não alcançou registry por DNS; proxy-only não cobre o transporte Undici que protege endpoints contra SSRF; instalação e rede corporativa não foram comprovadas em estação gerenciada; CI remota atual ainda não foi observada.

Próximos passos necessários: atualizar/revalidar a CI da PR #16 e obter aprovação humana para sua integração; redesenhar ou delimitar proxy para `fetchBound` preservando segurança SSRF; repetir instalação/preflight numa estação corporativa autorizada; então rebasear M17 sobre `main`, validar CI Linux/Windows e somente depois considerar merge, tag e release.

As integrações condicionais com Linear, Notion e e-mail não foram executadas porque a missão não alcançou sucesso integral/publicação. Nenhuma comunicação externa foi enviada.
