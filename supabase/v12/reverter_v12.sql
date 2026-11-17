-- Reverte a v12 (só remove a função de leitura; nenhum dado é afetado).
BEGIN;
DROP FUNCTION public.martins_producao_obra_gastos(uuid,uuid);
NOTIFY pgrst,'reload schema';
COMMIT;
