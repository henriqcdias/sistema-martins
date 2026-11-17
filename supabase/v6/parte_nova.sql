-- ============================================================================
-- Contratos v6: CONSUMO DE MATERIAIS NA OBRA (baixa única) e devolução.
-- Aditivo sobre a v5. Reaproveita o módulo estoque_movimentos (mesmo saldo derivado).
-- Um material só é baixado uma vez por RDO; correção é por devolução limitada ao consumido.
-- ============================================================================
CREATE UNIQUE INDEX consumo_unico_por_rdo ON martins_producao_v1.registros(empresa_id,(dados->>'rdo_id'),(dados->>'produto_id'))
 WHERE modulo='estoque_movimentos' AND dados->>'tipo'='consumo' AND NULLIF(dados->>'rdo_id','') IS NOT NULL;

CREATE FUNCTION public.martins_producao_obra_consumir(e uuid, op uuid, obra uuid, deposito uuid, itens jsonb, rdo uuid DEFAULT NULL, motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; it jsonb; p uuid; q bigint; i int := 0; ids jsonb := '[]'::jsonb; vistos uuid[] := ARRAY[]::uuid[]; novo martins_producao_v1.registros; nid uuid; prod martins_producao_v1.registros; dep martins_producao_v1.registros; resposta jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'estoque_movimentos','criar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR obra IS NULL OR deposito IS NULL OR jsonb_typeof(itens) IS DISTINCT FROM 'array' OR jsonb_array_length(itens) NOT BETWEEN 1 AND 100 OR length(COALESCE(motivo,''))>500 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','obra_consumir','e',e,'o',obra,'d',deposito,'i',itens,'r',rdo,'m',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 IF NOT martins_producao_v1.existe(e,'obras',obra) THEN RAISE EXCEPTION 'Obra não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF rdo IS NOT NULL AND NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='rdos' AND x.id=rdo AND x.dados->>'obra_id'=obra::text) THEN RAISE EXCEPTION 'O RDO informado não é desta obra' USING ERRCODE='23503'; END IF;
 SELECT * INTO dep FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='depositos' AND id=deposito;
 IF NOT FOUND THEN RAISE EXCEPTION 'Depósito não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF NOT COALESCE((dep.dados->>'ativo')::boolean,true) THEN RAISE EXCEPTION 'Depósito inativo' USING ERRCODE='22023'; END IF;
 FOR it IN SELECT value FROM jsonb_array_elements(itens) LOOP
  i := i + 1; p := NULLIF(it->>'produto_id','')::uuid;
  IF COALESCE(it->>'qtd_milli','') !~ '^[0-9]{1,13}$' OR (it->>'qtd_milli')::bigint < 1 THEN RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE='22023'; END IF;
  q := (it->>'qtd_milli')::bigint;
  IF p IS NULL OR p = ANY(vistos) THEN RAISE EXCEPTION 'Produto ausente ou repetido na lista' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,p);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||p::text||'estoque',0));
  SELECT * INTO prod FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='produtos' AND id=p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF NOT COALESCE((prod.dados->>'ativo')::boolean,true) THEN RAISE EXCEPTION 'Produto inativo' USING ERRCODE='22023'; END IF;
  IF rdo IS NOT NULL AND EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='estoque_movimentos' AND x.dados->>'tipo'='consumo' AND x.dados->>'rdo_id'=rdo::text AND x.dados->>'produto_id'=p::text) THEN
   RAISE EXCEPTION 'Este material já foi baixado neste RDO; para corrigir, registre uma devolução' USING ERRCODE='23505'; END IF;
  IF martins_producao_v1.saldo(e,p,deposito) < q THEN RAISE EXCEPTION 'Saldo insuficiente no depósito para um dos materiais' USING ERRCODE='23514'; END IF;
  nid := gen_random_uuid();
  INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
   VALUES(e,'estoque_movimentos',nid,1,jsonb_strip_nulls(jsonb_build_object('tipo','consumo','produto_id',p,'origem_id',deposito,'quantidade_milli',q,'obra_id',obra,'rdo_id',rdo,'motivo',NULLIF(trim(motivo),''))),auth.uid(),auth.uid())
   RETURNING * INTO novo;
  INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
   VALUES(e,'estoque_movimentos',nid,auth.uid(),md5(op::text||'c'||i)::uuid,'criar',NULL,to_jsonb(novo));
  ids := ids || jsonb_build_array(nid);
 END LOOP;
 resposta := jsonb_build_object('empresa_id',e,'modulo','estoque_movimentos','ids',ids);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

CREATE FUNCTION public.martins_producao_obra_devolver(e uuid, op uuid, consumo uuid, qtd bigint, motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; c martins_producao_v1.registros; devolvido bigint; novo martins_producao_v1.registros; nid uuid := gen_random_uuid(); resposta jsonb; p uuid;
BEGIN
 IF martins_producao_v1.pode(e,'estoque_movimentos','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR consumo IS NULL OR qtd IS NULL OR qtd<1 OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>500 THEN RAISE EXCEPTION 'Informe a quantidade (maior que zero) e o motivo da devolução' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','obra_devolver','e',e,'c',consumo,'q',qtd,'m',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 SELECT * INTO c FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='estoque_movimentos' AND id=consumo AND dados->>'tipo'='consumo';
 IF NOT FOUND THEN RAISE EXCEPTION 'Consumo não encontrado nesta empresa' USING ERRCODE='23503'; END IF;
 p := (c.dados->>'produto_id')::uuid;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||p::text||'estoque',0));
 SELECT COALESCE(sum((x.dados->>'quantidade_milli')::bigint),0) INTO devolvido FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='estoque_movimentos' AND x.dados->>'tipo'='devolucao_obra' AND x.dados->>'ref_id'=consumo::text;
 IF devolvido + qtd > (c.dados->>'quantidade_milli')::bigint THEN RAISE EXCEPTION 'Devolução maior que o consumido (já devolvido: % milésimos)', devolvido USING ERRCODE='23514'; END IF;
 INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
  VALUES(e,'estoque_movimentos',nid,1,jsonb_strip_nulls(jsonb_build_object('tipo','devolucao_obra','produto_id',p,'destino_id',c.dados->>'origem_id','quantidade_milli',qtd,'obra_id',c.dados->>'obra_id','rdo_id',c.dados->>'rdo_id','ref_id',consumo,'motivo',trim(motivo))),auth.uid(),auth.uid())
  RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'estoque_movimentos',nid,auth.uid(),op,'criar',NULL,to_jsonb(novo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','estoque_movimentos','id',nid);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- O que a obra consumiu (líquido de devoluções), por produto.
CREATE FUNCTION public.martins_producao_obra_materiais(e uuid, obra uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF martins_producao_v1.pode(e,'estoque_movimentos','ler') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('produto_id',t.p,'consumido_milli',t.c,'devolvido_milli',t.d,'liquido_milli',t.c-t.d) ORDER BY t.p) FROM (
   SELECT x.dados->>'produto_id' p, COALESCE(sum((x.dados->>'quantidade_milli')::bigint) FILTER (WHERE x.dados->>'tipo'='consumo'),0)::bigint c,
          COALESCE(sum((x.dados->>'quantidade_milli')::bigint) FILTER (WHERE x.dados->>'tipo'='devolucao_obra'),0)::bigint d
   FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='estoque_movimentos' AND x.dados->>'obra_id'=obra::text AND x.dados->>'tipo' IN ('consumo','devolucao_obra') GROUP BY 1) t),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.martins_producao_obra_consumir(uuid,uuid,uuid,uuid,jsonb,uuid,text), public.martins_producao_obra_devolver(uuid,uuid,uuid,bigint,text), public.martins_producao_obra_materiais(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_obra_consumir(uuid,uuid,uuid,uuid,jsonb,uuid,text), public.martins_producao_obra_devolver(uuid,uuid,uuid,bigint,text), public.martins_producao_obra_materiais(uuid,uuid) TO authenticated;
