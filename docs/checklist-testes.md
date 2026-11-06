# Checklist de testes — Azure Cost Local

Elaborado em 06/11/2026 a partir do código, testes e guias do projeto. Este documento é um roteiro de execução: nenhum item está aprovado por antecipação. Testes automatizados com dados sintéticos não comprovam login, permissões ou valores financeiros reais.

## Registro da rodada

| Campo | Preencher |
|---|---|
| Data, responsável e notebook | |
| Commit (`git rev-parse HEAD`) | |
| Windows, Node, npm, Edge e Copilot CLI | |
| Ambiente e acesso utilizado (nome; sem credenciais) | |
| Subscription/RG de teste | |
| Período, moeda e base real/amortizada | |
| Evidências e defeitos encontrados | |

Marque `[x]` somente após conferir o resultado esperado. Para cada item registre **Passou / Falhou / Bloqueado / Não se aplica**, evidência e motivo. Um requisito necessário bloqueado continua pendente; não equivale a aprovação. Redija evidências sem Secrets, tokens, senhas, URLs OAuth ou dados corporativos desnecessários.

**Prioridades:** P0 = bloqueia o aceite do uso básico; P1 = obrigatório para a funcionalidade escolhida; P2 = melhoria/compatibilidade. Execute primeiro 1–4, depois os módulos utilizados. Para uso somente por APIs, módulos MCP/Hub/chat podem ser não aplicáveis, com justificativa.

## 1. Instalação, serviço e persistência — P0

- [ ] **INF-01 — Dependências:** confirmar Node 24, npm, Git, PowerShell e Edge; `npm ci` termina sem erro. Usar o usuário Windows que operará a aplicação.
- [ ] **INF-02 — Compilação:** executar os comandos da seção 2; tipos e build terminam sem erro. Registrar avisos separadamente.
- [ ] **INF-03 — Serviço local:** executar `pwsh -File .\scripts\start.ps1`; abrir `http://localhost:4317`; `/api/health` retorna `ok: true`.
- [ ] **INF-04 — Reinício:** parar e iniciar pelos scripts; aplicação volta a abrir, cadastros permanecem e é possível reconectar o acesso. Sessões em memória podem precisar de novo login.
- [ ] **INF-05 — Sem dados inventados:** abrir sem autenticação; não aparecem gastos demonstrativos como dados reais.
- [ ] **INF-06 — Uma instância:** conferir que não há outra instância usando 4317 antes de iniciar. Se houver conflito, registrar falha sem encerrar processos desconhecidos.

## 2. Verificações automatizadas — P0

Na pasta do projeto, execute cada comando e confira seu resultado antes de seguir:

```powershell
git rev-parse HEAD
node --version
npm --version
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

- [ ] **AUT-01 — Serviço:** todos os testes Vitest passam; registrar quantidade real e falhas, sem assumir números de rodadas anteriores.
- [ ] **AUT-02 — Navegador:** todos os testes Playwright/Edge passam. Executar após build; se já houver serviço em 4317, assegurar que ele executa o mesmo commit. A configuração reutiliza o serviço existente fora de CI.
- [ ] **AUT-03 — Limite da evidência:** registrar que testes de login, Azure e modelos usam simulações/fixtures onde indicado; não classificá-los como integração real.

Mapa de cobertura existente: `tests/server` e `tests/connections` (sessão/acessos); `tests/costs`, `tests/forecast`, `tests/budgets`, `tests/benefits` (serviços); `tests/mcp`, `tests/security` (protocolo/políticas); `tests/hubs` (Hub/conciliação); `tests/chat`, `tests/agents` (chat); `tests/diagnostics` (diagnóstico); `tests/e2e` (interface).

## 3. Acessos e autenticação reais — P0

- [ ] **AUTH-01 — Cadastro:** criar acesso com nome, Tenant ID e Client ID; salvar, recarregar e conferir os identificadores.
- [ ] **AUTH-02 — Usuário:** clicar Conectar usuário; Microsoft abre em popup/janela separada; concluir login/MFA; dashboard reconhece o acesso. A aplicação não solicita a senha Microsoft em formulário próprio.
- [ ] **AUTH-03 — Cancelamento:** cancelar ou fechar o popup; não aparecer sucesso falso; uma nova tentativa funciona.
- [ ] **AUTH-04 — Retorno Entra:** confirmar `http://localhost:4317/api/auth/callback` no registro autorizado. Se ocorrer AADSTS50011, nonce/state inválido ou consentimento ausente, registrar código e mensagem segura; não reaproveitar callback antigo.
- [ ] **AUTH-05 — Aplicação/Secret:** em acesso de teste autorizado, cadastrar Secret Value; Testar Secret e Conectar aplicação obtêm credencial sem login de usuário. Mensagens ficam abaixo dos botões do acesso correspondente.
- [ ] **AUTH-06 — Secret inválido:** testar com um cadastro exclusivo de teste; mostrar falha clara sem expor a credencial. Não substituir Secret de acesso em uso para provocar o erro.
- [ ] **AUTH-07 — Token versus dados:** após obter token, consultar subscription/custo real; registrar separadamente sucesso de autenticação e autorização financeira.
- [ ] **AUTH-08 — Troca de identidade:** alternar entre dois acessos autorizados; dados e resultados anteriores não são apresentados como pertencentes ao novo acesso. Edição/logout invalida o contexto anterior.
- [ ] **AUTH-09 — Proteção:** respostas da aplicação e diagnóstico não devolvem Secret/token. Cadastro sobrevive ao reinício sob o mesmo usuário Windows, sem copiar o cofre para outro usuário.

## 4. Custos reais e conciliação com portal — P0

Escolha um RG com gasto conhecido. Use no portal e na aplicação o mesmo escopo, período, moeda, base e agrupamento. Registre horário da consulta, pois dados podem ser atualizados.

- [ ] **COST-01 — Inventário:** listar subscriptions e RGs permitidos; buscar subscription por nome/ID e por trecho com curinga, como `*grnuv*`.
- [ ] **COST-02 — Subscription:** consultar custo real para período fechado; conferir total, moeda, origem e datas com Cost Analysis.
- [ ] **COST-03 — Resource group:** repetir no RG escolhido; não incluir gasto de outros RGs nem ampliar o escopo silenciosamente.
- [ ] **COST-04 — Dois meses:** em 06/11/2026, o atalho Dois meses completos corresponde a 01/09/2026 até 01/11/2026 exclusivo. Registrar a janela efetivamente mostrada ao executar em outra data.
- [ ] **COST-05 — Base amortizada:** alternar Real/Amortizado; comparar cada base separadamente com o portal, sem exigir que os dois totais sejam iguais.
- [ ] **COST-06 — Detalhamento:** variar agrupamento e série; verificar consistência com o total no mesmo recorte e limites de completude indicados.
- [ ] **COST-07 — Sem linhas/sem permissão:** distinguir ausência de dados de erro 401/403, falha de rede e resposta parcial. Nenhuma dessas falhas deve aparecer como gasto zero confirmado.
- [ ] **COST-08 — Moedas:** preservar totais separados por moeda quando houver dados/fixture correspondente; não converter nem somar moedas implicitamente.
- [ ] **COST-09 — Concorrência:** iniciar consulta e trocar RG/acesso/período antes da resposta; resultado antigo não sobrescreve o contexto novo.
- [ ] **COST-10 — Fonte explícita:** selecionar MCP e tentar usar um cartão sem adapter financeiro equivalente; orientação explica como usar APIs, sem fallback silencioso nem alegação de erro de login não comprovado.

## 5. Forecast — P1

- [ ] **FOR-01 — Consulta real:** em APIs Azure, abrir Forecast, selecionar Mês atual e consultar; mostrar previsão oficial ou indisponibilidade/erro explicável.
- [ ] **FOR-02 — Segregação:** ativar Incluir realizados; dados recebidos como Actual ficam separados de Forecast, inclusive nos totais e por moeda.
- [ ] **FOR-03 — Sem histórico:** escopo sem previsão retorna indisponibilidade, não previsão zero inventada.
- [ ] **FOR-04 — Comparação:** comparar com a previsão do portal em escopo/base/período equivalentes e horário próximo; documentar diferenças e limitações, sem prometer coincidência de processamento.
- [ ] **FOR-05 — Mudança de filtros:** alterar escopo ou período; previsão anterior deixa de representar o novo contexto até nova consulta.

## 6. Budgets, Reservations e Savings Plans — P1

- [ ] **BUD-01 — Budgets:** listar budgets reais na subscription e no RG quando existentes/suportados; conferir limite, moeda, período e valores retornados com o portal.
- [ ] **BUD-02 — Ausência:** diferenciar lista vazia, falta de permissão e falha de consulta. Não criar budget durante o teste.
- [ ] **BEN-01 — Recomendações:** consultar Reservations e Savings Plans; conferir fonte, escopo, prazo e moeda. Recomendações são projeções, não economia já realizada.
- [ ] **BEN-02 — Benefícios atribuídos:** conferir que custos amortizados associados a benefícios não são apresentados como inventário global de contratos.
- [ ] **BEN-03 — Limites:** utilização/cobertura sem API/dataset disponível e simulação horária sem dados ficam indisponíveis; não calcular percentuais sem evidência.
- [ ] **BEN-04 — Parcial:** falha em uma fonte preserva resultados válidos das demais e mostra aviso. Alternativas de economia não são somadas como benefícios cumulativos.

## 7. MCP: configuração, autenticação e execução — P1

- [ ] **MCP-01 — Etapas visíveis:** salvar conexão, autenticar, descobrir catálogo, aprovar tools e executar leitura produzem estados distintos e compreensíveis.
- [ ] **MCP-02 — Catálogo real:** Testar / descobrir apresenta quantidade, nomes e descrições retornados. Uma única tool é aceitável quando corresponde ao namespace configurado; não significa catálogo completo do Azure.
- [ ] **MCP-03 — Formulário:** selecionar tool; campos correspondem ao inputSchema, inclusive objetos aninhados. Contexto de recursos da conexão não é confundido com argumentos de uma chamada.
- [ ] **MCP-04 — Aprovação:** tool não aprovada, desconhecida, de escrita ou com schema alterado é bloqueada. Aprovação local não é confundida com permissão Azure.
- [ ] **MCP-05 — Retorno:** executar leitura aprovada; exibir conexão, tool, momento, resultado/erro e detalhe em Diagnóstico.
- [ ] **MCP-06 — Pricing:** consultar SKU/região conhecidos; identificar o resultado como preço de catálogo, sem apresentá-lo como gasto real.
- [ ] **MCP-07 — ARM delegado:** cadastrar preset arm/HTTP, acesso e scope exato de subscription/RG; Autorizar recurso abre login Microsoft; testar catálogo após consentimento MCP.Access.
- [ ] **MCP-08 — ARM financeiro:** aprovar query_costs e/ou forecast_costs/list_budgets quando retornadas e elegíveis; executar no escopo fixado, conferir evidência e limites de linhas. Não tratar soma truncada como total completo.
- [ ] **MCP-09 — Escopo divergente:** tentar chamada de teste fora do scope autorizado; bloquear antes da execução. No chat, seleção deve coincidir com scope cadastrado.
- [ ] **MCP-10 — Modos suportados:** ARM remoto com identidade de aplicação/Secret não deve ser declarado conectado nesta versão. Validar ADX, Fabric, Power BI e Foundry individualmente apenas se fizerem parte do aceite; preencher resultado de cada um, sem generalizar sucesso do ARM.

## 8. Copilot local e agente cadastrado — P1

- [ ] **CHAT-01 — Copilot:** CLI instalado/autenticado e permitido pela organização; Verificar Copilot informa disponibilidade. Extensão VS Code sozinha não substitui o CLI.
- [ ] **CHAT-02 — Agente:** cadastrar endpoint/deployment e credencial de inferência autorizados; testar. Chave do modelo e Client Secret são credenciais distintas. A inferência real pode ter custo.
- [ ] **CHAT-03 — Analista FinOps:** criar perfil pelo template; conferir instruções, fontes/revisões e tools autorizadas; salvar sem conceder conexões adicionais implicitamente.
- [ ] **CHAT-04 — Gasto:** selecionar RG, fonte APIs e perguntar “Quanto gastei neste resource group nos dois últimos meses completos?”; resposta cita janela, escopo, base, moeda e valores compatíveis com a evidência e a consulta da seção 4.
- [ ] **CHAT-05 — Previsão:** perguntar previsão do mês atual; evidência de Forecast fica separada do gasto realizado.
- [ ] **CHAT-06 — Provedores:** repetir uma consulta em Copilot local e Agente cadastrado; redação pode variar, valores/escopo devem corresponder às evidências de cada consulta.
- [ ] **CHAT-07 — Fonte MCP:** selecionar conexão e tools aprovadas; quando não houver tool de custos disponível, explicar a limitação sem inventar valores nem atribuir a causa a permissões sem evidência.
- [ ] **CHAT-08 — Consentimento/contexto:** conferir autorização de envio ao provedor e contexto do escopo escolhido; modelo não pode escolher credencial, endpoint arbitrário ou ampliar acessos.

## 9. FinOps hub/ADX e comparação — P1 se utilizado

- [ ] **HUB-01 — Pré-requisitos reais:** cluster/banco Hub/schema v1_2 e exportações disponíveis; identidade possui acesso ao banco. Cost Management Reader não substitui permissão ADX.
- [ ] **HUB-02 — Transporte:** testar API Kusto ou conexão MCP ADX aprovada; conexão/destino/acesso correspondem ao Hub cadastrado.
- [ ] **HUB-03 — Dois meses:** selecionar RG e Consultar dois meses; conferir os dois meses civis completos anteriores, independentemente dos filtros gerais, e comparar agregações com a fonte.
- [ ] **HUB-04 — Conciliação:** executar Conciliar com Cost Management; conferir mesmas janela/base/escopo, valores separados, diferenças e moedas. Denominador zero não produz percentual inválido.
- [ ] **HUB-05 — Cobertura:** sem linhas/exportação incompleta, informar cobertura desconhecida; diferença zero não certifica conciliação financeira.
- [ ] **HUB-06 — Falha de uma fonte:** preservar a outra com aviso; não substituir fonte silenciosamente. Usar ambiente de teste controlado, sem revogar permissões de produção.
- [ ] **HUB-07 — Benefícios:** validar datasets disponíveis; recomendações Savings Plans sem schema certificado permanecem indisponíveis. Linhas de uso limitadas não comprovam utilização/cobertura global.
- [ ] **HUB-08 — Chat:** com Hub selecionado, repetir pergunta de gasto e pedir comparação; evidências identificam Hub e Cost Management separadamente.

## 10. Diagnóstico, segurança e usabilidade — P0 para proteção; P1 para interface

- [ ] **DIA-01 — Rastreabilidade:** reproduzir login, consulta API e chamada MCP; Atualizar diagnóstico mostra operação, origem, status e mensagem útil para distinguir autenticação, autorização, configuração e indisponibilidade.
- [ ] **DIA-02 — Privacidade:** conferir que histórico e mensagens não exibem senha, Secret, token, código ou URL OAuth. Resultados de negócio e detalhes técnicos são apresentados em seus locais apropriados.
- [ ] **DIA-03 — Memória:** limpar histórico; eventos somem. Reinício/nova sessão não é apresentado como recuperação de operações antigas.
- [ ] **SEC-01 — Destinos:** conferir os testes automatizados que bloqueiam metadata, IP privado não autorizado, endpoint/audience trocados e redirecionamento de tokens; não sondar sistemas corporativos para reproduzir esses casos.
- [ ] **SEC-02 — Políticas:** conferir regressões de escrita/consulta livre/escopo divergente e invalidação após alteração de acesso; diagnóstico não deve contornar as mesmas proteções.
- [ ] **UI-01 — Feedback:** conexão e Testar Secret mostram retorno abaixo dos botões do cartão correspondente, visível e com texto claro.
- [ ] **UI-02 — Operação:** testar abas, busca, estados de carregamento, erros e resultados extensos no navegador do notebook; informações essenciais não ficam cortadas.
- [ ] **UI-03 — Acessibilidade (P2):** percorrer controles por teclado, conferir foco, rótulos e leitura das mensagens de status; registrar falhas visuais separadamente dos testes automatizados.

## 11. Migração Windows — P1 para portabilidade

- [ ] **MIG-01 — Instalação limpa:** clonar repositório privado em outro notebook, instalar dependências e executar build/testes conforme [roteiro](migration-windows.md), sem copiar node_modules/dist.
- [ ] **MIG-02 — Credenciais:** recriar acessos, Secrets e vínculos MCP/Hub/agente; não copiar o cofre DPAPI nem tokens Copilot. Revalidar permissões e política corporativa.
- [ ] **MIG-03 — Aceite no destino:** repetir health, autenticação, um custo comparado com o portal e os canais efetivamente utilizados; sucesso no notebook anterior não aprova o novo.

## Critério de aceite e registro de defeitos

Aceitar o uso básico quando todos os P0 passarem, houver uma consulta financeira real conferida com o portal e nenhuma falha de isolamento/exposição de credenciais. Aprovar cada módulo adicional somente após seus P1. Se faltarem conta, permissão, dataset ou licença, registrar bloqueio e limitar o aceite ao que foi comprovado.

| Caso | Resultado | Evidência segura | Defeito / próxima ação | Responsável |
|---|---|---|---|---|
| Ex.: COST-03 | Não executado | — | Consultar RG de teste e comparar portal | |

Cada defeito deve conter: ID do caso, commit, passos, esperado, obtido, horário, impacto e evidência sem credenciais. Para divergências financeiras, acrescentar fonte, escopo, período, base, moeda, agrupamento e eventual aviso de parcialidade.

Guias de apoio: [operação](setup.md), [Forecast/ARM](forecast-arm-operation.md), [MCP/diagnóstico](mcp-usability-diagnostics.md), [Hub](finops-hub-guide.md), [benefícios](benefits-capabilities.md) e [validação histórica](validation.md).
