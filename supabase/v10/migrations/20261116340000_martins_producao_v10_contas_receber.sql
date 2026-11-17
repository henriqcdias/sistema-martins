-- GERADO por supabase/v10/gerar_migracao.py. Não edite à mão.
-- Pré-requisito: producao, v2 a v9 aplicadas.
BEGIN;
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

-- Funções existentes, copiadas da v8/v9 com o módulo de contas a receber.

CREATE OR REPLACE FUNCTION martins_producao_v1.pode(e uuid,m text,a text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND m IN ('funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber')
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
 FROM unnest(ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber']) m)) ORDER BY e.id)
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
 ELSIF m='pedidos_compra' THEN d:=martins_producao_v1.preparar_v5(e,m,r,v,d,anterior);
 ELSIF m IN ('frota_eventos','ausencias','cotacoes') THEN d:=martins_producao_v1.preparar_v7(e,m,r,v,d,anterior);
 ELSIF m='requisicoes_material' THEN d:=martins_producao_v1.preparar_v8(e,m,r,v,d,anterior);
 ELSIF m='contas_receber' THEN d:=martins_producao_v1.preparar_v10(e,m,r,v,d,anterior); END IF;
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
 IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber']) m WHERE COALESCE(martins_producao_v1.pode(e,m,'ler'),false)) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
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

CREATE OR REPLACE FUNCTION public.martins_producao_permissoes_definir(e uuid, op uuid, usuario uuid, itens jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; it jsonb; m text; vistos text[] := ARRAY[]::text[]; papel_alvo text; antes jsonb; depois jsonb; resposta jsonb;
 modulos text[] := ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber'];
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR usuario IS NULL OR jsonb_typeof(itens) IS DISTINCT FROM 'array' OR jsonb_array_length(itens) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','permissoes_definir','e',e,'u',usuario,'i',itens);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 SELECT a.papel INTO papel_alvo FROM public.martins_online_acessos a WHERE a.empresa_id=e AND a.usuario_id=usuario;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não tem vínculo com esta empresa' USING ERRCODE='23503'; END IF;
 IF papel_alvo='master' THEN RAISE EXCEPTION 'Master já tem acesso total; não há permissões para configurar' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||usuario::text||'permissoes',0));
 SELECT COALESCE(jsonb_object_agg(q.modulo,jsonb_build_object('ler',q.ler,'criar',q.criar,'editar',q.editar)),'{}'::jsonb) INTO antes FROM martins_producao_v1.permissoes q WHERE q.usuario_id=usuario AND q.empresa_id=e;
 FOR it IN SELECT value FROM jsonb_array_elements(itens) LOOP
  m := it->>'modulo';
  IF m IS NULL OR NOT (m = ANY(modulos)) THEN RAISE EXCEPTION 'Módulo desconhecido' USING ERRCODE='22023'; END IF;
  IF m = ANY(vistos) THEN RAISE EXCEPTION 'Módulo repetido na lista' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,m);
  IF jsonb_typeof(it->'ler') IS DISTINCT FROM 'boolean' OR jsonb_typeof(it->'criar') IS DISTINCT FROM 'boolean' OR jsonb_typeof(it->'editar') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Permissões devem ser verdadeiro ou falso' USING ERRCODE='22023'; END IF;
  IF ((it->>'criar')::boolean OR (it->>'editar')::boolean) AND NOT (it->>'ler')::boolean THEN RAISE EXCEPTION 'Para criar ou editar é preciso poder ver o módulo' USING ERRCODE='22023'; END IF;
  IF NOT ((it->>'ler')::boolean OR (it->>'criar')::boolean OR (it->>'editar')::boolean) THEN
   DELETE FROM martins_producao_v1.permissoes WHERE usuario_id=usuario AND empresa_id=e AND modulo=m;
  ELSE
   INSERT INTO martins_producao_v1.permissoes(usuario_id,empresa_id,modulo,ler,criar,editar) VALUES(usuario,e,m,(it->>'ler')::boolean,(it->>'criar')::boolean,(it->>'editar')::boolean)
   ON CONFLICT(usuario_id,empresa_id,modulo) DO UPDATE SET ler=EXCLUDED.ler,criar=EXCLUDED.criar,editar=EXCLUDED.editar;
  END IF;
 END LOOP;
 SELECT COALESCE(jsonb_object_agg(q.modulo,jsonb_build_object('ler',q.ler,'criar',q.criar,'editar',q.editar)),'{}'::jsonb) INTO depois FROM martins_producao_v1.permissoes q WHERE q.usuario_id=usuario AND q.empresa_id=e;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'permissoes',usuario,auth.uid(),op,'editar',jsonb_build_object('permissoes',antes),jsonb_build_object('permissoes',depois));
 resposta := jsonb_build_object('empresa_id',e,'usuario_id',usuario,'permissoes',depois);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
