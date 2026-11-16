BEGIN READ ONLY;

SELECT table_name, ordinal_position, column_name, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('martins_empresas', 'martins_obras_operacionais', 'martins_rdos_operacionais')
ORDER BY table_name, ordinal_position;

WITH tabelas AS (
  SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('martins_empresas', 'martins_obras_operacionais', 'martins_rdos_operacionais')
)
SELECT t.relname, t.relrowsecurity, t.relforcerowsecurity, c.conname, c.contype,
       pg_get_constraintdef(c.oid) AS definicao
FROM tabelas t LEFT JOIN pg_constraint c ON c.conrelid = t.oid
ORDER BY t.relname, c.conname;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('martins_obras_operacionais', 'martins_rdos_operacionais');

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('martins_obras_operacionais', 'martins_rdos_operacionais'))
   OR (schemaname = 'martins_hml_v1' AND tablename = 'membros');

SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid) AS gatilho, t.tgfoid::regprocedure AS funcao
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('martins_obras_operacionais', 'martins_rdos_operacionais')
  AND NOT t.tgisinternal;

SELECT c.relname, r.papel, p.privilegio, has_table_privilege(r.papel, c.oid, p.privilegio) AS concedido
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated')) r(papel)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(privilegio)
WHERE n.nspname = 'public' AND c.relname IN ('martins_obras_operacionais', 'martins_rdos_operacionais');

ROLLBACK;
