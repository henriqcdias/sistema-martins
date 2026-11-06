-- Contrato isolado de integração. Dados fiscais/evidências são provisionados por serviço confiável, nunca pelo cliente.
BEGIN;
CREATE TABLE martins_hml_v1.nfe_pedidos (
 empresa_id uuid NOT NULL,id uuid NOT NULL,fornecedor text NOT NULL,itens jsonb NOT NULL CHECK(jsonb_typeof(itens)='array'),
 referencia_origem text NOT NULL DEFAULT '',legado_entregue boolean NOT NULL DEFAULT false,conferido boolean NOT NULL DEFAULT false,versao bigint NOT NULL DEFAULT 1,
 obrigacoes_existentes uuid[] NOT NULL DEFAULT '{}',PRIMARY KEY(empresa_id,id)
);
CREATE TABLE martins_hml_v1.nfe_notas (
 empresa_id uuid NOT NULL,chave text NOT NULL CHECK(chave~'^[0-9]{44}$'),pedido_id uuid NOT NULL,fornecedor text NOT NULL,
 data_emissao date NOT NULL,xml_original bytea NOT NULL CHECK(octet_length(xml_original) BETWEEN 1 AND 524288),sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$') CHECK(sha256=encode(pg_catalog.sha256(xml_original),'hex')),
 itens jsonb NOT NULL CHECK(jsonb_typeof(itens)='array'),parcelas jsonb NOT NULL CHECK(jsonb_typeof(parcelas)='array'),valor_centavos bigint NOT NULL CHECK(valor_centavos>0),
 numero text NOT NULL DEFAULT '',finalidade text NOT NULL CHECK(finalidade IN ('normal','complementar','devolucao','ajuste')),situacao text NOT NULL CHECK(situacao IN ('nao_consultada','autorizada','cancelada','denegada')),
 xsd_valido boolean NOT NULL DEFAULT false,assinatura_valida boolean NOT NULL DEFAULT false,confianca_aprovada boolean NOT NULL DEFAULT false,
 teste_sintetico boolean NOT NULL DEFAULT false,consulta_oficial boolean NOT NULL DEFAULT false,protocolo_oficial text,fonte_consulta text,consultado_em timestamptz,
 CHECK(situacao='nao_consultada' OR teste_sintetico OR consulta_oficial),CHECK(NOT consulta_oficial OR (protocolo_oficial IS NOT NULL AND length(trim(protocolo_oficial))>0 AND fonte_consulta IS NOT NULL AND length(trim(fonte_consulta))>0 AND consultado_em IS NOT NULL)),PRIMARY KEY(empresa_id,chave),FOREIGN KEY(empresa_id,pedido_id) REFERENCES martins_hml_v1.nfe_pedidos(empresa_id,id)
);
-- Referências provisionadas com os mesmos IDs do catálogo/depósitos de homologação; XML não cadastra produto.
CREATE TABLE martins_hml_v1.nfe_produtos(empresa_id uuid NOT NULL,id uuid NOT NULL,nome text NOT NULL,unidade text NOT NULL,ativo boolean NOT NULL DEFAULT true,PRIMARY KEY(empresa_id,id));
CREATE TABLE martins_hml_v1.nfe_depositos(empresa_id uuid NOT NULL,id uuid NOT NULL,nome text NOT NULL,ativo boolean NOT NULL DEFAULT true,PRIMARY KEY(empresa_id,id));
CREATE TABLE martins_hml_v1.nfe_saldos (
 empresa_id uuid NOT NULL,produto_id uuid NOT NULL,deposito_id uuid NOT NULL,quantidade numeric(20,6) NOT NULL CHECK(quantidade>=0),PRIMARY KEY(empresa_id,produto_id,deposito_id),FOREIGN KEY(empresa_id,produto_id) REFERENCES martins_hml_v1.nfe_produtos(empresa_id,id),FOREIGN KEY(empresa_id,deposito_id) REFERENCES martins_hml_v1.nfe_depositos(empresa_id,id)
);
CREATE TABLE martins_hml_v1.nfe_recebimentos (
 empresa_id uuid NOT NULL,id uuid NOT NULL,chave text NOT NULL,pedido_id uuid NOT NULL,deposito_id uuid NOT NULL,autor uuid NOT NULL,
 itens jsonb NOT NULL,documento text NOT NULL,em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(empresa_id,id),UNIQUE(empresa_id,chave,documento),
 FOREIGN KEY(empresa_id,chave) REFERENCES martins_hml_v1.nfe_notas(empresa_id,chave),FOREIGN KEY(empresa_id,pedido_id) REFERENCES martins_hml_v1.nfe_pedidos(empresa_id,id)
);
CREATE TABLE martins_hml_v1.nfe_parcelas (
 empresa_id uuid NOT NULL,chave text NOT NULL,numero text NOT NULL,lancamento_id uuid NOT NULL,PRIMARY KEY(empresa_id,chave,numero),UNIQUE(empresa_id,lancamento_id),
 FOREIGN KEY(empresa_id,chave) REFERENCES martins_hml_v1.nfe_notas(empresa_id,chave),FOREIGN KEY(empresa_id,lancamento_id) REFERENCES martins_hml_v1.fin_lancamentos(empresa_id,id)
);
CREATE TABLE martins_hml_v1.nfe_operacoes (
 empresa_id uuid NOT NULL,id uuid NOT NULL,autor uuid NOT NULL,requisicao jsonb NOT NULL,resposta jsonb NOT NULL,PRIMARY KEY(empresa_id,id)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['nfe_produtos','nfe_depositos','nfe_pedidos','nfe_notas','nfe_saldos','nfe_recebimentos','nfe_parcelas','nfe_operacoes'] LOOP
 EXECUTE format('ALTER TABLE martins_hml_v1.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE martins_hml_v1.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON martins_hml_v1.%I FROM PUBLIC,authenticated',t);
 END LOOP;END $$;
-- O contrato combinado é restrito ao Master; o Lançador continua vendo apenas as parcelas próprias/compartilhadas via fin_lancamentos.
GRANT SELECT ON martins_hml_v1.nfe_produtos,martins_hml_v1.nfe_depositos,martins_hml_v1.nfe_pedidos,martins_hml_v1.nfe_notas,martins_hml_v1.nfe_saldos,martins_hml_v1.nfe_recebimentos,martins_hml_v1.nfe_parcelas TO authenticated;
CREATE POLICY nfe_produtos_read ON martins_hml_v1.nfe_produtos FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id) AND martins_hml_v1.permitido(empresa_id,'estoque',false));
CREATE POLICY nfe_depositos_read ON martins_hml_v1.nfe_depositos FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id) AND martins_hml_v1.permitido(empresa_id,'estoque',false));
CREATE POLICY nfe_pedidos_read ON martins_hml_v1.nfe_pedidos FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE POLICY nfe_notas_read ON martins_hml_v1.nfe_notas FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE POLICY nfe_saldos_read ON martins_hml_v1.nfe_saldos FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id) AND martins_hml_v1.permitido(empresa_id,'estoque',false));
CREATE POLICY nfe_recebimentos_read ON martins_hml_v1.nfe_recebimentos FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE POLICY nfe_parcelas_read ON martins_hml_v1.nfe_parcelas FOR SELECT TO authenticated USING(martins_hml_v1.fin_pode(empresa_id,lancamento_id,false));
CREATE TABLE martins_hml_v1.nfe_auditoria(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,empresa_id uuid NOT NULL,chave text NOT NULL,autor uuid,executor text NOT NULL,acao text NOT NULL,antes jsonb,depois jsonb,em timestamptz NOT NULL DEFAULT now());
ALTER TABLE martins_hml_v1.nfe_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.nfe_auditoria FORCE ROW LEVEL SECURITY;
REVOKE ALL ON martins_hml_v1.nfe_auditoria FROM PUBLIC,authenticated;
GRANT SELECT ON martins_hml_v1.nfe_auditoria TO authenticated;
CREATE POLICY nfe_auditoria_read ON martins_hml_v1.nfe_auditoria FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE FUNCTION martins_hml_v1.nfe_auditar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.empresa_id,NEW.chave,NEW.pedido_id,NEW.fornecedor,NEW.xml_original,NEW.sha256,NEW.itens,NEW.parcelas,NEW.valor_centavos,NEW.data_emissao,NEW.finalidade,NEW.numero) IS DISTINCT FROM (OLD.empresa_id,OLD.chave,OLD.pedido_id,OLD.fornecedor,OLD.xml_original,OLD.sha256,OLD.itens,OLD.parcelas,OLD.valor_centavos,OLD.data_emissao,OLD.finalidade,OLD.numero) THEN RAISE EXCEPTION 'Documento e vínculos fiscais imutáveis; exige correção auditada específica';END IF;
 INSERT INTO martins_hml_v1.nfe_auditoria(empresa_id,chave,autor,executor,acao,antes,depois) VALUES(NEW.empresa_id,NEW.chave,auth.uid(),COALESCE(nullif(current_setting('role',true),'none'),'servico_banco'),TG_OP,CASE WHEN TG_OP='UPDATE' THEN jsonb_build_object('sha256',OLD.sha256,'situacao',OLD.situacao,'xsd',OLD.xsd_valido,'assinatura',OLD.assinatura_valida,'confianca',OLD.confianca_aprovada) END,jsonb_build_object('sha256',NEW.sha256,'situacao',NEW.situacao,'xsd',NEW.xsd_valido,'assinatura',NEW.assinatura_valida,'confianca',NEW.confianca_aprovada,'teste_sintetico',NEW.teste_sintetico,'consulta_oficial',NEW.consulta_oficial,'fonte_consulta',NEW.fonte_consulta,'consultado_em',NEW.consultado_em));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.nfe_auditar() FROM PUBLIC;
CREATE TRIGGER nfe_documento_auditado BEFORE INSERT OR UPDATE ON martins_hml_v1.nfe_notas FOR EACH ROW EXECUTE FUNCTION martins_hml_v1.nfe_auditar();
CREATE FUNCTION martins_hml_v1.nfe_conferir_pedido(e uuid,p uuid,revisao bigint,origens uuid[],motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old martins_hml_v1.nfe_pedidos%ROWTYPE; f uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(e::text||'financeiro_usuario',0));
 IF NOT martins_hml_v1.fin_master(e) OR NOT martins_hml_v1.permitido(e,'estoque',true) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
 SELECT * INTO old FROM martins_hml_v1.nfe_pedidos WHERE empresa_id=e AND id=p FOR UPDATE;
 IF NOT FOUND OR old.versao IS DISTINCT FROM revisao THEN RAISE EXCEPTION 'Conflito de versão' USING ERRCODE='40001';END IF;
 IF motivo IS NULL OR length(trim(motivo)) NOT BETWEEN 1 AND 1000 OR origens IS NULL THEN RAISE EXCEPTION 'Identificação e justificativa obrigatórias';END IF;
 FOREACH f IN ARRAY origens LOOP IF f IS NULL OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND id=f AND estado='pendente_conferencia') THEN RAISE EXCEPTION 'Obrigação existente inválida';END IF;END LOOP;
 UPDATE martins_hml_v1.nfe_pedidos SET conferido=true,versao=versao+1,obrigacoes_existentes=origens WHERE empresa_id=e AND id=p;
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,antes,depois) VALUES(e,auth.uid(),'conferencia_pedido_nfe',p,to_jsonb(old),jsonb_build_object('motivo',motivo,'origens',origens,'legado_sem_entrada_automatica',old.legado_entregue));
END $$;
CREATE FUNCTION martins_hml_v1.nfe_integrar(e uuid,chave_nfe text,dep uuid,itens_recebidos jsonb,vinculos jsonb,documento text,op uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n martins_hml_v1.nfe_notas%ROWTYPE;p martins_hml_v1.nfe_pedidos%ROWTYPE;old_op martins_hml_v1.nfe_operacoes%ROWTYPE;
 req jsonb;res jsonb;item jsonb;original jsonb;pedido_item jsonb;parcela jsonb;link jsonb;f martins_hml_v1.fin_lancamentos%ROWTYPE;
 produto uuid;qty numeric;received numeric;total bigint:=0;fin_id uuid;v_numero text;ids uuid[]:='{}';seen text[]:='{}';qpedido numeric;acumulados jsonb:='{}';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(e::text||'financeiro_usuario',0));
 IF NOT martins_hml_v1.fin_master(e) OR NOT martins_hml_v1.permitido(e,'estoque',true) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM martins_hml_v1.ambiente WHERE tipo='homologacao') THEN RAISE EXCEPTION 'Somente homologação';END IF;
 IF dep IS NULL OR op IS NULL OR documento IS NULL OR length(trim(documento)) NOT BETWEEN 1 AND 200 OR jsonb_typeof(itens_recebidos) IS DISTINCT FROM 'array' OR jsonb_array_length(itens_recebidos) NOT BETWEEN 1 AND 200 OR jsonb_typeof(vinculos) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Conferência inválida';END IF;
 IF jsonb_array_length(vinculos)>200 OR (SELECT count(DISTINCT v->>'numero') FROM jsonb_array_elements(vinculos) v)<>jsonb_array_length(vinculos) THEN RAISE EXCEPTION 'Vínculos repetidos ou inválidos';END IF;
 req:=jsonb_build_object('chave',chave_nfe,'deposito',dep,'itens',itens_recebidos,'vinculos',vinculos,'documento',documento);
 SELECT * INTO old_op FROM martins_hml_v1.nfe_operacoes WHERE empresa_id=e AND id=op;
 IF FOUND THEN IF old_op.autor<>auth.uid() OR old_op.requisicao<>req THEN RAISE EXCEPTION 'Operação reutilizada' USING ERRCODE='23505';END IF;RETURN old_op.resposta;END IF;
 SELECT * INTO n FROM martins_hml_v1.nfe_notas WHERE empresa_id=e AND chave=chave_nfe FOR UPDATE;
 IF NOT FOUND OR NOT n.xsd_valido OR NOT n.assinatura_valida OR NOT(n.confianca_aprovada OR n.teste_sintetico) THEN RAISE EXCEPTION 'Validação de servidor ausente; assinatura/XSD/confiança pendentes';END IF;
 IF n.situacao IN ('cancelada','denegada') OR n.finalidade<>'normal' THEN RAISE EXCEPTION 'Situação/finalidade exige fluxo fiscal específico; nenhum efeito automático';END IF;
 SELECT * INTO p FROM martins_hml_v1.nfe_pedidos WHERE empresa_id=e AND id=n.pedido_id FOR UPDATE;
 IF NOT FOUND OR NOT p.conferido OR p.fornecedor<>n.fornecedor THEN RAISE EXCEPTION 'Pedido/fornecedor ainda não conferido';END IF;
 IF NOT EXISTS(SELECT 1 FROM martins_hml_v1.nfe_depositos WHERE empresa_id=e AND id=dep AND ativo) THEN RAISE EXCEPTION 'Depósito indisponível';END IF;
 IF (SELECT count(DISTINCT v->>'produtoId') FROM jsonb_array_elements(p.itens) v)<>jsonb_array_length(p.itens) OR (SELECT count(DISTINCT v->>'nItem') FROM jsonb_array_elements(n.itens) v)<>jsonb_array_length(n.itens) THEN RAISE EXCEPTION 'Itens ambíguos; reconferir mapeamento';END IF;
 IF p.legado_entregue THEN RAISE EXCEPTION 'Pedido legado entregue não permite entrada retroativa automática';END IF;
 -- Todo recebimento vincula item NF-e ao produto/unidade/limite previamente conferidos do pedido.
 FOR item IN SELECT value FROM jsonb_array_elements(itens_recebidos) LOOP
 IF item->>'nItem'=ANY(seen) OR NOT COALESCE(item->>'quantidade','')~'^[0-9]+(\.[0-9]{1,6})?$' THEN RAISE EXCEPTION 'Item repetido ou quantidade inválida';END IF;
 seen:=array_append(seen,item->>'nItem');qty:=(item->>'quantidade')::numeric;IF qty<=0 THEN RAISE EXCEPTION 'Quantidade inválida';END IF;
 SELECT value INTO original FROM jsonb_array_elements(n.itens) WHERE value->>'nItem'=item->>'nItem';
 SELECT value INTO pedido_item FROM jsonb_array_elements(p.itens) WHERE value->>'produtoId'=original->>'produtoId';
 IF original IS NULL OR pedido_item IS NULL OR original->>'unidade'<>pedido_item->>'unidade' THEN RAISE EXCEPTION 'Produto/unidade divergente';END IF;
 produto:=(original->>'produtoId')::uuid;IF NOT EXISTS(SELECT 1 FROM martins_hml_v1.nfe_produtos WHERE empresa_id=e AND id=produto AND ativo AND unidade=original->>'unidade') THEN RAISE EXCEPTION 'Produto/unidade indisponível no catálogo';END IF;
 SELECT COALESCE(sum((x.value->>'quantidade')::numeric),0) INTO received FROM martins_hml_v1.nfe_recebimentos r CROSS JOIN LATERAL jsonb_array_elements(r.itens) x WHERE r.empresa_id=e AND r.chave=chave_nfe AND x.value->>'nItem'=item->>'nItem';
 IF received+qty>(original->>'quantidade')::numeric THEN RAISE EXCEPTION 'Recebimento acima da quantidade da nota';END IF;
 SELECT COALESCE(sum((x.value->>'quantidade')::numeric),0) INTO qpedido FROM martins_hml_v1.nfe_recebimentos r CROSS JOIN LATERAL jsonb_array_elements(r.itens) x JOIN martins_hml_v1.nfe_notas nn ON nn.empresa_id=r.empresa_id AND nn.chave=r.chave WHERE r.empresa_id=e AND r.pedido_id=p.id AND EXISTS(SELECT 1 FROM jsonb_array_elements(nn.itens) ni WHERE ni->>'nItem'=x.value->>'nItem' AND ni->>'produtoId'=produto::text);
 IF qpedido+COALESCE((acumulados->>produto::text)::numeric,0)+qty>(pedido_item->>'quantidade')::numeric THEN RAISE EXCEPTION 'Recebimento acima do pedido';END IF;
 acumulados:=jsonb_set(acumulados,ARRAY[produto::text],to_jsonb(COALESCE((acumulados->>produto::text)::numeric,0)+qty));
 INSERT INTO martins_hml_v1.nfe_saldos VALUES(e,produto,dep,qty) ON CONFLICT(empresa_id,produto_id,deposito_id) DO UPDATE SET quantidade=nfe_saldos.quantidade+qty;
 END LOOP;
 -- Falha em qualquer parcela abaixo reverte também estoque e recebimento na mesma transação.
 seen:='{}';
 IF jsonb_array_length(n.parcelas)=0 THEN RAISE EXCEPTION 'Parcelas devem ser conferidas; não inventar vencimentos';END IF;
 FOR parcela IN SELECT value FROM jsonb_array_elements(n.parcelas) LOOP
 v_numero:=parcela->>'numero';IF v_numero IS NULL OR v_numero='' OR v_numero=ANY(seen) OR NOT COALESCE(parcela->>'valorCentavos','')~'^[0-9]+$' THEN RAISE EXCEPTION 'Parcela inválida/repetida';END IF;
 seen:=array_append(seen,v_numero);IF (parcela->>'valorCentavos')::numeric NOT BETWEEN 1 AND 9007199254740991 THEN RAISE EXCEPTION 'Valor de parcela inválido';END IF;
 PERFORM (parcela->>'vencimento')::date;total:=total+(parcela->>'valorCentavos')::bigint;
 SELECT lancamento_id INTO fin_id FROM martins_hml_v1.nfe_parcelas WHERE empresa_id=e AND chave=chave_nfe AND nfe_parcelas.numero=v_numero;
 IF FOUND THEN SELECT * INTO f FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND id=fin_id;IF f.estado NOT IN ('pendente_conferencia','conferido') OR (f.dados->>'valor_centavos')::bigint<>(parcela->>'valorCentavos')::bigint OR f.dados->>'vencimento'<>parcela->>'vencimento' OR f.dados->>'fornecedor'<>n.fornecedor THEN RAISE EXCEPTION 'Parcela vinculada alterada ou bloqueada; reconferir';END IF;ids:=array_append(ids,fin_id);CONTINUE;END IF;
 SELECT value INTO link FROM jsonb_array_elements(vinculos) WHERE value->>'numero'=v_numero;
 IF link IS NOT NULL THEN
 fin_id:=(link->>'lancamentoId')::uuid;SELECT * INTO f FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND id=fin_id;
 IF NOT FOUND OR NOT fin_id=ANY(p.obrigacoes_existentes) OR f.estado<>'pendente_conferencia' OR f.dados->>'fornecedor'<>n.fornecedor OR (f.dados->>'valor_centavos')::bigint<>(parcela->>'valorCentavos')::bigint OR f.dados->>'vencimento'<>parcela->>'vencimento' THEN RAISE EXCEPTION 'Obrigação existente diverge da parcela';END IF;
 ELSE
 IF cardinality(p.obrigacoes_existentes)>0 OR EXISTS(SELECT 1 FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND NOT(id=ANY(ids)) AND dados->>'fornecedor'=n.fornecedor AND dados->>'documento_numero' IN (n.chave,p.id::text,nullif(n.numero,''),nullif(p.referencia_origem,''))) THEN RAISE EXCEPTION 'Conferir vínculo com obrigação preexistente antes de criar outra';END IF;
 fin_id:=gen_random_uuid();PERFORM martins_hml_v1.fin_salvar(e,fin_id,0,jsonb_build_object('tipo','nota_fiscal','descricao','NF-e '||n.chave||' parcela '||v_numero,'valor_centavos',(parcela->>'valorCentavos')::bigint,'data',n.data_emissao::text,'vencimento',parcela->>'vencimento','fornecedor',n.fornecedor,'documento_numero',n.chave),gen_random_uuid());
 END IF;
 INSERT INTO martins_hml_v1.nfe_parcelas VALUES(e,n.chave,v_numero,fin_id);ids:=array_append(ids,fin_id);
 END LOOP;
 IF total<>n.valor_centavos THEN RAISE EXCEPTION 'Parcelas divergem do total da nota';END IF;
 INSERT INTO martins_hml_v1.nfe_recebimentos(empresa_id,id,chave,pedido_id,deposito_id,autor,itens,documento) VALUES(e,op,n.chave,p.id,dep,auth.uid(),itens_recebidos,documento);
 res:=jsonb_build_object('recebimento',op,'parcelas',ids,'estado','pendente_conferencia','pagamento',false,'teste_sintetico',n.teste_sintetico,'situacao_fiscal',n.situacao,'consulta_oficial',n.consulta_oficial,'sha256',n.sha256);
 INSERT INTO martins_hml_v1.nfe_operacoes VALUES(e,op,auth.uid(),req,res);
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,depois) VALUES(e,auth.uid(),'nfe_recebimento_parcelas_pendentes',op,res);
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.nfe_conferir_pedido(uuid,uuid,bigint,uuid[],text),martins_hml_v1.nfe_integrar(uuid,text,uuid,jsonb,jsonb,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.nfe_conferir_pedido(uuid,uuid,bigint,uuid[],text),martins_hml_v1.nfe_integrar(uuid,text,uuid,jsonb,jsonb,text,uuid) TO authenticated;
COMMIT;
