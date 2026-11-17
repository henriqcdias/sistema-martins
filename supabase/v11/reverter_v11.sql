-- Reverte a v11 (remove só a função; o que já foi devolvido permanece registrado nos recebimentos e no estoque).
BEGIN;
DROP FUNCTION public.martins_producao_compras_devolver(uuid,uuid,uuid,jsonb,text);
NOTIFY pgrst,'reload schema';
COMMIT;
