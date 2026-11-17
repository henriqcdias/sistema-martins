-- ============================================================================
-- Contratos v5: COMPRAS. Pedido de compra -> aprovação (Master) -> recebimento.
-- O recebimento é UM evento atômico: entrada no estoque + obrigação pendente de conferência
-- + atualização do pedido. A nota fiscal não pode entrar duas vezes (chave ou fornecedor+número).
-- Aditivo sobre a v4. Dinheiro em centavos, quantidades em milésimos, tudo inteiro.
-- ============================================================================
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra'));

CREATE UNIQUE INDEX pedido_numero_empresa ON martins_producao_v1.registros(empresa_id,(dados->>'numero')) WHERE modulo='pedidos_compra';
-- A mesma nota não entra duas vezes.
CREATE UNIQUE INDEX recebimento_chave_unica ON martins_producao_v1.registros(empresa_id,(dados->>'chave_acesso'))
 WHERE modulo='recebimentos_compra' AND NULLIF(dados->>'chave_acesso','') IS NOT NULL;
CREATE UNIQUE INDEX recebimento_nf_fornecedor ON martins_producao_v1.registros(empresa_id,(dados->>'fornecedor_id'),(dados->>'numero_nf'))
 WHERE modulo='recebimentos_compra' AND NULLIF(dados->>'numero_nf','') IS NOT NULL;

-- Validação do pedido (somente em rascunho). Recebido e estado são do servidor.
CREATE FUNCTION martins_producao_v1.preparar_v5(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item jsonb; itens jsonb := '[]'::jsonb; vistos uuid[] := ARRAY[]::uuid[]; p uuid; numero bigint;
BEGIN
 IF anterior.id IS NOT NULL AND COALESCE(anterior.dados->>'estado','rascunho') <> 'rascunho' THEN
  RAISE EXCEPTION 'Pedido % não pode ser editado; somente pedidos em rascunho', COALESCE(anterior.dados->>'estado','') USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('id','empresa_id','empresaId','fornecedor_id','centro_custo_id','obra_id','conta_bancaria_id','itens','observacao','previsao_entrega','numero','estado')) THEN
  RAISE EXCEPTION 'Campo de pedido não reconhecido' USING ERRCODE='22023'; END IF;
 IF NOT martins_producao_v1.existe(e,'fornecedores',NULLIF(d->>'fornecedor_id','')::uuid) THEN RAISE EXCEPTION 'Fornecedor não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF NOT martins_producao_v1.existe(e,'centros_custo',NULLIF(d->>'centro_custo_id','')::uuid) THEN RAISE EXCEPTION 'Centro de custo não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF NULLIF(d->>'obra_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'obras',(d->>'obra_id')::uuid) THEN RAISE EXCEPTION 'Obra não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF NULLIF(d->>'conta_bancaria_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'contas_bancarias',(d->>'conta_bancaria_id')::uuid) THEN RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF jsonb_typeof(d->'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'itens') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Informe de 1 a 100 itens no pedido' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(d->'itens') LOOP
  p := NULLIF(item->>'produto_id','')::uuid;
  IF NOT martins_producao_v1.existe(e,'produtos',p) THEN RAISE EXCEPTION 'Produto do pedido não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF p = ANY(vistos) THEN RAISE EXCEPTION 'Produto repetido no pedido; some as quantidades' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,p);
  IF COALESCE(item->>'qtd_milli','') !~ '^[0-9]{1,13}$' OR (item->>'qtd_milli')::bigint < 1 THEN RAISE EXCEPTION 'Quantidade inválida no pedido' USING ERRCODE='22023'; END IF;
  IF COALESCE(item->>'preco_centavos','') !~ '^[0-9]{1,13}$' OR (item->>'preco_centavos')::bigint < 1 THEN RAISE EXCEPTION 'Informe o preço unitário (maior que zero) de cada item' USING ERRCODE='22023'; END IF;
  itens := itens || jsonb_build_array(jsonb_build_object('produto_id',p,'qtd_milli',(item->>'qtd_milli')::bigint,'preco_centavos',(item->>'preco_centavos')::bigint,'recebido_milli',0));
 END LOOP;
 IF anterior.id IS NULL THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'pedido-numero',0));
  SELECT COALESCE(max((x.dados->>'numero')::bigint),0)+1 INTO numero FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='pedidos_compra';
 ELSE numero := (anterior.dados->>'numero')::bigint; END IF;
 RETURN (d - 'itens' - 'numero' - 'estado') || jsonb_build_object('itens',itens,'numero',numero,'estado','rascunho');
END $$;
REVOKE ALL ON FUNCTION martins_producao_v1.preparar_v5(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros) FROM PUBLIC,anon,authenticated;

-- Aprovação e cancelamento: somente Master.
CREATE FUNCTION public.martins_producao_compras_estado(e uuid, r uuid, v bigint, estado text, motivo text, op uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb; atual text;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF r IS NULL OR op IS NULL OR v IS NULL OR v<1 OR estado IS NULL OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>1000 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','compras_estado','e',e,'r',r,'v',v,'estado',estado,'motivo',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'pedido'||r::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='pedidos_compra' AND id=r FOR UPDATE;
 IF NOT FOUND OR anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 atual := COALESCE(anterior.dados->>'estado','rascunho');
 IF NOT ((atual='rascunho' AND estado IN ('aprovado','cancelado')) OR (atual='aprovado' AND estado='cancelado'
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(anterior.dados->'itens') i WHERE (i->>'recebido_milli')::bigint>0))) THEN
  RAISE EXCEPTION 'Transição de % para % não permitida', atual, estado USING ERRCODE='22023'; END IF;
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('estado',estado), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='pedidos_compra' AND id=r RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'pedidos_compra',r,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo',motivo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','pedidos_compra','id',r,'revisao',novo.revisao,'estado',estado);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Recebimento: entrada no estoque + obrigação + pedido, na mesma transação.
CREATE FUNCTION public.martins_producao_compras_receber(e uuid, op uuid, pedido uuid, deposito uuid, itens jsonb, documento jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; ped martins_producao_v1.registros; rec_id uuid := gen_random_uuid(); desp_id uuid := gen_random_uuid();
 it jsonb; po jsonb; i int := 0; total numeric := 0; qtd bigint; novos jsonb := '[]'::jsonb; movs jsonb := '[]'::jsonb; mov jsonb; todos boolean; nf text; chave text; hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
 novo_estado text; resposta jsonb; recebidos jsonb := '[]'::jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'pedidos_compra','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR pedido IS NULL OR deposito IS NULL OR jsonb_typeof(itens) IS DISTINCT FROM 'array' OR jsonb_array_length(itens) NOT BETWEEN 1 AND 100 OR jsonb_typeof(documento) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 nf := NULLIF(trim(documento->>'numero'),''); chave := NULLIF(regexp_replace(COALESCE(documento->>'chave_acesso',''),'[^0-9]','','g'),'');
 IF nf IS NULL AND chave IS NULL THEN RAISE EXCEPTION 'Informe o número ou a chave de acesso da nota fiscal' USING ERRCODE='22023'; END IF;
 IF chave IS NOT NULL AND length(chave)<>44 THEN RAISE EXCEPTION 'Chave de acesso inválida: são 44 dígitos' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','compras_receber','e',e,'p',pedido,'d',deposito,'i',itens,'doc',documento);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'pedido'||pedido::text,0));
 SELECT * INTO ped FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='pedidos_compra' AND id=pedido FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado nesta empresa' USING ERRCODE='23503'; END IF;
 IF COALESCE(ped.dados->>'estado','') NOT IN ('aprovado','recebido_parcial') THEN RAISE EXCEPTION 'Só é possível receber pedido aprovado (situação atual: %)', COALESCE(ped.dados->>'estado','') USING ERRCODE='22023'; END IF;
 IF NOT martins_producao_v1.existe(e,'depositos',deposito) THEN RAISE EXCEPTION 'Depósito não pertence à empresa' USING ERRCODE='23503'; END IF;
 -- Nota fiscal já recebida (XML importado ou lançamento manual): recusa com a origem.
 IF (chave IS NOT NULL AND EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='recebimentos_compra' AND x.dados->>'chave_acesso'=chave))
  OR (nf IS NOT NULL AND EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='recebimentos_compra' AND x.dados->>'fornecedor_id'=ped.dados->>'fornecedor_id' AND x.dados->>'numero_nf'=nf)) THEN
  RAISE EXCEPTION 'Esta nota fiscal já foi recebida; nada foi lançado de novo' USING ERRCODE='23505'; END IF;
 -- Itens recebidos: só produtos do pedido, sem exceder o que falta.
 FOR it IN SELECT value FROM jsonb_array_elements(itens) LOOP
  i := i + 1;
  IF COALESCE(it->>'qtd_milli','') !~ '^[0-9]{1,13}$' OR (it->>'qtd_milli')::bigint < 1 THEN RAISE EXCEPTION 'Quantidade recebida inválida' USING ERRCODE='22023'; END IF;
  qtd := (it->>'qtd_milli')::bigint;
  SELECT x INTO po FROM jsonb_array_elements(ped.dados->'itens') x WHERE x->>'produto_id'=it->>'produto_id';
  IF po IS NULL THEN RAISE EXCEPTION 'Produto não faz parte do pedido' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(recebidos) y WHERE y->>'produto_id'=it->>'produto_id') THEN RAISE EXCEPTION 'Produto repetido no recebimento' USING ERRCODE='22023'; END IF;
  IF (po->>'recebido_milli')::bigint + qtd > (po->>'qtd_milli')::bigint THEN RAISE EXCEPTION 'Quantidade maior que o saldo do pedido' USING ERRCODE='23514'; END IF;
  total := total + round(qtd::numeric * (po->>'preco_centavos')::numeric / 1000);
  recebidos := recebidos || jsonb_build_array(jsonb_build_object('produto_id',it->>'produto_id','qtd_milli',qtd,'preco_centavos',(po->>'preco_centavos')::bigint));
  mov := public.martins_producao_estoque_mover(e, md5(op::text||'mov'||i)::uuid, 'entrada', (it->>'produto_id')::uuid, NULL, deposito, qtd, 'Recebimento do pedido '||(ped.dados->>'numero')||COALESCE(' · NF '||nf,''), NULL);
  movs := movs || jsonb_build_array(mov->>'id');
 END LOOP;
 IF total < 1 THEN RAISE EXCEPTION 'Valor do recebimento inválido' USING ERRCODE='22023'; END IF;
 -- Atualiza o recebido do pedido.
 SELECT jsonb_agg(CASE WHEN y.q IS NOT NULL THEN t.x||jsonb_build_object('recebido_milli',(t.x->>'recebido_milli')::bigint+y.q) ELSE t.x END ORDER BY t.n)
  INTO novos FROM jsonb_array_elements(ped.dados->'itens') WITH ORDINALITY AS t(x,n)
  LEFT JOIN (SELECT yy->>'produto_id' p,(yy->>'qtd_milli')::bigint q FROM jsonb_array_elements(recebidos) yy) y ON y.p=t.x->>'produto_id';
 SELECT bool_and((x->>'recebido_milli')::bigint >= (x->>'qtd_milli')::bigint) INTO todos FROM jsonb_array_elements(novos) x;
 novo_estado := CASE WHEN todos THEN 'recebido' ELSE 'recebido_parcial' END;
 UPDATE martins_producao_v1.registros SET revisao=revisao+1, dados=dados||jsonb_build_object('itens',novos,'estado',novo_estado), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='pedidos_compra' AND id=pedido;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'pedidos_compra',pedido,auth.uid(),md5(op::text||'ped')::uuid,'editar',to_jsonb(ped),jsonb_build_object('dados',jsonb_build_object('estado',novo_estado),'motivo','Recebimento '||rec_id));
 -- Obrigação: pendente de conferência (o Master aprova; nada é pago automaticamente).
 INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
  VALUES(e,'despesas',desp_id,1,jsonb_strip_nulls(jsonb_build_object('descricao','Compra · pedido '||(ped.dados->>'numero')||COALESCE(' · NF '||nf,''),'valor_centavos',total::bigint,'competencia',hoje::text,
   'classificacao',CASE WHEN ped.dados->>'obra_id' IS NOT NULL THEN 'obra' ELSE 'administrativa' END,'obra_id',ped.dados->>'obra_id','centro_custo_id',ped.dados->>'centro_custo_id',
   'fornecedor_id',ped.dados->>'fornecedor_id','conta_bancaria_id',ped.dados->>'conta_bancaria_id','documento_numero',nf,'observacao','Gerada pelo recebimento '||rec_id,'confidencial',false,'estado','pendente_conferencia')),auth.uid(),auth.uid());
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'despesas',desp_id,auth.uid(),md5(op::text||'desp')::uuid,'criar',NULL,jsonb_build_object('dados',jsonb_build_object('estado','pendente_conferencia'),'motivo','Obrigação do recebimento '||rec_id));
 INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
  VALUES(e,'recebimentos_compra',rec_id,1,jsonb_strip_nulls(jsonb_build_object('pedido_id',pedido,'fornecedor_id',ped.dados->>'fornecedor_id','deposito_id',deposito,'numero_nf',nf,'chave_acesso',chave,
   'data',hoje::text,'itens',recebidos,'total_centavos',total::bigint,'despesa_id',desp_id,'movimentos',movs)),auth.uid(),auth.uid());
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'recebimentos_compra',rec_id,auth.uid(),op,'criar',NULL,jsonb_build_object('dados',jsonb_build_object('estado',novo_estado)));
 resposta := jsonb_build_object('empresa_id',e,'modulo','recebimentos_compra','id',rec_id,'revisao',1,'despesa_id',desp_id,'estado_pedido',novo_estado,'total_centavos',total::bigint);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;
REVOKE ALL ON FUNCTION public.martins_producao_compras_estado(uuid,uuid,bigint,text,text,uuid), public.martins_producao_compras_receber(uuid,uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_compras_estado(uuid,uuid,bigint,text,text,uuid), public.martins_producao_compras_receber(uuid,uuid,uuid,uuid,jsonb,jsonb) TO authenticated;
