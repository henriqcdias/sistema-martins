-- GERADO por supabase/v5/gerar_migracao.py. Não edite à mão.
-- Pré-requisito: producao, v2, v3 e v4 aplicadas.
BEGIN;
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

-- Funções existentes, copiadas da v4 com os módulos de compras.

CREATE OR REPLACE FUNCTION martins_producao_v1.pode(e uuid,m text,a text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND m IN ('funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra')
 AND a IN ('ler','criar','editar')
 AND EXISTS(SELECT 1 FROM public.martins_online_acessos v JOIN public.martins_perfis p ON p.usuario_id=v.usuario_id
 WHERE v.usuario_id=auth.uid() AND v.empresa_id=e AND v.ativo AND p.ativo
 AND (v.papel='master' OR (a='ler' AND v.papel='administrador' AND v.leitura_integral) OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes q
 WHERE q.usuario_id=v.usuario_id AND q.empresa_id=e AND q.modulo=m
 AND CASE a WHEN 'ler' THEN q.ler WHEN 'criar' THEN q.ler AND q.criar WHEN 'editar' THEN q.ler AND q.editar ELSE false END)))
$$;

CREATE OR REPLACE FUNCTION public.martins_producao_contexto() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE resultado jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('usuario_id',p.usuario_id,'nome',p.nome,'empresas',
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'nome',COALESCE(e.nome_fantasia,e.razao_social),'papel',v.papel,
 'permissoes',(SELECT jsonb_object_agg(m,jsonb_build_object('ler',martins_producao_v1.pode(e.id,m,'ler'),'criar',martins_producao_v1.pode(e.id,m,'criar'),'editar',martins_producao_v1.pode(e.id,m,'editar')))
 FROM unnest(ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra']) m)) ORDER BY e.id)
 FROM public.martins_online_acessos v JOIN public.martins_empresas e ON e.id=v.empresa_id
 WHERE v.usuario_id=p.usuario_id AND v.ativo),'[]'::jsonb)) INTO resultado
 FROM public.martins_perfis p WHERE p.usuario_id=auth.uid() AND p.ativo;
 IF resultado IS NULL THEN RAISE EXCEPTION 'Perfil inativo' USING ERRCODE='42501'; END IF;
 RETURN resultado;
END $$;

CREATE OR REPLACE FUNCTION public.martins_producao_salvar(e uuid,m text,r uuid,v bigint,d jsonb,op uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; anterior martins_producao_v1.registros; cached martins_producao_v1.operacoes;
 novo martins_producao_v1.registros; resposta jsonb; obra uuid; pessoa uuid; dia date; horas numeric; total numeric; item jsonb; soma numeric; qtd numeric; metragem numeric; preco numeric; desconto numeric; acrescimo numeric; subtotal numeric; itens jsonb; equipe jsonb; vistos uuid[]:=ARRAY[]::uuid[];
BEGIN
 IF martins_producao_v1.pode(e,m,CASE WHEN v=0 THEN 'criar' ELSE 'editar' END) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF r IS NULL OR op IS NULL OR v IS NULL OR v<0 OR v>=9007199254740991 OR jsonb_typeof(d) IS DISTINCT FROM 'object'
 OR octet_length(d::text)>1048576 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF (d ? 'empresa_id' AND (d->>'empresa_id')::uuid IS DISTINCT FROM e)
 OR (d ? 'empresaId' AND (d->>'empresaId')::uuid IS DISTINCT FROM e)
 OR (d ? 'id' AND (d->>'id')::uuid IS DISTINCT FROM r) THEN RAISE EXCEPTION 'Identidade divergente' USING ERRCODE='22023'; END IF;
 req:=jsonb_build_object('e',e,'m',m,'r',r,'v',v,'d',d);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
 IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
 RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||m||r::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo=m AND id=r FOR UPDATE;
 IF (v=0 AND FOUND) OR (v>0 AND (NOT FOUND OR anterior.revisao<>v)) THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 IF m IN ('estoque_movimentos','recebimentos_compra') THEN RAISE EXCEPTION 'Este registro só é gravado pela função própria do módulo' USING ERRCODE='42501'; END IF;
 IF m IN ('clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas') THEN d:=martins_producao_v1.preparar_v2(e,m,r,v,d,anterior);
 ELSIF m IN ('feriados','precos_insumo','epis') THEN d:=martins_producao_v1.preparar_v3(e,m,r,v,d,anterior);
 ELSIF m='pedidos_compra' THEN d:=martins_producao_v1.preparar_v5(e,m,r,v,d,anterior); END IF;
 IF m IN ('funcionarios','obras','planejamento','orcamentos') AND NULLIF(trim(d->>'nome'),'') IS NULL THEN RAISE EXCEPTION 'Nome obrigatório' USING ERRCODE='22023'; END IF;
 IF m='funcionarios' AND d->>'salarioBase' IS NOT NULL AND ((d->>'salarioBase')::numeric<0 OR (d->>'salarioBase')::numeric>1000000000) THEN RAISE EXCEPTION 'Salário inválido' USING ERRCODE='22023';END IF;
 IF m='obras' AND d->>'valorContratado' IS NOT NULL AND ((d->>'valorContratado')::numeric<0 OR (d->>'valorContratado')::numeric>1000000000000) THEN RAISE EXCEPTION 'Valor contratado inválido' USING ERRCODE='22023';END IF;
 IF m='funcionarios' AND NULLIF(d->>'cpf','') IS NOT NULL AND regexp_replace(d->>'cpf','[^0-9]','','g') !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido' USING ERRCODE='22023'; END IF;
 IF m='obras' AND NOT public.martins_online_master(e) THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('nome','codigo','status','clienteResponsavel','enderecoLocalizacao','responsavelTecnico','encarregado','equipesVinculadas','equipesTerceirizadas','dataInicio','previsaoConclusao','situacaoAtual','descricao')) THEN RAISE EXCEPTION 'Campo de Obras restrito' USING ERRCODE='42501'; END IF;
 d:=COALESCE(anterior.dados,'{}'::jsonb)||d;
 END IF;
 IF m='obras' AND NULLIF(trim(d->>'codigo'),'') IS NULL THEN RAISE EXCEPTION 'Código obrigatório' USING ERRCODE='22023'; END IF;
 IF m IN ('planejamento','rdos') OR (m='frequencia' AND d->>'situacao'='presente') THEN
 obra:=(d->>'obra_id')::uuid;
 IF obra IS NULL OR NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='obras' AND id=obra) THEN RAISE EXCEPTION 'Obra não pertence à empresa' USING ERRCODE='23503'; END IF;
 d:=jsonb_set(d,'{obra_id}',to_jsonb(obra::text));
 IF v>0 AND anterior.dados->>'obra_id' IS DISTINCT FROM d->>'obra_id' THEN RAISE EXCEPTION 'Obra imutável' USING ERRCODE='22023'; END IF;
 END IF;
 IF m='rdos' AND v=0 AND d->>'numero' IS NULL THEN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||obra::text||'rdo-numero',0));
 SELECT COALESCE(max((x.dados->>'numero')::bigint),0)+1 INTO total FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='rdos' AND x.dados->>'obra_id'=obra::text;
 d:=jsonb_set(d,'{numero}',to_jsonb(total::bigint));
 END IF;
 IF m='rdos' THEN
 dia:=(d->>'data')::date;IF dia IS NULL THEN RAISE EXCEPTION 'Data obrigatória' USING ERRCODE='22023';END IF;d:=jsonb_set(d,'{data}',to_jsonb(dia::text));equipe:='[]'::jsonb;
 IF d ? 'trabalhadores' AND (jsonb_typeof(d->'trabalhadores') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'trabalhadores')>200) THEN RAISE EXCEPTION 'Equipe do RDO inválida' USING ERRCODE='22023';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(d->'trabalhadores','[]'::jsonb)) ORDER BY (value->>'funcionario_id')::uuid LOOP
 pessoa:=(item->>'funcionario_id')::uuid;
 IF pessoa IS NULL OR NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='funcionarios' AND x.id=pessoa) THEN RAISE EXCEPTION 'Funcionário do RDO não pertence à empresa' USING ERRCODE='23503';END IF;
 horas:=(item->>'horas')::numeric;
 IF horas IS NULL OR horas<0 OR horas>8 THEN RAISE EXCEPTION 'Horas normais do RDO inválidas' USING ERRCODE='22023';END IF;
 IF pessoa=ANY(vistos) THEN RAISE EXCEPTION 'Funcionário duplicado no RDO' USING ERRCODE='22023';END IF;vistos:=array_append(vistos,pessoa);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||pessoa::text||dia::text||'rdo-horas',0));
 SELECT COALESCE(sum((t.value->>'horas')::numeric),0) INTO total FROM martins_producao_v1.registros x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x.dados->'trabalhadores','[]'::jsonb)) t
 WHERE x.empresa_id=e AND x.modulo='rdos' AND x.id<>r AND x.dados->>'data'=dia::text AND (t.value->>'funcionario_id')::uuid=pessoa;
 IF total+horas>8 THEN RAISE EXCEPTION 'Limite de 8h normais em RDOs entre obras excedido' USING ERRCODE='23514';END IF;
 equipe:=equipe||jsonb_build_array(item||jsonb_build_object('funcionario_id',pessoa));
 END LOOP;
 d:=jsonb_set(d,'{trabalhadores}',equipe);
 dia:=(d->>'data')::date;
 IF dia IS NULL OR dia>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR d->>'status' IS DISTINCT FROM 'rascunho'
 OR COALESCE((d->>'numero')::bigint,0)<1 THEN RAISE EXCEPTION 'RDO inválido: somente rascunho, número positivo e data não futura' USING ERRCODE='22023'; END IF;
 END IF;
 IF m='orcamentos' THEN
 IF jsonb_typeof(d->'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'itens')<1 OR jsonb_array_length(d->'itens')>300 THEN RAISE EXCEPTION 'Informe os itens do orçamento' USING ERRCODE='22023'; END IF;
 soma:=0;itens:='[]'::jsonb;
 FOR item IN SELECT value FROM jsonb_array_elements(d->'itens') LOOP
 qtd:=(item->>'qtd')::numeric;metragem:=COALESCE((item->>'metragem')::numeric,1);preco:=(item->>'precoUnit')::numeric;desconto:=COALESCE((item->>'descontoPct')::numeric,0);acrescimo:=COALESCE((item->>'acrescimoPct')::numeric,0);
 IF NULLIF(trim(item->>'desc'),'') IS NULL OR qtd IS NULL OR qtd<=0 OR qtd>1000000000 OR metragem<=0 OR metragem>1000000000 OR preco IS NULL OR preco<0 OR preco>1000000000 OR desconto<0 OR desconto>100 OR acrescimo<0 OR acrescimo>100 THEN RAISE EXCEPTION 'Item do orçamento inválido' USING ERRCODE='22023'; END IF;
 subtotal:=round(qtd*metragem*preco*(1-desconto/100+acrescimo/100),2);
 IF item ? 'totalEditado' AND item->>'totalEditado' IS NOT NULL THEN subtotal:=(item->>'totalEditado')::numeric;IF subtotal<0 OR subtotal>1000000000000 THEN RAISE EXCEPTION 'Total de item inválido' USING ERRCODE='22023';END IF;subtotal:=round(subtotal,2);END IF;
 soma:=soma+subtotal;itens:=itens||jsonb_build_array(item||jsonb_build_object('total',subtotal,'subtotal',subtotal));
 END LOOP;
 d:=d||jsonb_build_object('itens',itens,'total',soma,'valorTotal',soma);
 IF d->>'obra_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='obras' AND x.id=(d->>'obra_id')::uuid) THEN RAISE EXCEPTION 'Obra do orçamento não pertence à empresa' USING ERRCODE='23503';END IF;
 END IF;
 IF m='funcionarios' AND d->>'obra_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='obras' AND x.id=(d->>'obra_id')::uuid) THEN RAISE EXCEPTION 'Obra do funcionário não pertence à empresa' USING ERRCODE='23503';END IF;
 IF m='frequencia' THEN
 pessoa:=(d->>'funcionario_id')::uuid;dia:=(d->>'data')::date;horas:=(d->>'horas_normais')::numeric;
 IF pessoa IS NULL OR dia IS NULL OR dia>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR horas IS NULL OR horas<0 OR horas>8
 OR COALESCE((d->>'horas_extras')::numeric,0)<0 OR horas+COALESCE((d->>'horas_extras')::numeric,0)>24
 OR COALESCE(d->>'situacao','') NOT IN ('presente','falta','folga','ferias','atestado') THEN RAISE EXCEPTION 'Frequência inválida' USING ERRCODE='22023'; END IF;
 IF d->>'situacao'<>'presente' AND (horas<>0 OR COALESCE((d->>'horas_extras')::numeric,0)<>0) THEN RAISE EXCEPTION 'Ausência não pode registrar horas' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='funcionarios' AND id=pessoa) THEN RAISE EXCEPTION 'Funcionário não pertence à empresa' USING ERRCODE='23503'; END IF;
 d:=jsonb_set(jsonb_set(d,'{funcionario_id}',to_jsonb(pessoa::text)),'{data}',to_jsonb(dia::text));
 IF v>0 AND (anterior.dados->>'funcionario_id' IS DISTINCT FROM d->>'funcionario_id' OR anterior.dados->>'data' IS DISTINCT FROM d->>'data') THEN RAISE EXCEPTION 'Pessoa e data imutáveis' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||pessoa::text||dia::text,0));
 SELECT COALESCE(sum((x.dados->>'horas_normais')::numeric),0) INTO total FROM martins_producao_v1.registros x
 WHERE empresa_id=e AND modulo='frequencia' AND dados->>'funcionario_id'=pessoa::text AND dados->>'data'=dia::text AND id<>r;
 IF total+horas>8 THEN RAISE EXCEPTION 'Limite de 8h normais entre obras excedido' USING ERRCODE='23514'; END IF;
 END IF;
 INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
 VALUES(e,m,r,1,d,auth.uid(),auth.uid())
 ON CONFLICT(empresa_id,modulo,id) DO UPDATE SET revisao=v+1,dados=d,atualizado_por=auth.uid(),atualizado_em=now() RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
 VALUES(e,m,r,auth.uid(),op,CASE WHEN v=0 THEN 'criar' ELSE 'editar' END,to_jsonb(anterior),to_jsonb(novo));
 resposta:=jsonb_build_object('empresa_id',e,'modulo',m,'id',r,'revisao',novo.revisao);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

CREATE OR REPLACE FUNCTION public.martins_producao_catalogos(e uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE lancar boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra']) m WHERE COALESCE(martins_producao_v1.pode(e,m,'ler'),false)) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
 lancar := COALESCE(martins_producao_v1.pode(e,'despesas','criar'),false);
 RETURN jsonb_build_object('empresa_id',e,
 'obras',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','codigo',x.dados->>'codigo') ORDER BY x.id) FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='obras'),'[]'::jsonb),
 'funcionarios',CASE WHEN martins_producao_v1.pode(e,'funcionarios','ler') OR martins_producao_v1.pode(e,'rdos','ler') OR martins_producao_v1.pode(e,'frequencia','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','funcao',x.dados->>'funcao','status',x.dados->>'status') ORDER BY x.id) FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='funcionarios'),'[]'::jsonb) ELSE '[]'::jsonb END,
 'centros_custo',CASE WHEN lancar OR martins_producao_v1.pode(e,'centros_custo','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'codigo',x.dados->>'codigo','nome',x.dados->>'nome','tipo',x.dados->>'tipo','obra_id',x.dados->>'obra_id') ORDER BY x.dados->>'codigo') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='centros_custo' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'fornecedores',CASE WHEN lancar OR martins_producao_v1.pode(e,'fornecedores','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome') ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='fornecedores' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'contas_bancarias',CASE WHEN lancar OR martins_producao_v1.pode(e,'contas_bancarias','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome') ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='contas_bancarias' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'depositos',CASE WHEN martins_producao_v1.pode(e,'depositos','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','principal',COALESCE((x.dados->>'principal')::boolean,false)) ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='depositos' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'clientes',CASE WHEN martins_producao_v1.pode(e,'clientes','ler') OR martins_producao_v1.pode(e,'orcamentos','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome') ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='clientes' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'vendedores',CASE WHEN martins_producao_v1.pode(e,'vendedores','ler') OR martins_producao_v1.pode(e,'orcamentos','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',COALESCE(x.dados->>'nome',f.dados->>'nome'),'funcionario_id',x.dados->>'funcionario_id') ORDER BY x.id) FROM martins_producao_v1.registros x LEFT JOIN martins_producao_v1.registros f ON f.empresa_id=x.empresa_id AND f.modulo='funcionarios' AND f.id::text=x.dados->>'funcionario_id' WHERE x.empresa_id=e AND x.modulo='vendedores' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END);
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
