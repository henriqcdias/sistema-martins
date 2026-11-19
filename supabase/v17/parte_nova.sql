-- ============================================================================
-- Contratos v17: apontamentos do Henrique (18/11/2026).
--  * RDO: aprovar (encerrar) e reabrir pelo servidor (antes o botão "Aprovar" só mudava uma cópia no navegador).
--    Aprovar exige serviços, responsável técnico da obra (funcionário com CREA) e grava quem aprovou e quando;
--    RDO aprovado não é editado até ser reaberto (com motivo). Tudo com histórico e auditoria.
--  * Responsável técnico da obra: escolhido entre funcionários com CREA (responsavel_tecnico_id), não digitado.
--  * EPI: recibo de entrega com VÁRIOS itens por recibo (módulo epi_entregas), numerado pelo servidor e editável.
--  * Nomes de quem alterou (Frequência): martins_producao_nomes devolve o nome dos usuários da empresa.
-- ============================================================================
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios','epi_entregas'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas',
 'feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',
 'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios','epi_entregas'));

CREATE UNIQUE INDEX epi_entrega_numero ON martins_producao_v1.registros(empresa_id,(dados->>'numero')) WHERE modulo='epi_entregas';

-- Obras: o responsável técnico escolhido (id) também é visto por quem não é Master.
CREATE OR REPLACE FUNCTION martins_producao_v1.projetar(x martins_producao_v1.registros) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN x.modulo<>'obras' OR public.martins_online_master(x.empresa_id) THEN to_jsonb(x)
 ELSE jsonb_set(to_jsonb(x),'{dados}',COALESCE((SELECT jsonb_object_agg(k,v) FROM jsonb_each(x.dados) kv(k,v)
 WHERE k IN ('nome','codigo','status','clienteResponsavel','enderecoLocalizacao','responsavelTecnico','responsavel_tecnico_id','encarregado','equipesVinculadas','equipesTerceirizadas','dataInicio','previsaoConclusao','situacaoAtual','descricao')),'{}'::jsonb)) END
$$;

-- Recibo de entrega de EPI: um recibo, vários itens.
CREATE FUNCTION martins_producao_v1.preparar_v17(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE it jsonb; itens jsonb := '[]'::jsonb; ep martins_producao_v1.registros; vistos text[] := ARRAY[]::text[]; chave text; num bigint; dia date;
 hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; qtd bigint;
BEGIN
 d := jsonb_strip_nulls(d);
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('id','empresa_id','empresaId','funcionario_id','data','itens','motivo','observacao','numero','estado','motivo_cancelamento')) THEN
  RAISE EXCEPTION 'Campo do recibo de EPI não reconhecido' USING ERRCODE='22023'; END IF;
 IF anterior.id IS NOT NULL AND anterior.dados->>'estado'='cancelado' THEN RAISE EXCEPTION 'Recibo cancelado não pode ser editado' USING ERRCODE='22023'; END IF;
 IF NULLIF(d->>'funcionario_id','') IS NULL OR NOT martins_producao_v1.existe(e,'funcionarios',(d->>'funcionario_id')::uuid) THEN RAISE EXCEPTION 'Funcionário do recibo não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF anterior.id IS NOT NULL AND anterior.dados->>'funcionario_id' IS DISTINCT FROM d->>'funcionario_id' THEN RAISE EXCEPTION 'O funcionário do recibo não pode ser trocado' USING ERRCODE='22023'; END IF;
 dia := NULLIF(d->>'data','')::date;
 IF dia IS NULL OR dia > hoje OR dia < date '2000-01-01' THEN RAISE EXCEPTION 'Data da entrega inválida (não pode ser futura)' USING ERRCODE='22023'; END IF;
 d := jsonb_set(d,'{data}',to_jsonb(dia::text));
 IF jsonb_typeof(d->'itens') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'itens') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Informe de 1 a 30 itens no recibo' USING ERRCODE='22023'; END IF;
 FOR it IN SELECT value FROM jsonb_array_elements(d->'itens') LOOP
  IF COALESCE(it->>'qtd','') !~ '^[0-9]{1,4}$' OR (it->>'qtd')::bigint < 1 THEN RAISE EXCEPTION 'Quantidade inválida (1 a 9999)' USING ERRCODE='22023'; END IF;
  qtd := (it->>'qtd')::bigint;
  SELECT * INTO ep FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='epis' AND id=NULLIF(it->>'epi_id','')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'EPI/uniforme não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF COALESCE((ep.dados->>'ativo')::boolean,true) IS FALSE AND NOT (anterior.id IS NOT NULL AND anterior.dados->'itens' @> jsonb_build_array(jsonb_build_object('epi_id',ep.id))) THEN RAISE EXCEPTION 'EPI/uniforme inativo' USING ERRCODE='22023'; END IF;
  chave := ep.id::text||'|'||COALESCE(lower(btrim(it->>'tamanho')),'');
  IF chave = ANY(vistos) THEN RAISE EXCEPTION 'Item repetido no recibo (mesmo EPI e tamanho): some as quantidades' USING ERRCODE='22023'; END IF; vistos := array_append(vistos,chave);
  IF length(COALESCE(it->>'tamanho',''))>20 THEN RAISE EXCEPTION 'Tamanho longo demais' USING ERRCODE='22023'; END IF;
  itens := itens || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('epi_id',ep.id,'descricao',COALESCE(ep.dados->>'nome',ep.dados->>'descricao'),'codigo',ep.dados->>'codigo','tamanho',NULLIF(btrim(it->>'tamanho'),''),'qtd',qtd)));
 END LOOP;
 IF length(COALESCE(d->>'motivo',''))>200 OR length(COALESCE(d->>'observacao',''))>500 THEN RAISE EXCEPTION 'Texto longo demais' USING ERRCODE='22023'; END IF;
 IF v=0 OR NULLIF(anterior.dados->>'numero','') IS NULL THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'epi-recibo-numero',0));
  SELECT COALESCE(max((x.dados->>'numero')::bigint),0)+1 INTO num FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='epi_entregas';
 ELSE num := (anterior.dados->>'numero')::bigint; END IF;
 d := (d - 'numero' - 'estado' - 'motivo_cancelamento') || jsonb_build_object('itens',itens,'numero',num,'estado',CASE WHEN COALESCE(d->>'estado','')='cancelado' THEN 'cancelado' ELSE 'entregue' END);
 IF d->>'estado'='cancelado' THEN d := d || jsonb_build_object('motivo_cancelamento',COALESCE(NULLIF(btrim(anterior.dados->>'motivo_cancelamento'),''),'Cancelado pelo usuário')); END IF;
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION martins_producao_v1.preparar_v17(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros) FROM PUBLIC,anon,authenticated;

-- RDO: aprovar (encerrar) e reabrir. Só o servidor muda a situação.
CREATE FUNCTION public.martins_producao_rdo_estado(e uuid, op uuid, rdo uuid, v bigint, estado text, motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; ob martins_producao_v1.registros; rt martins_producao_v1.registros;
 atual text; hist jsonb; resposta jsonb; nome_aprovador text;
BEGIN
 IF auth.uid() IS NULL OR e IS NULL OR op IS NULL OR rdo IS NULL OR v IS NULL OR v<1 OR estado NOT IN ('aprovado','rascunho') OR length(COALESCE(motivo,''))>1000 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 IF martins_producao_v1.pode(e,'rdos','editar') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 req := jsonb_build_object('acao','rdo_estado','e',e,'r',rdo,'v',v,'estado',estado,'motivo',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'rdos'||rdo::text,0));
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='rdos' AND id=rdo FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RDO não encontrado nesta empresa' USING ERRCODE='23503'; END IF;
 IF anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 atual := COALESCE(anterior.dados->>'status','rascunho');
 SELECT COALESCE(NULLIF(btrim(p.nome),''),'Usuário') INTO nome_aprovador FROM public.martins_perfis p WHERE p.usuario_id=auth.uid();
 IF estado='aprovado' THEN
  IF atual<>'rascunho' THEN RAISE EXCEPTION 'Só se aprova RDO em rascunho (situação atual: %)', atual USING ERRCODE='22023'; END IF;
  IF NULLIF(anterior.dados->>'data','') IS NULL OR NULLIF(btrim(anterior.dados->>'servicos'),'') IS NULL THEN RAISE EXCEPTION 'Para aprovar, o RDO precisa ter data e serviços executados' USING ERRCODE='22023'; END IF;
  SELECT * INTO ob FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='obras' AND id=(anterior.dados->>'obra_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obra do RDO não encontrada' USING ERRCODE='23503'; END IF;
  SELECT * INTO rt FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='funcionarios' AND id=NULLIF(ob.dados->>'responsavel_tecnico_id','')::uuid;
  IF NOT FOUND OR NULLIF(btrim(rt.dados->>'crea'),'') IS NULL THEN RAISE EXCEPTION 'Para aprovar, escolha o responsável técnico da obra (funcionário com CREA) em Gestão de Obras' USING ERRCODE='22023'; END IF;
  hist := COALESCE(anterior.dados->'historicoStatus','[]'::jsonb)||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('de','rascunho','para','aprovado','em',now(),'por',auth.uid(),'por_nome',nome_aprovador,'motivo',NULLIF(btrim(motivo),''))));
  UPDATE martins_producao_v1.registros SET revisao=v+1, atualizado_por=auth.uid(), atualizado_em=now(),
   dados=dados||jsonb_build_object('status','aprovado','aprovado_por',auth.uid(),'aprovado_por_nome',nome_aprovador,'aprovado_em',now(),'rt_id',rt.id,'rt_nome',rt.dados->>'nome','rt_crea',rt.dados->>'crea','responsavel',rt.dados->>'nome','historicoStatus',hist)
   WHERE empresa_id=e AND modulo='rdos' AND id=rdo RETURNING * INTO novo;
 ELSE
  IF atual<>'aprovado' THEN RAISE EXCEPTION 'Só se reabre RDO aprovado (situação atual: %)', atual USING ERRCODE='22023'; END IF;
  IF NULLIF(btrim(motivo),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo para reabrir o RDO' USING ERRCODE='22023'; END IF;
  hist := COALESCE(anterior.dados->'historicoStatus','[]'::jsonb)||jsonb_build_array(jsonb_build_object('de','aprovado','para','rascunho','em',now(),'por',auth.uid(),'por_nome',nome_aprovador,'motivo',btrim(motivo)));
  UPDATE martins_producao_v1.registros SET revisao=v+1, atualizado_por=auth.uid(), atualizado_em=now(),
   dados=(dados-'aprovado_por'-'aprovado_por_nome'-'aprovado_em'-'rt_id'-'rt_nome'-'rt_crea')||jsonb_build_object('status','rascunho','historicoStatus',hist)
   WHERE empresa_id=e AND modulo='rdos' AND id=rdo RETURNING * INTO novo;
 END IF;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'rdos',rdo,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo',COALESCE(NULLIF(btrim(motivo),''),CASE WHEN estado='aprovado' THEN 'RDO aprovado' ELSE 'RDO reaberto' END)));
 resposta := jsonb_build_object('empresa_id',e,'modulo','rdos','id',rdo,'revisao',novo.revisao,'status',estado);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- Nomes de quem trabalha na empresa (para mostrar "alterado por"). Qualquer usuário ativo da empresa consulta.
CREATE FUNCTION public.martins_producao_nomes(e uuid, ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.martins_online_acessos a WHERE a.empresa_id=e AND a.usuario_id=auth.uid() AND a.ativo) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF ids IS NULL OR cardinality(ids)>200 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 RETURN COALESCE((SELECT jsonb_object_agg(p.usuario_id::text,COALESCE(NULLIF(btrim(p.nome),''),'Usuário')) FROM public.martins_perfis p
   JOIN public.martins_online_acessos a ON a.usuario_id=p.usuario_id AND a.empresa_id=e WHERE p.usuario_id=ANY(ids)),'{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_rdo_estado(uuid,uuid,uuid,bigint,text,text), public.martins_producao_nomes(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_rdo_estado(uuid,uuid,uuid,bigint,text,text), public.martins_producao_nomes(uuid,uuid[]) TO authenticated;
