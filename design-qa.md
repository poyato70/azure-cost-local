# Missão 09 — QA visual do mapa de conexões

## Resultado final: aprovado nos três viewports solicitados

### Alvo e evidência

- **Fonte visual:** imagem anexada nesta conversa, `Foto 1.jpg` (1280 × 433 px; captura recortada do mapa).
- **Implementação desktop observada:** Tesseract local na tela Conexões MCP → Integração; captura ao vivo via CUA em 1280 × 720.
- **Execução responsiva:** build de produção servido isoladamente em `http://127.0.0.1:14317/`, com `LOCALAPPDATA` dedicado em `test-results/m09-isolated-appdata` e APIs simuladas somente nos testes Playwright.
- **Captura da implementação:** screenshot do navegador Codex via CUA, viewport 1280 × 720 CSS px, densidade do navegador 1 CSS px por pixel da captura. A ferramenta exibiu a captura na sessão, mas não ofereceu caminho local exportável; URL e estado foram registrados aqui.
- **Estado comparado:** tema escuro; Azure selecionado; integração Azure OpenAI Usage selecionada. A referência usa estado ilustrativo “Consultando”; a implementação exibe capacidades de catálogo e eventos reais de diagnóstico, sem simular consulta.
- **Comparação geral:** cabeçalho do mapa, seleção de provedor, lista de integrações e painel lateral de atividade foram inspecionados na captura ao vivo após a compilação corrigida.
- **Comparação focada:** cartões e relacionamento provedor → integração → capacidades; painel de atividade à direita; legendas de catálogo/preset/configurado/ativo.

### Achados e histórico de iteração

1. **[P2 corrigido] Folha de estilo M09 não carregada na aplicação servida pelo Next.**
   - Evidência inicial: captura ao vivo mostrava blocos sem grid, confirmação por `getComputedStyle` (`display: block`, `grid-template-columns: none`).
   - Causa: a aplicação Next usa `app/layout.tsx`; o import estava somente em `src/web/main.tsx`.
   - Correção: importar `src/web/styles-mission09.css` em `app/layout.tsx`, reconstruir e reiniciar o serviço local.
   - Evidência pós-correção: mapa renderizado com colunas, cartões, superfícies escuras, acentos lilás/ciano e atividade lateral. As medidas computadas mostraram grid de duas colunas no conteúdo principal e painel de atividade; detalhes de capacidade ocupam linha seguinte no espaço estreito disponível.

2. **Diferença responsiva esperada — sem ação pendente.**
   - A referência mostra três colunas e barra horizontal num canvas amplo sem navegação lateral. A implementação reserva espaço para sidebar; com viewport 1280 × 720, o mapa mede cerca de 919 px de largura e reflowa as métricas abaixo de provedor/integração. O painel de atividade permanece à direita. A missão permite empilhar/reorganizar colunas em larguras menores; não houve overflow horizontal do mapa.
   - No desktop largo, os media queries da folha M09 voltam a apresentar três colunas quando há espaço suficiente.

3. **Diferença intencional de conteúdo.**
   - A imagem mostra consulta de Azure OpenAI em progresso. O catálogo atual descreve tokens de entrada/saída e série diária, mas não oferece nessa versão um fluxo de consulta correspondente. A implementação identifica o item como referência de catálogo e não inventa status, etapas ou sucesso.
   - O painel real mostrou eventos `GET /api/agents`, `/api/mcp-connections` e `/api/accesses` com HTTP 200. Nenhuma mensagem de “consultando” foi fabricada.

### Superfícies de fidelidade

- **Tipografia:** hierarquia executiva e rótulos compactos mantidos; captura de referência usa conteúdo monoespaçado no painel de atividade, enquanto a UI usa a tipografia do produto. Diferença leve, classificada como P3.
- **Espaçamento/layout:** cards, três etapas numeradas e painel lateral mantidos; no viewport capturado, o detalhe de métricas reflowa para preservar legibilidade. Sem controles persistentes ocultos ou overflow observado.
- **Cores/tokens:** fundo escuro, superfícies profundas, realces lilás e ciano e estados distinguíveis; alinhados à direção visual da referência.
- **Ícones/ativos:** ícones da biblioteca Lucide já usada no produto; nenhuma ilustração de referência foi substituída por arte CSS.
- **Texto/estados:** categorias e capacidades de catálogo separadas de perfil salvo/conexão; atividade real e estado vazio explícito.
- **Teclado/foco:** navegação por Tab percorreu os itens do mapa; foco visível violeta foi confirmado por estilo computado (`outline` sólido).
- **Interações primárias:** selecionar Azure/AWS e alternar integração alterou os itens e capacidades; Azure foi restaurado ao final.
- **Responsividade (registro histórico):** a primeira comparação desta missão cobriu apenas 1280 × 720; o fechamento abaixo concluiu os viewports mobile e tablet.
- **Responsividade (fechamento):** Playwright definiu e mediu viewports de 390 × 844, 768 × 1024 e 1280 × 720. Não houve overflow horizontal. Mobile empilha Provedor → Integração → Métricas/Capacidades → Ações → Atividade; tablet e desktop mantêm as etapas do mapa legíveis, com atividade ao lado no desktop e abaixo no tablet.
- **Navegação/formulário/alvos:** fluxo MCP → Integração percorreu o mapa e formulário. Botões de seleção do mapa mediram pelo menos 44 CSS px de altura; menu móvel abriu e fechou no teste responsivo, e Tab percorreu os provedores com foco visível.
- **Estados e acessibilidade observada:** teste controlou loading da atividade, estado vazio, erro HTTP, foco Tab/visível e `prefers-reduced-motion: reduce`; não foram observados erros `pageerror`. Isso não substitui uma auditoria WCAG/axe completa.
- **Capturas Playwright:** `test-results/m09-mobile-390x844.png`, `test-results/m09-tablet-768x1024.png` e `test-results/m09-desktop-1280x720.png` (full-page; largura CSS igual ao viewport de referência). Diretório permanece ignorado pelo Git conforme política do projeto.
- **Console:** não foram coletados logs de console após a correção; o build e o render pós-correção foram observados.

### Limitações restantes

- **P3:** aproximar a tipografia monoespaçada usada na atividade do protótipo, caso essa distinção seja mantida após revisão de produto.
- Não foi executada auditoria automatizada axe/WCAG nem coleta geral de logs do console; o teste verifica `pageerror`, teclado/foco e alvos mínimos, e os limites de overflow medidos.

## Checklist

- [x] Abrir referência e captura da implementação.
- [x] Corrigir stylesheet ausente no entrypoint Next e recapturar.
- [x] Conferir estado real do mapa, seleção de catálogo, atividade e foco de teclado.
- [x] Registrar diferenças responsivas e de estado ilustrativo.
- [x] Revisar captura mobile, tablet e desktop antes de integrar PR #4.
- [x] Percorrer navegação mobile, foco de teclado, estado de loading/vazio/erro e movimento reduzido.

---

# Missão 12 — QA visual da jornada MCP A→B

## Resultado final: passed

### Fontes e implementação comparadas

- Referências abertas: `C:\Users\poyat\Downloads\ui_modelo.jpg` (grafite, botões com relevo e brilho ciano/coral), `C:\Users\poyat\Downloads\image (7).png` (grafo de nós) e `C:\Users\poyat\Downloads\atahan_guc_pindown.io_1794792848.mp4` (pulso ao longo da conexão).
- Implementação comparada em build local de produção, com dois servidores MCP Streamable HTTP sintéticos e independentes. A topologia foi reduzida ao escopo solicitado: caminho sequencial A→B; não foram adicionados ramos.
- O componente M09 continua com tema e tokens existentes. O painel M12 acrescenta superfícies grafite, relevo discreto e brilho ciano localizado no trecho em chamada; estados incluem rótulo, não dependem só de cor/movimento.

### Evidência inspecionada

- `test-results/mission-12/mission12-awaiting-b-1280x720.png`: estado de autorização B, campos transferidos e mapa do caminho.
- `test-results/mission-12/mission12-flow-390x844.png`: página empilhada em mobile sem overflow horizontal.
- `test-results/mission-12/mission12-flow-768x1024.png`: cartões e atividade refluem em tablet.
- `test-results/mission-12/mission12-flow-1280x720.png`: composição desktop com atividade, caminho e resultado concluído.
- Playwright mede `scrollWidth <= innerWidth + 1` nos três viewports, revisa axe sem violações, Tab/foco visível e computed animation duration de 0s em movimento reduzido.

### Achados e correções

1. **[P1 corrigido] Nomes iniciais de ferramentas não correspondiam às tools MCP da fixture controlada.** A primeira execução via navegador falhou em A; atividade real mostrou `failed`, sem chamada B. Valores iniciais da UI foram alinhados às tools anunciadas; a nova execução chegou ao estado de confirmação B e concluiu.
2. **Layout responsivo:** path A→B empilha abaixo de 600px; 390px, tablet 768px e desktop 1280px passaram sem overflow. A tela longa contém também formulários já existentes da página Conexões MCP; não foram removidos nesta missão.
3. **Movimento e estados:** pulso é aplicado na aresta enquanto B está em execução, e removido sob reduced motion. Labels de etapa e estado mantêm a informação acessível sem depender do pulso.

### Limitações

- Capturas foram feitas com Playwright Chromium headless; não há validação manual em navegador físico ou leitores de tela.
- Axe passou no estado concluído. O teste de integração MCP exercita falha/bloqueio/schema, porém a inspeção visual dedicada concentra-se nos estados pendente e concluído.

### Checklist

- [x] Abrir as três referências e comparar o estilo dos controles e do grafo com a implementação.
- [x] Capturar e inspecionar estados de confirmação e conclusão em desktop, tablet e mobile.
- [x] Verificar acessibilidade automatizada, foco de teclado e movimento reduzido.
- [x] Registrar overflow, topologia sequencial e limitações.
