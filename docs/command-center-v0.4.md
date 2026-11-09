# Tesseract 0.4 — operação e limites

React/Next.js exporta o shell estático; Fastify mantém APIs, autenticação, cofre e execução local em localhost:4317. Tailwind e Framer Motion compõem a interface, com botão baseado no padrão shadcn/Radix. Tema escuro nativo e inversão persistente. Nenhuma informação financeira é simulada no hero: contagens são cadastros; resposta de IA só aparece após chat, com contexto e correlação.

`npm ci`, `npm run build`, `npm start`. Desenvolvimento do serviço: `npm run dev` após build do frontend. Após mudanças de interface, executar novo build. Não existe servidor frontend separado com proxy implícito. `scripts/start.ps1 -SkipBuild` inicia a última compilação; uso normal sem parâmetro recompila.

O frame `public/tesseract-4d.html` deriva da referência fornecida em `D:\DEV\FinOps\Assets\tesseract-4d.html`, cujo original permanece preservado. É um único HTML/CSS/JS usando Three.js r128 via CDN: 16 vértices, 32 arestas, rotações XW/YW/ZW antes da perspectiva W→3D, câmera orbitável manualmente e zoom. Requer acesso à CDN e WebGL; indisponibilidade não bloqueia a aplicação. Movimento reduzido estabiliza a projeção; fechar o popup remove o iframe. A política de scripts do shell usa hashes; a CDN não é liberada globalmente.

MCP: Integração configura e testa; Análise lista capacidades, tools, prompts e resources e permite leituras explícitas; Descoberta lista fontes oficiais e manifestos HTTPS declarados pelo usuário. Limites de autenticação/adaptador permanecem por preset. Listar servidores AWS/GCP não transforma o registry Microsoft num autenticador universal. Manifestos não executam comandos, não instalam nada e não desativam política de endpoints. Resources dinâmicos por template não estão disponíveis no executor desta versão; somente URIs efetivamente listadas.

APIs: a área de avaliação oferece catálogo das operações já implementadas e testes de leitura Azure de custos/budgets/tags. AWS/GCP/OpenCost usam os testes em Visão multicloud, com pré-requisitos/consentimento próprios. Agentes mostram configuração, limites e teste sintético/health; teste financeiro real depende de chat e tools autorizadas.

Custos por tag usa `Query API.dataset.filter.tags` e retorna gastos históricos por ResourceId no escopo/período selecionado. Não interpreta tag atual como histórica; não presume herança. Não executa cruzamento entre fontes quando a consulta direta já resolve o filtro. Cruzamentos genéricos de inventário/MCP, autenticação universal, prompts de escrita e templates de resources não foram implementados e não são alegados como capacidades verificadas.

Referências visuais consultadas: Linear, Vercel, Stripe, Raycast e Arc, conforme URLs solicitadas. Nenhum asset dessas marcas foi copiado. Nova rodada de aceite: [checklist-v0.4.0.md](checklist-v0.4.0.md). Testes automatizados não comprovam permissões, valores financeiros reais nem aceite visual humano.
