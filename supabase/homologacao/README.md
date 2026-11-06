# Segurança isolada de homologação

Estes scripts não são uma migração automática do banco existente. Usam somente o schema novo `martins_hml_v1` e o bucket privado reservado `martins-hml-documentos-v1`, para validar o contrato em um projeto separado de homologação. Não executar no projeto definitivo sem inventário e mapeamento para as tabelas canônicas existentes. O projeto real já tem perfis e função de autorização; não são recriados por estes arquivos.

## Execução verificada localmente
`npm test` inclui PostgreSQL embarcado PGlite. Pode-se indicar instalação externa com MARTINS_PGLITE_MODULE; nenhuma credencial remota é necessária. Auth é representado no banco de testes por auth.uid() com claims sintéticas. Storage é representado por tabelas de metadados e políticas, sem executar o serviço de arquivos.

1. 001 cria membros de homologação, registros versionados, operações idempotentes e auditoria de metadados (sem cópia do conteúdo sensível).
2. 002 exige o schema Storage do Supabase, mantém bucket privado e impõe políticas restritivas que impedem uma política permissiva antiga de liberar o bucket. Não concede atualização ou exclusão de documentos.
3. Perfis são provisionados somente pelo responsável do ambiente, fora da aplicação. O navegador não pode criar membros nem promover a si próprio. Nenhum administrador padrão é criado.

## Contrato e limites
- JWT é a origem da autoria por auth.uid(); perfil e permissões vêm de membros no servidor. Negação explícita prevalece sobre administrador.
- RH, Engenharia, Financeiro, Estoque e leitura têm acessos separados por módulo. Sem perfil ativo não há acesso.
- SELECT utiliza RLS; escrita somente pela RPC salvar_registro com revisão esperada e ID da operação. Mesma operação retorna mesma resposta; conflito não sobrescreve o conteúdo remoto. Não há DELETE genérico.
- Financeiro, fechamento de Remuneração e Vales não podem ser escritos pelo comando genérico. Precisam de comandos específicos que validem as regras de negócio e a base confiável. Exceção de 40% continua bloqueada.
- Caminhos de documentos usam empresa/documentos/identificador/identificador.extensão, sem nome/CPF no path. Uploads sem upsert e downloads autenticados devem usar Storage privado; não fornecer URL pública.
- Servidor local executou as políticas reais com roles e claims sintéticas. PGlite serializa consultas em uma instância: prova o controle de versão sob solicitações concorrentes, não substitui teste com conexões independentes, PostgREST, Auth, Storage HTTP, MFA ou RLS do projeto remoto.

## Próximo passo remoto
Obter inventário somente leitura do projeto separado, conferir ownership das funções, schema exposto no PostgREST, JWT e perfis de dois usuários de empresas distintas. Executar testes reais antes de habilitar qualquer sincronização de dados existentes. Não copiar dados definitivos para homologação.

Referências primárias consultadas: https://supabase.com/docs/guides/database/postgres/row-level-security e https://supabase.com/docs/guides/storage/security/access-control.
