-- Sistema Martins | verificacao estrutural somente leitura | 2026-11-06
-- NUNCA cadastra empresas, usuarios, unidades ou altera RLS.
-- Seguro para o projeto existente: apenas metadados, contagens e sinalizadores.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT 'tabelas_publicas' AS verificacao, count(*) AS quantidade
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'martins\_%' ESCAPE '\';

SELECT c.relname AS tabela, c.relrowsecurity AS rls_habilitado,
       c.relforcerowsecurity AS rls_forcado
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'martins\_%' ESCAPE '\'
ORDER BY c.relname;

SELECT tablename AS tabela, cmd AS operacao, count(*) AS politicas
FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename LIKE 'martins\_%' ESCAPE '\'
GROUP BY tablename,cmd ORDER BY tablename,cmd;

SELECT grantee AS papel, table_name AS tabela, privilege_type AS privilegio
FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated')
AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
AND table_name LIKE 'martins\_%' ESCAPE '\'
ORDER BY grantee,table_name,privilege_type;

SELECT p.proname AS funcao, p.prosecdef AS security_definer,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS argumentos,
       has_function_privilege('PUBLIC',p.oid,'EXECUTE') AS executavel_por_public
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'martins\_%' ESCAPE '\'
ORDER BY p.proname;

SELECT id AS bucket, public AS publico FROM storage.buckets
WHERE id IN ('rdo-fotos','funcionarios','obras','notas-fiscais','contratos',
             'comprovantes','veiculos','projetos-engenharia')
ORDER BY id;

SELECT tablename AS tabela_storage, cmd AS operacao, count(*) AS politicas
FROM pg_catalog.pg_policies
WHERE schemaname='storage' AND tablename='objects'
GROUP BY tablename,cmd ORDER BY cmd;

SELECT 'empresas' AS entidade, count(*) AS registros FROM public.martins_empresas
UNION ALL SELECT 'unidades', count(*) FROM public.martins_unidades
UNION ALL SELECT 'perfis', count(*) FROM public.martins_perfis;

ROLLBACK;
