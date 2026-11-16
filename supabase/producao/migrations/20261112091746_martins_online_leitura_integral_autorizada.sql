-- Preparação local: leitura integral explicitamente autorizada por vínculo.
ALTER TABLE public.martins_online_acessos ADD COLUMN leitura_integral boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.martins_online_leitor(e uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.martins_online_acessos a
 JOIN public.martins_perfis p ON p.usuario_id=a.usuario_id
 WHERE a.usuario_id=auth.uid() AND a.empresa_id=e AND a.ativo AND p.ativo
 AND (a.papel='master' OR (a.papel='administrador' AND a.leitura_integral)))
$$;
REVOKE ALL ON FUNCTION public.martins_online_leitor(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_online_leitor(uuid) TO authenticated;
DROP POLICY estado_master ON public.martins_online_estados;
CREATE POLICY estado_leitura_autorizada ON public.martins_online_estados FOR SELECT TO authenticated USING(public.martins_online_leitor(empresa_id));
CREATE OR REPLACE FUNCTION public.martins_online_contexto()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('usuario_id',p.usuario_id,'nome',p.nome,'empresas',
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'nome',coalesce(e.nome_fantasia,e.razao_social),'papel',a.papel) ORDER BY e.nome_fantasia),'[]'::jsonb)
 FROM public.martins_online_acessos a JOIN public.martins_empresas e ON e.id=a.empresa_id
 WHERE a.usuario_id=p.usuario_id AND public.martins_online_leitor(e.id))) INTO result
 FROM public.martins_perfis p WHERE p.usuario_id=auth.uid() AND p.ativo;
 IF result IS NULL THEN RAISE EXCEPTION 'Perfil inativo ou não autorizado' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
-- martins_online_salvar permanece exclusivamente Master.
