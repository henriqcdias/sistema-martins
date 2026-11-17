-- ============================================================================
-- Contratos v14: FLUXO DO ORÇAMENTO. Número sequencial, mudança de situação com histórico e CONVERSÃO em
-- pedido de venda (um único pedido por orçamento). Aditivo sobre a v10/v13.
--  * Orçamento: o servidor define número (por empresa) e situação inicial; o navegador não escolhe nem altera
--    número/situação pelo cadastro. Orçamento convertido ou entregue não é mais editado.
--  * Situações: Em elaboração → Enviado → Aprovado → (converter) Convertido em venda → Entregue; Recusado e Vencido
--    têm saída para reabrir. Cada mudança grava histórico (de, para, quando, quem, motivo) e auditoria.
--  * Conversão: exige orçamento Aprovado (ou aprova e converte de uma vez), com itens e total; cria UM pedido de venda
--    por orçamento (índice único). Repetir a conversão, de qualquer jeito, não duplica: é recusada com o número do pedido.
-- ============================================================================
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda'));

-- Um pedido por orçamento; número de pedido único na empresa; número de orçamento único na empresa.
CREATE UNIQUE INDEX pedido_venda_por_orcamento ON martins_producao_v1.registros(empresa_id,(dados->>'orcamento_id')) WHERE modulo='pedidos_venda';
CREATE UNIQUE INDEX pedido_venda_numero_empresa ON martins_producao_v1.registros(empresa_id,(dados->>'numero')) WHERE modulo='pedidos_venda';
CREATE UNIQUE INDEX orcamento_numero_empresa ON martins_producao_v1.registros(empresa_id,(dados->>'numero')) WHERE modulo='orcamentos' AND NULLIF(dados->>'numero','') IS NOT NULL;

-- Mudança de situação do orçamento (o navegador não grava situação direto).
CREATE FUNCTION public.martins_producao_orcamento_estado(e uuid, op uuid, orcamento uuid, v bigint, estado text, motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; atual text; resposta jsonb; hist jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'orcamentos','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR orcamento IS NULL OR v IS NULL OR v<1 OR length(COALESCE(motivo,''))>500
    OR estado IS NULL OR estado NOT IN ('Em elaboração','Enviado','Aprovado','Recusado','Vencido','Entregue') THEN RAISE EXCEPTION 'Comando inválido (para converter em venda use a conversão)' USING ERRCODE='22023'; END IF;
 IF estado='Recusado' AND NULLIF(trim(motivo),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo da recusa' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','orcamento_estado','e',e,'o',orcamento,'v',v,'s',estado,'m',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'orcamento'||orcamento::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='orcamentos' AND id=orcamento FOR UPDATE;
 IF NOT FOUND OR anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 atual := CASE COALESCE(anterior.dados->>'status','') WHEN 'Em Orçamento' THEN 'Em elaboração' WHEN '' THEN 'Em elaboração' ELSE anterior.dados->>'status' END;
 IF NOT (   (atual='Em elaboração' AND estado IN ('Enviado','Aprovado','Recusado'))
         OR (atual='Enviado'       AND estado IN ('Aprovado','Recusado','Vencido','Em elaboração'))
         OR (atual='Vencido'       AND estado IN ('Enviado','Em elaboração'))
         OR (atual='Recusado'      AND estado='Em elaboração')
         OR (atual='Aprovado'      AND estado IN ('Recusado','Em elaboração'))
         OR (atual='Convertido em venda' AND estado='Entregue')) THEN
  RAISE EXCEPTION 'Mudança de "%" para "%" não permitida', atual, estado USING ERRCODE='22023'; END IF;
 hist := COALESCE(anterior.dados->'historicoStatus','[]'::jsonb)||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('de',atual,'para',estado,'em',now(),'por',auth.uid(),'motivo',NULLIF(trim(motivo),''))));
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('status',estado,'historicoStatus',hist), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='orcamentos' AND id=orcamento RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'orcamentos',orcamento,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo',COALESCE(NULLIF(trim(motivo),''),'Mudança de situação')));
 resposta := jsonb_build_object('empresa_id',e,'modulo','orcamentos','id',orcamento,'revisao',novo.revisao,'status',estado);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Conversão em pedido de venda: no máximo UM pedido por orçamento.
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

REVOKE ALL ON FUNCTION public.martins_producao_orcamento_estado(uuid,uuid,uuid,bigint,text,text), public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_orcamento_estado(uuid,uuid,uuid,bigint,text,text), public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean) TO authenticated;
