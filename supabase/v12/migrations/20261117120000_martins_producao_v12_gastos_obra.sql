-- Contratos v12: GASTOS DA OBRA (custo do material apropriado à obra). Escrito à mão; pré-requisito: producao..v11 aplicadas.
-- Só leitura (uma função). Visível ao Master e ao Administrador com leitura integral (preços e custos são sensíveis).
-- Regras:
--  * Material: consumo líquido da obra (consumos − devoluções à estoque) × custo médio ponderado das COMPRAS recebidas
--    (valor recebido − valor devolvido ao fornecedor) / (quantidade recebida − devolvida). Calculado na consulta: usa o
--    custo médio ATUAL, não congela o custo na data do consumo. Material sem compra (entrada manual) fica "sem custo".
--  * Despesas diretas: despesas da obra não canceladas, EXCLUINDO as geradas por recebimento de compra (o material
--    delas já entra pelo consumo; somar os dois contaria o mesmo gasto duas vezes). Confidenciais só aparecem ao Master.
--  * Total = material valorizado + despesas diretas.
BEGIN;

CREATE FUNCTION public.martins_producao_obra_gastos(e uuid, obra uuid) RETURNS jsonb
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

REVOKE ALL ON FUNCTION public.martins_producao_obra_gastos(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_obra_gastos(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
