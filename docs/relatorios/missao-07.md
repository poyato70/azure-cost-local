# Relatório da Missão 07 — Tesseract 2.0

**Data do relatório:** 2026-11-15 13:57 -03:00
**Status:** concluída, publicada e integrada à `main`
**Repositório:** `poyato70/azure-cost-local`
**PR:** https://github.com/poyato70/azure-cost-local/pull/2
**Commit de merge:** `a7507a1493471e6e975b04ebb4feefe91dd96155`
**Branch de trabalho:** `codex/missao-07-corporate-fixes`
**Referência inicial:** Missão 06, `50ebeb2afbd720f4c4342809aba846ae93ca4b41`

## Resumo executivo

A Missão 07 corrigiu o ciclo de vida do serviço no Windows, a rejeição indevida de requisições locais via `127.0.0.1`, o diagnóstico de erros Microsoft Entra, a validação do formulário Azure OpenAI Usage e os estados de interação da interface. O instalador foi validado com o registry e TLS estrito configurados no ambiente, sem mudar proxy, registry, certificados ou políticas corporativas.

As alterações foram implementadas em clone separado, validadas e integradas à `main` por PR. O checkout de trabalho original `checkout local anterior` manteve suas alterações locais.

## Causas confirmadas

1. **Origin local:** o servidor aceitava Host de `localhost` e `127.0.0.1`, mas comparava Origin apenas com o valor canônico `localhost`. Um POST com Origin `127.0.0.1` era recusado.
2. **Health check do serviço:** `/api/health` retornava `{ "ok": true }`; o novo gerenciador esperava outro formato e não reconhecia a instância correta. O endpoint agora também identifica `app: "Tesseract 2.0"` e o gerenciador verifica esse contrato.
3. **Ciclo de vida e wrappers:** o PID compartilhado podia conflitar entre checkouts; os scripts precisavam diferenciar PID obsoleto, processo alheio e processo não verificável. Os wrappers legados também usavam array splatting incompatível com a chamada nomeada no PowerShell.
4. **AADSTS650052:** o erro é uma condição de disponibilidade/configuração do recurso no tenant, não uma concessão de RBAC feita pelo Tesseract. O contexto da execução corporativa e seus anexos não estavam disponíveis neste checkout para confirmação de um tenant específico.
5. **Azure OpenAI Usage:** o campo não orientava suficientemente o formato esperado e não extraía com segurança o Resource ID de uma URL reconhecida do Portal Azure; datas precisavam de validação explícita para período UTC com fim exclusivo.
6. **npm:** a auditoria identificou vulnerabilidade baixa e corrigível em `esbuild`; o lockfile foi atualizado para `0.27.2`, e a auditoria passou a reportar zero vulnerabilidades.

## Correções implementadas

- `service.ps1` centraliza start/status/stop com PID e logs por checkout, detecção de porta, validação da linha de comando, remoção controlada de metadado obsoleto, timeout configurável e preservação do processo quando o health check falha.
- `install.ps1` verifica Node/npm, registry, TLS, conectividade e gravação; respeita as configurações existentes e testa o carregamento de `koffi` sem aprovar scripts automaticamente.
- `start.ps1`, `stop.ps1`, `status.ps1` e wrappers em `scripts/` delegam corretamente para o gerenciador.
- O servidor aceita somente os Origins locais `localhost` e `127.0.0.1` na porta configurada; Host e CSRF continuam validados.
- Erros AADSTS650052 apresentam tenant, recurso, application ID e IDs de correlação disponíveis, sem tokens; a orientação administrativa cobre service principal, `MCP.Access` e consentimento. Nenhuma mudança de tenant, identidade, política, service principal ou consentimento é automática.
- O formulário Azure OpenAI Usage aceita Resource ID completo ou URL HTTPS reconhecida do `portal.azure.com`, rejeita outros hosts/rotas, valida datas reais e limite de 30 dias, e não consulta campos inválidos.
- Fluxos de autorização mostram loading, desabilitam ações concorrentes e deixam claro que não trocam a identidade automaticamente. Botões e campos receberam estados/foco acessíveis.
- Documentação de instalação, operação e AADSTS650052 atualizada.

## Validação executada

| Verificação | Resultado |
|---|---|
| `npm ci` limpo | Passou; instalou 371 pacotes; aviso de depreciação de `node-domexception` e scripts não aprovados pelo npm 11 registrados. |
| Carregamento nativo `require('koffi')` | Passou sem aprovar scripts. |
| `npm audit` | 0 vulnerabilidades após correção do lockfile. |
| `npm run build` | Passou, incluindo compilação Next.js e TypeScript. Aviso de rastreamento do Next.js não foi reproduzido. |
| `npm run typecheck` | Passou. |
| Vitest | 52 arquivos e 124 testes passaram, incluindo Origin/CSRF, OAuth, Azure Usage e ciclo de vida PowerShell. |
| Playwright / Microsoft Edge | 4 testes passaram: MCP clarity, MCP laboratory e fluxo Azure OpenAI Usage com loading, validação e foco. |
| Serviço real isolado | Start/status/stop passaram na porta 14317, usando dados locais temporários isolados. |
| POST real com Origin `http://127.0.0.1:14317` | HTTP 200 com sessão e token CSRF válidos. |
| Parser PowerShell | Todos os scripts de instalação, serviço, start/status/stop/update e wrappers analisaram sem erros. |
| `git diff --check` | Passou. |
| Inspeção visual | Captura temporária revisada na execução original; arquivo bruto permanece fora do Git. |

Os avisos `NO_COLOR`/`FORCE_COLOR` emitidos pelo harness Playwright foram ambientais e não impediram os testes. A instalação preservou as políticas da máquina.

## Limitações e pendências externas

- Os anexos/logs da execução corporativa em `checkout corporativo citado na fonte` não estavam acessíveis no ambiente da missão; nenhum dado corporativo foi copiado para o repositório.
- Não houve autenticação real em Microsoft Entra ou no ARM MCP. O acesso efetivo depende do tenant: um administrador deve verificar a disponibilidade/service principal do ARM MCP, a permissão delegada `MCP.Access` e o consentimento exigido pela organização.
- RBAC das subscriptions é uma autorização separada. A correção do Tesseract melhora o diagnóstico, mas não remove bloqueios impostos pelo tenant.

## Publicação

PR #2 foi integrado à `main`, sem force push. O GitHub não tinha branch protection nem checks configurados para a `main`; as validações locais descritas acima passaram antes do merge.

- PR: https://github.com/poyato70/azure-cost-local/pull/2
- Commit de merge confirmado no remoto: `a7507a1493471e6e975b04ebb4feefe91dd96155`
- Horário do registro do commit: `2026-11-15 13:51:52 -03:00`

**Último registro confirmado:** 2026-11-15 13:51:52 -03:00 — merge commit `a7507a1493471e6e975b04ebb4feefe91dd96155`.
