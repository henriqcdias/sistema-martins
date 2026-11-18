-- ============================================================================
-- Contratos v16: CONCILIAÇÃO BANCÁRIA. Importação de extrato (OFX/CSV lido no navegador, gravado aqui) e
-- vínculo de cada linha do extrato a UM recebimento (baixa de contas a receber) ou a UMA despesa paga.
--  * Módulo extratos_bancarios: só lido pelo cadastro; toda gravação passa pelas funções abaixo.
--  * Sem duplicar: cada linha tem uma chave (FITID da conta ou, sem FITID, conta+data+valor+descrição+ocorrência);
--    reimportar o mesmo arquivo (ou outro que o sobreponha) ignora o que já existe.
--  * Sem conciliar duas vezes: um recebimento/despesa só pode estar ligado a uma linha, e uma linha a um só lançamento.
--  * Valor e sentido precisam bater (entrada com recebimento, saída com despesa); estorno não concilia.
-- ============================================================================
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios'));

CREATE UNIQUE INDEX extrato_linha_chave ON martins_producao_v1.registros(empresa_id,(dados->>'chave')) WHERE modulo='extratos_bancarios';
CREATE UNIQUE INDEX extrato_alvo_unico ON martins_producao_v1.registros(empresa_id,(dados->>'alvo_chave')) WHERE modulo='extratos_bancarios' AND NULLIF(dados->>'alvo_chave','') IS NOT NULL;

-- Importação: até 2000 linhas por envio. linhas = [{data:'AAAA-MM-DD', valor_centavos:±n, descricao, fitid?}]
CREATE FUNCTION public.martins_producao_extrato_importar(e uuid, op uuid, conta uuid, formato text, linhas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; resposta jsonb; total int; novas int; lin jsonb;
 hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 IF auth.uid() IS NULL OR e IS NULL OR op IS NULL OR conta IS NULL OR formato NOT IN ('ofx','csv') OR jsonb_typeof(linhas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF martins_producao_v1.pode(e,'extratos_bancarios','criar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 total := jsonb_array_length(linhas);
 IF total<1 OR total>2000 THEN RAISE EXCEPTION 'Envie de 1 a 2000 linhas por importação' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','extrato_importar','e',e,'conta',conta,'formato',formato,'linhas',linhas);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='contas_bancarias' AND id=conta AND COALESCE(dados->>'ativo','true')<>'false') THEN
  RAISE EXCEPTION 'Conta bancária não encontrada (ou inativa) nesta empresa' USING ERRCODE='23503'; END IF;
 FOR lin IN SELECT x FROM jsonb_array_elements(linhas) x LOOP
  IF jsonb_typeof(lin) IS DISTINCT FROM 'object' OR COALESCE(lin->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' OR COALESCE(lin->>'valor_centavos','') !~ '^-?\d{1,14}$'
     OR (lin->>'valor_centavos')::bigint=0 OR length(COALESCE(lin->>'descricao',''))>300 OR length(COALESCE(lin->>'fitid',''))>100 THEN
   RAISE EXCEPTION 'Linha de extrato inválida: %', left(lin::text,120) USING ERRCODE='22023'; END IF;
  IF (lin->>'data')::date NOT BETWEEN date '2000-01-01' AND hoje+366 THEN RAISE EXCEPTION 'Data fora do intervalo aceito: %', lin->>'data' USING ERRCODE='22023'; END IF;
 END LOOP;
 WITH base AS (
  SELECT (x.v->>'data')::date AS data, (x.v->>'valor_centavos')::bigint AS valor, btrim(COALESCE(x.v->>'descricao','')) AS descricao, NULLIF(btrim(COALESCE(x.v->>'fitid','')),'') AS fitid, x.n
  FROM jsonb_array_elements(linhas) WITH ORDINALITY AS x(v,n)
 ), chaves AS (
  SELECT b.*, CASE WHEN b.fitid IS NOT NULL THEN md5(conta::text||'|fitid|'||b.fitid)
    ELSE md5(conta::text||'|'||b.data::text||'|'||b.valor::text||'|'||lower(b.descricao)||'|'||row_number() OVER (PARTITION BY b.data,b.valor,lower(b.descricao) ORDER BY b.n)::text) END AS chave
  FROM base b
 ), unicas AS (SELECT DISTINCT ON (chave) * FROM chaves ORDER BY chave, n),
 ins AS (
  INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
  SELECT e,'extratos_bancarios',gen_random_uuid(),1,jsonb_strip_nulls(jsonb_build_object('conta_bancaria_id',conta,'data',u.data::text,'valor_centavos',u.valor,'descricao',NULLIF(u.descricao,''),'fitid',u.fitid,'chave',u.chave,'formato',formato,'importado_em',now(),'situacao','pendente')),auth.uid(),auth.uid()
  FROM unicas u ORDER BY u.n
  ON CONFLICT DO NOTHING RETURNING id, dados
 ), aud AS (
  INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  SELECT e,'extratos_bancarios',i.id,auth.uid(),md5(op::text||i.id::text)::uuid,'criar',NULL,i.dados FROM ins i RETURNING 1
 ) SELECT count(*) INTO novas FROM ins;
 resposta := jsonb_build_object('empresa_id',e,'conta_bancaria_id',conta,'recebidas',total,'inseridas',novas,'ignoradas',total-novas);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Conciliar: liga a linha a uma baixa de contas a receber (tipo 'baixa': alvo = título, baixa = id da baixa) ou a uma despesa paga (tipo 'despesa': alvo = despesa).
CREATE FUNCTION public.martins_producao_extrato_conciliar(e uuid, op uuid, linha uuid, v bigint, tipo text, alvo uuid, baixa uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; ln martins_producao_v1.registros; novo martins_producao_v1.registros; t martins_producao_v1.registros; b jsonb; chave text; resposta jsonb; avancou boolean := false; dnovo martins_producao_v1.registros;
BEGIN
 IF auth.uid() IS NULL OR e IS NULL OR op IS NULL OR linha IS NULL OR v IS NULL OR v<1 OR tipo NOT IN ('baixa','despesa') OR alvo IS NULL OR (tipo='baixa' AND baixa IS NULL) THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF martins_producao_v1.pode(e,'extratos_bancarios','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 req := jsonb_build_object('acao','extrato_conciliar','e',e,'linha',linha,'v',v,'tipo',tipo,'alvo',alvo,'baixa',baixa);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'conciliacao',0));
 SELECT * INTO ln FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='extratos_bancarios' AND id=linha FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Linha de extrato não encontrada nesta empresa' USING ERRCODE='23503'; END IF;
 IF ln.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 IF ln.dados->>'situacao'='conciliada' THEN RAISE EXCEPTION 'Esta linha do extrato já está conciliada' USING ERRCODE='23505'; END IF;
 IF tipo='baixa' THEN
  IF martins_producao_v1.pode(e,'contas_receber','ler') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  IF (ln.dados->>'valor_centavos')::bigint<=0 THEN RAISE EXCEPTION 'Só linhas de entrada (crédito) conciliam com recebimentos' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='contas_receber' AND id=alvo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Título a receber não encontrado nesta empresa' USING ERRCODE='23503'; END IF;
  SELECT x INTO b FROM jsonb_array_elements(COALESCE(t.dados->'baixas','[]'::jsonb)) x WHERE x->>'id'=baixa::text;
  IF b IS NULL THEN RAISE EXCEPTION 'Recebimento não encontrado neste título' USING ERRCODE='23503'; END IF;
  IF COALESCE((b->>'estornada')::boolean,false) THEN RAISE EXCEPTION 'Recebimento estornado não pode ser conciliado' USING ERRCODE='22023'; END IF;
  IF (b->>'valor_centavos')::bigint<>(ln.dados->>'valor_centavos')::bigint THEN RAISE EXCEPTION 'O valor do recebimento (%) é diferente do valor da linha do extrato (%)', b->>'valor_centavos', ln.dados->>'valor_centavos' USING ERRCODE='22023'; END IF;
  chave := 'baixa:'||baixa::text;
 ELSE
  IF public.martins_online_leitor(e) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  IF (ln.dados->>'valor_centavos')::bigint>=0 THEN RAISE EXCEPTION 'Só linhas de saída (débito) conciliam com despesas' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='despesas' AND id=alvo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada nesta empresa' USING ERRCODE='23503'; END IF;
  IF COALESCE((t.dados->>'confidencial')::boolean,false) AND NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  IF COALESCE(t.dados->>'estado','pendente_conferencia') NOT IN ('pago','confirmado','conciliado') THEN RAISE EXCEPTION 'Só despesa paga pode ser conciliada (situação atual: %)', COALESCE(t.dados->>'estado','pendente_conferencia') USING ERRCODE='22023'; END IF;
  IF (t.dados->>'valor_centavos')::bigint<>-(ln.dados->>'valor_centavos')::bigint THEN RAISE EXCEPTION 'O valor da despesa (%) é diferente do valor da linha do extrato (%)', t.dados->>'valor_centavos', -(ln.dados->>'valor_centavos')::bigint USING ERRCODE='22023'; END IF;
  chave := 'despesa:'||alvo::text;
 END IF;
 IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='extratos_bancarios' AND dados->>'alvo_chave'=chave) THEN
  RAISE EXCEPTION 'Este lançamento já está conciliado com outra linha do extrato' USING ERRCODE='23505'; END IF;
 UPDATE martins_producao_v1.registros SET revisao=v+1, atualizado_por=auth.uid(), atualizado_em=now(),
  dados=dados||jsonb_strip_nulls(jsonb_build_object('situacao','conciliada','alvo_chave',chave,'conciliacao',jsonb_build_object('tipo',tipo,'alvo',alvo,'baixa',baixa,'em',now(),'por',auth.uid())))
  WHERE empresa_id=e AND modulo='extratos_bancarios' AND id=linha RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'extratos_bancarios',linha,auth.uid(),op,'editar',to_jsonb(ln),to_jsonb(novo)||jsonb_build_object('motivo','Conciliação com '||tipo));
 IF tipo='despesa' AND t.dados->>'estado'='confirmado' AND public.martins_online_master(e) THEN
  UPDATE martins_producao_v1.registros SET revisao=revisao+1, dados=dados||jsonb_build_object('estado','conciliado'), atualizado_por=auth.uid(), atualizado_em=now()
   WHERE empresa_id=e AND modulo='despesas' AND id=alvo RETURNING * INTO dnovo;
  INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
   VALUES(e,'despesas',alvo,auth.uid(),md5(op::text||'desp')::uuid,'editar',to_jsonb(t),to_jsonb(dnovo)||jsonb_build_object('motivo','Conciliada com o extrato'));
  avancou := true;
 END IF;
 resposta := jsonb_build_object('empresa_id',e,'modulo','extratos_bancarios','id',linha,'revisao',novo.revisao,'situacao','conciliada','despesa_conciliada',avancou);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Desfazer a conciliação (motivo obrigatório). Não devolve a despesa a "confirmado": isso é decisão do Master.
CREATE FUNCTION public.martins_producao_extrato_desconciliar(e uuid, op uuid, linha uuid, v bigint, motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; ln martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb;
BEGIN
 IF auth.uid() IS NULL OR e IS NULL OR op IS NULL OR linha IS NULL OR v IS NULL OR v<1 OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>1000 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF martins_producao_v1.pode(e,'extratos_bancarios','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 req := jsonb_build_object('acao','extrato_desconciliar','e',e,'linha',linha,'v',v,'motivo',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 SELECT * INTO ln FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='extratos_bancarios' AND id=linha FOR UPDATE;
 IF NOT FOUND OR ln.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 IF ln.dados->>'situacao' IS DISTINCT FROM 'conciliada' THEN RAISE EXCEPTION 'Esta linha não está conciliada' USING ERRCODE='22023'; END IF;
 UPDATE martins_producao_v1.registros SET revisao=v+1, atualizado_por=auth.uid(), atualizado_em=now(), dados=(dados-'conciliacao'-'alvo_chave')||jsonb_build_object('situacao','pendente')
  WHERE empresa_id=e AND modulo='extratos_bancarios' AND id=linha RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'extratos_bancarios',linha,auth.uid(),op,'editar',to_jsonb(ln),to_jsonb(novo)||jsonb_build_object('motivo',motivo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','extratos_bancarios','id',linha,'revisao',novo.revisao,'situacao','pendente');
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_extrato_importar(uuid,uuid,uuid,text,jsonb), public.martins_producao_extrato_conciliar(uuid,uuid,uuid,bigint,text,uuid,uuid), public.martins_producao_extrato_desconciliar(uuid,uuid,uuid,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_extrato_importar(uuid,uuid,uuid,text,jsonb), public.martins_producao_extrato_conciliar(uuid,uuid,uuid,bigint,text,uuid,uuid), public.martins_producao_extrato_desconciliar(uuid,uuid,uuid,bigint,text) TO authenticated;
