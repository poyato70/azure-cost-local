# Missão 16 — Auditoria UX/UI e protótipo do Tesseract

## Identificação

- **Estado atual:** UX-01 a UX-04 publicadas para revisão em PR #17. Após atualizar seletores E2E, CI no commit de código `894ad01` passou no Windows e no Linux passou typecheck/build/testes, mas permanece bloqueada pelo gate de auditoria de dependências.
- **Data:** 2026-11-18.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/tesseract-2-ux`.
- **Worktree:** `D:\DEV\FinOps\Tesseract-2-ux-base`.
- **Commit-base:** `facd3dfd794b1b9a2750f53280e763447ebe6ecd` (`main` buscada diretamente do remoto).
- **Pull Request:** [#17 — UX-01 a UX-04: fundação neumórfica e Inspector MCP](https://github.com/poyato70/azure-cost-local/pull/17), aberta contra `main`; merge não realizado e depende de aprovação humana.

## Objetivo, escopo e restrições

Auditar a experiência visual e de interação corrente, registrar evidências verificáveis, propor sistema visual coerente com a identidade Tesseract e entregar uma tela estática representativa. Este marco não altera autenticação, contratos MCP, regras de negócio, persistência ou implementação funcional.

## 1. Inventário do frontend

- **Entradas e composição:** `src/web/main.tsx`, `Workspace.tsx`, `App.tsx`, `api.ts`, `LoginComplete.tsx`.
- **Shell e navegação:** `components/Brand.tsx`, `Navigation.tsx`, `Breadcrumbs.tsx`, `ThemeControl.tsx`, `Welcome.tsx`, `CommandHero.tsx`.
- **Páginas:** `WorkspaceHome`, `Costs`, `TagCosts`, `Forecast`, `Budgets`, `Benefits`, `Multicloud`, `FinOpsCorrelation`, `Hubs`, `Investigations`, `Discovery`, `McpConnections`, `McpLab`, `ApiLab`, `Accesses`, `Agents`, `Chat`, `Knowledge`, `Diagnostics`, `Help`.
- **Componentes e padrões:** `ConnectionsMap` e seu modelo de catálogo/perfis, `ScopeFilters`, `ArmScopePicker`, `SchemaInputs`, `CloudResults`, `CloudDefaults`, `RegistrySearch`, `StatusPanel`, `McpDetails`, `McpToolResult`; primitivas Radix/CVA em `components/ui/button.tsx`; gráficos Recharts.
- **Estilos:** folha base `styles.css` longa, com regras de shell e múltiplas sobrescritas de navegação, e camada `styles-mission09.css` para tokens light/dark, mapa, estados, foco, responsividade e fluxo M12. Ambos entrypoints Vite e Next devem continuar importando as duas folhas.
- **Arquitetura visual existente:** shell com barra lateral, breadcrumb/barra superior, páginas React por domínio, filtros compartilhados para escopo e período, cartões/configurações e mapa MCP em três etapas (provedor → integração → capacidades), além de atividade real separada de catálogo e estado salvo.

## 2. Problemas de UX observados

1. **Estilo em camadas com contratos de precedência pouco claros.** `styles.css` declara a sidebar duas vezes (linhas 149 e 1123), além de outra customização da navegação perto da linha 1928; `styles-mission09.css` muda tokens/tema e estilos de controles. Isso torna alterações visuais globais propensas a regressões específicas. Evidência: `src/web/styles.css` linhas 144–219, 1123–1168, 1928–1947; `src/web/main.tsx` importa ambas.
2. **O mapa espacial está restrito a MCP/conexões.** `ConnectionsMap` explicita provedor, integração e detalhe/capacidade; custos/forecast/correlação usam estruturas próprias. É uma boa linguagem para conexões, mas relações e contexto visual ainda não são uma gramática compartilhada de tarefas. Evidência: `src/web/components/ConnectionsMap.tsx`; `src/web/pages/FinOpsCorrelation.tsx` estrutura formulário A/B independentemente.
3. **Muitos destinos na navegação.** A navegação enumera 20 páginas/subpáginas em cinco grupos expansíveis; no mobile vira menu recolhível e grupos permanecem abertos por padrão. Pode elevar custo de varredura e uso vertical em viewport estreito. Evidência: `src/web/components/Navigation.tsx` grupos/itens e `styles.css` regras mobile na região 1946; isto é hipótese de fricção, requer teste com usuários e browser atual.
4. **Hierarquia repetida antes da tarefa.** Em custos/multicloud o `CommandHero` precede o título comum; depois aparecem título de página, filtros e conteúdo. Em desktop estreito pode consumir altura sem oferecer resultado; não há evidência nesta auditoria de tarefa bloqueada. Evidência: `src/web/App.tsx` linhas 503–525.
5. **Relevo consistente apenas em um componente.** Fluxo M12 usa gradientes e sombras internas/externas com caráter côncavo/convexo, enquanto mapa, cards e controles usam fundos quase planos/contornos simples. Evidência: `styles-mission09.css` linhas 820–830 contra linhas 231–330.
6. **Escala de microtexto inconsistente.** A folha base define small em 11px e tipografia geral, mas o mapa fixa diversos rótulos em 8–10px. Em alta densidade de informação isto merece inspeção de legibilidade, zoom e telas pequenas; não é uma declaração de falha WCAG. Evidência: `styles-mission09.css` linhas 249–269, 278–283 e mapa da legenda.
7. **Acessibilidade e responsividade têm evidência parcial e localizada.** Navegação já usa `aria-current`, menu móvel `aria-expanded`; tokens de M09 definem foco visível e reduced motion. Relatórios M09/M12/M15 documentam viewports e axe para suas jornadas, mas M09 declara expressamente não ser auditoria WCAG integral e M15 registra revisão visual humana pendente. Não há base para generalizar esses resultados a todas as páginas.

Os itens 3–6 são hipóteses/inferências de auditoria estática; não foram reproduzidos em browser nesta etapa.

## 3. Proposta de design system

Preservar marca, vocabulário, ícones Lucide, indigo/lilás como ação/identidade, ciano como conexão ativa, e cores semânticas de status. Consolidar tokens sem trocar arquitetura:

- **Camadas:** canvas `#0b0e14` (dark) / `#f3f4f8` (light); superfície base `#141923` / `#ffffff`; superfície elevada `#1b2230` / `#f8f9fc`; sulco inset `#0d1119` / `#e9ebf1`.
- **Acentos existentes:** primário por tema aproximado aos valores atuais `#ad8bff` dark e `#6950c8` light; ciano ativo `#78ddd2` dark / `#147d76` light. Status mantêm texto + ícone + cor, nunca somente cor.
- **Profundidade:** escala curta com sombra difusa (elevação), highlight superior/esquerdo e sombra de contato inferior/direita; borda translúcida sutil para separar. Sulcos para filtros agrupados, campos e controles inset; não aplicar relevo forte em cada elemento.
- **Forma e espaçamento:** raio de controle 10–12px, painel 14–18px; escala 4/8/12/16/24/32; foco externo de 2–3px, estados hover/pressed de baixa amplitude.
- **Tipografia:** família e pesos atuais, escala de texto operacional em rem para zoom; microcopy com alvo mínimo de 12px CSS quando possível. Preservar headings responsivos e números tabulares em métricas.
- **Acessibilidade:** contraste validado por tema, outline de foco, targets confortáveis, semântica/estado de seleção, reduced motion, não depender de hover, e checagem a 200% zoom.

Tokens são proposta, não valores de produção aprovados.

## 4. Concavidade/convexidade com CSS/SVG

1. Criar uma superfície convexa usando fundo em gradiente linear/radial muito leve, `border: 1px solid color-mix(...)`, `box-shadow: -1px -1px 2px highlight, 2px 3px 8px shadow` e `::before` para um brilho especular difuso. Manter contraste e não simular fonte de luz diferente entre componentes vizinhos.
2. Criar controle côncavo com `background` ligeiramente mais escuro/claro que a placa, `box-shadow: inset 2px 2px 5px shadow, inset -1px -1px 2px highlight`; em light usar sombras neutras, evitando cinza pesado.
3. Limitar pseudo-elementos a elementos decorativos `pointer-events:none`, `aria-hidden`; não colocar texto ou estado dentro de filtros SVG.
4. Usar SVG inline para o mapa: paths Bézier/markers com `vector-effect: non-scaling-stroke`, labels DOM para leitores de tela e alvos; preferir gradientes simples e filtros blur leves, com fallback CSS sólido. A relação continua compreensível em layout linear/mobile e sem animação.
5. Aplicar relevo por níveis: casca externa convexa; nós selecionáveis convexos; seleções como encaixe inset; linhas/fluxos em SVG plano. Reservar glow para atividade real/transiente e obedecer reduced motion.
6. Construir CSS como tokens + classes semânticas (`surface-raised`, `surface-inset`, `node-selected`) em folha nova/importada junto das existentes. Migrar componente por componente e verificar cascata antes de reduzir ou remover legado.

## 5. Protótipo representativo

O laboratório executável `/design/neumorphic`, alinhado à especificação fornecida, cobre botões, superfícies elevadas/rebaixadas/planas, foco, disabled/loading, busca, toggle, Closed/Open em ambas as posições, Tools/Resources/Prompts e gauges 0/25/70/100/sem dados. Todo conteúdo é fixture local, sem chamadas API ou persistência. A captura de navegador ainda precisa ser gerada/revisada após instalação e execução.

## 6. Plano incremental

1. **Aceitar linguagem/tokens:** revisão deste relatório e protótipo; escolher tema de referência e limites de intensidade do relevo.
2. **Fundação:** introduzir tokens/classes isolados, documentar fontes de luz, contraste/foco/reduced motion; captura de baseline de páginas-chave.
3. **Shell:** navegação, topo, títulos e filtros; preservar destinos/ações e testar larguras desktop/tablet/mobile.
4. **Mapa de conexões (piloto funcional):** migrar o relevo para `ConnectionsMap` reutilizando seleção/ações existentes; a seleção espacial atual não é uma busca nem um tab de capacidades, então não inventar filtros no catálogo.
5. **Tarefa FinOps:** adaptar um fluxo representativo (custos ou correlação) com hierarquia task-first e relações no contexto; sem alterar lógica nem contrato.
6. **Expansão gradual:** formulário, cartões de estado, diagnóstico e demais páginas conforme evidência e aceitação; sem reescrita global.
7. **Validação por etapa:** build/typecheck existentes quando implementação começar; E2E focado em navegação e ações preservadas; comparação de capturas em 390×844, 768×1024, 1280×720 e desktop largo; teclado, leitor de tela/labels, foco, axe como sinal automatizado, contraste, zoom 200%, reduced motion, overflow e revisão visual humana. Corrigir regressões antes de ampliar escopo.

## Acompanhamento

| Etapa | Estado | Evidência |
|---|---|---|
| Inspecionar instruções, arquitetura, Git e relatórios | Concluída | `AGENTS.md`, páginas/componentes, CSS, relatórios M09–M15 e `main` inspecionados. Base `facd3df`; worktree limpa na branch dedicada. |
| Auditoria e proposta | Concluída | Inventário, evidências e hipóteses descritos acima. |
| Laboratório visual (Etapa A) | Implementado e validado na UX-01 | Rota `/design/neumorphic`; capturas e validações atuais em “UX-01”. |
| Piloto MCP (parte da Etapa B) | Implementado e validado na UX-02 | Mapa e Inspector observados em browser, temas claro/escuro e três larguras; busca existente preservada e E2E/Axe documentados em “UX-02”. |
| Workspace FinOps (Etapa C) | Fora de escopo | Esta frente mantém foco MCP/UX e não altera métricas operacionais ou orçamento. |
| PR/merge | Não aplicável | Conforme instrução, nenhum PR/merge nesta etapa. |

## Validação e limitações

- `git ls-remote` e `git fetch` confirmaram a ponta de `main` `facd3dfd794b1b9a2750f53280e763447ebe6ecd`; worktree derivada sem alterações prévias.
- Fontes atuais lidas diretamente: `AGENTS.md`, `src/web/App.tsx`, `Navigation.tsx`, `ConnectionsMap.tsx`, páginas Costs/FinOpsCorrelation, `styles.css`, `styles-mission09.css`, mapa-modelo e relatórios versionados.
- `npm ci --no-audit --no-fund`: **Bloqueado** nesta máquina após longa espera sem saída. A tentativa deixou `node_modules` parcial; remoção recursiva desta árvore foi rejeitada pela revisão automática e nenhuma nova tentativa foi feita.
- `npm run typecheck`: **Bloqueado** por declarations ausentes na instalação parcial (`node`, `vitest/globals`). Execução alternativa com dependências de lockfile idêntico também não resolveu declarations devido ao estado parcial.
- `next build --webpack`: **Bloqueado** por resolução mista entre dependências parciais/externas; falhas observadas incluem `lucide-react`, tipos Next e imports `es-toolkit/compat` do Recharts. Não classificar como regressão do código UX sem instalação limpa.
- E2E, axe e capturas: **Não executados**, porque o build consistente não foi possível. Não houve chamadas a servidores MCP reais.
- Revisão estática: laboratório usa buttons/inputs reais, `aria-pressed`/`role=switch`, rótulos e foco; movimento reduzido e layout mobile estão definidos. A busca real filtra somente tools já descobertas e deixa intactas as checkboxes de aprovação.
- Pendência: conectar os tokens/classes a `ConnectionsMap` e ações MCP de forma verificável; o estado atual não permite declarar piloto visual integrado. Rever seletores CSS contra o DOM real em browser.
- Nenhuma captura foi produzida; fidelidade à imagem, legibilidade, responsividade e estados de foco continuam sem validação visual.
- Nenhuma funcionalidade, autenticação, contrato MCP, regra de negócio ou persistência foi alterada.

## Evidências adicionais — recuperação e preview

- A instalação limpa da worktree `D:\DEV\FinOps\Tesseract-2-ux-verify` foi concluída pelo `npm ci` com exit 0; lockfile SHA-256 `FF96CDD3139A2A69D90DCFE9251D5B5AC97F2545C4BF67282BDD1F3083DB2F2B`, igual ao da worktree UX. Log npm: `C:\Users\poyat\AppData\Local\npm-cache\_logs\2026-11-17T00_58_24_303Z-debug-0.log`. O log mostra resolução/adicionamento de pacotes e aviso de scripts pendentes para `esbuild@0.27.2` e `koffi@3.2.1`; não aponta erro de instalação. Não se atribuem falhas de build a esses avisos sem evidência.
- Comparação: as três alterações rastreadas (`app/layout.tsx`, `src/web/main.tsx`, `src/web/pages/McpConnections.tsx`) foram copiadas após confirmar ambos worktrees no mesmo commit-base `facd3df`; cinco arquivos novos de UI/relatório foram copiados quando destinos estavam ausentes. SHA-256 dos arquivos `neo.tsx`, `NeumorphicLab.tsx` e `styles-neumorphic.css` conferidos iguais entre árvores. As últimas melhorias no laboratório também foram sincronizadas explicitamente.
- `npm run typecheck`: aprovado na árvore temporária com o conjunto UX transferido.
- `npm run build`: aprovado também depois dos ajustes de espaçamento/grade; build exportou `/design/neumorphic` como página estática.
- Testes focados `tests/connections-map-model.test.ts`, `tests/mcp/inspect.test.ts`, `tests/mcp/catalog.test.ts`: 3 arquivos, 9 testes aprovados.
- Next dev local em `http://localhost:4325/design/neumorphic` respondeu 200. Browser AX confirmou botões, switch, seleções segmentadas e gauges 0/25/70/100/sem dados. Capturas preliminares estão em `D:\DEV\FinOps\Tesseract-2-ux-verify\test-results\mission16\lab-dark-desktop.png`, `lab-light-desktop.png`, `lab-dark-mobile.png`, `lab-light-mobile.png`.
- Geometria observada nas capturas regeneradas: sombras externas/internas distintas; seleção côncava muda de posição nos dois exemplos Closed/Open; gauges com arco/canal/centro distinguíveis. Foco de teclado observado como outline sólido ciano. Overflow horizontal medido: 1280/1280 desktop e 390/390 mobile. Cartões agora alinham pelo topo e gauges usam três tracks na largura disponível; quarto gauge e sem-dados quebram para linha seguinte. No mobile os cartões empilham e têm padding lateral de 16px.
- Tema claro alternável foi adicionado apenas ao laboratório, sem persistência. Contraste e legibilidade foram inspecionados visualmente em ambos temas, mas não calculados por ferramenta WCAG; rótulos pequenos de metadados continuam sendo ponto de atenção. O campo de busca ainda mostra ícone e placeholder desalinhados verticalmente na captura; corrigir antes de considerar a fundação pronta para adoção.
- Zoom 200% e reduced motion não foram medidos nesta execução. DevTools badge do Next aparece nas capturas do servidor de desenvolvimento; não faz parte do build estático de produção.
- Nenhuma chamada MCP real foi realizada e não houve mudança de APIs, autenticação ou dados operacionais. Nenhuma outra worktree ou stash foi alterada.

## UX-01 — Refinamento e validação do laboratório

### Achados visuais demonstrados

- **Busca:** o estilo base global `label { flex-direction: column }` empilhava lupa e campo; regras globais de `input` mantinham padding vertical e horizontal. No browser, a caixa do input media 52 px e ficava abaixo do ícone. A inspeção computada mediu depois da correção ícone e input com centros verticais iguais (`verticalDelta: 0`) e vão de 12 px em 1280, 768, 390 e 640 CSS px.
- **Gauges:** a amostra sem dados ficava fora da grade dos quatro percentuais, criando uma segunda linha centralizada sem alinhamento e elevando o painel desktop a 508 px na captura anterior. Com as cinco amostras na mesma grade, a altura observada passou a 246 px em 1280, 229 px em 768 e 585 px em 390. No desktop cabem cinco indicadores circulares em uma linha; no tablet, três colunas; no mobile, duas colunas.
- **Sem dados versus zero:** a amostra de 0% mostra `0%`; a ausência de valor mostra traço, rótulo “Sem dados” e nome acessível “Sem dados: sem dados”. O estado não é codificado como percentual zero.
- **Superfícies e tema claro:** as variáveis globais de tema escuro e as regras globais para controles vazavam para o laboratório claro. Isso deixava texto escuro sobre o canvas escuro e o acento ciano abaixo do contraste AA. O laboratório agora mantém tema e cores em escopo local, os controles de tema têm hover explícito, o acento claro foi escurecido e as sombras foram reduzidas sem perder o realce superior/esquerdo e a sombra inferior/direita.

### Correções implementadas

- Busca em linha, com altura e padding do input normalizados; a lupa, o texto digitado, placeholder e foco permanecem em trilhas separadas e centralizadas.
- As cinco amostras de gauge compartilham uma grade responsiva. Rótulos de fixture repetidos foram reduzidos; o aviso do laboratório continua deixando claro que as amostras não são métricas operacionais.
- Superfícies clara/escura isoladas em `data-neo-theme`, sem alterar o tema global da aplicação. Contraste selecionado no tema claro foi ajustado; foco ciano permanece visível. `NeoSurface` é marcado como decorativo e descrito em texto adjacente, sem atributos ARIA proibidos em elementos genéricos.
- Indicadores sem glow no traço dos gauges para evitar brilho que reduzia a nitidez do arco. Botão de tema recebeu foco visível; movimento reduzido também cobre esse controle.

### Indicador vermelho de erro

- O badge “1 Issue” pertence ao portal de ferramentas de desenvolvimento do Next.js (`nextjs-portal`), não ao componente do laboratório. Em captura Playwright iniciada imediatamente depois da renderização do heading, o console e o processo dev reproduziram um mismatch de hidratação: o input tinha `style={{caret-color:"transparent"}}` apenas no DOM do browser, embora não existisse no HTML renderizado pelo servidor. A barra do Next então mostrou `data-error=true` e “1 Issue”.
- A sequência controlada que espera a hidratação por meio de interação, antes de capturar, não reproduziu o mismatch: erros de console vazios e barra do Next com `data-error=false`. O build estático final não contém a barra Next. Portanto, o badge registrado é compatível com a captura antes da hidratação e não foi atribuído a um erro funcional dos controles.
- Um teste separado de `next dev` em `127.0.0.1` registrou aviso de origem bloqueada para `/_next/hmr`; acessar o dev server via `localhost` retirou o aviso. O preview final foi validado pela exportação estática, sem HMR.

### Testes e evidências

- Ambiente descartável: `D:\DEV\FinOps\_tmp-ux01-validation-20261117`, com cópia das alterações UX verificadas por SHA-256 e `node_modules` acessado por junction para a instalação já concluída em `Tesseract-2-ux-verify`. As worktrees registradas e seus conteúdos não foram editados durante a execução de testes; o `node_modules` parcial da UX original foi preservado.
- `npm run typecheck`: aprovado, exit 0.
- `npm run build`: aprovado, exit 0; Next gerou `/design/neumorphic` como conteúdo estático e a exportação foi servida localmente para captura final.
- `npm test -- tests/connections-map-model.test.ts tests/mcp/inspect.test.ts tests/mcp/catalog.test.ts`: 3 arquivos, 9 testes aprovados.
- E2E visual Playwright/Chromium sobre `/design/neumorphic`: tema e busca interagiram; toggle e segmento mudaram estado; gauge 0% e sem dados foram verificados; disabled/loading mantiveram estado; foco de teclado permaneceu visível; sem overflow horizontal nas oito combinações tema×viewport e nos dois viewports equivalentes de 200%.
- Axe (`@axe-core/playwright`, tags WCAG 2.0 A/AA e 2.1 A/AA) em desktop: **zero violações** nos temas escuro e claro, 21 verificações aprovadas por tema. Também foram conferidos foco, cores, `aria-pressed`, `role=switch`, `aria-busy` e rótulos dos gauges.
- `prefers-reduced-motion: reduce`: transição medida como `0s` para o botão de demonstração.
- Console do browser e indicador Next no preview estático: sem erros; a barra de desenvolvimento não estava presente.
- Preview estático local respondendo HTTP 200 em `http://127.0.0.1:4332/design/neumorphic`. A navegação direta pela aba IAB foi bloqueada pela política de URL do navegador; as capturas abaixo foram verificadas com Chromium/Playwright e estão disponíveis no checkout.
- Capturas de página renderizada (PNG) estão em `docs/relatorios/evidencias/ux-01/`: dark/light 1280×900, 768×1024 e 390×844, além das capturas a 640 CSS px (equivalente de viewport a 200% de um desktop com 1280 CSS px). A medição de overflow foi 0 px em todas.

  - Desktop: [dark](evidencias/ux-01/lab-dark-1280.png) · [light](evidencias/ux-01/lab-light-1280.png)
  - Tablet: [dark](evidencias/ux-01/lab-dark-768.png) · [light](evidencias/ux-01/lab-light-768.png)
  - Mobile: [dark](evidencias/ux-01/lab-dark-390.png) · [light](evidencias/ux-01/lab-light-390.png)
  - Equivalente 200%: [dark](evidencias/ux-01/lab-dark-200-percent-equivalent.png) · [light](evidencias/ux-01/lab-light-200-percent-equivalent.png)

### Limitações e pendências

- O teste de 200% usou o viewport equivalente de 640 CSS px, não o controle de zoom nativo do navegador; a árvore de layout responsiva e o overflow foram verificados nessa largura. O navegador não expôs o ajuste de zoom por atalho nesta sessão.
- Axe foi executado nas duas aparências em desktop; em tablet/mobile a validação incluiu renderização, geometria, busca e overflow, sem uma execução Axe separada por cada viewport.
- As capturas demonstram o estado do laboratório e seus fixtures. A revisão visual de produto ainda cabe à pessoa responsável antes de aprovar a integração em outras áreas.
- Mapa de Conexões e Inspector não foram integrados/alterados nesta UX-01. Build e testes do repositório passaram, mas este trabalho não declara qualquer alteração MCP validada.
- `git diff --check`: aprovado, exit 0 no checkout UX.
- Nenhuma regra de negócio, API, autenticação, armazenamento operacional, outra worktree ou stash foi modificada. Sem PR e sem merge.

## UX-02 — Piloto visual do Mapa de Conexões e Inspector

### Reconciliação e escopo

- Worktree `D:\DEV\FinOps\Tesseract-2-ux-base`, branch `codex/tesseract-2-ux`, HEAD-base `facd3dfd794b1b9a2750f53280e763447ebe6ecd`. As alterações locais UX-01 foram preservadas.
- A worktree funcional `D:\DEV\FinOps\Tesseract-2` já continha alterações próprias e uma história Git sem relação ancestral demonstrada com esta branch. Este checkout UX não tem remoto configurado nem referência `main`; portanto, não foi possível confirmar avanço remoto de `main` nem fazer reconciliação segura. Não houve merge ou rebase. A worktree funcional e o stash não foram alterados.
- `ConnectionsMap.tsx` e `McpConnections.tsx` mantêm eventos, IDs, rotas, estados, handlers e busca local preexistentes. O único ajuste estrutural em componente foi a classe visual `mcp-inspector` em `McpLab.tsx`; o restante do piloto é CSS escopado ao mapa e ao modo Análise.
- Não foram introduzidas tabs ou filtros semânticos. Tools, resources e prompts continuam apresentados pelo fluxo original. A busca continua filtrando apenas a lista local de tools descobertas, sem alterar permissões ou aprovação.

### Alterações visuais implementadas

- **Mapa:** painéis elevados com sombra curta e iluminação superior/esquerda comum; nós recebem elevação discreta; provedores e integrações selecionados usam cavidade inset; legenda, estado e texto continuam visíveis. Atividade e relações permanecem planas para não competir com os dados. A variante clara usa neutros claros e acento escurecido para manter contraste.
- **Inspector:** agrupamentos de capabilities e campos apropriados recebem superfície rebaixada; cards internos ficam elevados com sombra menor. Os refinamentos de cadastro e campos foram restringidos ao modo Análise. Busca local alinhada horizontalmente com lupa e texto centralizados; foco visível em ambos temas.
- Estados operacionais textuais originais são preservados: “Salva”, “Ativa”, “Configurar”, “sem conexão ativa nesta sessão”, vazio de atividade, seleção suja, botão de aprovação desabilitado e execução pendente/concluída.
- Melhorias de legibilidade no tema claro ajustaram o contraste dos metadados dos nós, status “Salva”, textos do Inspector e botão primário. Nenhum brilho foi adicionado às linhas nem ao conteúdo denso.

### Capturas antes/depois

As capturas são renderizações reais do build da aplicação, com perfis/tools/resources/prompts sintéticos roteados pelo browser. “Antes” usa os arquivos UX-01 anteriores ao piloto; “Depois” usa a versão UX-02. Arquivos em `docs/relatorios/evidencias/ux-02/`.

- Antes, desktop 1280: [Mapa escuro](evidencias/ux-02/before/map-dark-1280.png), [Mapa claro](evidencias/ux-02/before/map-light-1280.png), [Inspector escuro](evidencias/ux-02/before/inspector-capabilities-dark-1280.png), [Busca escura](evidencias/ux-02/before/inspector-tools-dark-1280.png), [Busca clara](evidencias/ux-02/before/inspector-tools-light-1280.png).
- Depois, Mapa: [escuro 1280](evidencias/ux-02/after/map-dark-1280.png), [claro 1280](evidencias/ux-02/after/map-light-1280.png), [escuro 768](evidencias/ux-02/after/map-dark-768.png), [claro 768](evidencias/ux-02/after/map-light-768.png), [escuro 390](evidencias/ux-02/after/map-dark-390.png), [claro 390](evidencias/ux-02/after/map-light-390.png).
- Depois, Inspector/capabilities e busca: 12 capturas em `evidencias/ux-02/after/`, cobrindo os dois temas e 1280, 768 e 390 px.

### Validação executada

- A `node_modules` parcial da worktree original foi preservada. Nela, `npm run build` falha com `Cannot find module '../server/require-hook'` dentro de `node_modules/next`; `npm run typecheck` também expõe módulos/declarations ausentes de Next e `lucide-react`. Evidência indica instalação local incompleta, não regressão visual. Não foram alteradas dependências, lockfile ou política de scripts npm.
- Ambiente consistente: cópia descartável `D:\DEV\FinOps\_tmp-ux02-validation-20261117`, usando instalação já concluída em `Tesseract-2-ux-verify` por junction. SHA-256 do lockfile original e da cópia coincide (`FF96CDD3139A2A69D90DCFE9251D5B5AC97F2545C4BF67282BDD1F3083DB2F2B`); hashes dos arquivos UX transferidos foram comparados antes do build. A árvore de teste não contém mudanças de aplicação além dos arquivos UX comparados.
- `npm run typecheck`: passou. `npm run build`: passou após as últimas alterações de CSS; `/`, `/_not-found` e `/design/neumorphic` foram prerenderizadas e o servidor de teste foi compilado.
- Testes focados: `tests/connections-map-model.test.ts`, `tests/mcp/inspect.test.ts`, `tests/mcp/catalog.test.ts`: **3 arquivos, 9 testes passaram**.
- E2E focados: `tests/e2e/ux02-visual.spec.ts`, `mcp-laboratory.spec.ts`, `mcp-clarity.spec.ts`: **4 testes passaram** na execução final. Cobriram seleção por teclado de provedor, seleção de integração, ausência de atividade, catálogo sintético, tools/resources/prompts, busca com resultado e sem resultado, seleção suja, estado de aprovação desabilitado/habilitado, loading e conclusão simulados.
- As rotas de catálogo, aprovação e chamada foram interceptadas pelo browser e responderam apenas com fixture local. Asserções confirmaram que não ocorreu `/test` ou `/connect`; nenhuma chamada MCP real foi feita.
- Axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) no desktop: **0 violações** no Mapa dark/light e Inspector dark/light. A versão anterior havia falhado contraste em status “Salva” no mapa escuro e no botão primário do Inspector claro; ambos foram corrigidos e revalidados.
- Viewports efetivos de teste: 1280×900, 768×900 e 390×844. Sem overflow horizontal em nenhum. O viewport de 640 CSS px foi usado como equivalente responsivo de 200%; não foi possível configurar zoom nativo do navegador. `prefers-reduced-motion: reduce` produziu transição computada `0s`; foco de teclado no nó e busca foi medido como outline visível. Erros de console e `pageerror` no carregamento frio: zero.
- `git diff --check`: aprovado após as alterações finais.

### Achados e limitações visuais

- A captura anterior mostra que o modo claro herdava superfícies de tom incompatível e perdia legibilidade em várias áreas. A camada UX-02 agora usa tokens locais do Mapa/Inspector com superfícies claras, texto legível e estados destacados sem depender apenas de cor.
- A busca real herdava `label` global em coluna e apresentava lupa, input e placeholder em linhas diferentes. O layout agora mantém ícone e input na mesma linha; os centros foram medidos com delta máximo de 1 px nos três viewports e temas.
- Em 768 e 390 px, o mapa linear empilha provedor, integração, capacidades, ações e atividade. Isso preserva relações e alvos de toque, mas exige rolagem vertical. O componente atual não desenha linhas SVG entre colunas; não foram inventadas conexões novas nesta etapa.
- As evidências de interação usam dados sintéticos; não validam disponibilidade, autorização ou respostas de servidores MCP reais. Axe foi executado em desktop, não em cada viewport. O zoom de 200% foi representado por 640 CSS px, não pelo controle de zoom do navegador.
- Parecer: **apto para revisão humana como piloto visual do Mapa e Inspector**. A fundação visual passou nos checks descritos, mas o usuário deve revisar as capturas antes de ampliar a linguagem a outras áreas.

### Publicação

- Nenhum commit, PR ou merge criado, conforme instrução. Arquivos funcionais e stash permaneceram fora da frente UX.

## UX-03 — Capability Inspector e portabilidade

**Data da execução:** 2026-11-18

**Branch:** `codex/tesseract-2-ux`
**Estado:** piloto implementado e tecnicamente validado; aguardando revisão humana. Nenhum PR, merge ou commit criado.

### Reconciliação e escopo

- Lidos `AGENTS.md`, o estado Git e o relatório UX-01/02. A worktree contém alterações locais UX-01/02 não publicadas; foram preservadas. A worktree funcional `Tesseract-2` e seu stash não foram alterados.
- Metadados do repositório confirmam `poyato70/azure-cost-local`; `git ls-remote` confirmou que `main` ainda aponta para `facd3dfd794b1b9a2750f53280e763447ebe6ecd`, igual à base desta branch. O clone não tinha remoto Git configurado; nenhum remoto foi adicionado.
- O piloto reutiliza `McpLab`, `McpConnections`, `readCatalog` e os retornos já existentes. Não houve alteração a autenticação, transporte, endpoints, contratos, regras de negócio, aprovação, execução ou persistência.
- `readCatalog` lista tools, prompts e resources, mas não solicita `resourceTemplates`. A UI só apresenta templates quando o retorno existente os inclui; caso contrário informa essa limitação, sem chamada ou mudança de contrato.

### Implementação

- `src/web/pages/McpLab.tsx`: reorganizado em duas áreas de primeiro nível, **Explorar MCP** e **Replicar / Exportar**. Explorar usa controle segmentado Tools/Resources/Prompts, apresenta estados descoberto/vazio/não anunciado/erro, origem do servidor, descrição, identificador e disponibilidade de aprovação quando retornados. Seleção e inspeção não acionam execução.
- O Inspector separa **Input Schema** de **Input JSON — exemplo sintético**, exibe Output Schema quando anunciado e apresenta metadados sanitizados. A visão estruturada é uma leitura resumida; a visão JSON conserva `$ref`, `oneOf`, `anyOf`, arrays, objetos e keywords sem reconstruí-los. Segredos identificados nos valores são substituídos por `[REMOVIDO]`, portanto essa cópia é sanitizada e pode deixar de ser um schema executável.
- `src/web/components/mcp-export.ts`: contém formatação de exportação, sanitização profunda e geração conservadora de exemplos. Exemplo só é proposto quando o tipo e as restrições conhecidas permitem um valor sintético; padrões, formatos, referências, uniões e casos sem valor seguro recebem explicação em vez de payload inventado.
- `src/web/styles-neumorphic.css`: superfície elevada do Inspector, cavidades para grupos/seleções, foco visível, estados disabled, layouts responsivos e tema claro/escuro. O estado selecionado continua distinguível sem depender exclusivamente de cor.
- `tests/mcp/mcp-export.test.ts` e `tests/e2e/ux03-inspector.spec.ts`: cobrem HTTP/stdio, schemas simples e avançados, sanitização, estados de catálogo, cópia, teclado, movimento reduzido, responsividade e Axe.

### Formatos e segurança

- **VS Code:** alvo identificado como formato nativo do Copilot (`mcpServers`) para stdio/HTTP, segundo a documentação oficial consultada em 2026-11-18: [referência de configuração MCP](https://code.visualstudio.com/docs/agents/reference/mcp-configuration). O nome/versão instalados do VS Code não foram verificados; a compatibilidade de runtime não foi declarada. O JSON é validado em fixtures. Configuração HTTP não leva headers de autorização; identidade delegada, token, cookies e autenticação devem ser configurados separadamente pelo cliente. Stdio usa referências de ambiente `${AZURE_TENANT_ID}`, `${AZURE_CLIENT_ID}` e `${AZURE_CLIENT_SECRET}`, nunca valores nem referências de vault/sessão do Tesseract.
- **PowerShell:** a documentação Microsoft do AI Shell descreve `$HOME\.aish\mcp.json` com `servers` para stdio e HTTP e declara o projeto arquivado desde janeiro de 2026: [MCP support — PowerShell](https://learn.microsoft.com/en-us/powershell/utility-modules/aishell/how-to/mcp-support?view=ps-modules). A saída UX-03 é um here-string PowerShell que imprime o JSON de configuração; não grava arquivo, instala runtime, conecta ou executa servidor. A sintaxe foi verificada em teste, mas compatibilidade com uma sessão real do AI Shell não foi validada. O UI marca esse limite antes do trecho.
- **Manifesto:** formato próprio `tesseract.capability-manifest` v1.0, explicitamente não padrão MCP. Mantém estado `discovered` ou `not_verified` e capacidades que o catálogo efetivamente retornou.
- A sanitização não é apenas visual: a função exportadora substitui valores ligados a nomes de segredo/token/cookie/autorização/vault/sessão, remove credenciais de userinfo, valores de query sensíveis, Bearer e JWT em strings; os formatos e a cópia do schema passam por essa função. A política é coberta por fixtures com valores falsos. Como qualquer sanitizador por padrão/heurística, texto arbitrário contendo um segredo sem nome/codificação reconhecível não pode ser provado seguro universalmente; por isso o manifesto limita campos de conexão a uma allowlist e a autenticação não é copiada.
- Não há elevação de privilégio ou comando de conexão/instalação gerado. O cliente-alvo precisa de runtime e credenciais configurados fora do artefato exportado.

### Validação executada

- Ambiente isolado: `D:\DEV\FinOps\_tmp-ux03-validation-20261118`, cópia do código UX, `package-lock.json` com SHA-256 igual à worktree e junction para a instalação íntegra já existente em `Tesseract-2-ux-verify`. A `node_modules` parcial original não foi alterada. Node **v24.20.0**, npm **11.19.0**.
- `npm run typecheck`: **passou**.
- `npm run build`: **passou**; `/`, `/_not-found` e `/design/neumorphic` foram prerenderizadas.
- Testes unitários focados (`mcp-export`, `catalog`, `inspect`): **3 arquivos, 8 testes passaram**.
- Playwright E2E focado: **2 testes passaram**. Dados MCP foram fixtures interceptadas no browser. O único POST operacional da jornada foi `/catalog`, após clique explícito em “Descobrir capacidades MCP”; houve exatamente uma chamada a essa rota. Não houve chamadas `/call`, `/approve-tools`, `/test`, `/connect`, `/auth` ou `/inspect`, nem operação MCP real.
- Axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`): **0 violações** no Inspector dark 1280, light 1280 e light 390. Os testes exercitam Enter/Tab e exigem outline de foco de pelo menos 2 px; `prefers-reduced-motion: reduce` computa transição de 0 s.
- Viewports testados: 1280×900, 768×900, 640×900 CSS px (referência equivalente a zoom 200%; zoom nativo não foi controlado) e 390×844. O teste mediu ausência de overflow horizontal em 640 e 390; as capturas incluem 1280, 768 e 390.
- `git diff --check`: **passou**. Nenhum erro de página (`pageerror`) na E2E.
- Capturas reais obtidas após renderização no Edge/Playwright com dados sintéticos:
  - [Inspector, dark, desktop 1280](evidencias/ux-03/inspector-dark-desktop-1280.png)
  - [Exportação, dark, desktop 1280](evidencias/ux-03/export-dark-desktop-1280.png)
  - [Exportação, light, desktop 1280](evidencias/ux-03/export-light-desktop-1280.png)
  - [Exportação, light, tablet 768](evidencias/ux-03/export-light-tablet-768.png)
  - [Exportação, light, mobile 390](evidencias/ux-03/export-light-mobile-390.png)

### Achados e limitações

- A inspeção de schema avançado conserva a forma original, mas sinaliza que a geração de argumento não é segura quando há `$ref`/`oneOf` ou restrições desconhecidas. Exemplos simples usam valores sintéticos e não são enviados ao MCP.
- Estado de aprovação é o valor retornado para a tool (`approved`/`reviewable`); uma conexão salva permanece identificada como configurada, não como conectada/verificada. O Inspector informa que descoberta não comprova autorização de execução.
- Resource templates não fazem parte da consulta MCP atualmente reutilizada; permanecem não verificados quando ausentes. Não foi criada chamada nova para descobri-los.
- Os artefatos VS Code e AI Shell tiveram a estrutura e a sanitização testadas, não a inicialização de cliente/servidor externo. O AI Shell está arquivado. Autenticação HTTP é deliberadamente omitida e requer configuração própria no destino.
- Axe e responsividade demonstrados usam os estados registrados e dados sintéticos; não certificam servidor, credenciais nem comportamento de runtime externo. Zoom de 200% nativo não foi possível nesta automação; foi verificada a largura CSS de 640 px.
- Parecer: **piloto UX-03 pronto para revisão humana**. Não ampliar a portabilidade para outros clientes antes de decisão sobre targets suportados e revisão das capturas.

### Publicação e preservação

- Nenhum commit, PR ou merge foi criado. A porta 4317 pertencia ao processo `Tesseract-missao-16`; a execução E2E usou a porta isolada 4318. O processo da outra frente foi deixado intacto.

## UX-04 — Portabilidade MCP e preparação para publicação

**Data da execução:** 2026-11-18

**Branch:** `codex/tesseract-2-ux`
**Estado:** exportações revisadas, testes de fixture aprovados e diff preparado para revisão; aguardando revisão humana. Nenhum commit, PR ou merge criado.

### Reconciliação Git e preservação

- Worktree UX: `D:\DEV\FinOps\Tesseract-2-ux-base`, branch `codex/tesseract-2-ux`, HEAD-base `facd3dfd794b1b9a2750f53280e763447ebe6ecd`.
- O checkout não contém remoto/ref local `origin/main`. Consulta read-only ao GitHub em 2026-11-18 retornou `refs/heads/main = facd3dfd794b1b9a2750f53280e763447ebe6ecd`, igual ao HEAD; a ref pública `codex/tesseract-2-ux` não foi anunciada. Não foi necessário rebase/merge e nenhum remoto foi configurado.
- A worktree UX tinha alterações UX-01/02/03 não commitadas antes de UX-04. Elas foram preservadas. A worktree funcional `D:\DEV\FinOps\Tesseract-2` manteve as alterações M16 observadas; nenhum arquivo dela foi transferido ou escrito. `git stash list` não mostrou entradas neste clone e não foi alterado.
- Para validação foi criada a cópia isolada `D:\DEV\FinOps\_tmp-ux04-validation-20261118`: extração do HEAD mais os caminhos UX modificados/não rastreados, com `node_modules` em junction para a instalação íntegra já usada pela UX-03. O lockfile em ambas as árvores tem SHA-256 `FF96CDD3139A2A69D90DCFE9251D5B5AC97F2545C4BF67282BDD1F3083DB2F2B`. Arquivos UX alterados durante a rodada foram transferidos novamente e comparados por SHA-256. Não houve mudança de dependências ou lockfile.

### Alterações e classificação de formatos

- **VS Code Copilot (`mcpServers`):** a configuração é produzida somente para HTTP ou para presets stdio reconhecidos pela tabela de presets já existente no Tesseract. Presets/transporte não reconhecidos não recebem comando fictício; a cópia da configuração fica indisponível. O catálogo de tools descobertas deixou de ser usado para limitar as tools na configuração exportada. O formato nativo atual do Copilot usa um objeto superior `mcpServers`; a documentação atual separa esse formato do formato legado `servers` e dos destinos `.vscode/mcp.json`: [referência oficial da configuração MCP](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) e [adicionar/usar servidores MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers).
- O VS Code instalado é `1.145.3`; não há extensão GitHub Copilot instalada (`code --list-extensions`). Por isso não foi executada importação pela interface Copilot. O JSON foi parseado e sua URL HTTP foi usada pelo cliente MCP SDK contra fixture local; esta evidência comprova estrutura e interoperabilidade do protocolo na fixture, não importação no aplicativo VS Code, autenticação ou serviço externo.
- **PowerShell:** a saída antiga com `servers` para AI Shell foi removida como alegação de portabilidade atual. A interface oferece somente um texto marcado como **informativo**, sem cliente, configuração operacional, endpoint secreto ou comando de inicialização autônomo. A documentação Microsoft informa que o AI Shell foi arquivado em janeiro de 2026; seu formato não foi tratado como compatibilidade garantida: [estado de manutenção do AI Shell](https://learn.microsoft.com/en-us/powershell/utility-modules/aishell/install-aishell?view=ps-modules). Não foi criado cliente PowerShell MCP. Os processos stdio reconhecidos continuam configuráveis pelo formato Copilot `command`/`args`; iniciá-los sem cliente deixaria o processo stdio sem protocolo consumidor, portanto nenhum comando standalone foi rotulado como cliente operacional.
- **Manifesto Tesseract:** formato proprietário identificado como `tesseract.capability-manifest` v1.0 e explicitamente não MCP. O manifesto exporta campos conhecidos de servidor, capabilities, tools, resources, prompts e resource templates; schemas preservam keywords JSON Schema aceitas, referências e composição e omitem metadados não permitidos pela seleção. Estado sem descoberta permanece `not_verified`.
- **Segurança:** exportações exercitam sanitização de chaves sensíveis inesperadas e aninhadas, arrays, userinfo de URL, query params, Bearer, JWT, texto percent-encoded, conteúdo Base64 reconhecível e referências `vault://`/Key Vault. Dados de annotations/capabilities e demais estruturas externas não permitidas são descartados do manifesto. Schemas mantêm propriedades estruturais; valores `default`, `example`, `enum` e `const` associados a nomes sensíveis são redigidos. O export stdio só contém referências de ambiente (`${AZURE_TENANT_ID}`, `${AZURE_CLIENT_ID}`, `${AZURE_CLIENT_SECRET}`), nunca valores locais do ambiente. Referências internas de secrets da conexão não entram nos artefatos.
- A sanitização de conteúdo textual é defensiva, não prova universal para qualquer segredo disfarçado em texto arbitrário. Por isso a superfície do manifesto usa allowlist e a autenticação não é exportada. Fixtures usaram apenas sentinelas falsas; tenant Azure e credenciais corporativas não foram acessados.

### Testes de reprodução e regressão

- Fixture `Streamable HTTP` local registra tools, resource e prompt; o schema da tool tem campo obrigatório e campo opcional. O teste parseia o JSON Copilot produzido, conecta o cliente do `@modelcontextprotocol/sdk` ao endpoint gerado e descobre tools/resources/prompts. O teste não chama a tool.
- Validação de formato (JSON, marcadores, allowlists e sanitização) permanece separada do teste de protocolo/descoberta. Importação real do VS Code e inicialização dos pacotes Azure/Fabric não foram executadas; não houve chamadas externas nem Azure.
- `npm run typecheck`: **passou** na cópia isolada.
- `npm run build`: **passou**; `/`, `/_not-found` e `/design/neumorphic` foram prerenderizadas.
- Testes focados finais `mcp-export`, `mcp-export-interoperability`: **2 arquivos, 6 testes passaram**; a execução focada de protocolo incluiu `mission10-protocol`, totalizando **3 arquivos, 8 testes aprovados**.
- Suíte Vitest completa: primeira execução concorrente com o build teve **195/196 aprovados**, com timeout de 15 s em `tests/storage/data-directory-isolation.test.ts` durante contenção de CPU. Reexecução serial, sem build concorrente, passou: **64 arquivos, 196 testes**. O caso do timeout passou nessa execução; não houve alteração de teste ou política para contornar falha.
- Playwright E2E final: **2/2 passaram** em Edge headless, com servidor da aplicação isolado na porta 4338 e armazenamento de teste. Cobriu exploração, cópia sanitizada, exportes, estado HTTP vazio e ausência de caminhos `/call`, `/approve-tools`, `/test`, `/connect`, `/auth` e `/inspect`. A descoberta da fixture usou apenas `/catalog`; nenhuma operação MCP real ocorreu.
- Axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) no E2E: **zero violações** em Inspector/export dark desktop 1280 e light desktop 1280. Teclado Enter/Tab e outline de foco >=2 px passaram. `prefers-reduced-motion: reduce` computou transição de 0 s. Larguras 1280, 768, 640 CSS px e 390 foram exercitadas; sem overflow horizontal nos checks a 640 e 390.
- O viewport de 640 CSS px é uma aproximação responsiva do zoom de 200%; zoom nativo do Edge não foi medido nesta sessão. Axe não foi executado separadamente nos viewports tablet/mobile e contraste não foi calculado manualmente por ferramenta WCAG.
- `git diff --check`: **passou** após a atualização deste relatório e depois de incluir, temporariamente, arquivos novos por intent-to-add; o index foi restaurado ao estado sem stage. Prettier passou para os arquivos de código/teste UX-04.

### Achados visuais e capturas validadas

- A primeira captura UX-04 mostrou o botão **Copiar texto informativo** do PowerShell desabilitado, embora o texto dissesse que podia ser copiado. A condição foi corrigida; o E2E agora copia o texto e confirma a notificação. A captura final confirma o botão habilitado.
- As seleções segmentadas quebram para uma segunda linha em tablet e formam uma coluna em mobile; JSON usa rolagem interna, sem overflow horizontal. Os screenshots finais foram gerados pela execução E2E final, inspecionados e copiados para `docs/relatorios/evidencias/ux-04/`; os hashes das sete imagens foram verificados.
- Capturas: [Inspector dark desktop 1280](evidencias/ux-04/inspector-dark-desktop-1280.png), [Copilot config dark desktop 1280](evidencias/ux-04/vscode-copilot-dark-desktop-1280.png), [PowerShell informativo dark desktop 1280](evidencias/ux-04/powershell-informative-dark-desktop-1280.png), [manifesto dark desktop 1280](evidencias/ux-04/export-dark-desktop-1280.png), [manifesto light desktop 1280](evidencias/ux-04/export-light-desktop-1280.png), [manifesto light tablet 768](evidencias/ux-04/export-light-tablet-768.png) e [manifesto light mobile 390](evidencias/ux-04/export-light-mobile-390.png).
- Capturas contêm perfis e capacidades MCP sintéticos. A saída Copilot visualizada inclui referências genéricas de ambiente, não valores de credenciais.

### Inventário de arquivos publicados

O diff cumulativo UX-01 a UX-04 contra a base `facd3dfd794b1b9a2750f53280e763447ebe6ecd` contém **63 caminhos**: nove arquivos de aplicação/estilo, nove testes, este relatório e 44 capturas. Os commits estão publicados na branch `codex/tesseract-2-ux`; a worktree está limpa. Inventário por grupo:

- Shell/rotas/styles: `app/layout.tsx`, `app/design/neumorphic/page.tsx`, `src/web/main.tsx`, `src/web/styles-neumorphic.css`.
- Componentes e páginas: `src/web/components/ui/neo.tsx`, `src/web/components/mcp-export.ts`, `src/web/pages/NeumorphicLab.tsx`, `src/web/pages/McpConnections.tsx`, `src/web/pages/McpLab.tsx`.
- Testes E2E: `tests/e2e/command-center.spec.ts`, `tests/e2e/mcp-laboratory.spec.ts`, `tests/e2e/mcp-usability.spec.ts`, `tests/e2e/mission-10-mcp.spec.ts`, `tests/e2e/ux02-tool-search.spec.ts`, `tests/e2e/ux03-inspector.spec.ts`, `tests/e2e/workbench.spec.ts`.
- Testes unitários: `tests/mcp/mcp-export.test.ts`, `tests/mcp/mcp-export-interoperability.test.ts`.
- Relatório: `docs/relatorios/missao-16-ux-auditoria.md`.
- Evidências: 44 PNGs sob `docs/relatorios/evidencias/ux-01/`, `ux-02/`, `ux-03/` e `ux-04/` (7 novas capturas UX-04). A busca de duplicidade por SHA-256 encontrou zero grupos repetidos.

Arquivos de evidência incluídos:

- `ux-01/`: `lab-dark-1280.png`, `lab-dark-200-percent-equivalent.png`, `lab-dark-390.png`, `lab-dark-768.png`, `lab-light-1280.png`, `lab-light-200-percent-equivalent.png`, `lab-light-390.png`, `lab-light-768.png`.
- `ux-02/before/`: `inspector-capabilities-dark-1280.png`, `inspector-capabilities-light-1280.png`, `inspector-tools-dark-1280.png`, `inspector-tools-light-1280.png`, `map-dark-1280.png`, `map-light-1280.png`.
- `ux-02/after/`: `inspector-capabilities-dark-1280.png`, `inspector-capabilities-dark-390.png`, `inspector-capabilities-dark-768.png`, `inspector-capabilities-light-1280.png`, `inspector-capabilities-light-390.png`, `inspector-capabilities-light-768.png`, `inspector-tools-dark-1280.png`, `inspector-tools-dark-390.png`, `inspector-tools-dark-768.png`, `inspector-tools-light-1280.png`, `inspector-tools-light-390.png`, `inspector-tools-light-768.png`, `map-dark-1280.png`, `map-dark-390.png`, `map-dark-768.png`, `map-light-1280.png`, `map-light-390.png`, `map-light-768.png`.
- `ux-03/`: `export-dark-desktop-1280.png`, `export-light-desktop-1280.png`, `export-light-mobile-390.png`, `export-light-tablet-768.png`, `inspector-dark-desktop-1280.png`.
- `ux-04/`: `export-dark-desktop-1280.png`, `export-light-desktop-1280.png`, `export-light-mobile-390.png`, `export-light-tablet-768.png`, `inspector-dark-desktop-1280.png`, `powershell-informative-dark-desktop-1280.png`, `vscode-copilot-dark-desktop-1280.png`.

## UX-05 — Revisão final da fundação UX e preparação da publicação

**Data:** 2026-11-18
**Branch/worktree:** `codex/tesseract-2-ux` · `D:\DEV\FinOps\Tesseract-2-ux-base`
**Base remota confirmada:** `origin/main` = `facd3dfd794b1b9a2750f53280e763447ebe6ecd`, igual ao commit-base.
**Estado:** validação local aprovada com limitações identificadas; PR #17 aberta. CI run `44316949731` no head documental `b6802c0`: Windows aprovado; Linux reprovado somente pelo gate de vulnerabilidades altas. Esse run contém o mesmo código de produto do commit `894ad01`; a mudança posterior é documental.

### Revisão do diff e escopo

- Reconfirmada a identidade GitHub `poyato70/azure-cost-local`, branch default `main` e permissão de escrita antes de configurar `origin`. `git fetch origin main` confirmou que a main não avançou. A branch de UX não inclui alterações da worktree funcional M16; nenhuma alteração foi feita na worktree M16 ou no stash M13.
- O inventário atualizado contém **63 caminhos**: nove arquivos de aplicação/estilo, nove testes, este relatório e 44 PNGs. As 44 capturas foram abertas visualmente por grupos, identificadas como cenários sintéticos, sem credenciais/dados corporativos aparentes, com hashes únicos e cobertura de variação de tema, viewport, estado e comparação antes/depois. Todas são mantidas porque representam estados distintos; nenhuma foi removida por deduplicação.
- O scan textual de alta confiança encontrou somente placeholders de ambiente (`${AZURE_CLIENT_SECRET}`) e strings/JWT de fixture deliberadamente falsas nos testes de sanitização. Não encontrou credenciais reais. A revisão confirmou que os arquivos alterados estão limitados ao shell/estilos/laboratório/Mapa/Inspector/exportações UX e testes/documentação; não há alterações de autenticação, API/contrato MCP, autorização, persistência ou regras de negócio.
- O teste E2E `tests/e2e/ux02-tool-search.spec.ts` foi acrescentado para cobrir a filtragem local de tools descobertas. Com catálogo sintético interceptado, verificou busca por nome/descrição e estado vazio, sem chamadas adicionais, aprovação ou execução.

### Achados de revisão e correções

- Revisão independente encontrou dois defeitos no exportador. URLs podiam manter `tenant_id`, `clientId` e `subscription_id`; os aliases foram adicionados à redação de query e cobertos por fixture. A geração de exemplos numéricos podia retornar o mesmo valor do `exclusiveMinimum` por arredondamento; agora escolhe o próximo `double` representável e o próximo inteiro válido ou recusa intervalos impossíveis. Os testes focados cobrem os casos.
- Os cenários de credencial permanecem somente fixtures falsas. Configurações exportadas não incorporam credenciais corporativas, e nenhuma importação real no Copilot, autenticação ou conexão Azure foi alegada.

### Validação na cópia isolada correspondente

- O código e o lockfile foram validados em `D:\DEV\FinOps\_tmp-ux04-validation-20261118`. Os arquivos exportador, testes e novas capturas foram transferidos por caminhos explícitos e conferidos por SHA-256. A comparação dos 58 caminhos foi concluída; depois, cinco E2E com seletores antigos também foram transferidos e conferidos, totalizando 63 caminhos correspondentes. O lockfile permanece igual (`FF96CDD3139A2A69D90DCFE9251D5B5AC97F2545C4BF67282BDD1F3083DB2F2B`); não foram atualizadas dependências.
- `npm run typecheck`: passou após as correções finais, incluindo o novo E2E.
- `npm run build`: passou; `/`, `/_not-found` e `/design/neumorphic` foram geradas estaticamente.
- Vitest focado de exportação/interoperabilidade: **2 arquivos, 7 testes aprovados**.
- Vitest completo serial final: **64 arquivos, 197 testes aprovados**. Uma execução anterior teve 1 falha intermitente no teste de concorrência entre processos `orchestration-store` (`storage_unavailable`/lock no seu diretório temporário); a reprodução isolada passou e a execução completa serial final passou. O teste e o código de armazenamento não foram alterados. O diretório de fixture restante `C:\Users\poyat\AppData\Local\Temp\tesseract-m13-process-race-pYvvv8` foi preservado; não havia arquivo `.lock` remanescente.
- Playwright final em Edge headless e armazenamento isolado: **3/3** (`ux02-tool-search` e os dois fluxos `ux03-inspector`). Axe não reportou violações nos estados Inspector/export cobertos. Os POSTs foram interceptados; a exploração usou fixture de `/catalog`, sem `/call`, `/approve-tools`, `/test`, `/connect`, `/auth` ou servidor MCP real.
- Uma verificação isolada do laboratório `/design/neumorphic` passou: **1 E2E**, Axe com zero violações nos dois temas no estado estável e hover do controle de tema, widths 1280/768/390 sem overflow, busca, toggle, seleção segmentada, estados disabled/loading, foco e `prefers-reduced-motion`. Duas capturas dark/light foram geradas e inspecionadas na árvore temporária; as capturas versionadas UX-01 foram visualmente conferidas e cobrem a mesma tela sem o indicador de desenvolvimento do servidor Next.
- E2E adicionais para navegação e MCP: após a CI inicial confirmar seletores antigos no M10, os seletores de heading/descoberta/segmentos foram alinhados à interface UX-03, preservando as asserções funcionais. **1/1** jornada M10 (descoberta, leitura de resource, aprovação, execução fixture e resultado) passou; **7/7** casos dos arquivos `command-center`, `workbench`, `mcp-laboratory` e `mcp-usability` passaram com dados/interceptações sintéticas. Não são integrações Azure reais.
- A configuração Playwright UX-04 tentou iniciar na porta 4317, já ocupada por um serviço de outra worktree. O processo não foi interrompido; o E2E final usou a porta isolada 4343.
- `git diff --check`: passou após as mudanças finais e antes de versionar.

### Evidências, limitações e publicação

- Capturas visuais de referência permanecem em `docs/relatorios/evidencias/ux-01/` a `ux-04/`. Não há capturas de Azure/Copilot reais. Zoom nativo de 200% e Axe em cada viewport pequeno não foram verificados nesta rodada; a cobertura responsiva inclui larguras 390, 640/768 e 1280 CSS px.
- Os dois fluxos E2E legados precisam de atualização coordenada com a navegação atual do Inspector. Não os alterei para não misturar comportamento funcional M16 na publicação UX.
- Commit UX-01/02: `b1e34de1cb453574e144456bab043251c440af74` (`feat(ux): add neumorphic lab and map pilot`).
- Commit UX-03/04: `a9e7f124ad998b534c39260bd91f4ec2452daef5` (`feat(ux): add MCP capability export and portability review`). Branch publicada; PR #17 aberta contra `main`.
- CI inicial `44313959736` no SHA `08cb5f7` falhou no Linux `npm audit --audit-level=high` com 5 vulnerabilidades altas transitivas (`picomatch`, `fdir`, `tinyglobby`, `vite`, `vitest`) e no Windows M10 por seletores antigos do heading. Nenhum lockfile foi alterado pela frente UX. Após atualizar seletores, CI `44316254676` no SHA `894ad01` passou integralmente no job Windows (incluindo M10/M12/M14 E2E); Linux passou typecheck, build e unit/protocol (61 arquivos, 190 testes aprovados; 1 arquivo e 4 testes ignorados), mas falhou no gate de auditoria. Run `44316949731` no head documental `b6802c0` repetiu os mesmos resultados.
- O advisory [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) classifica picomatch `<=4.0.7` como vulnerável e lista **nenhuma versão corrigida**. A árvore de validação tem `picomatch@4.0.7`; consulta ao registry npm retornou 404 para `picomatch@4.0.8`. `npm audit --json` oferece apenas correções `--force` com downgrades major de Vite/Vitest. Sem correção compatível disponível, preservar o lockfile e registrar o gate como bloqueio externo a esta frente, sem enfraquecer o pipeline. A validação local dos fluxos corrigidos passou **8/8**. Merge não realizado e sujeito à aprovação humana.

### Parecer e publicação

- As configurações agora distinguem formato oficialmente documentado, teste sintático e interoperabilidade com fixture. AI Shell não aparece como suporte operacional atual; manifesto é explicitamente proprietário; credenciais não são exportadas.
- O laboratório e o Inspector permanecem separados de aprovação/execução; o E2E não acionou operações MCP. Nenhuma autenticação, contrato MCP, regra de negócio, armazenamento operacional, lockfile, outra worktree ou stash foi alterada.
- `main` remoto confirmado e HEAD-base seguem iguais. A branch está publicada na PR #17 para revisão do diff cumulativo UX-01 a UX-04. A verificação não equivale a importação real do Copilot nem a teste de credenciais/servidores externos.
- Nenhum commit, PR ou merge criado. Aguardando revisão/decisão humana antes de publicar.
