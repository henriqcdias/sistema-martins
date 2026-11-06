# Procedimento para homologação REAL do Supabase

## Estado atual
Painel do Supabase verificado nesta execução: tela de login, sem sessão administrativa disponível. Não há URL/chave pública nem usuários de teste configurados neste ambiente. O preflight foi executado e registrou **bloqueado, zero testes remotos**. Nenhum script foi aplicado no Supabase remoto.

## 1. Selecionar o ambiente
No Dashboard do Supabase, entre na conta e selecione exclusivamente projeto separado de desenvolvimento/homologação. Se necessário, use projeto gratuito; nenhuma contratação é necessária ou autorizada. Anote a Project URL, a referência do projeto e a Publishable Key. Não usar projeto definitivo, service_role, chave secreta ou senha de banco. Não enviar senhas no chat.

## 2. Conferir e preparar o schema
No SQL Editor desse projeto separado, execute primeiro consultas/01_inventario_somente_leitura.sql (a partir da pasta supabase). Guarde o resultado para conferir estruturas existentes. Se martins_hml_v1 ainda não existe, execute nesta ordem:

1. 001_seguranca_registros.sql
2. 002_documentos_privados.sql
3. 003_documentos_financeiros.sql
4. 004_identificacao_ambiente.sql
5. 005_financeiro_bloqueado.sql

Se o schema, buckets, funções ou políticas já existem, não repetir scripts nem remover objetos: conferir o inventário e preparar uma atualização específica. Os scripts não têm DROP ou limpeza automática. Uma incompatibilidade interrompe a preparação.

Nas configurações da Data API, acrescente **martins_hml_v1** em **Exposed schemas**, preservando as entradas anteriores. Não conceder ALL, não expor auth/storage manualmente e não ampliar grants para anon. Os scripts já concedem apenas os acessos necessários para authenticated; gravação de registros é somente pela RPC. Esta etapa depende de acesso administrativo e altera a exposição da API do projeto de homologação.

## 3. Criar quatro usuários Auth fictícios
Em Authentication → Users → Add user, crie quatro usuários exclusivos de teste, com credenciais próprias e sem dados reais. Confirme esses usuários pelo fluxo administrativo do projeto de teste, sem desativar a confirmação de e-mail globalmente. Não criar administrador padrão no aplicativo.

| Usuário | Empresa fictícia | Perfil no schema de homologação | Ativo |
|---|---|---|---|
| rhA | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | rh | sim |
| rhB | bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb | rh | sim |
| financeiroA | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | financeiro | sim |
| inativoA | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | rh | não |

Copie somente os UUIDs dos usuários. Em PROVISIONAR_USUARIOS_FICTICIOS.sql, preencha a referência do projeto e os quatro UUIDs; execute no SQL Editor do projeto separado. Nenhuma senha entra nesse SQL. O script valida a existência dos usuários e não sobrescreve membros existentes. A identificação do ambiente é somente leitura para a aplicação.

## 4. Configurar o executor privado
Copie credenciais.example.json para **um arquivo privado fora do repositório**, por exemplo martins-hml.local.json, e preencha URL, Publishable Key, projectRef, e-mail, senha e UID dos quatro usuários fictícios. Preserve a confirmação HOMOLOGACAO_ISOLADA e os UUIDs das empresas. Esse arquivo não deve ser anexado em conversa, incluído em backup compartilhado ou versionado. Arquivos *.local.json também são ignorados pelo git como proteção complementar.

Instale as dependências do projeto com npm install. Defina MARTINS_HML_CONFIG_FILE com o caminho privado. Exemplos em terminal, sem colocar os valores das credenciais no comando:

```sh
export MARTINS_HML_CONFIG_FILE=/caminho/privado/martins-hml.local.json
node scripts/homologar-supabase-remoto.cjs
```

A primeira execução é apenas preflight, sem rede. Se estiver pronta, executar:

```sh
node scripts/homologar-supabase-remoto.cjs --executar
```

O executor exige que a referência configurada corresponda à URL e à identificação de homologação declarada no servidor antes de gravar. Usa só usuários fictícios e chave pública; não requer chave administrativa. Nunca liga automaticamente o sistema local ao banco remoto.

## 5. Conferir evidências
O relatório é salvo por padrão em output/RESULTADOS_SUPABASE_REMOTO.json, pasta ignorada pelo git. Pode-se escolher caminho com MARTINS_HML_REPORT. Resultado não contém e-mails, senhas, chaves ou tokens. Preflight bloqueado não é contado como teste remoto. Transporte simulado é explicitamente marcado como simulado.

O roteiro testa login, renovação, perfil, RLS por API direta, inatividade, autopromoção recusada, auditoria, duas solicitações da mesma versão, Storage privado, duas empresas, RH versus documentos financeiros, não sobrescrita, estado financeiro bloqueado no servidor, bloqueio financeiro genérico e logout/refresh invalidado. Não usa somente mensagens de bloqueio do cliente como prova de RLS.

Os registros e arquivos sintéticos criados ficam disponíveis para conferência; não há DELETE, migração definitiva ou limpeza automática. A confirmação de origem não prova a segurança das tabelas de produção nem migra dados canônicos.

## Limites que precisam de etapa própria
- Logout revoga a renovação; JWT de acesso pode continuar válido até expirar. O roteiro não declara revogação imediata desse JWT como aprovada.
- Revogação de perfil durante sessão: com usuário logado, o responsável altera apenas o membro fictício pelo SQL Editor e repete as consultas; a aplicação não recebe poderes para revogar a si própria.
- MFA, testes físicos e autorização transacional de pagamentos/vales permanecem pendentes. Exceções de vales acima de 40% continuam bloqueadas.
- Não publicar no Netlify de produção nem executar estes passos no projeto definitivo.

Referências oficiais consultadas: https://supabase.com/docs/guides/api/using-custom-schemas e https://supabase.com/docs/guides/auth/signout.
