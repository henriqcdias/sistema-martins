# Auth e sincronização de homologação — 06/11/2026
Base remota: 75f406987e17.

Conector existente foi ampliado sem conexão automática. O diagnóstico original continua somente leitura. Modo separado de homologação usa membros e registros do schema martins_hml_v1; não depende de promover perfis do banco existente.

- Refresh token permanece somente em memória. Renovações simultâneas compartilham uma troca; nova identidade e perfis são verificados no servidor. Logout, mudança de configuração e resposta não autorizada invalidam chamadas pendentes.
- Leitura e escrita isoladas revalidam a identidade no endpoint Auth e a permissão na RPC do servidor. Tenant, módulo, ID e versão da resposta são conferidos. Escrita financeira, fechamento e vales continuam bloqueados pelo contrato genérico.
- Conferência explícita carrega um registro antes de preparar a operação. Não existe importação ou cópia automática das bases locais. Sem versão conhecida não há preparação de gravação.
- Rede incerta mantém conteúdo e ID da operação; repetição usa o mesmo ID. Conflito não sobrescreve remoto. Reconciliação compara conteúdo e versão. Logout remove a conferência sensível da página.
- Tela de conexão oferece renovação e conferência isolada de registro sintético em projeto separado. Configuração pública continua vazia no código.

510 testes aprovados; 64 scripts compilados; auditoria de segredos executada antes do envio. Dezesseis novos testes do conector e da sincronização. Testes HTTP usam transporte simulado; não alegar login remoto, PostgREST ou sincronização com dados reais. Os vinte testes PostgreSQL da etapa anterior foram repetidos.

A instalação e exposição do schema no PostgREST de um projeto separado, os usuários reais de homologação e o inventário remoto ainda não estão disponíveis neste ambiente. Nenhuma política, tabela, sessão real ou arquivo foi criado no Supabase remoto. Nenhuma publicação no Netlify ou alteração de main.
