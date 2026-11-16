-- ============================================================================
-- Contratos v3: cadastros auxiliares que só existiam no navegador.
-- feriados (calendário da empresa), precos_insumo (histórico de preço pago) e
-- epis (catálogo de EPI e uniformes). Aditivo sobre a v2; não altera registros.
-- Saldos de estoque NÃO são campos de cadastro: virão de movimentações (etapa de estoque).
-- ============================================================================

ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis'));

-- Um feriado por data na empresa; um código por EPI.
CREATE UNIQUE INDEX feriados_data_empresa ON martins_producao_v1.registros(empresa_id, (dados->>'data')) WHERE modulo='feriados';
CREATE UNIQUE INDEX epis_codigo_empresa ON martins_producao_v1.registros(empresa_id, (lower(dados->>'codigo')))
 WHERE modulo='epis' AND NULLIF(dados->>'codigo','') IS NOT NULL;

CREATE FUNCTION martins_producao_v1.preparar_v3(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
 IF d ? 'ativo' AND jsonb_typeof(d->'ativo') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Situação inválida' USING ERRCODE='22023'; END IF;
 d := d || jsonb_build_object('ativo', COALESCE((d->>'ativo')::boolean, true));
 IF NULLIF(trim(d->>'nome'),'') IS NULL THEN RAISE EXCEPTION 'Nome obrigatório' USING ERRCODE='22023'; END IF;

 IF m='feriados' THEN
  IF NULLIF(d->>'data','') IS NULL THEN RAISE EXCEPTION 'Data do feriado obrigatória' USING ERRCODE='22023'; END IF;
  d := jsonb_set(d,'{data}',to_jsonb(((d->>'data')::date)::text));
  IF COALESCE(d->>'abrangencia','municipal') NOT IN ('nacional','estadual','municipal','empresa') THEN RAISE EXCEPTION 'Abrangência inválida' USING ERRCODE='22023'; END IF;

 ELSIF m='precos_insumo' THEN
  IF NULLIF(trim(d->>'unidade'),'') IS NULL THEN RAISE EXCEPTION 'Unidade obrigatória' USING ERRCODE='22023'; END IF;
  IF COALESCE(d->>'preco_centavos','') !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'Preço inválido (centavos inteiros)' USING ERRCODE='22023'; END IF;
  d := jsonb_set(d,'{preco_centavos}',to_jsonb((d->>'preco_centavos')::bigint));
  IF NULLIF(d->>'data','') IS NOT NULL THEN d := jsonb_set(d,'{data}',to_jsonb(((d->>'data')::date)::text)); END IF;
  IF NULLIF(d->>'fornecedor_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'fornecedores',(d->>'fornecedor_id')::uuid) THEN RAISE EXCEPTION 'Fornecedor não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF NULLIF(d->>'produto_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'produtos',(d->>'produto_id')::uuid) THEN RAISE EXCEPTION 'Produto não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF NULLIF(d->>'centro_custo_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'centros_custo',(d->>'centro_custo_id')::uuid) THEN RAISE EXCEPTION 'Centro de custo não pertence à empresa' USING ERRCODE='23503'; END IF;

 ELSIF m='epis' THEN
  IF NULLIF(d->>'preco_centavos','') IS NOT NULL THEN
   IF d->>'preco_centavos' !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'Preço inválido (centavos inteiros)' USING ERRCODE='22023'; END IF;
   d := jsonb_set(d,'{preco_centavos}',to_jsonb((d->>'preco_centavos')::bigint));
  END IF;
  IF NULLIF(d->>'estoque_minimo','') IS NOT NULL THEN
   IF d->>'estoque_minimo' !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'Estoque mínimo inválido' USING ERRCODE='22023'; END IF;
   d := jsonb_set(d,'{estoque_minimo}',to_jsonb((d->>'estoque_minimo')::int));
  END IF;
  -- Saldo é resultado de movimentações, não campo de cadastro.
  IF d ? 'saldo' THEN RAISE EXCEPTION 'Saldo de EPI não é informado no cadastro; registre uma entrada de estoque' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION martins_producao_v1.preparar_v3(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros) FROM PUBLIC,anon,authenticated;
