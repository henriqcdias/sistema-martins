-- GERADO por supabase/v15/gerar_migracao.py. Reverte a v15 (só se não houver parcelas geradas por pedido). Consumos já gravados mantêm o custo.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND NULLIF(dados->>'pedido_id','') IS NOT NULL) THEN
  RAISE EXCEPTION 'Há contas a receber geradas por pedido; a reversão apagaria vínculos e foi bloqueada';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.martins_producao_obra_consumir(e uuid, op uuid, obra uuid, deposito uuid, itens jsonb, rdo uuid DEFAULT NULL, motivo text DEFAULT NULL) RETURNS jsonb
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

CREATE OR REPLACE FUNCTION public.martins_producao_req_entregar(e uuid, op uuid, requisicao uuid, itens jsonb) RETURNS jsonb
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

CREATE OR REPLACE FUNCTION public.martins_producao_obra_devolver(e uuid, op uuid, consumo uuid, qtd bigint, motivo text) RETURNS jsonb
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

CREATE OR REPLACE FUNCTION martins_producao_v1.preparar_v10(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 d := jsonb_strip_nulls(d);
 IF anterior.id IS NOT NULL AND (COALESCE(anterior.dados->>'estado','aberta') <> 'aberta' OR COALESCE((anterior.dados->>'recebido_centavos')::bigint,0) > 0
    OR jsonb_array_length(COALESCE(anterior.dados->'baixas','[]'::jsonb)) > 0) THEN
  RAISE EXCEPTION 'Título com recebimento ou fechado não pode ser editado; use cancelar ou estornar' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('id','empresa_id','empresaId','cliente_id','cliente_nome','descricao','valor_centavos','vencimento','competencia','obra_id','orcamento_id','numero_documento','observacao','estado','recebido_centavos','baixas')) THEN
  RAISE EXCEPTION 'Campo de conta a receber não reconhecido' USING ERRCODE='22023'; END IF;
 IF NULLIF(trim(d->>'descricao'),'') IS NULL OR length(d->>'descricao')>200 THEN RAISE EXCEPTION 'Descrição obrigatória (até 200 caracteres)' USING ERRCODE='22023'; END IF;
 IF NULLIF(d->>'cliente_id','') IS NOT NULL THEN
  IF NOT martins_producao_v1.existe(e,'clientes',(d->>'cliente_id')::uuid) THEN RAISE EXCEPTION 'Cliente não pertence à empresa' USING ERRCODE='23503'; END IF;
 ELSIF NULLIF(trim(d->>'cliente_nome'),'') IS NULL OR length(d->>'cliente_nome')>200 THEN RAISE EXCEPTION 'Informe o cliente' USING ERRCODE='22023'; END IF;
 IF COALESCE(d->>'valor_centavos','') !~ '^[0-9]{1,13}$' OR (d->>'valor_centavos')::bigint < 1 THEN RAISE EXCEPTION 'Valor inválido (centavos inteiros, maior que zero)' USING ERRCODE='22023'; END IF;
 d := jsonb_set(d,'{valor_centavos}',to_jsonb((d->>'valor_centavos')::bigint));
 IF NULLIF(d->>'vencimento','') IS NULL THEN RAISE EXCEPTION 'Vencimento obrigatório' USING ERRCODE='22023'; END IF;
 d := jsonb_set(d,'{vencimento}',to_jsonb(((d->>'vencimento')::date)::text));
 IF NULLIF(d->>'competencia','') IS NOT NULL THEN d := jsonb_set(d,'{competencia}',to_jsonb(((d->>'competencia')::date)::text)); END IF;
 IF NULLIF(d->>'obra_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'obras',(d->>'obra_id')::uuid) THEN RAISE EXCEPTION 'Obra não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF NULLIF(d->>'orcamento_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'orcamentos',(d->>'orcamento_id')::uuid) THEN RAISE EXCEPTION 'Orçamento não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF length(COALESCE(d->>'numero_documento',''))>60 OR length(COALESCE(d->>'observacao',''))>500 THEN RAISE EXCEPTION 'Texto longo demais' USING ERRCODE='22023'; END IF;
 RETURN (d - 'estado' - 'recebido_centavos' - 'baixas') || jsonb_build_object('estado','aberta','recebido_centavos',0,'baixas','[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.martins_producao_obra_gastos(e uuid, obra uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE eh_master boolean; mat jsonb; sem jsonb; material bigint; diretas bigint; confid bigint; excluidas bigint;
BEGIN
 IF NOT public.martins_online_leitor(e) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF obra IS NULL OR NOT martins_producao_v1.existe(e,'obras',obra) THEN RAISE EXCEPTION 'Obra não pertence à empresa' USING ERRCODE='23503'; END IF;
 eh_master := public.martins_online_master(e);
 WITH consumo AS (
   SELECT x.dados->>'produto_id' p,
          sum(CASE WHEN x.dados->>'tipo'='consumo' THEN (x.dados->>'quantidade_milli')::bigint ELSE -(x.dados->>'quantidade_milli')::bigint END)::bigint liquido
   FROM martins_producao_v1.registros x
   WHERE x.empresa_id=e AND x.modulo='estoque_movimentos' AND x.dados->>'obra_id'=obra::text AND x.dados->>'tipo' IN ('consumo','devolucao_obra') GROUP BY 1),
 compras AS (
   SELECT i->>'produto_id' p,
          sum((i->>'qtd_milli')::bigint - COALESCE((i->>'devolvido_milli')::bigint,0))::bigint q,
          sum(round((i->>'qtd_milli')::numeric*(i->>'preco_centavos')::numeric/1000) - COALESCE((i->>'devolvido_centavos')::bigint,0))::bigint v
   FROM martins_producao_v1.registros r CROSS JOIN LATERAL jsonb_array_elements(r.dados->'itens') i
   WHERE r.empresa_id=e AND r.modulo='recebimentos_compra' GROUP BY 1),
 linhas AS (
   SELECT c.p, c.liquido, k.q, k.v,
          CASE WHEN k.q > 0 THEN round(k.v::numeric*1000/k.q)::bigint END custo_unitario,
          CASE WHEN k.q > 0 THEN round(c.liquido::numeric*k.v/k.q)::bigint END custo_total
   FROM consumo c LEFT JOIN compras k ON k.p=c.p WHERE c.liquido <> 0)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('produto_id',p,'liquido_milli',liquido,'custo_unitario_centavos',custo_unitario,'custo_centavos',custo_total) ORDER BY p) FILTER (WHERE custo_total IS NOT NULL),'[]'::jsonb),
        COALESCE(jsonb_agg(jsonb_build_object('produto_id',p,'liquido_milli',liquido) ORDER BY p) FILTER (WHERE custo_total IS NULL),'[]'::jsonb),
        COALESCE(sum(custo_total),0)::bigint
 INTO mat, sem, material FROM linhas;
 SELECT COALESCE(sum((d.dados->>'valor_centavos')::bigint) FILTER (WHERE NOT origem AND (eh_master OR NOT conf)),0)::bigint,
        CASE WHEN eh_master THEN COALESCE(sum((d.dados->>'valor_centavos')::bigint) FILTER (WHERE conf AND NOT origem),0)::bigint END,
        COALESCE(sum((d.dados->>'valor_centavos')::bigint) FILTER (WHERE origem AND (eh_master OR NOT conf)),0)::bigint
 INTO diretas, confid, excluidas
 FROM (SELECT x.dados AS dados, COALESCE((x.dados->>'confidencial')::boolean,false) conf,
              EXISTS(SELECT 1 FROM martins_producao_v1.registros r WHERE r.empresa_id=e AND r.modulo='recebimentos_compra' AND r.dados->>'despesa_id'=x.id::text) origem
       FROM martins_producao_v1.registros x
       WHERE x.empresa_id=e AND x.modulo='despesas' AND x.dados->>'obra_id'=obra::text AND COALESCE(x.dados->>'estado','') <> 'cancelado') d;
 RETURN jsonb_build_object('obra_id',obra,'material',mat,'sem_custo',sem,'material_centavos',material,'despesas_diretas_centavos',diretas,
   'confidenciais_incluidas_centavos',confid,'despesas_de_compras_nao_somadas_centavos',excluidas,'total_centavos',material+diretas);
END $$;

DROP FUNCTION public.martins_producao_financeiro_relatorios(uuid,date,date);
DROP FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean,integer,date,integer);
CREATE FUNCTION public.martins_producao_orcamento_converter(e uuid, op uuid, orcamento uuid, v bigint, aprovar_antes boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; atual text; resposta jsonb; hist jsonb; ped_id uuid := gen_random_uuid(); num bigint; ped martins_producao_v1.registros; ja martins_producao_v1.registros;
 hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 IF martins_producao_v1.pode(e,'orcamentos','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR orcamento IS NULL OR v IS NULL OR v<1 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','orcamento_converter','e',e,'o',orcamento,'v',v,'a',COALESCE(aprovar_antes,false));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'orcamento'||orcamento::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='orcamentos' AND id=orcamento FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado nesta empresa' USING ERRCODE='23503'; END IF;
 SELECT * INTO ja FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='pedidos_venda' AND dados->>'orcamento_id'=orcamento::text;
 IF FOUND THEN RAISE EXCEPTION 'Este orçamento já foi convertido no pedido nº %; nada foi duplicado', ja.dados->>'numero' USING ERRCODE='23505'; END IF;
 IF anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 atual := CASE COALESCE(anterior.dados->>'status','') WHEN 'Em Orçamento' THEN 'Em elaboração' WHEN '' THEN 'Em elaboração' ELSE anterior.dados->>'status' END;
 IF atual NOT IN ('Aprovado') AND NOT (COALESCE(aprovar_antes,false) AND atual IN ('Em elaboração','Enviado')) THEN
  RAISE EXCEPTION 'Só se converte orçamento aprovado (situação atual: %)', atual USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(anterior.dados->'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(anterior.dados->'itens')<1 OR COALESCE((anterior.dados->>'total')::numeric,0) <= 0 THEN
  RAISE EXCEPTION 'Orçamento sem itens ou sem valor não pode virar pedido' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'pedido-venda-numero',0));
 SELECT COALESCE(max((x.dados->>'numero')::bigint),0)+1 INTO num FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='pedidos_venda';
 INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
  VALUES(e,'pedidos_venda',ped_id,1,jsonb_strip_nulls(jsonb_build_object('numero',num,'orcamento_id',orcamento,'orcamento_numero',anterior.dados->'numero','cliente',anterior.dados->>'cliente','cliente_id',anterior.dados->>'cliente_id',
    'vendedor_id',anterior.dados->>'vendedor_id','vendedorResponsavel',anterior.dados->>'vendedorResponsavel','obra_id',anterior.dados->>'obra_id','itens',anterior.dados->'itens','total',(anterior.dados->>'total')::numeric,
    'condicoes',anterior.dados->>'condicoes','prazo',anterior.dados->>'prazo','estado','aberto','data',hoje::text)),auth.uid(),auth.uid())
  RETURNING * INTO ped;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'pedidos_venda',ped_id,auth.uid(),md5(op::text||'ped')::uuid,'criar',NULL,to_jsonb(ped));
 hist := COALESCE(anterior.dados->'historicoStatus','[]'::jsonb)||jsonb_build_array(jsonb_build_object('de',atual,'para','Convertido em venda','em',now(),'por',auth.uid(),'motivo','Convertido no pedido nº '||num));
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('status','Convertido em venda','pedido_id',ped_id,'pedido_numero',num,'historicoStatus',hist), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='orcamentos' AND id=orcamento RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'orcamentos',orcamento,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo','Convertido no pedido nº '||num));
 resposta := jsonb_build_object('empresa_id',e,'modulo','orcamentos','id',orcamento,'revisao',novo.revisao,'status','Convertido em venda','pedido_id',ped_id,'pedido_numero',num);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;
REVOKE ALL ON FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean) TO authenticated;
DROP FUNCTION martins_producao_v1.custo_medio(uuid,uuid);
DROP INDEX martins_producao_v1.conta_receber_parcela_unica;
NOTIFY pgrst,'reload schema';
COMMIT;
