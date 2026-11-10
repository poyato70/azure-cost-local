# Correções MCP — 10/11/2026

Escopo autorizado: cadastro/exclusão, identidade e endpoint claros, separação Integração/Análise e descoberta real.

Evidência: cadastro/exclusão funcionaram em cópia isolada. Em localhost, POST criou uma conexão temporária, DELETE com Content-Type JSON e sem corpo retornou 500; a mesma exclusão sem esse header retornou 200. Conexão temporária removida; cadastros do usuário preservados. A falha de criação relatada não foi reproduzida e não será alegada como corrigida sem evidência.

1. Corrigir Content-Type de pedidos sem corpo e classificação de JSON vazio, com correlação.
2. Exibir resumo de provider/transporte/execução/endpoint/autenticação/pacote/namespace antes e depois do cadastro. stdio não tem endpoint HTTP e seu OAuth ocorre no acesso Azure.
3. Separar componentes por tela; não navegar automaticamente ao conectar. Identificar o acesso salvo pelo nome e oferecer ação explícita para conectar a identidade. Análise sem cartões de edição/exclusão.
4. Busca online paginada no MCP Registry oficial, com metadados e preparação explícita de cadastro, sem executar pacotes ou atestar a segurança de publicações. Manifesto personalizado e documentação continuam como recursos secundários.
5. Testes de regressão, build/typecheck, revisão independente e publicação/registro Linear já autorizados.

Limites: acesso Azure real não é presumido, descoberta não instala nem autentica um MCP. Não alterar .vscode do usuário.


Concluído: correções 1–4 e revisão independente; 113 serviços, 32 Edge, typecheck/build aprovados. Consulta real do Registry e preservação de cadastros verificadas. Aceite Azure/OpenShift corporativo não presumido.
