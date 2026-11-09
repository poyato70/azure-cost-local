# Migração para outro notebook Windows

Versão local, 03/11/2026. Repositório privado: https://github.com/poyato70/azure-cost-local. Faça a instalação com o usuário Windows que utilizará a aplicação.

## 1. Preparar o computador

Instale Git for Windows, Node.js 24 (com npm), PowerShell 7 e Microsoft Edge. GitHub CLI é recomendado para obter o repositório privado. Azure CLI, Python, Docker e .NET não são exigidos para executar o dashboard. O MCP local pode baixar seu próprio binário no primeiro uso; mantenha acesso HTTPS ao registro npm e aos serviços Microsoft.

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Microsoft.PowerShell -e
winget install --id GitHub.cli -e
```

Confirme `node --version`: use a linha 24 para reproduzir o ambiente validado. O pacote LTS do WinGet pode mudar; se instalar outra linha, obtenha Node 24 no site oficial. Feche e reabra o terminal após as instalações.

```powershell
node --version
npm --version
pwsh --version
git --version
gh auth login
```

PowerShell do Windows (`powershell.exe`) também precisa permanecer disponível: a proteção dos Secrets usa DPAPI através dele. Não é necessário instalar módulos PowerShell adicionais.

## 2. Copiar o código e instalar as bibliotecas

Prefira uma pasta local fora do OneDrive:

```powershell
New-Item -ItemType Directory -Path C:\Projetos -Force
Set-Location C:\Projetos
gh repo clone poyato70/azure-cost-local
Set-Location azure-cost-local
npm ci
npm run typecheck
npm test
npm run build
```

`npm ci` instala as versões do `package-lock.json`. Não copie `node_modules` ou `dist` do notebook anterior.

| Componente | Instalação / finalidade |
|---|---|
| React, Recharts e Vite | Instalados por npm ci; interface e gráficos |
| Fastify e plugins cookie/static | Instalados por npm ci; serviço local |
| MSAL Node | Instalado por npm ci; login Microsoft e identidade de aplicação |
| GitHub Copilot SDK | Instalado por npm ci; comunicação com Copilot CLI |
| MCP SDK, Undici, Zod e Decimal.js | Instalados por npm ci; protocolo, rede, validação e valores monetários |
| TypeScript, Vitest, Playwright, Prettier | Instalados por npm ci; build e verificações |
| Azure MCP 3.0.0 | Baixado sob demanda pelo executor npm da aplicação ao testar conexão local Azure/ADX |
| Fabric MCP 1.7.0 | Baixado sob demanda ao testar conexão local Fabric |

Os números exatos de todas as dependências estão em package.json e package-lock.json. Os MCPs remotos Foundry/Fabric/Power BI não exigem pacote local correspondente.

## 3. Configurar o GitHub Copilot

Para usar **Copilot local**, instale o CLI oficial, separado da extensão do VS Code:

```powershell
npm install -g @github/copilot
copilot --version
copilot
```

Dentro do Copilot, use `/login` e conclua o fluxo GitHub. A assinatura e a política da organização precisam permitir o Copilot CLI. A versão anteriormente verificada neste notebook foi 1.0.106-2; a instalação sem versão fixa obtém a versão disponível no momento e precisa ser validada novamente. Não copie tokens, arquivos de credenciais ou a pasta `.copilot` do computador anterior.

Na aplicação, abra Chat e execute **Verificar Copilot**. Extensões do VS Code, plugins do Codex e skills não são necessários para executar esta aplicação. Codex é opcional para continuar o desenvolvimento; as skills usadas durante a construção não são bibliotecas da aplicação. O chat restringe o catálogo do Copilot às ferramentas mediadas pela aplicação, sem importar automaticamente MCPs/skills do editor.

Referência: [instalação oficial do Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli).

## 4. Recriar os acessos e agentes

Inicie o serviço:

```powershell
pwsh -File .\scripts\start.ps1
```

Abra http://localhost:4317. Em **Acessos**, cadastre nome, Tenant ID e Application (Client) ID.

- Usuário: configure no Entra o retorno `http://localhost:4317/api/auth/callback` na plataforma pública desktop/mobile; permissões delegadas e MFA seguem as políticas do tenant. Entre pelo popup Microsoft.
- Aplicação: informe **Secret Value**, não Secret ID, e selecione identidade de aplicação. Não aparece login do usuário para obter esse token. A aplicação precisa de RBAC e permissões próprias, por exemplo Cost Management Reader no escopo autorizado. Identificadores e Secret não concedem permissões automaticamente.
- Agente cadastrado: informe endpoint Azure OpenAI/Foundry compatível com Chat Completions v1, deployment/modelo e chave de inferência ou acesso Entra. A chave do modelo é diferente do Client Secret. O teste de inferência pode consumir recursos do provedor.
- MCPs: refaça os vínculos, contexto de recursos, autenticação e aprovação de ferramentas. Para HTTP próprio Azure/ADX, informe audience `api://ID-do-aplicativo-do-servidor`, configurada no Entra pelo responsável pelo servidor. Não use a audience ARM de saída como autenticação de entrada desse servidor.

Metadados e Secrets ficam em `%LOCALAPPDATA%\AzureCostLocal\config`, fora do repositório. Os Secrets são protegidos por DPAPI do usuário Windows e **não são portáveis por cópia simples**. Recomendação: recrie os cadastros e informe os Secrets novamente no novo notebook. Não envie o diretório vault ao GitHub/OneDrive. Não há exportação portátil de credenciais nesta versão. IDs de perfis e vínculos também são recriados; recadastre agentes e MCPs depois dos acessos.

## 5. Validar e operar

```powershell
npm run test:e2e
Invoke-RestMethod http://localhost:4317/api/health
```

Os testes Edge usam dados sintéticos e não confirmam sua conta Azure. Para o aceite real, conecte um acesso e compare um custo com o portal usando o mesmo período, subscription/RG, moeda e base real/amortizada. Depois valide uma ferramenta MCP aprovada e uma pergunta do agente. Cada serviço depende das permissões, recursos e licenças do tenant.

Parar e reiniciar, dentro da pasta do projeto:

```powershell
pwsh -File .\scripts\stop.ps1
pwsh -File .\scripts\start.ps1
```

Os perfis salvos permanecem; sessões e cache são refeitos. O serviço não inicia automaticamente com o Windows. Para diagnóstico no terminal use `npm start` depois do build, encerrando com Ctrl+C. Evite duas instâncias simultâneas. ERR_CONNECTION_REFUSED indica verificar se o serviço está iniciado; porta ocupada exige encerrar a instância anterior. AADSTS50011 exige conferir o retorno Entra exato. Não reutilize URLs antigas de callback.

Atualizações futuras:

```powershell
pwsh -File .\scripts\stop.ps1
git pull --ff-only
npm ci
pwsh -File .\scripts\start.ps1
```

Preserve alterações locais antes de atualizar. Não exponha o serviço local à rede. Teams, SharePoint e hospedagem multiusuário exigem outro desenho de implantação e não fazem parte desta migração.

## Ampliação FinOps hub

Ao migrar, recadastre também os Hubs depois dos acessos e MCPs; configure Database Viewer e valide o schema v1_2. Nenhuma dependência adicional é exigida para consultar ADX remoto. Não instale Docker, módulos FinOpsToolkit ou plugins globais apenas para usar esta integração. Veja [roteiro específico](finops-hub-guide.md).

## Atualização 0.3.0 — multicloud

No novo notebook, use `D:\DEV\FinOps\Tesseract`, Node.js 24 e `npm ci`, `npm run build`, `npm start`. As dependências AWS (`@aws-sdk/client-cost-explorer`, `@aws-sdk/credential-providers`) e GCP (`@google-cloud/bigquery`) estão fixadas no lockfile e são instaladas por `npm ci`.

Opcionais por fonte: AWS CLI com perfil/SSO; Google Cloud CLI com ADC; kubectl/oc apenas quando necessário para alcançar OpenCost. Copilot não é necessário para esses três conectores. MCPs e chat mantêm seus requisitos anteriores. [Guia multicloud](multicloud-guide.md).

Reautentique AWS/ADC no novo Windows. O cofre DPAPI é vinculado ao usuário/máquina: copiar arquivos não garante descriptografia em outro notebook. Preserve a cópia original e recadastre os segredos pelo fluxo autorizado; não os publique no GitHub.

Para desenvolvimento visual, Product Design foi usado para auditoria de fluxos com capturas atuais, complementado por testes de navegador. É ferramenta de desenvolvimento, não dependência de execução da aplicação. Nenhum plugin/skill precisa ser instalado para abrir o dashboard.

## Atualização 0.4.0 — Next.js e centro de inteligência

Node.js 24 permanece obrigatório nesta rodada. `npm ci` instala Next.js, Tailwind, Framer Motion, Radix e dependências fixadas no lockfile. `npm run build` exporta o frontend para `dist/web` e compila o serviço local; `npm start` mantém a aplicação em localhost:4317. `npm run dev` observa o serviço após build; alterações de frontend exigem nova compilação. Não há proxy implícito de um servidor Next separado.

`scripts/start.ps1 -SkipBuild` usa a última compilação concluída. O script sem parâmetro recompila. A inicialização espera health check antes de abrir o navegador. Animação 4D depende de Three.js via CDN e WebGL; confirme acesso à CDN na rede corporativa. A falha da animação não impede fechar o popup e usar o sistema. O arquivo original de referência em Assets foi preservado.

[Roteiro completo de validação 0.4.0](checklist-v0.4.0.md). Reautenticar provedores e validar dados financeiros no novo notebook; nenhum teste sintético substitui essas etapas.
