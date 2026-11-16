# Missão 13 — Persistência e recuperação da orquestração MCP

## Identificação e estado

- Estado: implementação em validação; **não concluída e não publicada**.
- Data: 2026-11-16.
- Repositório: `poyato70/azure-cost-local`.
- Worktree: `D:\DEV\FinOps\Tesseract-missao-13`.
- Branch: `codex/missao-13-persistencia`.
- Commit-base observado: `28161501ed098eea455b556dcedfa2251c6409db` (`origin/main`).
- PR, commit da missão e CI remota: pendentes.
- Stash `codex-preserve-before-mission-13`: preservado, não aplicado nem removido.

## Acompanhamento

| Etapa | Estado | Evidência atual |
|---|---|---|
| Inspecionar worktree, implementação e reproduzir regressão M12 | Concluída | `git status`, diff, AGENTS.md, relatório anterior, testes e implementação inspecionados; regressão reproduzida. |
| Restaurar contrato público M12 | Concluída | Teste M12 passa com os eventos A enviado, A concluído, B aguardando autorização, B enviado e B concluído. |
| Integridade, concorrência e armazenamento | Parcial | Testes de lock, inicialização concorrente, reserva idempotente entre processos, colisão de argumentos, corrupção, schema e retenção passam. Falha real de disco não foi injetada. |
| Reinício e autorização | Parcial | E2E reinicia o processo com duas fixtures MCP e verifica estado concluído, pendente e chamada A indeterminada. `approval_required` não pode continuar; reautorização pós-reinício não existe. |
| Validação local completa | Concluída | Typecheck, build, audit, M12/store, suíte unitária completa e Playwright M10/M12 passaram após as alterações finais. |
| Revisão de segurança e relatório | Em andamento | Arquivo de histórico separado, filtragem por proprietário, sanitização e limite de resultado revisados; retenção de não terminais e durabilidade de diretório ainda exigem decisão/evidência. |
| Commit, PR, CI Linux/Windows e merge | Pendente | Gate de publicação retido pelos riscos de durabilidade, retenção e ausência de CI remota. |

- Progresso do plano: 3/7 etapas concluídas (43%); 3 estão parciais/em andamento e publicação permanece pendente.
- Tempo observado: primeiro registro de validação desta continuação às 05:22:58; última leitura às 09:54:39, aproximadamente 4h31m41s decorridos. O trabalho ainda continua.

## Compatibilidade M12

O contrato público da M12 espera a sequência de estágios `A, A, B, B, B`: chamada A enviada, A concluída, B aguardando aprovação, B enviada e B concluída.

Antes da correção, o teste observou seis eventos: A/indeterminate duas vezes, A/concluída, B/aguardando_autorização, B/indeterminate e B/concluída. A causa foi a transição de `running_a`/`running_b` para `indeterminate` dentro de cada mutação do armazenamento, em vez de somente na recuperação de inicialização. A transição foi movida para a recuperação; os eventos “enviada” são persistidos antes das chamadas externas. A assertion da M12 foi mantida.

O teste M12 usa duas fixtures Streamable HTTP e agora grava seu estado em diretório temporário, isolando-o do armazenamento normal do usuário.

## Armazenamento e autorização

- O histórico usa `orchestrations.json`, schema versão 1, arquivo temporário único, `sync()` do arquivo temporário e rename no mesmo diretório. A sincronização do diretório pai não está implementada; durabilidade contra perda abrupta de energia não está comprovada.
- Lock exclusivo usa `.lock`, token e PID, espera até 10 segundos, trata cabeçalho recém-criado ainda ilegível como inicialização e falha fechado quando o lock abandonado é antigo/inválido. O teste de encerramento abrupto confirma o lock remanescente e a recusa de lock abandonado. PID reutilizado pode manter uma execução antiga aparente como ativa; a recuperação prioriza não duplicar chamadas e pode exigir inspeção manual.
- Falhas de escrita do arquivo de dados são limpas quanto ao temporário, mas não houve injeção determinística de disco cheio, falha de rename ou perda de energia.
- Chaves idempotentes são reservadas sob lock entre processos e ligadas a fingerprint dos argumentos. Mesma chave/mesmos argumentos retornam a execução; mesma chave/argumentos diferentes retorna 409. A segunda instância lê estado persistido atualizado. Isso não oferece exactly-once no servidor MCP.
- Erros de transporte MCP e mudança de sessão/configuração após o envio passam a `indeterminate`. Resposta MCP explícita de falha e erros pré-chamada permanecem `failed`. Nenhum estado indeterminado é reenviado automaticamente; chamada humana com nova chave ainda pode duplicar efeito externo.
- Após restart, chamada em andamento vira `indeterminate`; aprovação B aguardando vira `approval_required`. O estado de aprovação pós-reinício é somente inspecionável; `confirm()` não o reenvia. Aprovação ainda pendente na sessão original revalida sessão, versão da conexão, schema e política antes da chamada.
- Proprietário é usuário autenticado ou sessão anônima. A listagem e consulta filtram por proprietário. Continuidade E2E com identidade Microsoft real não foi testada nem deve ser feita nesta missão sem credenciais/tenant. Sessões anônimas reiniciadas não recebem acesso à execução da sessão anterior.
- Resultados persistidos passam por `sanitizeEvidence`, limitados a 16 KiB; payloads de argumentos e credenciais não são persistidos. Estados indeterminados e não terminais são protegidos contra remoção pela retenção técnica. Isso pode ultrapassar o limite nominal e requer política de retenção aprovada.
- `publicView()` omite sessão, proprietário, chave idempotente, fingerprint, sessão de aprovação e PID; teste cobre a ausência desses metadados.

## Validações executadas até este marco

| Comando/cenário | Resultado observado | Limites |
|---|---|---|
| `npm ci --cache "$env:TEMP\\tesseract-m13-npm-cache"` | Concluído; 371 pacotes, 0 vulnerabilidades; lockfile não alterado. | npm informou scripts de `esbuild` e `koffi` não aprovados. Não foi alterada a política de scripts. |
| `npm run typecheck` | Passou após as alterações finais. | Verificação local. |
| `npm run build` | Passou após as alterações finais. | Build Next/TypeScript local. |
| `npm audit --audit-level=high` | Passou; 0 vulnerabilidades. | Executado sem instalar/atualizar dependências. |
| `npm test -- --run tests/mcp/orchestration-store.test.ts tests/mcp/mission12-orchestration.test.ts --reporter=dot` | Último resultado: 6 testes passaram. | Inclui reserva entre processos via stub de registry; E2E usa fixtures MCP reais. |
| `npm test -- --run --maxWorkers=1 --reporter=dot` | Passou após as alterações finais: 57 arquivos, 138 testes. | Serializado para evitar competição entre testes que iniciam subprocessos/serviços Windows. A primeira execução paralela teve timeouts; testes apontados passaram isoladamente. |
| `npx playwright test --config=playwright.m10.config.ts` | Passou após o build final: M10 e M12, 2/2. | M12 reinicia o processo real com duas fixtures HTTP; preserva estado concluído, converte aprovação pendente em `approval_required` e chamada A interrompida em `indeterminate`; contagem final A=3/B=1 não aumenta após o restart. Não comprova continuidade de owner autenticado via Microsoft. |
| `npm audit --audit-level=high` | 0 vulnerabilidades. | Resultado local apenas. |
| `git diff --check` | Passou após as alterações de código mais recentes. | Reexecutar após esta atualização documental. |

### Observação de dados locais

Uma versão inicial do teste de concorrência entre processos foi executada sem injetar o `OrchestrationStore` temporário e criou uma execução sintética no armazenamento padrão `LOCALAPPDATA\Tesseract\orchestrations.json`. O registro único foi identificado pelo owner `user:u`, chave `shared-key` e servidores de teste `A`/`B`. Como havia um serviço local ativo, a limpeza foi feita depois sob o lock do armazenamento: cópia integral anterior salva em `test-results/mission13-local-data-backup/orchestrations-before-targeted-cleanup.json`, removido somente o ID criado pelo teste e preservados os demais 131 registros. Os testes foram corrigidos para usar armazenamento temporário. Nenhum segredo foi observado no registro correspondente.

## Riscos e bloqueios para publicação

1. Validação local completa passou: typecheck, build, suíte unitária completa (138/138), Playwright (2/2), audit (0 vulnerabilidades) e diff check; CI remota ainda ausente.
2. A reautorização pós-reinício permanece deliberadamente bloqueada; não há endpoint seguro para continuar `approval_required`. A aprovação de operação externa exige decisão futura, sem reenvio automático.
3. Persistência não prova durabilidade de diretório contra falha de energia. Exigir decisão de plataforma/garantia antes de declarar integridade completa.
4. PID reutilizado pode retardar recuperação; locks abandonados falham fechado e precisam de inspeção manual. Não existe exactly-once externo.
5. Retenção não tem política aprovada e estados indeterminados/não terminais não são descartados automaticamente.
6. Não houve CI remota Linux/Windows, PR, commit ou merge. Nenhuma publicação será feita até revisão dos bloqueios e autorização compatível com o critério desta missão.

## Continuação — isolamento automático de testes (2026-11-16)

### Causa técnica e proteção

A lacuna era estrutural: `buildApp()` construía `ConfigStore` e `McpOrchestration` por padrão; o primeiro resolvia seu diretório a partir de `LOCALAPPDATA`, e o segundo montava diretamente `LOCALAPPDATA\Tesseract\orchestrations.json`. Testes que chamavam `buildApp()` sem injeção podiam, portanto, inicializar persistência na pasta do usuário. O contexto Vitest anterior não era convertido centralmente em diretório temporário, e o Playwright padrão reutilizava potencialmente um servidor ativo.

Foi introduzido `src/server/storage/data-directory.ts` como resolver/guard central para configuração e orquestração. O contexto de teste reconhece o marcador Tesseract e sinais Vitest/Jest/Playwright; exige diretório absoluto existente, canonicaliza caminhos reais, exige descendência do temp do sistema, rejeita interseção com raízes operacionais protegidas e falha em configuração ausente/malformada. Paths explícitos também passam pelo guard. Fora de testes, os paths de produção continuam resolvidos por `LOCALAPPDATA`/`XDG_DATA_HOME` conforme os defaults anteriores.

`vitest.config.ts` carrega `tests/test-isolation.setup.ts`, que cria sandbox exclusivo sob `%TEMP%\tesseract-vitest-*` por worker/arquivo, define marcadores e paths distintos de dados, `LOCALAPPDATA` e `XDG_DATA_HOME`, registra raízes protegidas e remove somente o sandbox próprio ao terminar. Os processos filhos criados pelos testes herdam esse ambiente; testes de subprocesso também passam ambiente explicitamente. `AppDeps` agora admite injeção opcional de `OrchestrationStore`; `OrchestrationStore()` sem arquivo em contexto de teste usa o sandbox central, e sem sandbox seguro falha antes de operação persistente.

M10/M12 recebem paths de teste explícitos; M12 reutiliza seu diretório isolado no reinício. O webServer Playwright padrão passou a iniciar por `scripts/playwright-server.mjs`, que cria seu próprio `%TEMP%\tesseract-playwright-server-*`, configura os marcadores antes de iniciar `dist/server/main.js` e remove apenas esse diretório ao encerrar. `reuseExistingServer` foi desativado para não conectar a um serviço do usuário. `outputDir` padrão agora é `test-results/playwright-default-output`, evitando que a limpeza automática do Playwright alcance outros artefatos irmãos em `test-results`.

### Testes e evidências desta continuação

| Verificação | Resultado atual | Evidência/limite |
|---|---|---|
| Isolamento focused + M12/M13 | Passou: 18 testes em 3 arquivos. | Inclui `buildApp()` sem storage injetado, `OrchestrationStore()` sem arquivo, inicializações simultâneas/repetidas, recusa de path operacional antes de I/O, processos sem sandbox, filho configurado e defaults de produção. |
| Suíte Vitest completa sem override manual | Passou: 58 arquivos, 150 testes; execução serial de 95,58 s. | Comando `npm test -- --run --maxWorkers=1 --reporter=dot`; nenhum `LOCALAPPDATA` foi definido pelo operador. O setup automático criou os sandboxes. |
| Typecheck | Passou. | Executado após as alterações finais. |
| Build | Passou. | Next compilou, gerou páginas e TypeScript concluiu. |
| Playwright M10/M12 | Passou: 2/2. | M10 e jornada M12 com duas fixtures MCP Streamable HTTP; M12 reinicia a aplicação real usando o mesmo diretório temporário isolado. |
| Playwright padrão | Passou: 1/1 dashboard. | Validou o launcher `scripts/playwright-server.mjs` e o servidor temporário; `outputDir` explicitamente separado. |
| `npm audit --audit-level=high` | Passou: 0 vulnerabilidades. | Nenhuma dependência instalada/atualizada. |
| `git diff --check` | Passou após a última atualização deste relatório. | Sem erros de whitespace. |

Os diretórios efetivamente definidos/verificados usam padrões `%TEMP%\tesseract-vitest-*\app-data`, `%TEMP%\tesseract-vitest-*\local-app-data`, `%TEMP%\tesseract-vitest-*\xdg-data`, `%TEMP%\tesseract-m10-e2e-*`, `%TEMP%\tesseract-m12-e2e-*` e `%TEMP%\tesseract-playwright-server-*`. As asserções confirmam a resolução sob esses diretórios; o bootstrap Vitest remove o sandbox de cada worker ao finalizar. O processo normal foi validado em subprocesso com os marcadores de teste removidos e `LOCALAPPDATA` temporário: os arquivos voltaram ao layout de produção sob esse caminho.

### Integridade dos dados operacionais e backup

O armazenamento operacional permaneceu intacto em todas as verificações: `LOCALAPPDATA\Tesseract\orchestrations.json` continuou com 30 bytes, conteúdo `{"schemaVersion":1,"flows":[]}`, SHA-256 `6C9B9DD26B7657A87733F60C0A6B1ECAFEBB123000C047823D2A0B398A393BD7` e timestamps inalterados (`2026-11-16T13:19:14.1475527Z`).

**Incidente de preservação:** no começo desta missão, o backup `test-results/mission13-local-data-backup/orchestrations-before-targeted-cleanup.json` existia (193.193 bytes, SHA-256 `5DC597DF1E03AB4C92E7EA348210ADD5E30B5C8A1675669AE62574C1F9592832`). Ao executar um teste com o `playwright.config.ts` sem `outputDir` explícito, o Playwright limpou seu diretório padrão `test-results`; o backup deixou de existir no caminho. Esta execução foi minha ação e contrariou a instrução de preservá-lo. Não recriei conteúdo, não copiei o armazenamento operacional para o lugar do backup e não encontrei cópia idêntica na busca realizada em `D:\DEV\FinOps`. `vssadmin` não permitiu consultar shadow copies sem privilégios administrativos. A configuração foi corrigida para direcionar a saída padrão a uma subpasta exclusiva, mas o backup original permanece não recuperado. A linha anterior deste relatório que dizia que o backup não foi alterado referia-se à rodada anterior e está supersedida por este registro.

### Estado, limites e pendências

- Proteção local contra gravações de teste no caminho operacional: demonstrada por guard de path, testes negativos sem arquivos e hash operacional antes/depois da suíte completa e E2E.
- Stash `codex-preserve-before-mission-13` permaneceu intacto. A impressão digital final do backup não pode ser comparada porque o arquivo desapareceu durante esta execução; este requisito não foi satisfeito.
- A origem histórica da criação do arquivo operacional vazio continua sem atribuição conclusiva. O mecanismo estrutural anterior permitia `buildApp()` usar o padrão, mas isso não prova qual execução criou aquele arquivo.
- Limites M13 não alterados: durabilidade do diretório após perda de energia não demonstrada; recuperação segura não oferece exactly-once externo; CI Linux/Windows e publicação não executadas.
- **Parecer: bloqueado.** A proteção técnica de testes passou as verificações, mas o critério de preservação do backup falhou nesta execução e o backup não foi recuperado. Não criar commit, PR ou merge.

## Alterações no worktree

## Continuação — validação local pendente (2026-11-16)

Esta seção substitui os números anteriores de validação para o estado de código atual; os resultados abaixo foram observados após a correção da resposta de retenção na UI.

### Resultado das verificações atuais

| Verificação | Resultado observado | Isolamento/limite |
|---|---|---|
| `npm test -- --run tests/mcp/orchestration-store.test.ts --reporter=dot` | Passou: 10 testes. Inclui reserva impedida por retenção, código esperado no serviço, preservação dos dois estados indeterminados e zero chamadas MCP. | Store em diretório temporário exclusivo pelo teste. |
| `npm run typecheck` | Passou. | Estado após mudanças de API/UI. |
| `npm run build` | Passou; Next compilou e TypeScript concluiu. | Build local, sem iniciar integrações MCP/Azure. |
| `npx playwright test --config=playwright.m10.config.ts` | Passou: 2/2 (M10 e M12). | M10/M12 usam diretórios temporários. M12 usa duas fixtures Streamable HTTP e reinicia o processo da aplicação; ambos os processos recebem `LOCALAPPDATA` temporário. A fixture MCP registra chamadas sintéticas e não usa o store da aplicação. |
| `npm audit --audit-level=high` | Passou: 0 vulnerabilidades. | Sem instalação ou atualização de dependências. |
| Suíte unitária `npm test -- --run --maxWorkers=1 --reporter=dot` | Passou: 57 arquivos, 143 testes. | Executada com `LOCALAPPDATA=%TEMP%\tesseract-m13-unit-<id>`; store observado sob esse diretório. Não foi executada com armazenamento operacional. |
| `git diff --check` | Passou após código e novamente após este relatório. | Sem erros de whitespace. |

### Retenção e retorno visível

O serviço rejeita a nova reserva com `AppError` de código `storage_retention_limit` e status 507 quando o limite é excedido por operações não terminais/indeterminadas. O teste focado demonstrou que a chamada MCP não começa e que registros existentes permanecem. A resposta HTTP conserva código e mensagem. `manageRequest` agora preserva status/código como `ManageRequestError`; a página apresenta falha explícita com o identificador `storage_retention_limit`, em vez de informar incorretamente que o resultado MCP é indeterminado. Erros sem resposta HTTP continuam tratados como resultado de transporte não confirmado.

Política técnica observada: registros `succeeded`/`failed` podem ser removidos após 30 dias e os mais antigos são removidos primeiro para manter o limite nominal de 500. Estados pendentes e `indeterminate` não expiram nem são removidos automaticamente. Quando estes ultrapassam o limite, gravações novas são recusadas; o histórico pode permanecer acima de 500 até revisão/arquivamento explícito. Isso evita descarte silencioso, mas mantém pendente o procedimento operacional autorizado de revisão/arquivamento.

### Armazenamento operacional e isolamento

O snapshot anterior citado na solicitação dizia que `LOCALAPPDATA\Tesseract\orchestrations.json` estava ausente. Na primeira inspeção desta continuação, antes das verificações, o arquivo já existia: 30 bytes, conteúdo `{"schemaVersion":1,"flows":[]}`, criado/alterado em `2026-11-16T13:19:14.1475527Z`; SHA-256 `6C9B9DD26B7657A87733F60C0A6B1ECAFEBB123000C047823D2A0B398A393BD7`. Portanto, a ausência do snapshot anterior não se confirmou no início desta rodada.

Registrei uma linha de base imediatamente antes dos comandos desta rodada. Depois do teste focado, build, Playwright, audit e suíte unitária isolada, hash, tamanho, criação e última gravação eram idênticos; o arquivo operacional não foi criado, alterado nem limpo por esses comandos. A suíte usou `LOCALAPPDATA` temporário; M10/M12 passaram `LOCALAPPDATA` temporário aos processos da aplicação, inclusive o processo reiniciado.

A origem exata da criação anterior não pode ser provada pelo arquivo vazio. Há, contudo, um caminho direto para contaminação local: `buildApp()` cria `McpOrchestration` com store padrão e chama `init()`; o caminho padrão usa `LOCALAPPDATA`. Testes em `tests/server/empty-json.test.ts`, `tests/server/auth.test.ts` e `tests/server/session.test.ts` chamam `buildApp()` sem injetar store. O horário de criação coincide com a janela relatada para a suíte executada anteriormente. Isso torna essa suíte a origem mais provável, mas não identifica qual teste/processo gravou o arquivo. A execução atual da suíte com override temporário passou e não alterou o armazenamento operacional. O caminho de teste, porém, não força isolamento por si só; uma execução local sem override ainda pode inicializar o arquivo padrão.

### Estado e decisão

- Validação local requerida nesta continuação: 6/6 itens concluídos (100%); suíte unitária adicional também passou. Tempo observado desta execução: aproximadamente 6 min 45 s, de 10:26:20 a 10:33:05 (-03:00), sem estimativa de tempo restante.
- Armazenamento operacional permaneceu byte a byte igual durante esta rodada; permaneceu presente porque já existia antes dela. Nenhum backup ou stash foi alterado.
- Limitações persistentes: sincronização do diretório pai e durabilidade contra perda de energia não demonstradas; `approval_required` após reinício permanece apenas inspecionável; lock abandonado pode exigir inspeção; não há exactly-once externo; CI Linux/Windows ainda não executada.
- **Parecer: bloqueado para revisão de publicação neste marco.** O hash operacional atual está preservado, mas a origem do arquivo que contradiz o snapshot inicial não é atribuível com certeza, e a suíte ainda tem chamadas `buildApp()` que usam o store operacional por padrão. A execução segura da suíte foi possível por override de ambiente, mas não corrigiu o risco de uma execução local sem esse override. Não houve publicação.

Nenhum commit, PR, merge ou operação de limpeza do armazenamento foi feito nesta continuação.

## Continuação — contenção da limpeza de backups (2026-11-16)

### Registro do incidente de perda

- **Backup original:** `test-results/mission13-local-data-backup/orchestrations-before-targeted-cleanup.json`.
- **Tamanho e SHA-256 registrados antes da perda:** 193.193 bytes; `5DC597DF1E03AB4C92E7EA348210ADD5E30B5C8A1675669AE62574C1F9592832`.
- **Comando que provocou a limpeza:** `npx playwright test --config=playwright.config.ts tests/e2e/dashboard.spec.ts --grep "opens Microsoft login"`.
- **Configuração que permitiu o alcance:** na execução, `playwright.config.ts` não definia `outputDir`; o Playwright usou seu diretório padrão `test-results` e limpou esse diretório antes do teste.
- **Diretório removido:** conteúdo de `test-results`, incluindo `test-results/mission13-local-data-backup`; o arquivo e seu diretório original não existem no caminho agora. A criação posterior de subpastas com nomes únicos em `test-results` não restaura esse conteúdo.
- **Responsabilidade:** a execução do comando acima foi feita por mim nesta missão e violou a instrução de preservar o backup.
- **Recuperação anterior documentada:** busca por cópia idêntica em `D:\DEV\FinOps` não localizou outra cópia; a consulta de shadow copies via `vssadmin` foi negada sem elevação. A recuperação permanece inconclusiva.
- **Esta continuação:** não repetiu busca de recuperação, não alterou permissões, não recriou o arquivo nem utilizou o armazenamento operacional como substituto.
- **Dados e impacto:** o artefato de backup com o snapshot anterior foi perdido do caminho conhecido. Relatórios anteriores descrevem que ele continha o snapshot integral anterior à remoção do registro sintético; como o arquivo não está disponível para nova inspeção, não é possível revalidar o conteúdo, a unicidade desses dados nem o impacto exato de eventual restauração. Não há evidência suficiente para declarar a informação recuperada ou quantificar perda além do artefato e da cópia ali registrada.

### Contenção implementada e destinos revisados

`scripts/test-path-safety.ts` centraliza criação de diretórios de saída exclusivos, validação e remoção segura:

- Normaliza caminhos absolutos e resolve ancestrais existentes com `realpath`; rejeita candidatos fora do sandbox, iguais à raiz, ou que coincidam/intersectem raízes protegidas.
- Protege `LOCALAPPDATA\Tesseract`, `LOCALAPPDATA\AzureCostLocal`, o diretório histórico do backup desta missão e raízes adicionais absolutas em `TESSERACT_TEST_PROTECTED_ROOTS`.
- Confere a raiz-base antes de criar diretórios. Rejeita raiz-base protegida, caminhos equivalentes após normalização, links/junctions usados como alvo e qualquer link/junction encontrado dentro de uma remoção recursiva.
- `safeRemoveTestDirectory` e `safeRemoveTestFile` validam o destino antes de `rmSync`/`unlinkSync`; os testes de recusa confirmam que o sentinela protegido continua presente.
- Os três configs Playwright definem `outputDir` em diretórios temporários exclusivos (`tesseract-playwright-default-*`, `tesseract-playwright-m07-*`, `tesseract-playwright-m10-*`). O launcher padrão agora usa `scripts/playwright-server.ts`, cria sandbox exclusivo e passa paths de teste explicitamente ao processo filho.
- M10/M12 gravam evidências em diretórios exclusivos `test-results/tesseract-m10-evidence-*` e `test-results/tesseract-m12-evidence-*`, que são irmãos do caminho protegido do backup. Seus processos de aplicação/fixtures usam diretórios temporários explícitos; a limpeza do sandbox passa pelo guard.
- Os demais alvos de limpeza em Vitest foram revisados: a remoção recursiva está centralizada no helper; remoções de arquivo avulsas usam `safeRemoveTestFile`. As referências de screenshot Playwright inspecionadas apontam para `testInfo.outputPath`, dentro do `outputDir` exclusivo. Scripts de serviço de produção não são usados para limpar os resultados das suítes.

### Testes negativos e validação

| Verificação | Resultado observado | Limite |
|---|---|---|
| Testes de proteção de paths | 8/8 passaram. Cobrem criação/remoção válida, raiz ancestral que contém backup sentinela, escape relativo, path absoluto protegido, alias normalizado, variação de caixa no Windows (condicional à plataforma), symlink/junction como destino/base e link aninhado. | Execução nesta máquina Windows; caso de caixa passou como parte dos 8. Links foram exercitados com junction/symlink temporários. |
| Testes focados M10/M12/storage/isolation | 5 arquivos, 28 testes passaram; inclui negativa de subprocesso e operação antes de arquivo, armazenamento e protocolos. | Um primeiro run paralelo excedeu o timeout padrão de 5 s no teste frio de subprocesso; isolado levou 3,4 s. Com base nessa medição, o teste recebeu limite de 15 s para startup sob carga. A nova rodada focada passou. |
| Typecheck | `npm run typecheck` passou. | Executado após corrigir o import `unlink` ausente em teste de falha. |
| Build | `npm run build` passou. | Build Next e TypeScript local; sem chamadas Azure. |
| Playwright M10/M12 | 2/2 passaram. M10 validou jornada com fixture MCP controlada; M12 validou A→B com servidores HTTP de fixture, reinício real da aplicação e persistência. | Fixtures locais/sintéticas, sem tenant ou credenciais corporativas. |
| Reexecução do comando do incidente | 1/1 passou: `npx playwright test --config=playwright.config.ts tests/e2e/dashboard.spec.ts --grep "opens Microsoft login"`. | Usa launcher TS isolado e `outputDir` único em `%TEMP%`; não limpa o diretório `test-results`. |
| `git diff --check` | Passou após a atualização deste registro. | Abrange alterações rastreadas; arquivos ainda não rastreados não aparecem no diff padrão. |

### Estado dos dados e limites residuais

Ao final das validações, `LOCALAPPDATA\Tesseract\orchestrations.json` continua com 30 bytes, criação e última gravação em `2026-11-16T13:19:14.1475527Z`, SHA-256 `6C9B9DD26B7657A87733F60C0A6B1ECAFEBB123000C047823D2A0B398A393BD7`, igual ao hash previamente registrado no relatório. Nesta rodada, a inspeção inicial e final confirmou presença, tamanho e timestamps; a captura legível do hash foi feita ao final. O arquivo original de backup continua ausente; não foi criado nem modificado por esta validação. O stash `codex-preserve-before-mission-13` continua listado como `stash@{0}`.

As proteções impedem os caminhos testados, mas não removem toda corrida TOCTOU entre a validação e a operação de filesystem; um processo local concorrente com capacidade de trocar paths no intervalo é risco residual. Backups arbitrários fora das raízes conhecidas precisam ser informados em `TESSERACT_TEST_PROTECTED_ROOTS`. Comportamentos de outros tipos de reparse point, volumes montados e sistemas de arquivos não exercitados não são garantidos por estes testes. O backup original permanece não recuperado.

### Parecer deste marco

**Incidente tecnicamente contido para os mecanismos e cenários de limpeza testados; backup não recuperado.** As configurações atuais não usam `test-results` como raiz de saída limpável, as recusas foram demonstradas em fixtures temporárias e o armazenamento operacional/stash permaneceram preservados. Isto não encerra a Missão 13: durabilidade física, CI remota/publicação e demais bloqueios arquiteturais já registrados permanecem pendentes. Nenhum commit, PR ou merge foi criado nesta etapa.

## Alterações no worktree

`src/server/mcp/orchestration-store.ts`, `src/server/mcp/orchestration.ts`, `src/server/mcp/registry.ts`, `src/server/app.ts`, `src/server/connections/routes.ts`, `src/web/pages/McpConnections.tsx`, `tests/mcp/orchestration-store.test.ts`, `tests/mcp/mission12-orchestration.test.ts`, `tests/e2e/mission-12-orchestration.spec.ts`, `tests/fixtures/mcp-mission12-pair.ts` e este relatório/índice. As alterações locais preexistentes foram mantidas. Nenhum commit ou push foi criado.

## Revisão final — validação, segurança e publicação controlada (2026-11-16)

### Reconciliação

- Worktree: D:\DEV\FinOps\Tesseract-missao-13; branch codex/missao-13-persistencia.
- HEAD/base: 28161501ed098eea455b556dcedfa2251c6409db, igual a origin/main na leitura remota por git ls-remote; a main remota não avançou durante esta revisão.
- Commits de missão locais: nenhum. Alterações M13 continuam no worktree; os arquivos modificados e não rastreados foram preservados.
- Stash codex-preserve-before-mission-13: continua em stash@{0}; nenhum comando de stash foi executado.
- CI: workflow .github/workflows/ci.yml define os checks obrigatórios Quality / Linux e PowerShell / Windows. Ainda não há execução remota desta branch porque a PR ainda não foi criada.

### Revisão de segurança e correções demonstradas

1. **Ownership:** a leitura do fluxo permitia acesso se o sessionId coincidisse, ainda que o ownerId atual fosse diferente, e recorria a um mapa global quando o registro não existia no store da instância. Como uma sessão pode mudar de principal, isso permitia cruzar ownership no mesmo cookie em determinadas transições. get() agora usa o store persistente da instância e exige correspondência exata do proprietário. Teste cobre owner diferente na mesma sessão, confirmação sem chamada MCP, store distinto vazio e leitura pelo mesmo proprietário em nova sessão.
2. **Persistência pós-chamada MCP:** falha de escrita depois de uma chamada externa podia ser classificada como failed, apesar de o resultado externo poder já existir. O fluxo agora persiste indeterminate quando falha de armazenamento ocorre após despacho MCP; teste injeta falha na gravação final, reinicia o serviço e confirma que a chave idempotente não provoca segunda chamada. Isso não declara exactly-once.
3. **Proteção de dados locais:** o helper de caminhos protege tanto LOCALAPPDATA quanto XDG_DATA_HOME, além de raízes explícitas. Teste confirma ambos os roots em fixture temporária.
4. **Configs E2E:** M10/M12 foram retirados do Playwright genérico porque usam porta, servidor e fixtures próprios, e permanecem executados em playwright.m10.config.ts. O teste ARM usa o nome acessível efetivo Escopo ARM; a asserção responsiva de 768 px agora respeita o breakpoint CSS observado em 900 px e ainda verifica a ordem vertical. Nenhuma expectativa de produto foi removida.

Sanitização, limites dos resultados persistidos, ausência de args de entrada no registro, exposição de campos internos em publicView, validação do schema, retenção, chamadas MCP e logs foram revisados no código. Resultados persistidos passam por sanitizeEvidence e limite nominal de 16 KiB; resultados excedentes são omitidos. Eventos registram estados/detalhes operacionais, não argumentos ou payloads financeiros. O armazenamento é JSON local sem ACL explicitamente aplicada pelo OrchestrationStore; na plataforma Windows depende das permissões herdadas do diretório de perfil. Não foi feita auditoria de ACL no tenant ou em outras contas do host.

### Limites avaliados

Os limites abaixo seguem declarados e não foram convertidos em garantias:

- **Durabilidade:** arquivo temporário sincronizado antes do rename; sincronização do diretório pai e persistência física após perda de energia não demonstradas.
- **Locks:** lock com PID/token, recusa fail-closed e concorrência testada; PID reutilizado pode produzir timeout e lock inválido pode exigir inspeção manual.
- **Recuperação/autorização:** approval_required recuperado é somente consultável; confirmação antiga não é reutilizada. Não há reautorização automática.
- **Resultado externo:** estado indeterminate não é reenviado. Não existe exactly-once para operações MCP fora do processo.
- **Retenção:** 500 registros nominais/30 dias para terminais; estados pendentes/indeterminados não são descartados automaticamente. Ao atingir capacidade protegida, nova reserva é recusada com erro visível. O histórico pode exceder o teto devido a registros que não podem ser excluídos automaticamente.
- **Filesystem:** caminhos canônicos, roots protegidos, diretórios exclusivos e links/junctions testados; permanece uma corrida TOCTOU e roots arbitrários precisam ser configurados. Outros reparse points/volumes não foram testados.

Esses limites foram classificados como **LIMITADOS**, não como garantias completas. Para esta aplicação local, os comportamentos implementados falham fechados e não executam automaticamente chamadas externas recuperadas; nenhum defeito crítico conhecido ficou sem contenção. Isso é uma avaliação técnica desta revisão, não uma aceitação pelo usuário da perda do backup ou de impactos desconhecidos.

### Validação local no estado revisto

Todos os diretórios de teste/Playwright foram exclusivos sob %TEMP% ou subdiretórios com nome exclusivo em test-results; nenhuma execução limpou test-results como raiz. Aplicações e fixtures MCP M10/M12 receberam caminhos de dados temporários explícitos. Nenhuma credencial corporativa, tenant, chamada Azure ou servidor MCP externo foi usado.

| Comando/verificação | Resultado observado |
|---|---|
| npm test -- --run --reporter=dot | Passou: 59 arquivos, 161 testes; isolamento automático, sem configuração manual de LOCALAPPDATA. |
| Testes de test-path-safety | Passou: 9/9, incluindo paths absolutos/relativos/normalizados, ancestry protegida, XDG, case Windows e links/junctions em fixture. |
| Testes focados de store/M12/isolation | Passaram; cobrem falhas create/write/sync/rename, corrupção/schema, lock abandonado, concorrência entre processos, reserva idempotente, ownership, reinício, retenção e falha persistente após resposta MCP. |
| npx playwright test --config=playwright.config.ts | Passou: 39/39. |
| npx playwright test --config=playwright.m07.config.ts | Passou: 4/4. |
| npx playwright test --config=playwright.m10.config.ts | Passou: 2/2. M10 usa fixture MCP controlada; M12 usa duas fixtures HTTP, aplicação reiniciada e armazenamento isolado. |
| npm run typecheck | Passou após as correções finais. |
| npm run build | Passou após as correções finais. |
| npm audit --audit-level=high | Passou: 0 vulnerabilidades conhecidas no resultado da auditoria. |
| git diff --check | Passou após a atualização deste relatório; arquivos não rastreados foram verificados adicionalmente quanto a whitespace. |

Uma primeira execução completa do Playwright genérico antes do alinhamento dos specs terminou em 38/41: dois testes tinham contrato de acessibilidade/breakpoint desatualizado e M10 executou sob a porta genérica apesar de exigir config dedicado. Depois das correções documentadas acima, a execução genérica final passou 39/39, e os configs dedicados passaram separadamente.

### Armazenamento, backup e decisão de perda

Fingerprint final conhecido de LOCALAPPDATA\Tesseract\orchestrations.json: 30 bytes, SHA-256 6C9B9DD26B7657A87733F60C0A6B1ECAFEBB123000C047823D2A0B398A393BD7, criação/última gravação 2026-11-16T13:19:14.1475527Z, igual ao fingerprint anteriormente registrado. Todos os processos de teste usaram roots explícitos/automáticos temporários. O stash permaneceu listado e não foi alterado.

O backup original test-results/mission13-local-data-backup/orchestrations-before-targeted-cleanup.json continua ausente. Seu tamanho e hash anteriores constam no registro do incidente. As tentativas de recuperação anteriores não confirmaram outra cópia; esta missão não repetiu buscas no volume, não alterou permissões, não produziu uma cópia substituta e não declara recuperação. **A aceitação da perda não foi presumida nem registrada como decisão do usuário; impacto material desconhecido permanece pendente.**

### Publicação

Etapas da missão para este marco: **5/7 (71%) concluídas**; a revisão/decisão local e a publicação/CI remota permanecem em andamento. Tempo medido até o fim da validação local: **19 min 51 s**, de 12:29:35 a 12:49:26 (-03:00); não inclui CI e publicação posteriores.

**Parecer local: apto a abrir PR e executar CI remota.** Os critérios locais foram demonstrados; limites conhecidos estão documentados e não há execução automática após estado indeterminado ou aprovação recuperada. A PR e os checks remotos Linux/Windows ainda precisam ser criados/observados antes de decidir merge. Não declarar a Missão 13 concluída antes do merge e da confirmação do SHA remoto.

## Addendum de segurança — decisão após inspeção ACL (2026-11-16, 12:52 -03:00)

Este achado posterior **substitui o parecer local anterior de “apto a abrir PR”**. A validação automatizada continua aprovada, mas o gate de segurança da publicação está bloqueado.

### Evidência read-only

Foi lida a ACL efetiva de LOCALAPPDATA\Tesseract e de orchestrations.json, sem alterar permissões. Tanto o diretório quanto o arquivo concedem direitos herdados Modify, Synchronize a:

- uma outra conta local da máquina;
- um grupo adicional não identificado na classificação sanitizada da inspeção.

As ACEs foram encontradas nos ancestrais LocalAppData e AppData e aparecem como herdadas no diretório Tesseract e no arquivo JSON. Também aparecem CurrentUser, SYSTEM e Administrators com FullControl herdado. Os nomes e SIDs dos demais principais foram deliberadamente omitidos do relatório; o resultado preserva sua classificação sem expor identidades pessoais.

Modify no arquivo permite leitura e alteração do histórico; Modify nos diretórios também permite manipular arquivos e locks. A autorização por owner dentro da API não protege o JSON contra essas identidades locais. O OrchestrationStore não aplica uma ACL própria, e o histórico contém resultados financeiros estruturados. A inspeção não fez leitura de outros dados nem tentou acesso por outra conta.

### Decisão de publicação

**BLOQUEADO.** Não criei commit, branch remota ou PR e não iniciei CI remota. A mudança de permissões ou uma migração para armazenamento com ACL explícita alteraria a segurança do armazenamento operacional; instruções anteriores vedam essa alteração sem autorização. Nenhuma permissão foi modificada. O próximo passo requer autorização explícita para corrigir a ACL do armazenamento com escopo definido e validar a preservação dos dados.

O backup perdido continua não recuperado e a aceitação da perda não foi presumida. O stash permanece em stash@{0}; o fingerprint final conhecido do armazenamento operacional segue igual ao anteriormente registrado. Nada foi limpo ou sobrescrito por esta revisão.

Progresso atualizado: **5/7 etapas (71%) concluídas**; etapa de decisão/publicação bloqueada por ACL; merge e CI remota não executados. Tempo medido até esta decisão: **23 min 20 s**, de 12:29:35 a 12:52:55 (-03:00). A Missão 13 permanece aberta.

## Addendum de segurança — ACL corrigida e revalidação local (2026-11-16, 13:10 -03:00)

Este registro substitui o bloqueio de ACL acima, que descrevia corretamente a evidência disponível naquele momento. Após autorização explícita do usuário para correção localizada, a DACL foi protegida somente em `%LOCALAPPDATA%\Tesseract` e `orchestrations.json`. A identidade efetiva do serviço foi investigada antes da mudança: não foi encontrado serviço Windows Tesseract nem processo Node associado ao worktree M13; a identidade do processo atual é a conta do usuário. Não foi necessário interromper serviço ativo.

Nos dois objetos-alvo a herança foi desabilitada e ficaram três ACEs Allow explícitas: usuário atual, `SYSTEM` e `Administrators`, cada uma com FullControl. A ACL está marcada como protegida. As ACLs dos ancestrais `AppData` e `LocalAppData` não foram alteradas. Após a correção, foram novamente observados tamanho de 30 bytes e SHA-256 `6C9B9DD26B7657A87733F60C0A6B1ECAFEBB123000C047823D2A0B398A393BD7`; não há evidência de mudança no conteúdo operacional pela correção ou pelos testes. Essa configuração local protege a instância examinada, mas não é parte versionada do produto nem prova configuração equivalente em outros hosts.

### Revalidação posterior à correção

| Verificação | Resultado observado |
|---|---|
| `npm test -- --run --reporter=dot` | 59 arquivos e 161 testes passaram. Dois testes de subprocesso, inicialmente acima do timeout padrão durante execução concorrente, foram medidos isoladamente em 3,585 s e 4,036 s; o limite desses testes frios foi ajustado para 15 s e a suíte completa passou, sem remover assertions. |
| `npm run typecheck` | Passou após as mudanças finais de código. |
| `npm run build` | Passou após as mudanças finais de código. |
| `npm audit --audit-level=high` | Passou; zero vulnerabilidades reportadas nesse nível pela auditoria executada. |
| `npx playwright test --config=playwright.config.ts` | 39/39 passaram. |
| `npx playwright test --config=playwright.m07.config.ts` | 4/4 passaram após a correção da ACL. |
| `npx playwright test --config=playwright.m10.config.ts` | 2/2 passaram após a correção: M10 com fixture MCP controlada e M12 com duas fixtures HTTP, reinício real da aplicação e persistência. |
| `git diff --check` | Passou após a atualização do relatório e do índice; a verificação pré-commit também será registrada. |

Os testes e builds são locais; não acessaram tenant corporativo, credenciais, Azure ou servidores MCP externos. O estado observado permanece em `codex/missao-13-persistencia`, HEAD/base `28161501ed098eea455b556dcedfa2251c6409db`, sem commits locais. `origin/main` ainda apontava para esse mesmo SHA na última consulta. O stash `codex-preserve-before-mission-13` continua em `stash@{0}`. O backup original continua ausente e não recuperado; sua perda e a incerteza de impacto permanecem registradas, sem presumir aceitação pelo usuário.

### Decisão atual

**Apto para revisão de publicação e abertura de PR, condicionado à revisão final do diff e à aprovação remota.** O bloqueio de ACL foi remediado no host e as validações locais foram repetidas; a recuperação do backup não é critério técnico para publicação e não é declarada. Durabilidade física, sincronização de diretório, execução exactly-once externa, reautorização após reinício e corrida TOCTOU continuam como limitações documentadas, sem evidência de risco crítico não contido no escopo exercitado. CI Linux/Windows ainda não foi executada e nenhum commit, push, PR ou merge foi feito até este registro.

Tempo decorrido medido desde 12:29:35 até a captura de 13:09:58 (-03:00): **40 min 23 s**. O progresso permanece **5/7 (71%)** até a PR e CI remota serem concluídas; não se estima tempo restante.

## Publicação controlada — PR aberta e CI em execução (2026-11-16, 13:13:02 -03:00)

Commit 17cff1267226f8b309ae67b5b7b42e8e47798640 foi publicado na branch codex/missao-13-persistencia; Pull Request [#10](https://github.com/poyato70/azure-cost-local/pull/10) está aberta contra main. Na consulta de 13:13:02 (-03:00), os checks obrigatórios Quality / Linux e PowerShell / Windows estavam IN_PROGRESS, associados ao commit acima. Nenhum merge foi feito. O resultado remoto ainda não pode ser declarado aprovado; a integração permanece condicionada à conclusão bem-sucedida de ambos os checks.

O progresso permanece **6/7 etapas (86%) concluídas**: estado reconciliado, correções/revisão técnica, validações locais e PR publicada; CI e integração ainda pendentes. Tempo decorrido desde 12:29:35 até 13:13:02 (-03:00): 43 min 27 s.

## Encerramento da implementação — PR #10 integrada (2026-11-16, 13:17:03 -03:00)

**Resultado da publicação:** Pull Request [#10](https://github.com/poyato70/azure-cost-local/pull/10) foi integrada por squash após aprovação dos checks obrigatórios no commit de PR 1db27cec0088ae4b6a92a9d15529c84706def1a4:

- Quality / Linux: **SUCCESS**, execução [43905067356](https://github.com/poyato70/azure-cost-local/actions/runs/43905067356/job/133431730129), 54 s; typecheck, build, Vitest e audit passaram.
- PowerShell / Windows: **SUCCESS**, execução [43905067356](https://github.com/poyato70/azure-cost-local/actions/runs/43905067356/job/133431728823), 2 min 13 s; build, parse dos scripts, testes Windows e jornada Playwright MCP passaram.
- Merge confirmado em origin/main: 37ee64380a97564a7256661ac2ce32bd7f394e6a, às 13:16:13 -03:00. A branch principal remota apontou para esse SHA na verificação posterior.

A validação local completa foi executada antes da publicação e está detalhada neste relatório; os checks remotos cobriram o workflow CI existente. Nenhuma proteção de branch foi contornada, nenhum force push foi usado. O stash codex-preserve-before-mission-13 permanece intacto. O armazenamento operacional continuou com 30 bytes e SHA-256 6C9B9DD26B7657A87733F60C0A6B1ECAFEBB123000C047823D2A0B398A393BD7; a ACL corrigida localmente permanece restrita ao usuário atual, SYSTEM e Administrators, sem alterar ACLs ancestrais.

O backup original continua ausente e **não foi recuperado**; nenhuma aceitação da perda foi presumida. As limitações de durabilidade física, exatamente-uma-vez externo, retomada de aprovação e corrida TOCTOU continuam válidas conforme seções anteriores. O merge conclui a implementação M13 e sua publicação; não altera o estado do incidente do backup.

Progresso: **7/7 etapas (100%)** da implementação/publicação concluídas. Tempo medido de 12:29:35 a 13:17:03 (-03:00): 47 min 28 s.
