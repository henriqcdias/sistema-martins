-- Etapa aditiva: somente homologação isolada, após 001..005. Sem pagamento ou conciliação.
BEGIN;
ALTER TABLE martins_hml_v1.membros DROP CONSTRAINT membros_papel_check;
ALTER TABLE martins_hml_v1.membros ADD CONSTRAINT membros_papel_check CHECK(papel IN ('administrador','rh','financeiro','engenharia','estoque','leitor','lancador_financeiro'));
CREATE TABLE martins_hml_v1.fin_contas (
 empresa_id uuid NOT NULL, id uuid NOT NULL, nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 200), ativo boolean NOT NULL DEFAULT true,
 PRIMARY KEY(empresa_id,id)
);
CREATE TABLE martins_hml_v1.fin_saldos (
 empresa_id uuid NOT NULL, conta_id uuid NOT NULL, saldo_centavos bigint NOT NULL,
 PRIMARY KEY(empresa_id,conta_id), FOREIGN KEY(empresa_id,conta_id) REFERENCES martins_hml_v1.fin_contas(empresa_id,id)
);
CREATE TABLE martins_hml_v1.fin_acessos_contas (
 empresa_id uuid NOT NULL, conta_id uuid NOT NULL, usuario_id uuid NOT NULL,
 usar boolean NOT NULL DEFAULT false, movimentos_proprios boolean NOT NULL DEFAULT true,
 todos_movimentos boolean NOT NULL DEFAULT false, saldo boolean NOT NULL DEFAULT false,
 PRIMARY KEY(empresa_id,conta_id,usuario_id),
 FOREIGN KEY(empresa_id,conta_id) REFERENCES martins_hml_v1.fin_contas(empresa_id,id),
 FOREIGN KEY(empresa_id,usuario_id) REFERENCES martins_hml_v1.membros(empresa_id,usuario_id)
);
CREATE TABLE martins_hml_v1.fin_lancamentos (
 empresa_id uuid NOT NULL, id uuid NOT NULL, criado_por uuid NOT NULL, versao bigint NOT NULL CHECK(versao>0),
 estado text NOT NULL DEFAULT 'pendente_conferencia' CHECK(estado IN ('pendente_conferencia','conferido','bloqueado','cancelado')),
 conta_id uuid, dados jsonb NOT NULL CHECK(jsonb_typeof(dados)='object'), criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,id), FOREIGN KEY(empresa_id,conta_id) REFERENCES martins_hml_v1.fin_contas(empresa_id,id),
 FOREIGN KEY(empresa_id,criado_por) REFERENCES martins_hml_v1.membros(empresa_id,usuario_id)
);
CREATE TABLE martins_hml_v1.fin_compartilhamentos (
 empresa_id uuid NOT NULL, lancamento_id uuid NOT NULL, usuario_id uuid NOT NULL, visualizar boolean NOT NULL, editar boolean NOT NULL CHECK(NOT editar OR visualizar),
 PRIMARY KEY(empresa_id,lancamento_id,usuario_id), FOREIGN KEY(empresa_id,lancamento_id) REFERENCES martins_hml_v1.fin_lancamentos(empresa_id,id),
 FOREIGN KEY(empresa_id,usuario_id) REFERENCES martins_hml_v1.membros(empresa_id,usuario_id)
);
CREATE TABLE martins_hml_v1.fin_auditoria (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, empresa_id uuid NOT NULL, autor uuid NOT NULL, acao text NOT NULL,
 alvo uuid NOT NULL, antes jsonb, depois jsonb, em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE martins_hml_v1.fin_operacoes (
 empresa_id uuid NOT NULL, id uuid NOT NULL, autor uuid NOT NULL, requisicao jsonb NOT NULL, resposta jsonb NOT NULL, PRIMARY KEY(empresa_id,id)
);
CREATE FUNCTION martins_hml_v1.fin_membro(e uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM martins_hml_v1.membros m WHERE m.empresa_id=e AND m.usuario_id=auth.uid() AND m.ativo AND m.papel IN ('administrador','financeiro','lancador_financeiro') AND COALESCE(m.permissoes->'financeiro','true'::jsonb)='true'::jsonb)
$$;
CREATE FUNCTION martins_hml_v1.fin_master(e uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT martins_hml_v1.fin_membro(e) AND EXISTS(SELECT 1 FROM martins_hml_v1.membros WHERE empresa_id=e AND usuario_id=auth.uid() AND papel='administrador')
$$;
CREATE FUNCTION martins_hml_v1.fin_pode(e uuid,l uuid,escrever boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT martins_hml_v1.fin_membro(e) AND EXISTS(SELECT 1 FROM martins_hml_v1.fin_lancamentos r WHERE r.empresa_id=e AND r.id=l
 AND (NOT escrever OR r.estado='pendente_conferencia')
 AND (martins_hml_v1.fin_master(e) OR
 (r.criado_por=auth.uid() OR EXISTS(SELECT 1 FROM martins_hml_v1.fin_compartilhamentos c WHERE c.empresa_id=e AND c.lancamento_id=l AND c.usuario_id=auth.uid() AND CASE WHEN escrever THEN c.editar ELSE c.visualizar END))
 AND (r.conta_id IS NULL OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.fin_acessos_contas a WHERE a.empresa_id=e AND a.conta_id=r.conta_id AND a.usuario_id=auth.uid() AND NOT a.movimentos_proprios))
 OR NOT escrever AND EXISTS(SELECT 1 FROM martins_hml_v1.fin_acessos_contas a WHERE a.empresa_id=e AND a.conta_id=r.conta_id AND a.usuario_id=auth.uid() AND a.todos_movimentos)))
$$;
CREATE FUNCTION martins_hml_v1.fin_conta_permitida(e uuid,c uuid,uso boolean DEFAULT false,ver_saldo boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT martins_hml_v1.fin_membro(e) AND EXISTS(SELECT 1 FROM martins_hml_v1.fin_contas x WHERE x.empresa_id=e AND x.id=c AND (NOT uso OR x.ativo))
 AND (martins_hml_v1.fin_master(e) OR EXISTS(SELECT 1 FROM martins_hml_v1.fin_acessos_contas a WHERE a.empresa_id=e AND a.conta_id=c AND a.usuario_id=auth.uid() AND CASE WHEN uso THEN a.usar WHEN ver_saldo THEN a.saldo ELSE a.usar OR a.movimentos_proprios OR a.todos_movimentos OR a.saldo END)
 OR NOT uso AND NOT ver_saldo AND EXISTS(SELECT 1 FROM martins_hml_v1.fin_lancamentos r WHERE r.empresa_id=e AND r.conta_id=c AND martins_hml_v1.fin_pode(e,r.id,false)))
$$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['fin_contas','fin_saldos','fin_acessos_contas','fin_lancamentos','fin_compartilhamentos','fin_auditoria','fin_operacoes'] LOOP
 EXECUTE format('ALTER TABLE martins_hml_v1.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE martins_hml_v1.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON martins_hml_v1.%I FROM PUBLIC,authenticated',t);
 END LOOP; END $$;
GRANT SELECT ON martins_hml_v1.fin_contas,martins_hml_v1.fin_saldos,martins_hml_v1.fin_acessos_contas,martins_hml_v1.fin_lancamentos,martins_hml_v1.fin_compartilhamentos,martins_hml_v1.fin_auditoria TO authenticated;
CREATE POLICY fin_contas_read ON martins_hml_v1.fin_contas FOR SELECT TO authenticated USING(martins_hml_v1.fin_conta_permitida(empresa_id,id));
CREATE POLICY fin_saldos_read ON martins_hml_v1.fin_saldos FOR SELECT TO authenticated USING(martins_hml_v1.fin_conta_permitida(empresa_id,conta_id,false,true));
CREATE POLICY fin_acessos_read ON martins_hml_v1.fin_acessos_contas FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id) OR usuario_id=auth.uid() AND martins_hml_v1.fin_membro(empresa_id));
CREATE POLICY fin_lancamentos_read ON martins_hml_v1.fin_lancamentos FOR SELECT TO authenticated USING(martins_hml_v1.fin_pode(empresa_id,id));
CREATE POLICY fin_shares_read ON martins_hml_v1.fin_compartilhamentos FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id) OR usuario_id=auth.uid() AND martins_hml_v1.fin_membro(empresa_id));
CREATE POLICY fin_audit_read ON martins_hml_v1.fin_auditoria FOR SELECT TO authenticated USING(martins_hml_v1.fin_master(empresa_id));
CREATE FUNCTION martins_hml_v1.fin_salvar(e uuid,l uuid,revisao bigint,d jsonb,op uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r martins_hml_v1.fin_lancamentos%ROWTYPE; o martins_hml_v1.fin_operacoes%ROWTYPE; req jsonb; result jsonb; conta uuid;
BEGIN
 IF NOT martins_hml_v1.fin_membro(e) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF l IS NULL OR op IS NULL OR revisao IS NULL OR revisao<0 OR revisao>=9007199254740991 OR d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>16384 THEN RAISE EXCEPTION 'Lançamento inválido' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('tipo','descricao','valor_centavos','data','vencimento','conta_id','documento_numero','fornecedor'))
 OR COALESCE(d->>'tipo','') NOT IN ('despesa','nota_fiscal') OR jsonb_typeof(d->'descricao') IS DISTINCT FROM 'string' OR length(trim(d->>'descricao')) NOT BETWEEN 1 AND 1000
 OR jsonb_typeof(d->'valor_centavos') IS DISTINCT FROM 'number' OR NOT COALESCE(d->>'valor_centavos','')~'^[0-9]{1,16}$' THEN RAISE EXCEPTION 'Campos financeiros inválidos' USING ERRCODE='22023'; END IF;
 IF (d->>'valor_centavos')::numeric NOT BETWEEN 1 AND 9007199254740991 THEN RAISE EXCEPTION 'Valor inválido' USING ERRCODE='22023'; END IF;
 IF NOT COALESCE(d->>'data','')~'^\d{4}-\d{2}-\d{2}$' OR (d->>'data')::date>current_date OR to_char((d->>'data')::date,'YYYY-MM-DD')<>d->>'data' THEN RAISE EXCEPTION 'Data inválida'; END IF;
 IF d ? 'vencimento' AND d->>'vencimento'<>'' THEN PERFORM (d->>'vencimento')::date; END IF;
 conta:=nullif(d->>'conta_id','')::uuid;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'financeiro_usuario',0));
 IF NOT martins_hml_v1.fin_membro(e) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND id=l;
 IF FOUND AND NOT martins_hml_v1.fin_pode(e,l,true) THEN RAISE EXCEPTION 'Lançamento não editável ou não autorizado' USING ERRCODE='42501'; END IF;
 req:=jsonb_build_object('id',l,'versao',revisao,'dados',d);
 SELECT * INTO o FROM martins_hml_v1.fin_operacoes WHERE empresa_id=e AND id=op;
 IF FOUND THEN IF o.autor<>auth.uid() OR o.requisicao<>req THEN RAISE EXCEPTION 'Operação reutilizada' USING ERRCODE='23505'; END IF; RETURN o.resposta; END IF;
 IF COALESCE(r.versao,0)<>revisao THEN RAISE EXCEPTION 'Conflito de versão' USING ERRCODE='40001'; END IF;
 IF conta IS NOT NULL AND NOT martins_hml_v1.fin_conta_permitida(e,conta,true) THEN RAISE EXCEPTION 'Conta não autorizada para uso' USING ERRCODE='42501'; END IF;
 -- Estado e autoria são determinados pelo servidor, nunca pelo payload ou perfil local.
 INSERT INTO martins_hml_v1.fin_lancamentos(empresa_id,id,criado_por,versao,conta_id,dados)
 VALUES(e,l,auth.uid(),1,conta,d) ON CONFLICT(empresa_id,id) DO UPDATE SET versao=r.versao+1,conta_id=excluded.conta_id,dados=excluded.dados,atualizado_em=now();
 SELECT to_jsonb(x) INTO result FROM martins_hml_v1.fin_lancamentos x WHERE x.empresa_id=e AND x.id=l;
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,antes,depois) VALUES(e,auth.uid(),CASE WHEN revisao=0 THEN 'criado_pendente' ELSE 'editado_pendente' END,l,to_jsonb(r),result);
 INSERT INTO martins_hml_v1.fin_operacoes VALUES(e,op,auth.uid(),req,result);
 RETURN result;
END $$;
CREATE FUNCTION martins_hml_v1.fin_compartilhar(e uuid,ids uuid[],usuarios uuid[],ver boolean,editar boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l uuid; u uuid; old_value jsonb; n integer:=0;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'financeiro_usuario',0));
 IF NOT martins_hml_v1.fin_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF ver IS NULL OR editar IS NULL OR editar AND NOT ver OR COALESCE(cardinality(ids),0) NOT BETWEEN 1 AND 100 OR COALESCE(cardinality(usuarios),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Compartilhamento inválido'; END IF;
 FOREACH l IN ARRAY ids LOOP
 IF l IS NULL OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND id=l) THEN RAISE EXCEPTION 'Lançamento indisponível'; END IF;
 FOREACH u IN ARRAY usuarios LOOP
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.membros WHERE empresa_id=e AND usuario_id=u AND ativo AND papel IN ('administrador','financeiro','lancador_financeiro')) THEN RAISE EXCEPTION 'Usuário indisponível nesta empresa'; END IF;
 SELECT to_jsonb(c) INTO old_value FROM martins_hml_v1.fin_compartilhamentos c WHERE empresa_id=e AND lancamento_id=l AND usuario_id=u;
 INSERT INTO martins_hml_v1.fin_compartilhamentos VALUES(e,l,u,ver,editar) ON CONFLICT(empresa_id,lancamento_id,usuario_id) DO UPDATE SET visualizar=ver,editar=fin_compartilhar.editar;
 IF old_value IS DISTINCT FROM (SELECT to_jsonb(c) FROM martins_hml_v1.fin_compartilhamentos c WHERE empresa_id=e AND lancamento_id=l AND usuario_id=u) THEN
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,antes,depois) VALUES(e,auth.uid(),'compartilhamento',l,old_value,jsonb_build_object('usuario',u,'visualizar',ver,'editar',editar));n:=n+1;END IF;
 END LOOP; END LOOP; RETURN n;
END $$;
CREATE FUNCTION martins_hml_v1.fin_autorizar_conta(e uuid,c uuid,u uuid,usar boolean,proprios boolean,todos boolean,saldo boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_value jsonb;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'financeiro_usuario',0));
 IF NOT martins_hml_v1.fin_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF usar IS NULL OR proprios IS NULL OR todos IS NULL OR saldo IS NULL OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.fin_contas WHERE empresa_id=e AND id=c) OR NOT EXISTS(SELECT 1 FROM martins_hml_v1.membros WHERE empresa_id=e AND usuario_id=u AND ativo AND papel IN ('administrador','financeiro','lancador_financeiro')) THEN RAISE EXCEPTION 'Conta ou usuário inválido'; END IF;
 SELECT to_jsonb(a) INTO old_value FROM martins_hml_v1.fin_acessos_contas a WHERE empresa_id=e AND conta_id=c AND usuario_id=u;
 INSERT INTO martins_hml_v1.fin_acessos_contas VALUES(e,c,u,usar,proprios,todos,saldo) ON CONFLICT(empresa_id,conta_id,usuario_id) DO UPDATE SET usar=fin_autorizar_conta.usar,movimentos_proprios=proprios,todos_movimentos=todos,saldo=fin_autorizar_conta.saldo;
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,antes,depois) VALUES(e,auth.uid(),'permissao_conta',c,old_value,jsonb_build_object('usuario',u,'usar',usar,'movimentos_proprios',proprios,'todos_movimentos',todos,'saldo',saldo));
END $$;
CREATE FUNCTION martins_hml_v1.fin_conferir(e uuid,l uuid,revisao bigint,estado text,motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r martins_hml_v1.fin_lancamentos%ROWTYPE;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'financeiro_usuario',0));
 IF NOT martins_hml_v1.fin_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF estado IS NULL OR estado NOT IN ('pendente_conferencia','conferido','bloqueado','cancelado') OR motivo IS NULL OR length(trim(motivo)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Conferência inválida'; END IF;
 SELECT * INTO r FROM martins_hml_v1.fin_lancamentos WHERE empresa_id=e AND id=l FOR UPDATE;
 IF NOT FOUND OR r.versao IS DISTINCT FROM revisao THEN RAISE EXCEPTION 'Conflito de versão' USING ERRCODE='40001'; END IF;
 IF r.estado='cancelado' AND estado<>'cancelado' THEN RAISE EXCEPTION 'Lançamento cancelado não pode ser reaberto'; END IF;
 IF r.estado=estado THEN RETURN; END IF;
 UPDATE martins_hml_v1.fin_lancamentos SET estado=fin_conferir.estado,versao=versao+1,atualizado_em=now() WHERE empresa_id=e AND id=l;
 INSERT INTO martins_hml_v1.fin_auditoria(empresa_id,autor,acao,alvo,antes,depois) VALUES(e,auth.uid(),'conferencia',l,jsonb_build_object('estado',r.estado,'versao',r.versao),jsonb_build_object('estado',estado,'motivo',motivo,'versao',r.versao+1));
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.fin_conferir(uuid,uuid,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.fin_conferir(uuid,uuid,bigint,text,text) TO authenticated;
-- Reusa o bucket privado e suas guardas RESTRICTIVE; cada caminho agora exige o lançamento autorizado.
CREATE OR REPLACE FUNCTION martins_hml_v1.documento_financeiro_permitido(p_nome text,p_escrita boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_nome ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/documentos_financeiros/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(pdf|png|jpg)$'
 THEN martins_hml_v1.fin_pode(split_part(p_nome,'/',1)::uuid,split_part(p_nome,'/',3)::uuid,p_escrita) AND EXISTS(SELECT 1 FROM martins_hml_v1.membros WHERE empresa_id=split_part(p_nome,'/',1)::uuid AND usuario_id=auth.uid() AND ativo AND COALESCE(permissoes->'documentos_financeiros','true'::jsonb)='true'::jsonb) ELSE false END
$$;
-- Funções auxiliares também são explicitamente limitadas ao papel autenticado.
REVOKE ALL ON FUNCTION martins_hml_v1.fin_membro(uuid),martins_hml_v1.fin_master(uuid),martins_hml_v1.fin_pode(uuid,uuid,boolean),martins_hml_v1.fin_conta_permitida(uuid,uuid,boolean,boolean),martins_hml_v1.fin_salvar(uuid,uuid,bigint,jsonb,uuid),martins_hml_v1.fin_compartilhar(uuid,uuid[],uuid[],boolean,boolean),martins_hml_v1.fin_autorizar_conta(uuid,uuid,uuid,boolean,boolean,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.fin_membro(uuid),martins_hml_v1.fin_master(uuid),martins_hml_v1.fin_pode(uuid,uuid,boolean),martins_hml_v1.fin_conta_permitida(uuid,uuid,boolean,boolean),martins_hml_v1.fin_salvar(uuid,uuid,bigint,jsonb,uuid),martins_hml_v1.fin_compartilhar(uuid,uuid[],uuid[],boolean,boolean),martins_hml_v1.fin_autorizar_conta(uuid,uuid,uuid,boolean,boolean,boolean,boolean) TO authenticated;
COMMIT;
