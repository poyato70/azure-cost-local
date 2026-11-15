# Missão 09 — QA visual do mapa de conexões

## Resultado final: passed

### Alvo e evidência

- **Fonte visual:** imagem anexada nesta conversa, `Foto 1.jpg` (1280 × 433 px; captura recortada do mapa).
- **Implementação:** Tesseract servido localmente em `http://127.0.0.1:4317/`, tela Conexões MCP → Integração.
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
- **Responsividade:** viewport disponível testado em 1280 × 720. Viewport móvel dedicado não foi capturado; regra mobile de empilhamento foi inspecionada no CSS, mas falta validação visual em dispositivo estreito.
- **Console:** não foram coletados logs de console após a correção; o build e o render pós-correção foram observados.

### Pendências menores

- **P3:** aproximar a tipografia monoespaçada usada na atividade do protótipo, caso essa distinção seja mantida após revisão de produto.
- Uma captura visual em viewport móvel permanece recomendada. O QA desta comparação desktop passou; não é declaração de aceite visual de todos os breakpoints.

## Checklist

- [x] Abrir referência e captura da implementação.
- [x] Corrigir stylesheet ausente no entrypoint Next e recapturar.
- [x] Conferir estado real do mapa, seleção de catálogo, atividade e foco de teclado.
- [x] Registrar diferenças responsivas e de estado ilustrativo.
- [ ] Revisar captura móvel antes de integrar PR #4.
