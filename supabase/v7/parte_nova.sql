-- ============================================================================
-- Contratos v7: FROTA (abastecimento e manutenção), AUSÊNCIAS/FÉRIAS e PROPOSTAS DE COTAÇÃO.
-- Telas que ainda gravavam só no navegador. Aditivo sobre a v5/v6.
-- Dinheiro em centavos, litros em milésimos, datas validadas no banco; o servidor recalcula
-- dias de ausência e total da proposta (o que vem do navegador não é confiado).
-- ============================================================================
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes'));

-- O mesmo abastecimento (veículo, data e odômetro) não entra duas vezes.
CREATE UNIQUE INDEX frota_abastecimento_unico ON martins_producao_v1.registros(empresa_id,(dados->>'veiculo_id'),(dados->>'data'),(dados->>'km'))
 WHERE modulo='frota_eventos' AND dados->>'tipo'='abastecimento' AND NULLIF(dados->>'km','') IS NOT NULL;

CREATE FUNCTION martins_producao_v1.preparar_v7(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ini date; fim date; dias int; sub bigint; frete bigint; desco bigint; milli numeric;
BEGIN
 d := jsonb_strip_nulls(d);  -- a tela envia campo opcional vazio como null; ausente = limpo
 IF d ? 'ativo' AND jsonb_typeof(d->'ativo') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Situação inválida' USING ERRCODE='22023'; END IF;
 d := d || jsonb_build_object('ativo', COALESCE((d->>'ativo')::boolean, true));

 IF m='frota_eventos' THEN
  IF COALESCE(d->>'tipo','') NOT IN ('abastecimento','manutencao') THEN RAISE EXCEPTION 'Tipo do evento inválido (abastecimento ou manutenção)' USING ERRCODE='22023'; END IF;
  IF NULLIF(d->>'veiculo_id','') IS NULL OR NOT martins_producao_v1.existe(e,'veiculos',(d->>'veiculo_id')::uuid) THEN RAISE EXCEPTION 'Veículo obrigatório e da empresa ativa' USING ERRCODE='23503'; END IF;
  IF NULLIF(d->>'data','') IS NULL THEN RAISE EXCEPTION 'Data do evento obrigatória' USING ERRCODE='22023'; END IF;
  d := jsonb_set(d,'{data}',to_jsonb(((d->>'data')::date)::text));
  IF (d->>'data')::date > (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1 THEN RAISE EXCEPTION 'A data do evento não pode estar no futuro' USING ERRCODE='22023'; END IF;
  IF COALESCE(d->>'valor_centavos','') !~ '^[0-9]{1,13}$' OR (d->>'valor_centavos')::bigint < 1 THEN RAISE EXCEPTION 'Valor inválido (centavos inteiros, maior que zero)' USING ERRCODE='22023'; END IF;
  d := jsonb_set(d,'{valor_centavos}',to_jsonb((d->>'valor_centavos')::bigint));
  IF NULLIF(d->>'km','') IS NOT NULL THEN
   IF d->>'km' !~ '^[0-9]{1,8}$' THEN RAISE EXCEPTION 'Quilometragem inválida' USING ERRCODE='22023'; END IF;
   d := jsonb_set(d,'{km}',to_jsonb((d->>'km')::bigint));
  END IF;
  IF d ? 'litros' THEN
   IF jsonb_typeof(d->'litros') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Litros inválidos' USING ERRCODE='22023'; END IF;
   milli := round((d->>'litros')::numeric * 1000);
   d := (d - 'litros') || jsonb_build_object('litros_milli', milli::bigint);
  END IF;
  IF d ? 'litros_milli' AND (COALESCE(d->>'litros_milli','') !~ '^[0-9]{1,11}$' OR (d->>'litros_milli')::bigint < 1) THEN RAISE EXCEPTION 'Litros inválidos (maior que zero)' USING ERRCODE='22023'; END IF;
  IF d->>'tipo'='abastecimento' AND NOT (d ? 'litros_milli') THEN RAISE EXCEPTION 'Informe os litros abastecidos' USING ERRCODE='22023'; END IF;
  IF d->>'tipo'='manutencao' AND d ? 'litros_milli' THEN RAISE EXCEPTION 'Manutenção não leva litros' USING ERRCODE='22023'; END IF;
  IF length(COALESCE(d->>'posto',''))>200 OR length(COALESCE(d->>'descricao',''))>500 THEN RAISE EXCEPTION 'Texto longo demais' USING ERRCODE='22023'; END IF;
  IF NULLIF(d->>'motorista_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'motoristas',(d->>'motorista_id')::uuid) THEN RAISE EXCEPTION 'Motorista não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF NULLIF(d->>'obra_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'obras',(d->>'obra_id')::uuid) THEN RAISE EXCEPTION 'Obra não pertence à empresa' USING ERRCODE='23503'; END IF;

 ELSIF m='ausencias' THEN
  IF NULLIF(d->>'funcionario_id','') IS NULL OR NOT martins_producao_v1.existe(e,'funcionarios',(d->>'funcionario_id')::uuid) THEN RAISE EXCEPTION 'Funcionário obrigatório e da empresa ativa' USING ERRCODE='23503'; END IF;
  IF COALESCE(d->>'tipo','') NOT IN ('falta','atestado_medico','folga','ferias') THEN RAISE EXCEPTION 'Tipo de ausência inválido' USING ERRCODE='22023'; END IF;
  IF COALESCE(d->>'situacao','confirmado') NOT IN ('confirmado','programado','em_analise','em_andamento','usufruido') THEN RAISE EXCEPTION 'Situação inválida' USING ERRCODE='22023'; END IF;
  IF NULLIF(d->>'inicio','') IS NULL THEN RAISE EXCEPTION 'Data de início obrigatória' USING ERRCODE='22023'; END IF;
  ini := (d->>'inicio')::date; fim := COALESCE(NULLIF(d->>'fim','')::date, ini);
  IF fim < ini THEN RAISE EXCEPTION 'A data final não pode ser anterior à inicial' USING ERRCODE='22023'; END IF;
  dias := (fim - ini) + 1;
  IF dias > 366 THEN RAISE EXCEPTION 'Período maior que um ano' USING ERRCODE='22023'; END IF;
  IF length(COALESCE(d->>'motivo',''))>500 THEN RAISE EXCEPTION 'Motivo longo demais' USING ERRCODE='22023'; END IF;
  d := d || jsonb_build_object('inicio',ini::text,'fim',fim::text,'dias',dias,'situacao',COALESCE(d->>'situacao','confirmado'));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||(d->>'funcionario_id')||'ausencia',0));
  IF (d->>'ativo')::boolean AND EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='ausencias' AND x.id<>r
     AND x.dados->>'funcionario_id'=d->>'funcionario_id' AND COALESCE((x.dados->>'ativo')::boolean,true)
     AND (x.dados->>'inicio')::date <= fim AND (x.dados->>'fim')::date >= ini) THEN
   RAISE EXCEPTION 'Este funcionário já tem uma ausência registrada que coincide com o período' USING ERRCODE='23505'; END IF;

 ELSIF m='cotacoes' THEN
  IF NULLIF(trim(d->>'referencia'),'') IS NULL OR length(d->>'referencia')>200 THEN RAISE EXCEPTION 'Informe o que está sendo cotado (referência)' USING ERRCODE='22023'; END IF;
  IF NULLIF(d->>'fornecedor_id','') IS NOT NULL THEN
   IF NOT martins_producao_v1.existe(e,'fornecedores',(d->>'fornecedor_id')::uuid) THEN RAISE EXCEPTION 'Fornecedor não pertence à empresa' USING ERRCODE='23503'; END IF;
  ELSIF NULLIF(trim(d->>'fornecedor_nome'),'') IS NULL OR length(d->>'fornecedor_nome')>200 THEN RAISE EXCEPTION 'Informe o fornecedor' USING ERRCODE='22023'; END IF;
  IF COALESCE(d->>'subtotal_centavos','') !~ '^[0-9]{1,13}$' OR (d->>'subtotal_centavos')::bigint < 1 THEN RAISE EXCEPTION 'Subtotal inválido (centavos inteiros, maior que zero)' USING ERRCODE='22023'; END IF;
  IF COALESCE(NULLIF(d->>'frete_centavos',''),'0') !~ '^[0-9]{1,13}$' OR COALESCE(NULLIF(d->>'desconto_centavos',''),'0') !~ '^[0-9]{1,13}$' THEN RAISE EXCEPTION 'Frete ou desconto inválido' USING ERRCODE='22023'; END IF;
  sub := (d->>'subtotal_centavos')::bigint; frete := COALESCE(NULLIF(d->>'frete_centavos',''),'0')::bigint; desco := COALESCE(NULLIF(d->>'desconto_centavos',''),'0')::bigint;
  IF desco > sub + frete THEN RAISE EXCEPTION 'O desconto não pode ser maior que o valor da proposta' USING ERRCODE='23514'; END IF;
  d := d || jsonb_build_object('subtotal_centavos',sub,'frete_centavos',frete,'desconto_centavos',desco,'total_centavos',sub+frete-desco);
  IF NULLIF(d->>'prazo_dias','') IS NOT NULL THEN
   IF d->>'prazo_dias' !~ '^[0-9]{1,3}$' OR (d->>'prazo_dias')::int > 365 THEN RAISE EXCEPTION 'Prazo inválido (0 a 365 dias)' USING ERRCODE='22023'; END IF;
   d := jsonb_set(d,'{prazo_dias}',to_jsonb((d->>'prazo_dias')::int));
  END IF;
  IF length(COALESCE(d->>'condicao',''))>200 THEN RAISE EXCEPTION 'Condição de pagamento longa demais' USING ERRCODE='22023'; END IF;
  IF NULLIF(d->>'pedido_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'pedidos_compra',(d->>'pedido_id')::uuid) THEN RAISE EXCEPTION 'Pedido não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF COALESCE(d->>'situacao','aberta') NOT IN ('aberta','escolhida','recusada') THEN RAISE EXCEPTION 'Situação da proposta inválida' USING ERRCODE='22023'; END IF;
  d := d || jsonb_build_object('situacao',COALESCE(d->>'situacao','aberta'));
 END IF;
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION martins_producao_v1.preparar_v7(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros) FROM PUBLIC,anon,authenticated;
