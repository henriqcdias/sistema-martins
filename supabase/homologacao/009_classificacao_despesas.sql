-- Contrato isolado: aplicar somente em banco local de testes ou homologação autorizada.
-- Não modifica obrigações, saldo bancário, pagamentos ou os contratos anteriores.
BEGIN;
CREATE TABLE martins_hml_v1.cd_acessos (
 empresa_id uuid NOT NULL, usuario_id uuid NOT NULL, documentos boolean NOT NULL DEFAULT false,
 PRIMARY KEY(empresa_id,usuario_id), FOREIGN KEY(empresa_id,usuario_id) REFERENCES martins_hml_v1.membros(empresa_id,usuario_id)
);
CREATE TABLE martins_hml_v1.cd_despesas (
 empresa_id uuid NOT NULL, lancamento_id uuid NOT NULL, revisao bigint NOT NULL DEFAULT 1,
 valor_centavos bigint NOT NULL CHECK(valor_centavos>0 AND valor_centavos<=9007199254740991),
 origem jsonb NOT NULL, rateios jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(rateios)='array'),
 PRIMARY KEY(empresa_id,lancamento_id), FOREIGN KEY(empresa_id,lancamento_id) REFERENCES martins_hml_v1.fin_lancamentos(empresa_id,id)
);
CREATE TABLE martins_hml_v1.cd_origens (
 empresa_id uuid NOT NULL, referencia text NOT NULL CHECK(length(referencia) BETWEEN 1 AND 500), lancamento_id uuid NOT NULL,
 PRIMARY KEY(empresa_id,referencia), FOREIGN KEY(empresa_id,lancamento_id) REFERENCES martins_hml_v1.cd_despesas(empresa_id,lancamento_id)
);
CREATE TABLE martins_hml_v1.cd_tarefas (
 empresa_id uuid NOT NULL, id uuid NOT NULL, lancamento_id uuid NOT NULL, destinatario uuid NOT NULL,
 valor_centavos bigint NOT NULL CHECK(valor_centavos>0), orientacao text NOT NULL,
 estado text NOT NULL CHECK(estado IN ('encaminhada','proposta','aprovada','rejeitada','retirada')),
 proposta jsonb NOT NULL DEFAULT '[]', criado_por uuid NOT NULL, proposto_por uuid,
 PRIMARY KEY(empresa_id,id), FOREIGN KEY(empresa_id,lancamento_id) REFERENCES martins_hml_v1.cd_despesas(empresa_id,lancamento_id),
 FOREIGN KEY(empresa_id,destinatario) REFERENCES martins_hml_v1.membros(empresa_id,usuario_id)
);
CREATE TABLE martins_hml_v1.cd_conciliacoes (
 empresa_id uuid NOT NULL, lancamento_id uuid NOT NULL, referencia text NOT NULL CHECK(length(referencia) BETWEEN 1 AND 500),
 autor uuid NOT NULL, em timestamptz NOT NULL DEFAULT now(), motivo text NOT NULL,
 PRIMARY KEY(empresa_id,lancamento_id), UNIQUE(empresa_id,referencia),
 FOREIGN KEY(empresa_id,lancamento_id) REFERENCES martins_hml_v1.cd_despesas(empresa_id,lancamento_id)
);
CREATE FUNCTION martins_hml_v1.cd_compras(e uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM martins_hml_v1.cd_acessos a JOIN martins_hml_v1.membros m USING(empresa_id,usuario_id)
 WHERE a.empresa_id=e AND a.usuario_id=u AND m.ativo AND COALESCE(m.permissoes->'classificacao','true'::jsonb)='true'::jsonb)
$$;
CREATE FUNCTION martins_hml_v1.cd_tarefa_permitida(e uuid,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT martins_hml_v1.fin_master(e) OR martins_hml_v1.cd_compras(e,auth.uid()) AND EXISTS(SELECT 1 FROM martins_hml_v1.cd_tarefas WHERE empresa_id=e AND id=t AND destinatario=auth.uid())
$$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['cd_acessos','cd_despesas','cd_origens','cd_tarefas','cd_conciliacoes'] LOOP
 EXECUTE format('ALTER TABLE martins_hml_v1.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE martins_hml_v1.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON martins_hml_v1.%I FROM PUBLIC,authenticated',t);
 EXECUTE format('GRANT SELECT ON martins_hml_v1.%I TO authenticated',t);
 END LOOP; END $$;
CREATE POLICY cd_access_read ON martins_hml_v1.cd_acessos FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id) OR usuario_id=auth.uid() AND martins_hml_v1.cd_compras(empresa_id,auth.uid()));
CREATE POLICY cd_expense_read ON martins_hml_v1.cd_despesas FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE POLICY cd_origins_read ON martins_hml_v1.cd_origens FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE POLICY cd_tasks_read ON martins_hml_v1.cd_tarefas FOR SELECT TO authenticated USING(martins_hml_v1.cd_tarefa_permitida(empresa_id,id));
CREATE POLICY cd_reconcile_read ON martins_hml_v1.cd_conciliacoes FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE FUNCTION martins_hml_v1.cd_liberar(e uuid,u uuid,liberar boolean,documentos boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'classificacao',0));
 IF NOT martins_hml_v1.fin_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF liberar IS NULL OR documentos IS NULL OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.membros WHERE empresa_id=e AND usuario_id=u AND ativo) THEN RAISE EXCEPTION 'Membro inválido'; END IF;
 IF liberar THEN INSERT INTO martins_hml_v1.cd_acessos VALUES(e,u,documentos) ON CONFLICT(empresa_id,usuario_id) DO UPDATE SET documentos=excluded.documentos;
 ELSE DELETE FROM martins_hml_v1.cd_acessos WHERE empresa_id=e AND usuario_id=u; END IF;
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,depois) VALUES(e,auth.uid(),'classificacao_acesso',u,jsonb_build_object('liberar',liberar,'documentos',documentos));
END $$;
-- Valida obras da mesma empresa e campos no servidor. Retorna soma inteira sem alterar caixa.
CREATE FUNCTION martins_hml_v1.cd_validar_rateios(e uuid,itens jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; soma numeric:=0; obras text[]:='{}'; obra uuid; k text;
BEGIN
 IF itens IS NULL OR jsonb_typeof(itens)<>'array' OR jsonb_array_length(itens)>100 THEN RAISE EXCEPTION 'Rateios inválidos'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(itens) LOOP
 IF jsonb_typeof(r)<>'object' OR NOT COALESCE(r->>'centavos','')~'^[0-9]{1,16}$' OR jsonb_typeof(r->'centavos') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Centavos inválidos'; END IF;
 IF (r->>'centavos')::numeric NOT BETWEEN 1 AND 9007199254740991 THEN RAISE EXCEPTION 'Centavos inválidos'; END IF;
 obra:=(r->>'obra_id')::uuid;
 IF obra IS NULL OR obra::text=ANY(obras) OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.registros WHERE empresa_id=e AND modulo='obras' AND id=obra) THEN RAISE EXCEPTION 'Obra inexistente, repetida ou de outra empresa'; END IF;
 obras:=array_append(obras,obra::text);
 FOREACH k IN ARRAY ARRAY['categoria','centro_custo','fornecedor','materiais','finalidade'] LOOP
 IF jsonb_typeof(r->k) IS DISTINCT FROM 'string' OR length(trim(r->>k)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Campo de classificação inválido: %',k; END IF;
 END LOOP;
 IF r->>'categoria' NOT IN ('Materiais','Mão de obra','Equipamentos','Serviços','Transporte','Administrativo','Outros') THEN RAISE EXCEPTION 'Categoria inválida'; END IF;
 soma:=soma+(r->>'centavos')::numeric;
 END LOOP;
 IF soma>9007199254740991 THEN RAISE EXCEPTION 'Soma fora do limite'; END IF;
 RETURN soma::bigint;
END $$;
-- revisao=0 cria vínculo; os demais comandos exigem a revisão atual. Repetir não duplica efeitos.
CREATE FUNCTION martins_hml_v1.cd_executar(e uuid,l uuid,revisao bigint,acao text,dados jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f martins_hml_v1.fin_lancamentos%ROWTYPE; c martins_hml_v1.cd_despesas%ROWTYPE; t martins_hml_v1.cd_tarefas%ROWTYPE;
 is_master boolean; antes jsonb; depois jsonb; soma bigint; reservado bigint; valor bigint; refs text; destino uuid;
BEGIN
 IF e IS NULL OR l IS NULL OR revisao IS NULL OR revisao<0 OR dados IS NULL OR jsonb_typeof(dados)<>'object' OR octet_length(dados::text)>262144 THEN RAISE EXCEPTION 'Comando inválido'; END IF;
 -- Mesma ordem de locks do financeiro; nenhuma ação escreve em fin_lancamentos.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'financeiro_usuario',0));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'classificacao',0));
 is_master:=martins_hml_v1.fin_master(e);
 IF NOT is_master AND (acao IS DISTINCT FROM 'propor' OR NOT martins_hml_v1.cd_compras(e,auth.uid())) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF NOT is_master AND NOT EXISTS(SELECT 1 FROM martins_hml_v1.cd_tarefas WHERE empresa_id=e AND lancamento_id=l AND id=(dados->>'tarefa_id')::uuid AND destinatario=auth.uid()) THEN RAISE EXCEPTION 'Tarefa não autorizada' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM martins_hml_v1.cd_despesas WHERE empresa_id=e AND lancamento_id=l FOR UPDATE;
 IF COALESCE(c.revisao,0)<>revisao THEN RAISE EXCEPTION 'Conflito de versão' USING ERRCODE='40001'; END IF;
 SELECT * INTO f FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND id=l FOR UPDATE;
 IF NOT FOUND OR f.estado IN ('cancelado','bloqueado') OR f.dados->>'tipo' NOT IN ('despesa','nota_fiscal') THEN RAISE EXCEPTION 'Despesa indisponível'; END IF;
 antes:=jsonb_build_object('despesa',to_jsonb(c),'conciliacao',(SELECT to_jsonb(x) FROM martins_hml_v1.cd_conciliacoes x WHERE empresa_id=e AND lancamento_id=l),'tarefa',(SELECT to_jsonb(x) FROM martins_hml_v1.cd_tarefas x WHERE empresa_id=e AND lancamento_id=l AND id=nullif(dados->>'tarefa_id','')::uuid));
 IF acao='vincular' THEN
 IF c.lancamento_id IS NOT NULL THEN RAISE EXCEPTION 'Despesa já vinculada'; END IF;
 INSERT INTO martins_hml_v1.cd_despesas(empresa_id,lancamento_id,valor_centavos,origem) VALUES(e,l,(f.dados->>'valor_centavos')::bigint,f.dados);
 IF dados ? 'referencias' THEN
 IF jsonb_typeof(dados->'referencias')<>'array' OR jsonb_array_length(dados->'referencias')>100 THEN RAISE EXCEPTION 'Referências inválidas'; END IF;
 FOR refs IN SELECT jsonb_array_elements_text(dados->'referencias') LOOP INSERT INTO martins_hml_v1.cd_origens VALUES(e,refs,l); END LOOP;
 END IF;
 ELSE
 IF c.lancamento_id IS NULL OR c.origem IS DISTINCT FROM f.dados THEN RAISE EXCEPTION 'Original mudou ou vínculo ausente'; END IF;
 SELECT COALESCE(sum((r->>'centavos')::bigint),0) INTO soma FROM jsonb_array_elements(c.rateios) r;
 SELECT COALESCE(sum(valor_centavos),0) INTO reservado FROM martins_hml_v1.cd_tarefas WHERE empresa_id=e AND lancamento_id=l AND estado IN ('encaminhada','proposta');
 IF acao='encaminhar' THEN
 IF NOT COALESCE(dados->>'centavos','')~'^[0-9]{1,16}$' OR jsonb_typeof(dados->'centavos') IS DISTINCT FROM 'number' OR (dados->>'centavos')::numeric NOT BETWEEN 1 AND c.valor_centavos-soma-reservado THEN RAISE EXCEPTION 'Parcela excede saldo livre'; END IF;
 destino:=(dados->>'destinatario')::uuid;
 IF NOT martins_hml_v1.cd_compras(e,destino) OR length(trim(COALESCE(dados->>'orientacao',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Destinatário ou orientação inválidos'; END IF;
 INSERT INTO martins_hml_v1.cd_tarefas(empresa_id,id,lancamento_id,destinatario,valor_centavos,orientacao,estado,criado_por) VALUES(e,(dados->>'tarefa_id')::uuid,l,destino,(dados->>'centavos')::bigint,dados->>'orientacao','encaminhada',auth.uid());
 ELSIF acao IN ('propor','aprovar','rejeitar','retirar') THEN
 SELECT * INTO t FROM martins_hml_v1.cd_tarefas WHERE empresa_id=e AND lancamento_id=l AND id=(dados->>'tarefa_id')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT is_master AND t.destinatario<>auth.uid() THEN RAISE EXCEPTION 'Tarefa não autorizada' USING ERRCODE='42501'; END IF;
 IF acao='propor' THEN
 IF t.estado<>'encaminhada' THEN RAISE EXCEPTION 'Tarefa não aceita proposta'; END IF;
 valor:=martins_hml_v1.cd_validar_rateios(e,dados->'itens');
 IF valor<=0 OR valor>t.valor_centavos THEN RAISE EXCEPTION 'Proposta excede parcela'; END IF;
 UPDATE martins_hml_v1.cd_tarefas SET estado='proposta',proposta=dados->'itens',proposto_por=auth.uid() WHERE empresa_id=e AND id=t.id;
 ELSE
 IF length(trim(COALESCE(dados->>'motivo',''))) NOT BETWEEN 1 AND 500 OR (CASE WHEN acao='retirar' THEN t.estado NOT IN ('encaminhada','proposta') ELSE t.estado<>'proposta' END) THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
 IF acao='aprovar' THEN
 valor:=martins_hml_v1.cd_validar_rateios(e,c.rateios||t.proposta);
 IF valor>c.valor_centavos THEN RAISE EXCEPTION 'Rateio excede total'; END IF;
 UPDATE martins_hml_v1.cd_despesas SET rateios=c.rateios||t.proposta WHERE empresa_id=e AND lancamento_id=l;
 END IF;
 UPDATE martins_hml_v1.cd_tarefas SET estado=CASE acao WHEN 'aprovar' THEN 'aprovada' WHEN 'retirar' THEN 'retirada' ELSE 'rejeitada' END WHERE empresa_id=e AND id=t.id;
 END IF;
 ELSIF acao='reclassificar' THEN
 IF reservado>0 OR length(trim(COALESCE(dados->>'motivo',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Retire tarefas pendentes e informe motivo'; END IF;
 valor:=martins_hml_v1.cd_validar_rateios(e,dados->'itens');
 IF valor>c.valor_centavos THEN RAISE EXCEPTION 'Rateio excede total'; END IF;
 UPDATE martins_hml_v1.cd_despesas SET rateios=dados->'itens' WHERE empresa_id=e AND lancamento_id=l;
 ELSIF acao='conciliar' THEN
 IF length(trim(COALESCE(dados->>'referencia',''))) NOT BETWEEN 1 AND 500 OR length(trim(COALESCE(dados->>'motivo',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Conciliação inválida'; END IF;
 INSERT INTO martins_hml_v1.cd_conciliacoes(empresa_id,lancamento_id,referencia,autor,motivo) VALUES(e,l,dados->>'referencia',auth.uid(),dados->>'motivo') ON CONFLICT(empresa_id,lancamento_id) DO UPDATE SET referencia=excluded.referencia,autor=excluded.autor,motivo=excluded.motivo,em=now();
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
 UPDATE martins_hml_v1.cd_despesas SET revisao=cd_despesas.revisao+1 WHERE empresa_id=e AND lancamento_id=l;
 END IF;
 SELECT to_jsonb(r) INTO depois FROM martins_hml_v1.cd_despesas r WHERE empresa_id=e AND lancamento_id=l;
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,antes,depois) VALUES(e,auth.uid(),'classificacao_'||acao,l,antes,jsonb_build_object('despesa',depois,'comando',dados));
 -- Compras recebe apenas confirmação e revisão; nunca o valor total ou dados bancários.
 IF NOT is_master THEN RETURN jsonb_build_object('revisao',depois->'revisao','estado','proposta'); END IF;
 RETURN depois;
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.cd_compras(uuid,uuid),martins_hml_v1.cd_tarefa_permitida(uuid,uuid),martins_hml_v1.cd_liberar(uuid,uuid,boolean,boolean),martins_hml_v1.cd_validar_rateios(uuid,jsonb),martins_hml_v1.cd_executar(uuid,uuid,bigint,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.cd_compras(uuid,uuid),martins_hml_v1.cd_tarefa_permitida(uuid,uuid),martins_hml_v1.cd_liberar(uuid,uuid,boolean,boolean),martins_hml_v1.cd_executar(uuid,uuid,bigint,text,jsonb) TO authenticated;
CREATE VIEW martins_hml_v1.cd_saldos WITH (security_invoker=true) AS
 SELECT f.empresa_id,f.id AS lancamento_id,f.dados->>'descricao' AS descricao,
 (f.dados->>'valor_centavos')::bigint AS total_centavos,
 COALESCE((SELECT sum((r->>'centavos')::bigint) FROM jsonb_array_elements(c.rateios) r),0)::bigint AS classificado_centavos,
 ((f.dados->>'valor_centavos')::bigint-COALESCE((SELECT sum((r->>'centavos')::bigint) FROM jsonb_array_elements(c.rateios) r),0))::bigint AS pendente_centavos,
 COALESCE((SELECT sum(t.valor_centavos) FROM martins_hml_v1.cd_tarefas t WHERE t.empresa_id=f.empresa_id AND t.lancamento_id=f.id AND t.estado IN ('encaminhada','proposta')),0)::bigint AS reservado_centavos,
 COALESCE(c.revisao,0) AS revisao
 FROM martins_hml_v1.fin_lancamentos f LEFT JOIN martins_hml_v1.cd_despesas c ON c.empresa_id=f.empresa_id AND c.lancamento_id=f.id
 WHERE martins_hml_v1.fin_master(f.empresa_id) AND f.estado NOT IN ('cancelado','bloqueado') AND f.dados->>'tipo' IN ('despesa','nota_fiscal');
REVOKE ALL ON martins_hml_v1.cd_saldos FROM PUBLIC;
GRANT SELECT ON martins_hml_v1.cd_saldos TO authenticated;
COMMIT;
