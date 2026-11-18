-- ============================================================================
-- Contratos v15: CUSTO CONGELADO NO CONSUMO, PARCELAS NA CONVERSÃO DO ORÇAMENTO e RELATÓRIOS FINANCEIROS.
-- Aditivo sobre a v14.
--  * Custo congelado: cada consumo (baixa de obra/entrega de requisição) grava o custo unitário médio das compras
--    NAQUELE MOMENTO. A devolução usa o custo do consumo original. Gastos da Obra passa a somar o custo gravado;
--    movimentos antigos (sem custo gravado) continuam estimados pelo custo médio atual e são sinalizados.
--  * Conversão: ao virar pedido, gera as parcelas a receber (contas a receber) UMA única vez (índice único por
--    pedido+parcela). Parcelas = 0 converte sem gerar cobrança.
--  * Relatórios financeiros (só leitura): fluxo de caixa, DRE (competência) e DFC (caixa efetivo), por período.
-- ============================================================================
CREATE UNIQUE INDEX conta_receber_parcela_unica ON martins_producao_v1.registros(empresa_id,(dados->>'pedido_id'),(dados->>'parcela'))
 WHERE modulo='contas_receber' AND NULLIF(dados->>'pedido_id','') IS NOT NULL;

-- Custo médio ponderado das compras recebidas (líquido de devoluções ao fornecedor): centavos por unidade (1.000 milésimos).
CREATE FUNCTION martins_producao_v1.custo_medio(e uuid, p uuid) RETURNS bigint
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN sum(q) > 0 THEN round(sum(v)::numeric*1000/sum(q))::bigint END
 FROM (SELECT (i->>'qtd_milli')::bigint - COALESCE((i->>'devolvido_milli')::bigint,0) q,
              round((i->>'qtd_milli')::numeric*(i->>'preco_centavos')::numeric/1000) - COALESCE((i->>'devolvido_centavos')::bigint,0) v
       FROM martins_producao_v1.registros r CROSS JOIN LATERAL jsonb_array_elements(r.dados->'itens') i
       WHERE r.empresa_id=e AND r.modulo='recebimentos_compra' AND i->>'produto_id'=p::text) t
$$;
REVOKE ALL ON FUNCTION martins_producao_v1.custo_medio(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Conversão em pedido de venda com geração das parcelas a receber.
DROP FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean);
CREATE FUNCTION public.martins_producao_orcamento_converter(e uuid, op uuid, orcamento uuid, v bigint, aprovar_antes boolean DEFAULT false, parcelas integer DEFAULT 1, primeiro_vencimento date DEFAULT NULL, intervalo_dias integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; atual text; resposta jsonb; hist jsonb; ped_id uuid := gen_random_uuid(); num bigint; ped martins_producao_v1.registros; ja martins_producao_v1.registros;
 hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; total_cent bigint; base bigint; valor_parc bigint; venc date; i int; titulos jsonb := '[]'::jsonb; tid uuid; npc int := COALESCE(parcelas,1); intv int := COALESCE(intervalo_dias,30);
BEGIN
 IF martins_producao_v1.pode(e,'orcamentos','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR orcamento IS NULL OR v IS NULL OR v<1 OR npc NOT BETWEEN 0 AND 60 OR intv NOT BETWEEN 1 AND 365 THEN RAISE EXCEPTION 'Comando inválido (parcelas de 0 a 60; intervalo de 1 a 365 dias)' USING ERRCODE='22023'; END IF;
 IF npc > 0 AND martins_producao_v1.pode(e,'contas_receber','criar') IS NOT TRUE THEN RAISE EXCEPTION 'Gerar as parcelas a receber exige permissão de criar contas a receber (ou converta sem cobrança)' USING ERRCODE='42501'; END IF;
 req := jsonb_build_object('acao','orcamento_converter','e',e,'o',orcamento,'v',v,'a',COALESCE(aprovar_antes,false),'p',npc,'d',primeiro_vencimento,'i',intv);
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
    'condicoes',anterior.dados->>'condicoes','prazo',anterior.dados->>'prazo','estado','aberto','data',hoje::text,'parcelas',npc)),auth.uid(),auth.uid())
  RETURNING * INTO ped;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'pedidos_venda',ped_id,auth.uid(),md5(op::text||'ped')::uuid,'criar',NULL,to_jsonb(ped));
 -- parcelas a receber: o total do pedido em centavos, dividido em partes iguais; a última absorve o resto
 IF npc > 0 THEN
  total_cent := round((anterior.dados->>'total')::numeric*100)::bigint;
  base := total_cent / npc;
  FOR i IN 1..npc LOOP
   valor_parc := CASE WHEN i = npc THEN total_cent - base*(npc-1) ELSE base END;
   venc := COALESCE(primeiro_vencimento, hoje + intv) + (i-1)*intv;
   tid := gen_random_uuid();
   INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
    VALUES(e,'contas_receber',tid,1,jsonb_strip_nulls(jsonb_build_object('cliente_id',anterior.dados->>'cliente_id','cliente_nome',CASE WHEN NULLIF(anterior.dados->>'cliente_id','') IS NULL THEN COALESCE(NULLIF(trim(anterior.dados->>'cliente'),''),'Cliente do pedido') END,
      'descricao','Pedido PV-'||lpad(num::text,4,'0')||' · parcela '||i||'/'||npc,'valor_centavos',valor_parc,'vencimento',venc::text,'competencia',hoje::text,'obra_id',anterior.dados->>'obra_id','orcamento_id',orcamento,
      'pedido_id',ped_id,'pedido_numero',num,'parcela',i,'parcelas',npc,'numero_documento','PV-'||lpad(num::text,4,'0')||' · '||i||'/'||npc,'estado','aberta','recebido_centavos',0,'baixas','[]'::jsonb)),auth.uid(),auth.uid());
   INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
    VALUES(e,'contas_receber',tid,auth.uid(),md5(op::text||'parc'||i)::uuid,'criar',NULL,jsonb_build_object('dados',jsonb_build_object('estado','aberta','valor_centavos',valor_parc,'vencimento',venc::text),'motivo','Parcela gerada na conversão do orçamento'));
   titulos := titulos || jsonb_build_array(jsonb_build_object('id',tid,'parcela',i,'valor_centavos',valor_parc,'vencimento',venc::text));
  END LOOP;
 END IF;
 hist := COALESCE(anterior.dados->'historicoStatus','[]'::jsonb)||jsonb_build_array(jsonb_build_object('de',atual,'para','Convertido em venda','em',now(),'por',auth.uid(),'motivo','Convertido no pedido nº '||num||CASE WHEN npc>0 THEN ' com '||npc||' parcela(s) a receber' ELSE ' (sem cobrança gerada)' END));
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('status','Convertido em venda','pedido_id',ped_id,'pedido_numero',num,'historicoStatus',hist), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='orcamentos' AND id=orcamento RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'orcamentos',orcamento,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo','Convertido no pedido nº '||num));
 resposta := jsonb_build_object('empresa_id',e,'modulo','orcamentos','id',orcamento,'revisao',novo.revisao,'status','Convertido em venda','pedido_id',ped_id,'pedido_numero',num,'parcelas',titulos);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;
REVOKE ALL ON FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean,integer,date,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean,integer,date,integer) TO authenticated;

-- Relatórios financeiros: fluxo de caixa, DRE e DFC. Só leitura. Master e Administrador com leitura integral.
-- Despesas confidenciais só entram para o Master. Data de pagamento = quando a despesa passou para "pago" (auditoria).
CREATE FUNCTION public.martins_producao_financeiro_relatorios(e uuid, de date, ate date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE eh_master boolean; r jsonb;
BEGIN
 IF NOT public.martins_online_leitor(e) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF de IS NULL OR ate IS NULL OR ate < de OR ate - de > 1100 THEN RAISE EXCEPTION 'Período inválido (a data final não pode ser anterior à inicial; máximo de 3 anos)' USING ERRCODE='22023'; END IF;
 eh_master := public.martins_online_master(e);
 WITH desp AS (
   SELECT x.id, x.dados d FROM martins_producao_v1.registros x
   WHERE x.empresa_id=e AND x.modulo='despesas' AND COALESCE(x.dados->>'estado','')<>'cancelado' AND (eh_master OR NOT COALESCE((x.dados->>'confidencial')::boolean,false))),
 mov AS (
   SELECT 'entrada_real' tipo,(b.value->>'data')::date dt,(b.value->>'valor_centavos')::bigint valor,NULL::text classe
    FROM martins_producao_v1.registros y CROSS JOIN LATERAL jsonb_array_elements(COALESCE(y.dados->'baixas','[]'::jsonb)) b
    WHERE y.empresa_id=e AND y.modulo='contas_receber' AND NOT COALESCE((b.value->>'estornada')::boolean,false)
   UNION ALL
   SELECT 'saida_real',COALESCE((SELECT min((a.em AT TIME ZONE 'America/Sao_Paulo')::date) FROM martins_producao_v1.auditoria a WHERE a.empresa_id=e AND a.modulo='despesas' AND a.registro_id=d.id AND a.depois->'dados'->>'estado'='pago'),
      NULLIF(d.d->>'vencimento','')::date,NULLIF(d.d->>'competencia','')::date),(d.d->>'valor_centavos')::bigint,COALESCE(d.d->>'classificacao','administrativa')
    FROM desp d WHERE d.d->>'estado' IN ('pago','confirmado','conciliado')
   UNION ALL
   SELECT 'entrada_prev',(y.dados->>'vencimento')::date,(y.dados->>'valor_centavos')::bigint-COALESCE((y.dados->>'recebido_centavos')::bigint,0),NULL
    FROM martins_producao_v1.registros y WHERE y.empresa_id=e AND y.modulo='contas_receber' AND y.dados->>'estado' IN ('aberta','parcial')
   UNION ALL
   SELECT 'saida_prev',COALESCE(NULLIF(d.d->>'vencimento','')::date,NULLIF(d.d->>'competencia','')::date),(d.d->>'valor_centavos')::bigint,NULL
    FROM desp d WHERE COALESCE(d.d->>'estado','pendente_conferencia') IN ('pendente_conferencia','aprovado')),
 meses AS (
   SELECT s.mes::date mes,
     COALESCE(sum(f.valor) FILTER (WHERE f.tipo='entrada_real'),0)::bigint ent, COALESCE(sum(f.valor) FILTER (WHERE f.tipo='saida_real'),0)::bigint sai,
     COALESCE(sum(f.valor) FILTER (WHERE f.tipo='entrada_prev'),0)::bigint pe, COALESCE(sum(f.valor) FILTER (WHERE f.tipo='saida_prev'),0)::bigint ps
   FROM generate_series(date_trunc('month',de)::date, date_trunc('month',ate)::date, interval '1 month') s(mes)
   LEFT JOIN mov f ON date_trunc('month',f.dt)=s.mes AND f.dt BETWEEN de AND ate GROUP BY s.mes),
 dfc AS (
   SELECT COALESCE(sum(valor) FILTER (WHERE tipo='entrada_real'),0)::bigint rec, COALESCE(sum(valor) FILTER (WHERE tipo='saida_real' AND classe='obra'),0)::bigint obra,
          COALESCE(sum(valor) FILTER (WHERE tipo='saida_real' AND classe<>'obra'),0)::bigint adm FROM mov WHERE dt BETWEEN de AND ate),
 rec_comp AS (
   SELECT COALESCE(sum((y.dados->>'valor_centavos')::bigint),0)::bigint v FROM martins_producao_v1.registros y
   WHERE y.empresa_id=e AND y.modulo='contas_receber' AND y.dados->>'estado'<>'cancelada' AND COALESCE(NULLIF(y.dados->>'competencia','')::date,NULLIF(y.dados->>'vencimento','')::date) BETWEEN de AND ate),
 desp_comp AS (
   SELECT d.id, d.d, COALESCE(d.d->>'classificacao','administrativa') classe FROM desp d WHERE NULLIF(d.d->>'competencia','')::date BETWEEN de AND ate)
 SELECT jsonb_build_object('periodo',jsonb_build_object('de',de::text,'ate',ate::text),'inclui_confidenciais',eh_master,
   'fluxo_caixa',jsonb_build_object('meses',COALESCE((SELECT jsonb_agg(jsonb_build_object('mes',to_char(m.mes,'YYYY-MM'),'entradas_centavos',m.ent,'saidas_centavos',m.sai,'saldo_centavos',m.ent-m.sai,
        'previstas_entradas_centavos',m.pe,'previstas_saidas_centavos',m.ps) ORDER BY m.mes) FROM meses m),'[]'::jsonb),
      'totais',(SELECT jsonb_build_object('entradas_centavos',COALESCE(sum(ent),0),'saidas_centavos',COALESCE(sum(sai),0),'saldo_centavos',COALESCE(sum(ent)-sum(sai),0),
        'previstas_entradas_centavos',COALESCE(sum(pe),0),'previstas_saidas_centavos',COALESCE(sum(ps),0)) FROM meses)),
   'dre',jsonb_build_object('receitas_centavos',(SELECT v FROM rec_comp),'despesas_centavos',(SELECT COALESCE(sum((d.d->>'valor_centavos')::bigint),0) FROM desp_comp d),
      'resultado_centavos',(SELECT v FROM rec_comp)-(SELECT COALESCE(sum((d.d->>'valor_centavos')::bigint),0) FROM desp_comp d),
      'despesas_por_classificacao',COALESCE((SELECT jsonb_agg(jsonb_build_object('classificacao',t.c,'total_centavos',t.v) ORDER BY t.c) FROM (SELECT classe c,sum((d.d->>'valor_centavos')::bigint)::bigint v FROM desp_comp d GROUP BY 1) t),'[]'::jsonb),
      'despesas_por_centro_custo',COALESCE((SELECT jsonb_agg(jsonb_build_object('centro_custo_id',t.c,'codigo',t.cod,'nome',t.nm,'total_centavos',t.v) ORDER BY t.v DESC)
        FROM (SELECT d.d->>'centro_custo_id' c,max(cc.dados->>'codigo') cod,max(cc.dados->>'nome') nm,sum((d.d->>'valor_centavos')::bigint)::bigint v FROM desp_comp d
              LEFT JOIN martins_producao_v1.registros cc ON cc.empresa_id=e AND cc.modulo='centros_custo' AND cc.id::text=d.d->>'centro_custo_id' GROUP BY 1) t),'[]'::jsonb)),
   'dfc',(SELECT jsonb_build_object('recebimentos_de_clientes_centavos',rec,'pagamentos_obra_centavos',obra,'pagamentos_administrativos_centavos',adm,'caixa_liquido_centavos',rec-obra-adm) FROM dfc))
 INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.martins_producao_financeiro_relatorios(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_financeiro_relatorios(uuid,date,date) TO authenticated;

-- Gastos da obra com o CUSTO GRAVADO em cada consumo (movimentos antigos, sem custo gravado, seguem estimados pelo custo médio atual).
CREATE OR REPLACE FUNCTION public.martins_producao_obra_gastos(e uuid, obra uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE eh_master boolean; mat jsonb; sem jsonb; material bigint; diretas bigint; confid bigint; excluidas bigint;
BEGIN
 IF NOT public.martins_online_leitor(e) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF obra IS NULL OR NOT martins_producao_v1.existe(e,'obras',obra) THEN RAISE EXCEPTION 'Obra não pertence à empresa' USING ERRCODE='23503'; END IF;
 eh_master := public.martins_online_master(e);
 WITH mov AS (
   SELECT x.dados->>'produto_id' p, CASE WHEN x.dados->>'tipo'='consumo' THEN 1 ELSE -1 END sinal, (x.dados->>'quantidade_milli')::bigint q, NULLIF(x.dados->>'custo_unitario_centavos','')::bigint cu
   FROM martins_producao_v1.registros x
   WHERE x.empresa_id=e AND x.modulo='estoque_movimentos' AND x.dados->>'obra_id'=obra::text AND x.dados->>'tipo' IN ('consumo','devolucao_obra')),
 consumo AS (
   SELECT p, sum(sinal*q)::bigint liquido, COALESCE(sum(CASE WHEN cu IS NOT NULL THEN sinal*round(q::numeric*cu/1000) ELSE 0 END),0)::bigint congelado,
          COALESCE(sum(CASE WHEN cu IS NULL THEN sinal*q ELSE 0 END),0)::bigint estimado_milli FROM mov GROUP BY p),
 compras AS (
   SELECT i->>'produto_id' p,
          sum((i->>'qtd_milli')::bigint - COALESCE((i->>'devolvido_milli')::bigint,0))::bigint q,
          sum(round((i->>'qtd_milli')::numeric*(i->>'preco_centavos')::numeric/1000) - COALESCE((i->>'devolvido_centavos')::bigint,0))::bigint v
   FROM martins_producao_v1.registros r CROSS JOIN LATERAL jsonb_array_elements(r.dados->'itens') i
   WHERE r.empresa_id=e AND r.modulo='recebimentos_compra' GROUP BY 1),
 linhas AS (
   SELECT c.p, c.liquido, c.congelado, c.estimado_milli,
          CASE WHEN c.estimado_milli=0 THEN 0 WHEN k.q > 0 THEN round(c.estimado_milli::numeric*k.v/k.q)::bigint END parte_atual
   FROM consumo c LEFT JOIN compras k ON k.p=c.p WHERE c.liquido <> 0),
 fin AS (SELECT p, liquido, estimado_milli, CASE WHEN parte_atual IS NULL THEN NULL ELSE congelado+parte_atual END custo_total FROM linhas)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('produto_id',p,'liquido_milli',liquido,'custo_unitario_centavos',round(custo_total::numeric*1000/liquido)::bigint,'custo_centavos',custo_total,'estimado_milli',estimado_milli) ORDER BY p) FILTER (WHERE custo_total IS NOT NULL),'[]'::jsonb),
        COALESCE(jsonb_agg(jsonb_build_object('produto_id',p,'liquido_milli',liquido) ORDER BY p) FILTER (WHERE custo_total IS NULL),'[]'::jsonb),
        COALESCE(sum(custo_total),0)::bigint
 INTO mat, sem, material FROM fin;
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
