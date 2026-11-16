-- Ponte transitória de persistência do aplicativo legado. Não recria empresas,
-- perfis, estoque ou compras. Somente Masters explicitamente provisionados.
-- Abertura a outros perfis depende de contratos por módulo, não deste snapshot.
CREATE TABLE public.martins_online_acessos (
 empresa_id uuid NOT NULL REFERENCES public.martins_empresas(id),
 usuario_id uuid NOT NULL REFERENCES public.martins_perfis(usuario_id),
 papel text NOT NULL CHECK(papel IN ('master','administrador','operacional')),
 ativo boolean NOT NULL DEFAULT false,
 PRIMARY KEY(usuario_id,empresa_id)
);
CREATE TABLE public.martins_online_estados (
 empresa_id uuid PRIMARY KEY REFERENCES public.martins_empresas(id),
 versao bigint NOT NULL CHECK(versao>0),
 estado jsonb NOT NULL CHECK(jsonb_typeof(estado)='object'),
 autor uuid NOT NULL REFERENCES public.martins_perfis(usuario_id),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.martins_online_revisoes (
 empresa_id uuid NOT NULL REFERENCES public.martins_empresas(id),
 versao bigint NOT NULL, operacao_id uuid NOT NULL,
 autor uuid NOT NULL REFERENCES public.martins_perfis(usuario_id),
 versao_esperada bigint NOT NULL, estado jsonb NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,versao), UNIQUE(empresa_id,operacao_id)
);
CREATE FUNCTION public.martins_online_master(e uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.martins_online_acessos a
  JOIN public.martins_perfis p ON p.usuario_id=a.usuario_id
  WHERE a.usuario_id=auth.uid() AND a.empresa_id=e AND a.ativo
    AND a.papel='master' AND p.ativo
 )
$$;
REVOKE ALL ON FUNCTION public.martins_online_master(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_online_master(uuid) TO authenticated;
ALTER TABLE public.martins_online_acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_online_acessos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.martins_online_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_online_estados FORCE ROW LEVEL SECURITY;
ALTER TABLE public.martins_online_revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_online_revisoes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.martins_online_acessos,public.martins_online_estados,
 public.martins_online_revisoes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.martins_online_estados TO authenticated;
CREATE POLICY estado_master ON public.martins_online_estados
 FOR SELECT TO authenticated USING(public.martins_online_master(empresa_id));

CREATE FUNCTION public.martins_online_contexto()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('usuario_id',p.usuario_id,'nome',p.nome,
 'empresas',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,
 'nome',coalesce(e.nome_fantasia,e.razao_social),'papel',a.papel) ORDER BY e.nome_fantasia),'[]'::jsonb)
 FROM public.martins_online_acessos a JOIN public.martins_empresas e ON e.id=a.empresa_id
 WHERE a.usuario_id=p.usuario_id AND a.ativo AND a.papel='master'))
 INTO result FROM public.martins_perfis p WHERE p.usuario_id=auth.uid() AND p.ativo;
 IF result IS NULL THEN RAISE EXCEPTION 'Perfil inativo ou não autorizado' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.martins_online_salvar(e uuid,v bigint,d jsonb,op uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE atual public.martins_online_estados%ROWTYPE;
 anterior public.martins_online_revisoes%ROWTYPE;
 nova bigint;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF v IS NULL OR v<0 OR v>=9007199254740991 OR op IS NULL OR d IS NULL
 OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>8388608
 OR jsonb_typeof(d->'storage') IS DISTINCT FROM 'object'
 OR jsonb_typeof(d->'globals') IS DISTINCT FROM 'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('storage','globals'))
 THEN RAISE EXCEPTION 'Estado inválido ou excedeu 8 MB' USING ERRCODE='22023'; END IF;
 -- Tokens, credenciais e permissões do cliente não são autoridade do banco.
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d->'storage') k
 WHERE k ~* '(password|senha|token|secret|service_role|session|sessao|usuarios|permissoes)')
 THEN RAISE EXCEPTION 'Estado contém campos de autenticação ou permissões' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'/martins-online',0));
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Acesso revogado' USING ERRCODE='42501'; END IF;
 SELECT * INTO anterior FROM public.martins_online_revisoes WHERE empresa_id=e AND operacao_id=op;
 IF FOUND THEN
  IF anterior.autor<>auth.uid() OR anterior.versao_esperada<>v OR anterior.estado<>d
  THEN RAISE EXCEPTION 'Operação reutilizada com outros dados' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('versao',anterior.versao,'operacao_id',op);
 END IF;
 SELECT * INTO atual FROM public.martins_online_estados WHERE empresa_id=e FOR UPDATE;
 IF coalesce(atual.versao,0)<>v THEN RAISE EXCEPTION 'Outro aparelho alterou os dados. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
 nova:=v+1;
 INSERT INTO public.martins_online_estados(empresa_id,versao,estado,autor)
 VALUES(e,nova,d,auth.uid()) ON CONFLICT(empresa_id) DO UPDATE
 SET versao=excluded.versao,estado=excluded.estado,autor=excluded.autor,atualizado_em=now();
 INSERT INTO public.martins_online_revisoes(empresa_id,versao,operacao_id,autor,versao_esperada,estado)
 VALUES(e,nova,op,auth.uid(),v,d);
 INSERT INTO public.martins_auditoria(empresa_id,usuario_id,acao,entidade,entidade_id,detalhes)
 VALUES(e,auth.uid(),'GRAVACAO_ONLINE','estado_empresa',e,
 jsonb_build_object('versao_anterior',v,'versao_nova',nova,'operacao_id',op,
 'campos',ARRAY(SELECT jsonb_object_keys(d->'globals'))));
 RETURN jsonb_build_object('versao',nova,'operacao_id',op);
END $$;
REVOKE ALL ON FUNCTION public.martins_online_contexto(),public.martins_online_salvar(uuid,bigint,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_online_contexto(),public.martins_online_salvar(uuid,bigint,jsonb,uuid) TO authenticated;
-- Sem seeds. Provisionar UID confirmado fora do repositório, depois da homologação.
NOTIFY pgrst,'reload schema';
