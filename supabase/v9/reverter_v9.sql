-- Reverte a v9 (só remove as funções; a trilha de auditoria e as permissões já gravadas permanecem).
BEGIN;
DROP FUNCTION public.martins_producao_usuario_vincular(uuid,uuid,text,text);
DROP FUNCTION public.martins_producao_usuario_situacao(uuid,uuid,uuid,boolean);
DROP FUNCTION public.martins_producao_permissoes_definir(uuid,uuid,uuid,jsonb);
DROP FUNCTION public.martins_producao_usuarios_listar(uuid);
NOTIFY pgrst,'reload schema';
COMMIT;
