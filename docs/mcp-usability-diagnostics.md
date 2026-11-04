# MCP: tools, consultas e diagnóstico

Atualização de 04/11/2026 baseada nos comentários da interface.

## O que significa descobrir tools

Conectar e listar tools inicia/contata o servidor e recebe seu catálogo. A tela mostra quantidade e nomes e rola até a lista. Isso comprova resposta ao protocolo MCP; não comprova permissão para todos os recursos Azure. Em particular, preços de catálogo podem ser públicos.

O grupo `pricing` carrega as tools de preços. É esperado descobrir apenas `pricing_get` nessa configuração. O seletor **Grupo de tools a carregar** escolhe namespace, não uma lista JSON de nomes. Outros grupos suportados nesta versão: advisor, optimization, subscription e group. A lista completa do servidor depende do grupo e da versão instalada. Trocar de grupo exige salvar e conectar novamente.

**Leitura reconhecida — pode ser liberada para uso** significa que a operação consta das regras de leitura da aplicação. Marcar a tool e salvar permite que esta aplicação a execute com aquele schema. Isso não concede RBAC no Azure. Tools não revisadas continuam bloqueadas. Se o schema mudar, revise novamente.

## Como executar

1. Clique **Conectar e listar tools**.
2. Marque as tools desejadas e clique **Salvar tools permitidas**.
3. Em **Tools**, selecione uma tool já permitida.
4. Preencha os campos gerados a partir do schema do servidor; * indica obrigatório. Objetos hierárquicos são exibidos por grupos e caminhos, como request.sku. Descrições, enumerações, tipos numéricos e booleanos vêm do schema. Campos opcionais vazios são omitidos.
5. Clique **Executar tool selecionada**. A confirmação/erro aparece junto ao botão, e o resultado mostra nome da tool, conexão, horário, duração e retorno MCP.

O JSON avançado é opcional para estruturas que precisem dele. Arrays e schemas fora do subconjunto de formulário suportado ainda podem exigir JSON. A descrição/schema original pode ser expandida; o servidor continua validando schema, aprovação e escopo. Não são inventados SKU, filtros ou valores de parâmetros obrigatórios.

No Chat, execuções MCP também geram **Retorno MCP**, independente do texto produzido pelo modelo, com o retorno sanitizado recebido pelo serviço. Não confunda esse retorno com a explicação financeira do assistente.

## Por que pricing_get não informa meu gasto

pricing_get consulta preços públicos por SKU. Não recupera cobranças da subscription/RG. Nesta versão, os cartões de gastos/budgets/benefícios tradicionais usam a API Cost Management; selecionar MCP não transforma preço em gasto. A mensagem agora explica essa diferença e oferece **Usar APIs Azure para consultar gastos**. A troca só acontece ao clicar no botão. Para a origem Hub, use a área FinOps hub e configure um banco com dados carregados.

Isso também vale para o chat: se a fonte escolhida só oferece pricing_get, o assistente não tem uma tool de despesas disponível. A resposta “não consigo consultar o gasto” pode representar ausência da capacidade, sem falha de login. O catálogo de tools daquela pergunta é registrado no Diagnóstico.

## Busca de subscriptions

Use **Buscar subscription** com parte do nome ou ID; `grnuv` e `*grnuv*` fazem busca por conteúdo, sem diferença entre maiúsculas/minúsculas. A seleção atual permanece visível mesmo que não corresponda ao filtro. A pesquisa não troca automaticamente o escopo.

## Diagnóstico

A nova área **Diagnóstico** registra eventos desta sessão, a partir da atualização: autenticação Microsoft/aplicação, rotas locais, retorno HTTP do Azure, código seguro de erro do provedor, catálogo/execução MCP e catálogo do chat/modelo. Reproduza a ação e clique **Atualizar diagnóstico**.

- 401: autenticação/token não aceito.
- 403: operação negada; verifique a identidade ativa e suas permissões no escopo indicado. Um 403 ARM não significa configuração MCP inválida.
- Parâmetros/schema: requisição recusada antes da consulta ou pelo comando; confira os campos obrigatórios e o tipo de dado.
- Fonte sem capacidade: bloqueio local explicado pela interface; não houve tentativa de consultar dados Azure naquela operação.
- tools/list: catálogo recebido; não representa uma chamada financeira.
- tools/call/resultado: tool executada; não comprova outras permissões do ambiente.

HTTP 200 da rota de chat indica abertura/conclusão do fluxo local; eventos de erro do chat e das tools são registrados separadamente. Se não houver execução de leitura, a resposta do modelo não comprova consulta aos dados.

O histórico é limitado a 150 eventos por sessão e mantido em memória, sem arquivo persistente. Há isolamento por sessão e limite global de sessões. Limpar histórico, encerrar sessão ou reiniciar pode remover o acesso aos eventos; operações anteriores não podem ser reconstruídas retroativamente. Senhas, Secrets, headers, tokens, corpo bruto de autenticação e URL OAuth não são registrados. Não se registra o corpo completo de respostas ARM. Retornos MCP da consulta ficam visíveis no painel de resultado/chat, sanitizados pelo mecanismo existente, e podem conter dados de negócio; trate-os como informação privada.

Verificação: 59 testes do serviço, incluindo isolamento/redação do diagnóstico e retorno ARM 403; 13 testes Edge, incluindo schema hierárquico, execução/resultado e busca de subscriptions; typecheck/build aprovados. Integração com a conta e custos reais não foi executada novamente para validar esta mudança de interface.
