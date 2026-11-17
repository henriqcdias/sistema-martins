-- Contratos v11: DEVOLUÇÃO AO FORNECEDOR (estorno parcial ou total de um recebimento de compra).
-- Escrito à mão; pré-requisito: producao..v10 aplicadas. Não altera módulos nem permissões: só acrescenta uma função.
-- Num único evento atômico: baixa o estoque do depósito do recebimento (saída), acompanha o que foi devolvido
-- por item e acerta a obrigação financeira gerada no recebimento:
--   * ainda "pendente de conferência"  -> reduz o valor (ou cancela, se tudo foi devolvido);
--   * já aprovada/paga/conciliada      -> NÃO mexe; registra crédito pendente com o fornecedor no recebimento;
--   * cancelada                        -> nada a acertar.
-- Nunca devolve mais que o recebido, nem mais que o saldo do depósito. O pedido NÃO reabre (compra nova = novo pedido).
BEGIN;

CREATE FUNCTION public.martins_producao_compras_devolver(e uuid, op uuid, recebimento uuid, itens jsonb, motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; rec martins_producao_v1.registros; novo martins_producao_v1.registros; desp martins_producao_v1.registros; despn martins_producao_v1.registros;
 it jsonb; po jsonb; i int := 0; vistos uuid[] := ARRAY[]::uuid[]; p uuid; q bigint; ja bigint; item_total bigint; valor bigint; total_valor bigint := 0; aplicados jsonb := '[]'::jsonb; movs jsonb := '[]'::jsonb; mov jsonb;
 novos jsonb := '[]'::jsonb; ap jsonb; orig bigint; devolvido_desp bigint; resultado text := 'sem_alteracao'; credito bigint := 0; nf text; dep uuid; devol_id uuid := gen_random_uuid(); resposta jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'pedidos_compra','editar') IS NOT TRUE OR martins_producao_v1.pode(e,'estoque_movimentos','criar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR recebimento IS NULL OR jsonb_typeof(itens) IS DISTINCT FROM 'array' OR jsonb_array_length(itens) NOT BETWEEN 1 AND 100 OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>500 THEN
  RAISE EXCEPTION 'Informe os itens e o motivo da devolução' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','compras_devolver','e',e,'r',recebimento,'i',itens,'m',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'recebimento'||recebimento::text,0));
 SELECT * INTO rec FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='recebimentos_compra' AND id=recebimento FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado nesta empresa' USING ERRCODE='23503'; END IF;
 nf := rec.dados->>'numero_nf'; dep := (rec.dados->>'deposito_id')::uuid;
 FOR it IN SELECT value FROM jsonb_array_elements(itens) LOOP
  i := i + 1; p := NULLIF(it->>'produto_id','')::uuid;
  IF COALESCE(it->>'qtd_milli','') !~ '^[0-9]{1,13}$' OR (it->>'qtd_milli')::bigint < 1 THEN RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE='22023'; END IF;
  q := (it->>'qtd_milli')::bigint;
  IF p IS NULL OR p = ANY(vistos) THEN RAISE EXCEPTION 'Produto ausente ou repetido na devolução' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,p);
  SELECT x INTO po FROM jsonb_array_elements(rec.dados->'itens') x WHERE x->>'produto_id'=p::text;
  IF po IS NULL THEN RAISE EXCEPTION 'Produto não faz parte deste recebimento' USING ERRCODE='23503'; END IF;
  ja := COALESCE((po->>'devolvido_milli')::bigint,0);
  IF ja + q > (po->>'qtd_milli')::bigint THEN RAISE EXCEPTION 'Devolução maior que o recebido (já devolvido: % milésimos)', ja USING ERRCODE='23514'; END IF;
  item_total := round((po->>'qtd_milli')::numeric * (po->>'preco_centavos')::numeric / 1000);
  -- no último trecho do item o valor fecha exatamente (sem sobra de centavos por arredondamento)
  valor := CASE WHEN ja + q = (po->>'qtd_milli')::bigint THEN item_total - COALESCE((po->>'devolvido_centavos')::bigint,0)
                ELSE round(q::numeric * (po->>'preco_centavos')::numeric / 1000) END;
  total_valor := total_valor + valor;
  aplicados := aplicados || jsonb_build_array(jsonb_build_object('produto_id',p,'qtd_milli',q,'valor_centavos',valor));
  mov := public.martins_producao_estoque_mover(e, md5(op::text||'dev'||i)::uuid, 'saida', p, dep, NULL, q, left('Devolução ao fornecedor'||COALESCE(' · NF '||nf,'')||' · '||trim(motivo),500), NULL);
  movs := movs || jsonb_build_array(mov->>'id');
 END LOOP;
 -- acompanha o devolvido por item no próprio recebimento
 FOR po IN SELECT value FROM jsonb_array_elements(rec.dados->'itens') LOOP
  SELECT a INTO ap FROM jsonb_array_elements(aplicados) a WHERE a->>'produto_id'=po->>'produto_id';
  IF ap IS NOT NULL THEN
   po := po || jsonb_build_object('devolvido_milli',COALESCE((po->>'devolvido_milli')::bigint,0)+(ap->>'qtd_milli')::bigint,'devolvido_centavos',COALESCE((po->>'devolvido_centavos')::bigint,0)+(ap->>'valor_centavos')::bigint);
  END IF;
  novos := novos || jsonb_build_array(po);
 END LOOP;
 -- obrigação financeira gerada no recebimento
 SELECT * INTO desp FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='despesas' AND id=NULLIF(rec.dados->>'despesa_id','')::uuid FOR UPDATE;
 IF FOUND AND desp.dados->>'estado'='pendente_conferencia' THEN
  orig := COALESCE((desp.dados->>'valor_original_centavos')::bigint,(desp.dados->>'valor_centavos')::bigint);
  devolvido_desp := COALESCE((desp.dados->>'devolvido_centavos')::bigint,0) + total_valor;
  IF devolvido_desp >= orig THEN
   UPDATE martins_producao_v1.registros SET revisao=revisao+1, dados=dados||jsonb_build_object('valor_original_centavos',orig,'devolvido_centavos',orig,'valor_centavos',orig,'estado','cancelado'), atualizado_por=auth.uid(), atualizado_em=now()
    WHERE empresa_id=e AND modulo='despesas' AND id=desp.id RETURNING * INTO despn;
   resultado := 'cancelada';
  ELSE
   UPDATE martins_producao_v1.registros SET revisao=revisao+1, dados=dados||jsonb_build_object('valor_original_centavos',orig,'devolvido_centavos',devolvido_desp,'valor_centavos',orig-devolvido_desp), atualizado_por=auth.uid(), atualizado_em=now()
    WHERE empresa_id=e AND modulo='despesas' AND id=desp.id RETURNING * INTO despn;
   resultado := 'reduzida';
  END IF;
  INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
   VALUES(e,'despesas',desp.id,auth.uid(),md5(op::text||'desp')::uuid,'editar',to_jsonb(desp),to_jsonb(despn)||jsonb_build_object('motivo','Devolução ao fornecedor: '||trim(motivo)));
 ELSIF FOUND AND desp.dados->>'estado' <> 'cancelado' THEN
  credito := total_valor; resultado := 'credito_pendente';
 END IF;
 UPDATE martins_producao_v1.registros SET revisao=revisao+1, atualizado_por=auth.uid(), atualizado_em=now(),
  dados=dados||jsonb_build_object('itens',novos,'credito_pendente_centavos',COALESCE((dados->>'credito_pendente_centavos')::bigint,0)+credito,
   'devolucoes',COALESCE(dados->'devolucoes','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',devol_id,'em',now(),'por',auth.uid(),'motivo',trim(motivo),'valor_centavos',total_valor,'itens',aplicados,'despesa',resultado)))
  WHERE empresa_id=e AND modulo='recebimentos_compra' AND id=recebimento RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'recebimentos_compra',recebimento,auth.uid(),op,'editar',to_jsonb(rec),to_jsonb(novo)||jsonb_build_object('motivo','Devolução ao fornecedor: '||trim(motivo)));
 resposta := jsonb_build_object('empresa_id',e,'modulo','recebimentos_compra','id',recebimento,'revisao',novo.revisao,'valor_devolvido_centavos',total_valor,'despesa',resultado,'credito_pendente_centavos',credito,'movimentos',movs);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_compras_devolver(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_compras_devolver(uuid,uuid,uuid,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
