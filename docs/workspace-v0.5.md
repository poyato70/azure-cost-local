# Workspace de integrações — 0.5.0

O início agora apresenta conectar → explorar/testar → configurar agente → vincular conhecimento. Análises financeiras continuam disponíveis, sem migração destrutiva das configurações.

## MCP independente

Escolha Kubernetes/OpenShift ou MCP HTTP personalizado em Conexões → MCPs → Integração. Informe um endpoint **MCP Streamable HTTP**, não a API do cluster nem uma página GitHub. O servidor deve estar instalado e iniciado pelo operador. Somente HTTP nesta entrega; não há execução de comandos arbitrários.

Autenticação: sem autenticação no endpoint ou token Bearer próprio, protegido pelo cofre Windows. O token MCP não é necessariamente o token Kubernetes: a credencial do cluster é configurada no servidor. HTTP sem TLS é permitido apenas em loopback explicitamente autorizado; rede corporativa exige HTTPS e autorização da rede privada. OAuth genérico, Device Code, certificados e GitHub Models não foram acrescentados.

Não é necessário um acesso Azure para testar MCPs independentes. Servidores Microsoft preservam as exigências de identidade e escopo existentes. O preset ARM continua delegado, com toolset CostManagement.

Em Análise, descubra o catálogo e revise as tools. Conectores independentes exigem `annotations.readOnlyHint === true` e ausência de `destructiveHint === true`, além de aprovação explícita. Essas indicações são fornecidas pelo servidor e **não garantem ausência de efeitos colaterais**. Use um servidor confiável configurado para leitura e RBAC de leitura no provedor. Tools sem essas indicações podem ser inspecionadas, mas não executadas nesta versão.

O hash de aprovação agora considera schema e annotations. Aprovações antigas precisam de nova revisão; credenciais e cadastros não são apagados. Trocar endpoint de conexão com Bearer exige substituir ou remover a credencial. Revogar a conexão cancela chamadas em andamento.

## Conhecimento e skills

Importe um arquivo Markdown público do GitHub fixado a SHA completo de commit. Revise a origem antes de autorizar a importação. Cada versão preserva origem, commit, caminho, licença declarada, hash SHA-256 e data. Pesquisa local por nome, caminho e conteúdo; documentos são exibidos como texto, sem executar HTML ou scripts.

Máximo de 100 documentos, 32 kB por arquivo, 5 documentos vinculados por agente e 48 mil caracteres de contexto combinado. Referências relativas, arquivos auxiliares e scripts de uma skill não são baixados automaticamente. Não há clonagem de repositório, indexação semântica, sincronização automática nem autenticação GitHub privada. A licença declarada pelo operador não é verificada automaticamente.

Vincule versões em Agentes. O runtime local inclui o conteúdo no contexto enviado ao modelo somente com os vínculos selecionados e consentimento do chat. O conteúdo orienta o modelo, mas não concede permissões de tools. Agentes HTTP remotos não recebem esse conhecimento. Uma versão vinculada não pode ser excluída até remover o vínculo.

## Investigação

Para MCP independente: configure agente com runtime local, endpoint de modelo Azure suportado, credencial de inferência, conexão e tools aprovadas. Abra Investigações, selecione MCP e agente. Não recebe filtros Azure e não exige login Azure quando a inferência usa API key. Inferência com Entra ainda depende do acesso Microsoft apropriado. Credenciais do modelo e MCP são separadas.

Para Azure/Copilot: abra Chat, conecte o acesso e selecione fonte/escopo. O Copilot continua no fluxo Azure existente; não foi habilitado para o novo fluxo independente. O agente opera sobre uma conexão MCP selecionada por investigação, não correlaciona automaticamente todos os MCPs vinculados.

Resultados mostram fonte, operação, correlação, tempo e retorno de tool. A contagem de tokens continua dependente do provedor; não há estimativa financeira sem tarifa. Esta versão não é um gateway compartilhado nem uma plataforma corporativa multiusuário.

Topologia, auditoria diária, importação privada e múltiplos provedores de inferência permanecem evoluções posteriores. Testes controlados não comprovam acesso Azure/OpenShift corporativo nem valores financeiros reais.
