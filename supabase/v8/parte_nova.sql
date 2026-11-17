-- ============================================================================
-- Contratos v8: REQUISIÇÃO DE MATERIAIS DA OBRA. Solicitar -> aprovar (Master) -> entregar.
-- A entrega é UM evento atômico: baixa do estoque do depósito (consumo da obra, como na v6)
-- + atualização da requisição. Entrega parcial permitida; nunca passa do solicitado nem do saldo.
-- Aditivo sobre a v7. Quantidades em milésimos, inteiras.
-- ============================================================================
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material'));

CREATE UNIQUE INDEX requisicao_numero_empresa ON martins_producao_v1.registros(empresa_id,(dados->>'numero')) WHERE modulo='requisicoes_material';

-- Validação da requisição (somente enquanto "solicitada"). Estado e entregue são do servidor.
CREATE FUNCTION martins_producao_v1.preparar_v8(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item jsonb; itens jsonb := '[]'::jsonb; vistos uuid[] := ARRAY[]::uuid[]; p uuid; numero bigint; dep martins_producao_v1.registros; prod martins_producao_v1.registros;
BEGIN
 d := jsonb_strip_nulls(d);
 IF anterior.id IS NOT NULL AND COALESCE(anterior.dados->>'estado','solicitada') <> 'solicitada' THEN
  RAISE EXCEPTION 'Requisição % não pode ser editada; somente requisições solicitadas', COALESCE(anterior.dados->>'estado','') USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('id','empresa_id','empresaId','obra_id','rdo_id','deposito_id','itens','observacao','necessario_em','numero','estado')) THEN
  RAISE EXCEPTION 'Campo de requisição não reconhecido' USING ERRCODE='22023'; END IF;
 IF NOT martins_producao_v1.existe(e,'obras',NULLIF(d->>'obra_id','')::uuid) THEN RAISE EXCEPTION 'Obra obrigatória e da empresa ativa' USING ERRCODE='23503'; END IF;
 IF NULLIF(d->>'rdo_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='rdos' AND x.id=(d->>'rdo_id')::uuid AND x.dados->>'obra_id'=d->>'obra_id') THEN
  RAISE EXCEPTION 'O RDO informado não é desta obra' USING ERRCODE='23503'; END IF;
 SELECT * INTO dep FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='depositos' AND id=NULLIF(d->>'deposito_id','')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Depósito de origem obrigatório e da empresa ativa' USING ERRCODE='23503'; END IF;
 IF NOT COALESCE((dep.dados->>'ativo')::boolean,true) THEN RAISE EXCEPTION 'Depósito inativo' USING ERRCODE='22023'; END IF;
 IF NULLIF(d->>'necessario_em','') IS NOT NULL THEN d := jsonb_set(d,'{necessario_em}',to_jsonb(((d->>'necessario_em')::date)::text)); END IF;
 IF length(COALESCE(d->>'observacao',''))>500 THEN RAISE EXCEPTION 'Observação longa demais' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(d->'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'itens') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Informe de 1 a 100 itens na requisição' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(d->'itens') LOOP
  p := NULLIF(item->>'produto_id','')::uuid;
  SELECT * INTO prod FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='produtos' AND id=p;
  IF p IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'Produto da requisição não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF NOT COALESCE((prod.dados->>'ativo')::boolean,true) THEN RAISE EXCEPTION 'Produto inativo na requisição' USING ERRCODE='22023'; END IF;
  IF p = ANY(vistos) THEN RAISE EXCEPTION 'Produto repetido na requisição; some as quantidades' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,p);
  IF COALESCE(item->>'qtd_milli','') !~ '^[0-9]{1,13}$' OR (item->>'qtd_milli')::bigint < 1 THEN RAISE EXCEPTION 'Quantidade inválida na requisição' USING ERRCODE='22023'; END IF;
  itens := itens || jsonb_build_array(jsonb_build_object('produto_id',p,'qtd_milli',(item->>'qtd_milli')::bigint,'entregue_milli',0));
 END LOOP;
 IF anterior.id IS NULL THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'requisicao-numero',0));
  SELECT COALESCE(max((x.dados->>'numero')::bigint),0)+1 INTO numero FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='requisicoes_material';
 ELSE numero := (anterior.dados->>'numero')::bigint; END IF;
 RETURN (d - 'itens' - 'numero' - 'estado') || jsonb_build_object('itens',itens,'numero',numero,'estado','solicitada');
END $$;
REVOKE ALL ON FUNCTION martins_producao_v1.preparar_v8(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros) FROM PUBLIC,anon,authenticated;

-- Aprovar/recusar: somente Master. Cancelar: quem edita requisições, enquanto nada foi entregue.
CREATE FUNCTION public.martins_producao_req_estado(e uuid, r uuid, v bigint, estado text, motivo text, op uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb; atual text;
BEGIN
 IF r IS NULL OR op IS NULL OR v IS NULL OR v<1 OR estado IS NULL OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>1000 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF estado NOT IN ('aprovada','recusada','cancelada') THEN RAISE EXCEPTION 'Estado inválido' USING ERRCODE='22023'; END IF;
 IF estado IN ('aprovada','recusada') THEN
  IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Aprovar ou recusar requisição é exclusivo do Master' USING ERRCODE='42501'; END IF;
 ELSIF martins_producao_v1.pode(e,'requisicoes_material','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 req := jsonb_build_object('acao','req_estado','e',e,'r',r,'v',v,'estado',estado,'motivo',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'requisicao'||r::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='requisicoes_material' AND id=r FOR UPDATE;
 IF NOT FOUND OR anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 atual := COALESCE(anterior.dados->>'estado','solicitada');
 IF NOT ((atual='solicitada' AND estado IN ('aprovada','recusada','cancelada')) OR (atual='aprovada' AND estado='cancelada'
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(anterior.dados->'itens') i WHERE (i->>'entregue_milli')::bigint>0))) THEN
  RAISE EXCEPTION 'Transição de % para % não permitida', atual, estado USING ERRCODE='22023'; END IF;
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('estado',estado), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='requisicoes_material' AND id=r RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'requisicoes_material',r,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo',motivo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','requisicoes_material','id',r,'revisao',novo.revisao,'estado',estado);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Entrega: baixa do estoque (consumo da obra) + requisição, na mesma transação.
CREATE FUNCTION public.martins_producao_req_entregar(e uuid, op uuid, requisicao uuid, itens jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; rq martins_producao_v1.registros; novo martins_producao_v1.registros; mov martins_producao_v1.registros;
 it jsonb; po jsonb; p uuid; q bigint; i int := 0; vistos uuid[] := ARRAY[]::uuid[]; dep uuid; nid uuid; ids jsonb := '[]'::jsonb; novos jsonb := '[]'::jsonb; pendente bigint; entregue bigint; todos boolean; novo_estado text; resposta jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'estoque_movimentos','criar') IS NOT TRUE OR martins_producao_v1.pode(e,'requisicoes_material','ler') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR requisicao IS NULL OR jsonb_typeof(itens) IS DISTINCT FROM 'array' OR jsonb_array_length(itens) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','req_entregar','e',e,'q',requisicao,'i',itens);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'requisicao'||requisicao::text,0));
 SELECT * INTO rq FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='requisicoes_material' AND id=requisicao FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Requisição não encontrada nesta empresa' USING ERRCODE='23503'; END IF;
 IF rq.dados->>'estado' NOT IN ('aprovada','parcial') THEN RAISE EXCEPTION 'Só se entrega requisição aprovada (estado atual: %)', rq.dados->>'estado' USING ERRCODE='22023'; END IF;
 dep := (rq.dados->>'deposito_id')::uuid;
 FOR it IN SELECT value FROM jsonb_array_elements(itens) LOOP
  i := i + 1; p := NULLIF(it->>'produto_id','')::uuid;
  IF COALESCE(it->>'qtd_milli','') !~ '^[0-9]{1,13}$' OR (it->>'qtd_milli')::bigint < 1 THEN RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE='22023'; END IF;
  q := (it->>'qtd_milli')::bigint;
  IF p IS NULL OR p = ANY(vistos) THEN RAISE EXCEPTION 'Produto ausente ou repetido na entrega' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,p);
  SELECT i2 INTO po FROM jsonb_array_elements(rq.dados->'itens') i2 WHERE i2->>'produto_id'=p::text;
  IF po IS NULL THEN RAISE EXCEPTION 'Produto não faz parte da requisição' USING ERRCODE='23503'; END IF;
  pendente := (po->>'qtd_milli')::bigint - (po->>'entregue_milli')::bigint;
  IF q > pendente THEN RAISE EXCEPTION 'Entrega maior que o pendente da requisição (pendente: % milésimos)', pendente USING ERRCODE='23514'; END IF;
  IF NULLIF(rq.dados->>'rdo_id','') IS NOT NULL AND EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='estoque_movimentos' AND x.dados->>'tipo'='consumo' AND x.dados->>'rdo_id'=rq.dados->>'rdo_id' AND x.dados->>'produto_id'=p::text) THEN
   RAISE EXCEPTION 'Este material já foi baixado no RDO da requisição; para corrigir, registre uma devolução' USING ERRCODE='23505'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||p::text||'estoque',0));
  IF martins_producao_v1.saldo(e,p,dep) < q THEN RAISE EXCEPTION 'Saldo insuficiente no depósito para um dos materiais' USING ERRCODE='23514'; END IF;
  nid := gen_random_uuid();
  INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
   VALUES(e,'estoque_movimentos',nid,1,jsonb_strip_nulls(jsonb_build_object('tipo','consumo','produto_id',p,'origem_id',dep,'quantidade_milli',q,'obra_id',rq.dados->>'obra_id','requisicao_id',requisicao,'motivo','Requisição nº '||(rq.dados->>'numero'))),auth.uid(),auth.uid())
   RETURNING * INTO mov;
  INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
   VALUES(e,'estoque_movimentos',nid,auth.uid(),md5(op::text||'e'||i)::uuid,'criar',NULL,to_jsonb(mov));
  ids := ids || jsonb_build_array(nid);
 END LOOP;
 FOR po IN SELECT value FROM jsonb_array_elements(rq.dados->'itens') LOOP
  entregue := (po->>'entregue_milli')::bigint + COALESCE((SELECT (x->>'qtd_milli')::bigint FROM jsonb_array_elements(itens) x WHERE x->>'produto_id'=po->>'produto_id'),0);
  novos := novos || jsonb_build_array(jsonb_set(po,'{entregue_milli}',to_jsonb(entregue)));
 END LOOP;
 SELECT bool_and((x->>'entregue_milli')::bigint >= (x->>'qtd_milli')::bigint) INTO todos FROM jsonb_array_elements(novos) x;
 novo_estado := CASE WHEN todos THEN 'entregue' ELSE 'parcial' END;
 UPDATE martins_producao_v1.registros SET revisao=revisao+1, dados=dados||jsonb_build_object('itens',novos,'estado',novo_estado), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='requisicoes_material' AND id=requisicao RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'requisicoes_material',requisicao,auth.uid(),md5(op::text||'req')::uuid,'editar',to_jsonb(rq),to_jsonb(novo)||jsonb_build_object('motivo','Entrega registrada'));
 resposta := jsonb_build_object('empresa_id',e,'modulo','requisicoes_material','id',requisicao,'revisao',novo.revisao,'estado',novo_estado,'ids',ids);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_req_estado(uuid,uuid,bigint,text,text,uuid), public.martins_producao_req_entregar(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_req_estado(uuid,uuid,bigint,text,text,uuid), public.martins_producao_req_entregar(uuid,uuid,uuid,jsonb) TO authenticated;
