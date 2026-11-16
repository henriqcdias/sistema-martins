-- SQL Editor do projeto kkjwmnxgcbonbwavaaya. Consulta somente leitura.
WITH vinculos AS (
  SELECT v.usuario_id,
         jsonb_agg(
           jsonb_build_object(
             'empresa_id', v.empresa_id,
             'empresa', coalesce(nullif(btrim(e.nome_fantasia), ''),
                                 nullif(btrim(e.razao_social), '')),
             'papel', v.papel,
             'ativo', v.ativo
           ) ORDER BY v.empresa_id, v.papel
         ) AS empresas
  FROM public.martins_online_acessos v
  LEFT JOIN public.martins_empresas e ON e.id = v.empresa_id
  GROUP BY v.usuario_id
), perfis AS (
  SELECT p.usuario_id, p.ativo AS perfil_ativo,
         nullif(btrim(to_jsonb(p)->>'email'), '') AS email_erp
  FROM public.martins_perfis p
)
SELECT p.usuario_id, p.perfil_ativo, p.email_erp, u.email AS email_auth,
       u.id IS NULL AS sem_conta_no_uuid,
       p.email_erp IS NULL AS email_erp_indisponivel,
       CASE WHEN u.id IS NOT NULL AND p.email_erp IS NOT NULL
            THEN lower(p.email_erp) IS DISTINCT FROM lower(btrim(u.email))
       END AS email_divergente,
       CASE WHEN u.id IS NOT NULL THEN u.email_confirmed_at IS NULL END AS email_nao_confirmado,
       CASE WHEN u.id IS NOT NULL THEN coalesce(u.banned_until > now(), false) END AS bloqueada,
       CASE WHEN u.id IS NOT NULL THEN u.deleted_at IS NOT NULL END AS removida_no_auth,
       coalesce(v.empresas, '[]'::jsonb) AS empresas_e_papeis
FROM perfis p
LEFT JOIN auth.users u ON u.id = p.usuario_id
LEFT JOIN vinculos v ON v.usuario_id = p.usuario_id
ORDER BY sem_conta_no_uuid DESC, p.usuario_id;
