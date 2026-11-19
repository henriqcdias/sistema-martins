-- GERADO por supabase/v17/gerar_migracao.py. Não edite à mão.
-- Pré-requisito: producao, v2 a v10, v14 e v16 aplicadas.
BEGIN;
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

-- Funções existentes, copiadas da v16 com o módulo de recibos de EPI, a regra do RDO aprovado e o responsável técnico da obra.

CREATE OR REPLACE FUNCTION martins_producao_v1.pode(e uuid,m text,a text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND m IN ('funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios','epi_entregas')
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
 FROM unnest(ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios','epi_entregas']) m)) ORDER BY e.id)
 FROM public.martins_online_acessos v JOIN public.martins_empresas e ON e.id=v.empresa_id
 WHERE v.usuario_id=p.usuario_id AND v.ativo),'[]'::jsonb)) INTO resultado
 FROM public.martins_perfis p WHERE p.usuario_id=auth.uid() AND p.ativo;
 IF resultado IS NULL THEN RAISE EXCEPTION 'Perfil inativo' USING ERRCODE='42501'; END IF;
 RETURN resultado;
END $$;

CREATE OR REPLACE FUNCTION public.martins_producao_salvar(e uuid,m text,r uuid,v bigint,d jsonb,op uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; anterior martins_producao_v1.registros; cached martins_producao_v1.operacoes;
 novo martins_producao_v1.registros; resposta jsonb; obra uuid; pessoa uuid; dia date; horas numeric; total numeric; item jsonb; soma numeric; qtd numeric; metragem numeric; preco numeric; desconto numeric; acrescimo numeric; subtotal numeric; itens jsonb; equipe jsonb; vistos uuid[]:=ARRAY[]::uuid[]; nome_rt text;
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
 IF m IN ('estoque_movimentos','recebimentos_compra','pedidos_venda','extratos_bancarios') THEN RAISE EXCEPTION 'Este registro só é gravado pela função própria do módulo' USING ERRCODE='42501'; END IF;
 IF m IN ('clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas') THEN d:=martins_producao_v1.preparar_v2(e,m,r,v,d,anterior);
 ELSIF m IN ('feriados','precos_insumo','epis') THEN d:=martins_producao_v1.preparar_v3(e,m,r,v,d,anterior);
 ELSIF m='pedidos_compra' THEN d:=martins_producao_v1.preparar_v5(e,m,r,v,d,anterior);
 ELSIF m IN ('frota_eventos','ausencias','cotacoes') THEN d:=martins_producao_v1.preparar_v7(e,m,r,v,d,anterior);
 ELSIF m='requisicoes_material' THEN d:=martins_producao_v1.preparar_v8(e,m,r,v,d,anterior);
 ELSIF m='contas_receber' THEN d:=martins_producao_v1.preparar_v10(e,m,r,v,d,anterior);
 ELSIF m='epi_entregas' THEN d:=martins_producao_v1.preparar_v17(e,m,r,v,d,anterior); END IF;
 IF m IN ('funcionarios','obras','planejamento','orcamentos') AND NULLIF(trim(d->>'nome'),'') IS NULL THEN RAISE EXCEPTION 'Nome obrigatório' USING ERRCODE='22023'; END IF;
 IF m='funcionarios' AND d->>'salarioBase' IS NOT NULL AND ((d->>'salarioBase')::numeric<0 OR (d->>'salarioBase')::numeric>1000000000) THEN RAISE EXCEPTION 'Salário inválido' USING ERRCODE='22023';END IF;
 IF m='obras' AND d->>'valorContratado' IS NOT NULL AND ((d->>'valorContratado')::numeric<0 OR (d->>'valorContratado')::numeric>1000000000000) THEN RAISE EXCEPTION 'Valor contratado inválido' USING ERRCODE='22023';END IF;
 IF m='funcionarios' AND NULLIF(d->>'cpf','') IS NOT NULL AND regexp_replace(d->>'cpf','[^0-9]','','g') !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido' USING ERRCODE='22023'; END IF;
 IF m='obras' AND NOT public.martins_online_master(e) THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('nome','codigo','status','clienteResponsavel','enderecoLocalizacao','responsavelTecnico','responsavel_tecnico_id','encarregado','equipesVinculadas','equipesTerceirizadas','dataInicio','previsaoConclusao','situacaoAtual','descricao')) THEN RAISE EXCEPTION 'Campo de Obras restrito' USING ERRCODE='42501'; END IF;
 d:=COALESCE(anterior.dados,'{}'::jsonb)||d;
 END IF;
 IF m='obras' AND NULLIF(trim(d->>'codigo'),'') IS NULL THEN RAISE EXCEPTION 'Código obrigatório' USING ERRCODE='22023'; END IF;
 IF m='obras' AND NULLIF(d->>'responsavel_tecnico_id','') IS NOT NULL THEN
 SELECT x.dados->>'nome' INTO nome_rt FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='funcionarios' AND x.id=(d->>'responsavel_tecnico_id')::uuid AND NULLIF(btrim(x.dados->>'crea'),'') IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'O responsável técnico precisa ser um funcionário cadastrado com CREA' USING ERRCODE='22023'; END IF;
 d:=d||jsonb_build_object('responsavelTecnico',nome_rt);
 END IF;
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
 IF v>0 AND COALESCE(anterior.dados->>'status','')='aprovado' THEN RAISE EXCEPTION 'RDO aprovado não pode ser editado; reabra o RDO (com motivo) para alterar' USING ERRCODE='22023'; END IF;
 d:=d-'aprovado_por'-'aprovado_por_nome'-'aprovado_em'-'rt_id'-'rt_nome'-'rt_crea'-'historicoStatus';
 IF v>0 AND anterior.dados ? 'historicoStatus' THEN d:=d||jsonb_build_object('historicoStatus',anterior.dados->'historicoStatus'); END IF;
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
 -- número e situação são do servidor; orçamento convertido/entregue não é mais editado
 IF v>0 AND COALESCE(anterior.dados->>'status','') IN ('Convertido em venda','Entregue') THEN RAISE EXCEPTION 'Orçamento já convertido em venda não pode ser editado' USING ERRCODE='22023'; END IF;
 IF v=0 OR NULLIF(anterior.dados->>'numero','') IS NULL THEN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'orcamento-numero',0));
 SELECT COALESCE(max((x.dados->>'numero')::bigint),0)+1 INTO total FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='orcamentos';
 d:=(d-'numero')||jsonb_build_object('numero',total::bigint);
 ELSE d:=(d-'numero')||jsonb_build_object('numero',(anterior.dados->>'numero')::bigint); END IF;
 d:=(d-'status'-'historicoStatus'-'pedido_id'-'pedido_numero')||jsonb_build_object('status',CASE WHEN v=0 THEN 'Em elaboração' ELSE COALESCE(NULLIF(CASE anterior.dados->>'status' WHEN 'Em Orçamento' THEN 'Em elaboração' ELSE anterior.dados->>'status' END,''),'Em elaboração') END);
 IF v>0 AND anterior.dados ? 'historicoStatus' THEN d:=d||jsonb_build_object('historicoStatus',anterior.dados->'historicoStatus'); END IF;
 IF v>0 AND anterior.dados ? 'pedido_id' THEN d:=d||jsonb_build_object('pedido_id',anterior.dados->'pedido_id','pedido_numero',anterior.dados->'pedido_numero'); END IF;
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
 IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios','epi_entregas']) m WHERE COALESCE(martins_producao_v1.pode(e,m,'ler'),false)) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
 lancar := COALESCE(martins_producao_v1.pode(e,'despesas','criar'),false);
 RETURN jsonb_build_object('empresa_id',e,
 'obras',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','codigo',x.dados->>'codigo') ORDER BY x.id) FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='obras'),'[]'::jsonb),
 'funcionarios',CASE WHEN martins_producao_v1.pode(e,'funcionarios','ler') OR martins_producao_v1.pode(e,'rdos','ler') OR martins_producao_v1.pode(e,'frequencia','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','funcao',x.dados->>'funcao','status',x.dados->>'status','crea',NULLIF(btrim(x.dados->>'crea'),'')) ORDER BY x.id) FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='funcionarios'),'[]'::jsonb) ELSE '[]'::jsonb END,
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
 modulos text[] := ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra','frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios','epi_entregas'];
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
