-- Reverte, no Supabase QA (oczxyiakpmgnrpoyhwov), a aplicação das migrações de produção
-- 20261112091746, 20261113173937 e 20261113175149. Volta ao estado de 16/11/2026.
-- NÃO rode em produção.
BEGIN;

DROP FUNCTION IF EXISTS public.martins_producao_salvar_lote(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.martins_producao_catalogos(uuid);
DROP FUNCTION IF EXISTS public.martins_producao_salvar(uuid, text, uuid, bigint, jsonb, uuid);
DROP FUNCTION IF EXISTS public.martins_producao_consultar(uuid, text, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.martins_producao_contexto();
DROP SCHEMA IF EXISTS martins_producao_v1 CASCADE;

DROP POLICY IF EXISTS estado_leitura_autorizada ON public.martins_online_estados;
CREATE POLICY estado_master ON public.martins_online_estados
 FOR SELECT TO authenticated USING (public.martins_online_master(empresa_id));

-- Definição do QA antes da migração 20261112091746 (com catalogo_empresas_v5).
CREATE OR REPLACE FUNCTION public.martins_online_contexto()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 result jsonb;
 usuario uuid := auth.uid();
 catalogo_v5 jsonb;
 tem_vinculo_v5 boolean;
BEGIN
 IF usuario IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('usuario_id',p.usuario_id,'nome',p.nome,
 'empresas',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,
 'nome',coalesce(e.nome_fantasia,e.razao_social),'papel',a.papel) ORDER BY e.nome_fantasia),'[]'::jsonb)
 FROM public.martins_online_acessos a JOIN public.martins_empresas e ON e.id=a.empresa_id
 WHERE a.usuario_id=p.usuario_id AND a.ativo AND a.papel='master'))
 INTO result FROM public.martins_perfis p WHERE p.usuario_id=usuario AND p.ativo;
 WITH vinculos_v5 AS (
   SELECT DISTINCT m.empresa_id
   FROM martins_hml_v1.membros m
   WHERE m.usuario_id = usuario AND m.ativo IS TRUE
 ), nomes_v5 AS (
   SELECT e.id,
          coalesce(nullif(btrim(e.nome_fantasia), ''), nullif(btrim(e.razao_social), '')) AS nome
   FROM vinculos_v5 v
   JOIN public.martins_empresas e ON e.id = v.empresa_id
 )
 SELECT EXISTS (SELECT 1 FROM vinculos_v5),
        coalesce(
          (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) ORDER BY n.id)
           FROM nomes_v5 n WHERE n.nome IS NOT NULL),
          '[]'::jsonb
        )
 INTO tem_vinculo_v5, catalogo_v5;
 IF result IS NULL THEN
   IF NOT tem_vinculo_v5 THEN
     RAISE EXCEPTION 'Perfil inativo ou não autorizado' USING ERRCODE='42501';
   END IF;
   result := jsonb_build_object('usuario_id', usuario, 'nome', NULL, 'empresas', '[]'::jsonb);
 END IF;
 RETURN result || jsonb_build_object('catalogo_empresas_v5', catalogo_v5);
END $function$;

DROP FUNCTION IF EXISTS public.martins_online_leitor(uuid);
ALTER TABLE public.martins_online_acessos DROP COLUMN IF EXISTS leitura_integral;

DELETE FROM supabase_migrations.schema_migrations
 WHERE name IN ('martins_online_leitura_integral_autorizada', 'martins_producao_operacional_v1',
                'martins_producao_preservar_leitura_e_validar_equipe_rdo');

NOTIFY pgrst, 'reload schema';
COMMIT;
