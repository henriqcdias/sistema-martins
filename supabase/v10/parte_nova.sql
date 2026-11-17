-- ============================================================================
-- Contratos v10: CONTAS A RECEBER (Vendas). Título -> recebimentos (parciais) -> quitado.
-- Estado, valor recebido e baixas são do servidor. Cancelar só sem recebimento; estornar um recebimento
-- é exclusivo do Master e fica registrado (a baixa não some, é marcada como estornada).
-- Aditivo sobre a v8/v9. Dinheiro em centavos, inteiro.
-- ============================================================================
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber'));

-- Cadastro do título (só enquanto "aberta" e sem recebimento). Estado, recebido e baixas são do servidor.
CREATE FUNCTION martins_producao_v1.preparar_v10(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
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
REVOKE ALL ON FUNCTION martins_producao_v1.preparar_v10(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros) FROM PUBLIC,anon,authenticated;

-- Registrar recebimento (parcial ou total).
CREATE FUNCTION public.martins_producao_receber_baixar(e uuid, op uuid, conta uuid, v bigint, valor bigint, data date, conta_bancaria uuid DEFAULT NULL, obs text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb; recebido bigint; novo_estado text; baixa jsonb; bid uuid := gen_random_uuid();
BEGIN
 IF martins_producao_v1.pode(e,'contas_receber','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR conta IS NULL OR v IS NULL OR v<1 OR valor IS NULL OR valor<1 OR data IS NULL OR length(COALESCE(obs,''))>300 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF data > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'A data do recebimento não pode estar no futuro' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','receber_baixar','e',e,'c',conta,'v',v,'valor',valor,'data',data,'cb',conta_bancaria,'obs',obs);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 IF conta_bancaria IS NOT NULL AND NOT martins_producao_v1.existe(e,'contas_bancarias',conta_bancaria) THEN RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE='23503'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'conta-receber'||conta::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='contas_receber' AND id=conta FOR UPDATE;
 IF NOT FOUND OR anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 IF anterior.dados->>'estado' NOT IN ('aberta','parcial') THEN RAISE EXCEPTION 'Só se registra recebimento em título aberto ou parcial (estado atual: %)', anterior.dados->>'estado' USING ERRCODE='22023'; END IF;
 recebido := (anterior.dados->>'recebido_centavos')::bigint;
 IF valor > (anterior.dados->>'valor_centavos')::bigint - recebido THEN RAISE EXCEPTION 'Recebimento maior que o saldo do título (saldo: % centavos)', (anterior.dados->>'valor_centavos')::bigint - recebido USING ERRCODE='23514'; END IF;
 recebido := recebido + valor;
 novo_estado := CASE WHEN recebido >= (anterior.dados->>'valor_centavos')::bigint THEN 'recebida' ELSE 'parcial' END;
 baixa := jsonb_strip_nulls(jsonb_build_object('id',bid,'valor_centavos',valor,'data',data::text,'conta_bancaria_id',conta_bancaria,'obs',NULLIF(trim(obs),''),'por',auth.uid(),'em',now(),'estornada',false));
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('recebido_centavos',recebido,'estado',novo_estado,'baixas',COALESCE(dados->'baixas','[]'::jsonb)||jsonb_build_array(baixa)), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='contas_receber' AND id=conta RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'contas_receber',conta,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo','Recebimento de '||valor||' centavos'));
 resposta := jsonb_build_object('empresa_id',e,'modulo','contas_receber','id',conta,'revisao',novo.revisao,'estado',novo_estado,'recebido_centavos',recebido,'baixa_id',bid);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Cancelar título sem nenhum recebimento.
CREATE FUNCTION public.martins_producao_receber_estado(e uuid, op uuid, conta uuid, v bigint, estado text, motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'contas_receber','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR conta IS NULL OR v IS NULL OR v<1 OR estado IS DISTINCT FROM 'cancelada' OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>1000 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','receber_estado','e',e,'c',conta,'v',v,'estado',estado,'motivo',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'conta-receber'||conta::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='contas_receber' AND id=conta FOR UPDATE;
 IF NOT FOUND OR anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 IF anterior.dados->>'estado' <> 'aberta' OR (anterior.dados->>'recebido_centavos')::bigint > 0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(anterior.dados->'baixas','[]'::jsonb)) b WHERE NOT COALESCE((b->>'estornada')::boolean,false)) THEN
  RAISE EXCEPTION 'Só se cancela título aberto e sem recebimento; com recebimento, estorne antes' USING ERRCODE='22023'; END IF;
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('estado','cancelada'), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='contas_receber' AND id=conta RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'contas_receber',conta,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo',motivo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','contas_receber','id',conta,'revisao',novo.revisao,'estado','cancelada');
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Estornar um recebimento (somente Master): a baixa fica marcada como estornada, nunca é apagada.
CREATE FUNCTION public.martins_producao_receber_estornar(e uuid, op uuid, conta uuid, v bigint, baixa uuid, motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb; b jsonb; lista jsonb := '[]'::jsonb; achou boolean := false; recebido bigint := 0; novo_estado text;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Estornar recebimento é exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR conta IS NULL OR v IS NULL OR v<1 OR baixa IS NULL OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>1000 THEN RAISE EXCEPTION 'Informe o recebimento e o motivo do estorno' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','receber_estornar','e',e,'c',conta,'v',v,'b',baixa,'motivo',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'conta-receber'||conta::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='contas_receber' AND id=conta FOR UPDATE;
 IF NOT FOUND OR anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 IF anterior.dados->>'estado' NOT IN ('parcial','recebida') THEN RAISE EXCEPTION 'Este título não tem recebimento para estornar' USING ERRCODE='22023'; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(anterior.dados->'baixas') LOOP
  IF b->>'id' = baixa::text THEN
   IF COALESCE((b->>'estornada')::boolean,false) THEN RAISE EXCEPTION 'Este recebimento já foi estornado' USING ERRCODE='23505'; END IF;
   achou := true; b := b || jsonb_build_object('estornada',true,'estorno_motivo',motivo,'estorno_por',auth.uid(),'estorno_em',now());
  END IF;
  IF NOT COALESCE((b->>'estornada')::boolean,false) THEN recebido := recebido + (b->>'valor_centavos')::bigint; END IF;
  lista := lista || jsonb_build_array(b);
 END LOOP;
 IF NOT achou THEN RAISE EXCEPTION 'Recebimento não encontrado neste título' USING ERRCODE='23503'; END IF;
 novo_estado := CASE WHEN recebido = 0 THEN 'aberta' WHEN recebido >= (anterior.dados->>'valor_centavos')::bigint THEN 'recebida' ELSE 'parcial' END;
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('baixas',lista,'recebido_centavos',recebido,'estado',novo_estado), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='contas_receber' AND id=conta RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'contas_receber',conta,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo',motivo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','contas_receber','id',conta,'revisao',novo.revisao,'estado',novo_estado,'recebido_centavos',recebido);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Totais calculados no servidor (a tela não soma o que baixou do navegador).
CREATE FUNCTION public.martins_producao_receber_totais(e uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; r jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'contas_receber','ler') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'a_receber_centavos',COALESCE(sum((x.dados->>'valor_centavos')::bigint-(x.dados->>'recebido_centavos')::bigint) FILTER (WHERE x.dados->>'estado' IN ('aberta','parcial')),0),
  'vencido_centavos',COALESCE(sum((x.dados->>'valor_centavos')::bigint-(x.dados->>'recebido_centavos')::bigint) FILTER (WHERE x.dados->>'estado' IN ('aberta','parcial') AND (x.dados->>'vencimento')::date < hoje),0),
  'titulos_abertos',count(*) FILTER (WHERE x.dados->>'estado' IN ('aberta','parcial')),
  'recebido_mes_centavos',COALESCE((SELECT sum((b.value->>'valor_centavos')::bigint) FROM martins_producao_v1.registros y CROSS JOIN LATERAL jsonb_array_elements(COALESCE(y.dados->'baixas','[]'::jsonb)) b
     WHERE y.empresa_id=e AND y.modulo='contas_receber' AND NOT COALESCE((b.value->>'estornada')::boolean,false)
     AND date_trunc('month',(b.value->>'data')::date)=date_trunc('month',hoje)),0)) INTO r
 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='contas_receber';
 RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_receber_baixar(uuid,uuid,uuid,bigint,bigint,date,uuid,text), public.martins_producao_receber_estado(uuid,uuid,uuid,bigint,text,text), public.martins_producao_receber_estornar(uuid,uuid,uuid,bigint,uuid,text), public.martins_producao_receber_totais(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_receber_baixar(uuid,uuid,uuid,bigint,bigint,date,uuid,text), public.martins_producao_receber_estado(uuid,uuid,uuid,bigint,text,text), public.martins_producao_receber_estornar(uuid,uuid,uuid,bigint,uuid,text), public.martins_producao_receber_totais(uuid) TO authenticated;
