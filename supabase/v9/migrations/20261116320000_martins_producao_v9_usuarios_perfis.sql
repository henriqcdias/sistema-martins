-- Contratos v9: USUÁRIOS E PERMISSÕES (somente Master). Escrito à mão; pré-requisito: producao..v8 aplicadas.
-- O Master vê quem tem acesso à empresa, define permissões por módulo (ler/criar/editar), ativa/desativa
-- o acesso e vincula uma conta JÁ criada no Supabase Auth. Nunca cria conta, nunca define senha e
-- nunca eleva papel: vínculo novo é sempre "operacional"; Master continua sendo decisão do banco.
-- Toda mudança grava trilha em martins_producao_v1.auditoria (modulo 'permissoes', registro = usuário alvo).
-- Atenção: a lista de módulos abaixo precisa acompanhar o CHECK de permissoes (v8). Módulo novo => atualizar aqui.
BEGIN;

CREATE FUNCTION public.martins_producao_usuarios_listar(e uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('usuario_id',a.usuario_id,'nome',COALESCE(p.nome,''),'email',COALESCE(u.email,''),'papel',a.papel,
    'acesso_ativo',a.ativo,'perfil_ativo',p.ativo,
    'permissoes',(SELECT COALESCE(jsonb_object_agg(q.modulo,jsonb_build_object('ler',q.ler,'criar',q.criar,'editar',q.editar)),'{}'::jsonb)
                  FROM martins_producao_v1.permissoes q WHERE q.usuario_id=a.usuario_id AND q.empresa_id=e))
    ORDER BY COALESCE(p.nome,''),a.usuario_id)
  FROM public.martins_online_acessos a JOIN public.martins_perfis p ON p.usuario_id=a.usuario_id LEFT JOIN auth.users u ON u.id=a.usuario_id
  WHERE a.empresa_id=e),'[]'::jsonb);
END $$;

CREATE FUNCTION public.martins_producao_permissoes_definir(e uuid, op uuid, usuario uuid, itens jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; it jsonb; m text; vistos text[] := ARRAY[]::text[]; papel_alvo text; antes jsonb; depois jsonb; resposta jsonb;
 modulos text[] := ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material'];
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR usuario IS NULL OR jsonb_typeof(itens) IS DISTINCT FROM 'array' OR jsonb_array_length(itens) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','permissoes_definir','e',e,'u',usuario,'i',itens);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 SELECT a.papel INTO papel_alvo FROM public.martins_online_acessos a WHERE a.empresa_id=e AND a.usuario_id=usuario;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não tem vínculo com esta empresa' USING ERRCODE='23503'; END IF;
 IF papel_alvo='master' THEN RAISE EXCEPTION 'Master já tem acesso total; não há permissões para configurar' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||usuario::text||'permissoes',0));
 SELECT COALESCE(jsonb_object_agg(q.modulo,jsonb_build_object('ler',q.ler,'criar',q.criar,'editar',q.editar)),'{}'::jsonb) INTO antes FROM martins_producao_v1.permissoes q WHERE q.usuario_id=usuario AND q.empresa_id=e;
 FOR it IN SELECT value FROM jsonb_array_elements(itens) LOOP
  m := it->>'modulo';
  IF m IS NULL OR NOT (m = ANY(modulos)) THEN RAISE EXCEPTION 'Módulo desconhecido' USING ERRCODE='22023'; END IF;
  IF m = ANY(vistos) THEN RAISE EXCEPTION 'Módulo repetido na lista' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,m);
  IF jsonb_typeof(it->'ler') IS DISTINCT FROM 'boolean' OR jsonb_typeof(it->'criar') IS DISTINCT FROM 'boolean' OR jsonb_typeof(it->'editar') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Permissões devem ser verdadeiro ou falso' USING ERRCODE='22023'; END IF;
  IF ((it->>'criar')::boolean OR (it->>'editar')::boolean) AND NOT (it->>'ler')::boolean THEN RAISE EXCEPTION 'Para criar ou editar é preciso poder ver o módulo' USING ERRCODE='22023'; END IF;
  IF NOT ((it->>'ler')::boolean OR (it->>'criar')::boolean OR (it->>'editar')::boolean) THEN
   DELETE FROM martins_producao_v1.permissoes WHERE usuario_id=usuario AND empresa_id=e AND modulo=m;
  ELSE
   INSERT INTO martins_producao_v1.permissoes(usuario_id,empresa_id,modulo,ler,criar,editar) VALUES(usuario,e,m,(it->>'ler')::boolean,(it->>'criar')::boolean,(it->>'editar')::boolean)
   ON CONFLICT(usuario_id,empresa_id,modulo) DO UPDATE SET ler=EXCLUDED.ler,criar=EXCLUDED.criar,editar=EXCLUDED.editar;
  END IF;
 END LOOP;
 SELECT COALESCE(jsonb_object_agg(q.modulo,jsonb_build_object('ler',q.ler,'criar',q.criar,'editar',q.editar)),'{}'::jsonb) INTO depois FROM martins_producao_v1.permissoes q WHERE q.usuario_id=usuario AND q.empresa_id=e;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'permissoes',usuario,auth.uid(),op,'editar',jsonb_build_object('permissoes',antes),jsonb_build_object('permissoes',depois));
 resposta := jsonb_build_object('empresa_id',e,'usuario_id',usuario,'permissoes',depois);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

CREATE FUNCTION public.martins_producao_usuario_situacao(e uuid, op uuid, usuario uuid, ativo boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; antes boolean; resposta jsonb;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR usuario IS NULL OR ativo IS NULL THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF usuario = auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar o próprio acesso' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','usuario_situacao','e',e,'u',usuario,'a',ativo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 SELECT a.ativo INTO antes FROM public.martins_online_acessos a WHERE a.empresa_id=e AND a.usuario_id=usuario FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não tem vínculo com esta empresa' USING ERRCODE='23503'; END IF;
 UPDATE public.martins_online_acessos a SET ativo=$4 WHERE a.empresa_id=e AND a.usuario_id=usuario;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'permissoes',usuario,auth.uid(),op,'editar',jsonb_build_object('acesso_ativo',antes),jsonb_build_object('acesso_ativo',ativo));
 resposta := jsonb_build_object('empresa_id',e,'usuario_id',usuario,'acesso_ativo',ativo);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

CREATE FUNCTION public.martins_producao_usuario_vincular(e uuid, op uuid, email text, nome text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; uid uuid; mail text := lower(trim(COALESCE(email,''))); rotulo text; resposta jsonb;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(mail)>254 OR length(COALESCE(nome,''))>120 THEN RAISE EXCEPTION 'Informe um e-mail válido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','usuario_vincular','e',e,'m',mail,'n',nome);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email)=mail;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada no Supabase Auth. Crie a conta no painel do Supabase (a senha é definida lá) e tente de novo' USING ERRCODE='23503'; END IF;
 IF EXISTS(SELECT 1 FROM public.martins_online_acessos a WHERE a.empresa_id=e AND a.usuario_id=uid) THEN RAISE EXCEPTION 'Este usuário já está vinculado à empresa' USING ERRCODE='23505'; END IF;
 rotulo := COALESCE(NULLIF(trim(nome),''), split_part(mail,'@',1));
 INSERT INTO public.martins_perfis(usuario_id,empresa_id,nome) VALUES(uid,e,rotulo) ON CONFLICT(usuario_id) DO NOTHING;
 INSERT INTO public.martins_online_acessos(empresa_id,usuario_id,papel,ativo) VALUES(e,uid,'operacional',true);
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'permissoes',uid,auth.uid(),op,'criar',NULL,jsonb_build_object('vinculo','operacional','acesso_ativo',true));
 resposta := jsonb_build_object('empresa_id',e,'usuario_id',uid);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_usuarios_listar(uuid), public.martins_producao_permissoes_definir(uuid,uuid,uuid,jsonb), public.martins_producao_usuario_situacao(uuid,uuid,uuid,boolean), public.martins_producao_usuario_vincular(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_usuarios_listar(uuid), public.martins_producao_permissoes_definir(uuid,uuid,uuid,jsonb), public.martins_producao_usuario_situacao(uuid,uuid,uuid,boolean), public.martins_producao_usuario_vincular(uuid,uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
