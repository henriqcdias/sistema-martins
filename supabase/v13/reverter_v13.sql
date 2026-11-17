-- Reverte a v13 (só remove as funções; backups já gerados e dados já restaurados não são afetados).
BEGIN;
DROP FUNCTION public.martins_producao_backup_importar(uuid,uuid,jsonb);
DROP FUNCTION public.martins_producao_backup_exportar(uuid);
NOTIFY pgrst,'reload schema';
COMMIT;
