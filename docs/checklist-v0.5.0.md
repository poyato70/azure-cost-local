# Aceite — workspace 0.5.0

Registrar ambiente, versão do MCP, identidade, permissões, resultado esperado/obtido e correlação. Não incluir senhas, tokens ou URLs OAuth nos registros.

## Inicialização e preservação
- [ ] `npm ci`, `npm run build`, `npm start`; abrir localhost:4317.
- [ ] A página inicial mostra o percurso de integração sem exigir login Azure.
- [ ] Cadastros anteriores permanecem; tema, navegação e análises financeiras funcionam.
- [ ] Revisar novamente aprovações de tools da versão anterior (hash inclui annotations).

## MCP independente e OpenShift
- [ ] Iniciar servidor Kubernetes/OpenShift compatível, configurado para leitura e credencial do cluster.
- [ ] Cadastrar endpoint Streamable HTTP. Uma URL da API do cluster deve falhar claramente como endpoint inadequado, sem afirmar sucesso.
- [ ] Testar sem identidade Azure; verificar servidor/versão/catálogos.
- [ ] Se usar Bearer, salvar sem expor o token no catálogo ou diagnóstico.
- [ ] Confirmar diferença entre descoberta do protocolo e sucesso de uma leitura autorizada.
- [ ] Tool sem readOnlyHint ou com destructiveHint não pode ser aprovada.
- [ ] Aprovar leitura, preencher formulário gerado pelo schema, executar e verificar retorno bruto/correlação.
- [ ] Conferir namespace real e métricas com fonte independente; não interpretar CPU/memória como custo monetário.
- [ ] Alterar endpoint exige substituir/remover token; contrato alterado exige nova aprovação.
- [ ] Revogar/desconectar durante leitura: cancelar operação e impedir publicação de resultado obsoleto.

## Conhecimento
- [ ] Revisar um Markdown público, usar URL com SHA completo e declarar licença/autorização.
- [ ] Branch `main`, scripts e arquivos acima de 32 kB são recusados.
- [ ] Buscar um termo do conteúdo; conferir fonte, commit e hash.
- [ ] HTML/script presente no Markdown é mostrado como texto.
- [ ] Vincular uma versão ao agente; verificar no chat o aviso de envio ao modelo.
- [ ] Excluir documento vinculado é bloqueado; desvincular permite remoção local.
- [ ] Validar que repositórios privados e referências relativas não são anunciados como suportados.

## Agente e investigação
- [ ] Configurar modelo suportado, credencial própria, MCP e tools aprovadas.
- [ ] Em Investigações, selecionar MCP independente e agente vinculado, autorizar envio de contexto e perguntar sobre namespaces.
- [ ] Conferir fonte, tool, correlação, retorno, fases e tokens quando informados.
- [ ] Agente sem vínculo/sem aprovação não consegue executar tool.
- [ ] Cancelar e revogar consentimento interrompe novas chamadas.
- [ ] Agente HTTP remoto não aceita vínculo de conhecimento local.

## Azure preservado
- [ ] Autenticar usuário no ARM MCP oficial; listar catálogo e liberar leituras CostManagement.
- [ ] Consultar gasto de RG nos dois meses civis completos anteriores e conciliar moeda/período com Cost Management.
- [ ] Separar previsão de realizado; verificar limites/truncamento do retorno MCP.
- [ ] APIs diretas com identidade de aplicação continuam funcionando conforme RBAC.
- [ ] Copilot local continua funcionando no Chat com consentimento.

## UX e diagnóstico
- [ ] Verificar 1440, 1024 e 390 px, temas claro/escuro e teclado.
- [ ] Confirmar que formulários não expõem um sucesso global ambíguo após falha de tool.
- [ ] Diagnóstico permite localizar a operação pelo ID e distinguir HTTP de resultado MCP.
- [ ] Aceite humano: uma pessoa conecta e testa o MCP sem instruções externas além da ajuda da aplicação.
