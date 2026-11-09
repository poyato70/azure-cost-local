# Identidade visual TESSERACT

## Centro de inteligência — 0.4.0, 09/11/2026

Reformulação radical autorizada pelo usuário: tema escuro nativo e inversão clara persistente, superfícies em camadas, índigo/violeta, tipografia forte, árvore minimalista com ícones geométricos monocromáticos e breadcrumbs. Hero executivo e respostas de IA com origem/correlação; valores financeiros não são simulados. Foco de tarefa preservado nas telas de configuração/análise.

Next.js/React, Tailwind, Framer Motion e componente de botão no padrão shadcn/Radix. Abertura usa HTML único com Three.js e rotação 4D real, derivado do exemplo fornecido; asset original preservado. Requer CDN/WebGL e respeita movimento reduzido. Referências solicitadas: Linear, Vercel, Stripe, Raycast e Arc; sem copiar assets dessas marcas.

Capturas e validação estão em [validation.md](validation.md); aceite humano segue [checklist-v0.4.0.md](checklist-v0.4.0.md). Diretrizes abaixo permanecem como histórico.

## Identidade própria — 09/11/2026, versão 0.3.0

O usuário aprovou reformular também a identidade e a organização completa das telas. Esta seção substitui as diretrizes cromáticas de aplicação abaixo, preservadas como histórico de 06/11.

Navegação escura #171D30, destaque índigo #5556D9, texto principal #20273B, superfícies claras #F5F6FA/#FFFFFF e destaque secundário #F0CC66. O nome e símbolo geométrico permanecem; o símbolo existente mantém seu azul. Grupos de navegação: Explorar, Planejar, Assistentes, Conexões e Operação. Rótulos de status acompanham cores. Tipografia de sistema, foco visível e rolagem restrita a tabelas/JSON/nav mobile quando necessário.

Capturas atuais desktop e 390 px revisadas em `.superpowers/ux/after-multicloud.png` e `after-mobile.png`. Não representam aceite visual humano nem validação financeira. Histórico abaixo não afirma que a nova identidade seja uma marca oficial BB.

## Histórico — 06/11/2026

Atualização de 06/11/2026, aprovada pelo usuário: nome público provisório TESSERACT; subtítulo FinOps & IA; símbolo fornecido adaptado ao azul. O repositório e os caminhos técnicos continuam azure-cost-local.

## Aplicação

- Azul #465EFF: navegação, marca, botões principais, títulos, KPIs financeiros e tendência de custos.
- Amarelo #FCFC30: seleção ativa e budget em atenção, com texto #333333.
- Branco #FFFFFF: fundo principal e cartões. Cinza #F3F4F6: superfícies auxiliares.
- Verde #16A34A: sucesso e economia potencial, com texto escuro #166534 quando pequeno.
- Âmbar #F59E0B: avisos e progresso de atenção; vermelho #DC2626: crítico.
- Texto azul em fundo azulado usa #354BD6 para contraste. Navegação azul usa branco opaco; seleção amarela usa texto escuro.
- Tipografia de sistema Segoe UI/Calibri/Arial, sem download de fonte proprietária.

CSS central em src/web/styles.css; Brand compartilhada no dashboard e conclusão do login; título e favicon no index.html. Asset public/tesseract-symbol.png gerado a partir da referência fornecida, com fundo transparente e original preservado. Nome e texto ficam no HTML para legibilidade.

Budgets: sinalização visual local de atenção a partir de 80% e crítico a partir de 100%, com rótulos explícitos. Não modifica thresholds nem alertas configurados no Azure. Percentual/consumo ausente continua indisponível; não é marcado como saudável. Economia potencial só recebe destaque quando há valor e moeda.

A referência cromática corresponde ao manual da Fundação BB fornecido pelo usuário. Esta aplicação não afirma homologação oficial ou que esse manual seja a versão mais atual de todo o conglomerado: https://fbb.org.br/wp-content/uploads/2024/10/Manual-da-Marca-Fundacao-Banco-do-Brasil-maio25.pdf.

## Validação

Build, typecheck e 14 testes Edge passaram. Health local retornou ok=true. Revisão independente final apontou contraste de textos pequenos no fundo azul suave e opacidade da sidebar; corrigidos com tom de texto específico e branco opaco. Inspeção com dados sintéticos verifica custos, estados de budgets, carregamento do símbolo e login em 1440, 1024 e 390 px. A barra de ações do Hub foi ajustada para quebrar linhas no notebook.

Capturas locais e roteiro de inspeção em .superpowers/tesseract (ignorados pelo Git). Dados exibidos nas capturas são fixtures, não consultas reais à Azure. A mudança visual não comprova autenticação, permissões, custos reais ou inferência com dados reais. O aceite visual final cabe ao usuário.
