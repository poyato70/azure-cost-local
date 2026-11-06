# Identidade visual TESSERACT

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
