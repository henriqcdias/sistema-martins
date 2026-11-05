-- Inventário de estrutura, sem consultar registros de negócio ou auth.users.
-- Não altera tabelas, funções, políticas ou perfis. Não repete ADD COLUMN papel.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
 'tabelas', (SELECT coalesce(jsonb_agg(jsonb_build_object('nome',c.relname,'rls',c.relrowsecurity,'rls_forcada',c.relforcerowsecurity) ORDER BY c.relname),'[]'::jsonb)
   FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'martins\_%' ESCAPE '\'),
 'colunas', (SELECT coalesce(jsonb_agg(jsonb_build_object('tabela',table_name,'coluna',column_name,'tipo',udt_name,'nulo',is_nullable,'padrao',column_default) ORDER BY table_name,ordinal_position),'[]'::jsonb)
   FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'martins\_%' ESCAPE '\'),
 'restricoes', (SELECT coalesce(jsonb_agg(jsonb_build_object('tabela',c.relname,'nome',con.conname,'tipo',con.contype,'definicao',pg_catalog.pg_get_constraintdef(con.oid)) ORDER BY c.relname,con.conname),'[]'::jsonb)
   FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'martins\_%' ESCAPE '\'),
 'politicas', (SELECT coalesce(jsonb_agg(jsonb_build_object('tabela',tablename,'nome',policyname,'comando',cmd,'roles',roles,'permissiva',permissive,'using',qual,'with_check',with_check) ORDER BY tablename,policyname),'[]'::jsonb)
   FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename LIKE 'martins\_%' ESCAPE '\'),
 'permissoes', (SELECT coalesce(jsonb_agg(jsonb_build_object('tabela',table_name,'role',grantee,'privilegio',privilege_type) ORDER BY table_name,grantee,privilege_type),'[]'::jsonb)
   FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name LIKE 'martins\_%' ESCAPE '\'),
 'rotinas', (SELECT coalesce(jsonb_agg(jsonb_build_object('nome',p.proname,'argumentos',pg_catalog.pg_get_function_identity_arguments(p.oid),'retorno',pg_catalog.pg_get_function_result(p.oid),'security_definer',p.prosecdef,'volatilidade',p.provolatile,'configuracao',p.proconfig) ORDER BY p.proname),'[]'::jsonb)
   FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'martins\_%' ESCAPE '\')
)) AS inventario_sistema_martins;
ROLLBACK;
