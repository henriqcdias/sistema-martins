# Gate de homologação remota — Sistema Martins

**Alvo exclusivo:** `oczxyiakpmgnrpoyhwov` (Sistema Martins - Homologação). **Não executar em** `kkjwmnxgcbonbwavaaya` (produção).

## Pré-requisitos verificados
- Migrações 001–009 registradas no projeto separado.
- 26 tabelas em `martins_hml_v1` com RLS habilitada.
- Buckets `martins-hml-documentos-v1` e `martins-hml-financeiro-v1` privados.
- Registro `ambiente` aponta para o projeto de homologação.
- O script de provisionamento foi corrigido para **conferir** o registro de ambiente em vez de reinseri-lo.

## Bloqueadores de aceite
1. **Auth:** criar quatro contas fictícias separadas por processo autorizado e seguro; o banco não possui essas identidades. Nunca inserir senhas ou tokens no repositório.
2. **Matriz de permissões:** o contrato `membros` usa `administrador`, mas não implementa o papel `master` nem o compartilhamento financeiro por documento requerido para José Henrique. Não declarar o cenário de três Masters homologado até existir RLS/RPC correspondente e testes de negação.
3. **Storage:** executar upload/download real com JWT de usuários de empresas diferentes; testar que URLs públicas e acesso anônimo não liberam documentos.
4. **Data API:** conferir se `martins_hml_v1` é schema exposto e se a integração do frontend usa exclusivamente URL/chave pública do ambiente separado.
5. **Operações:** verificar idempotência, conflito de versão, lançador financeiro, NF-e e classificação de despesas com usuários reais de teste.
6. **Segurança:** inspecionar privilégios efetivos, políticas e funções SECURITY DEFINER; registrar evidências de negação e auditoria.
7. **Site:** disponibilizar endereço de homologação isolado, sem alterar Netlify de produção.

## Critério de liberação
Somente marcar homologação concluída quando testes positivos e negativos de Auth, RLS, Storage, RPC e navegação mobile/desktop passarem. Não copiar dados reais nem publicar em produção por inferência.
