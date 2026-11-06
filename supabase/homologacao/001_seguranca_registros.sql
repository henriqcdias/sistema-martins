-- SOMENTE ambiente separado de homologação. Não aplicar no banco existente sem inventário.
-- Contrato isolado; não recria public.martins_perfis ou martins_empresa_autorizada.
BEGIN;
CREATE SCHEMA martins_hml_v1;
REVOKE ALL ON SCHEMA martins_hml_v1 FROM PUBLIC;
GRANT USAGE ON SCHEMA martins_hml_v1 TO authenticated;
CREATE TABLE martins_hml_v1.membros (
 empresa_id uuid NOT NULL, usuario_id uuid NOT NULL, papel text NOT NULL
 CHECK (papel IN ('administrador','rh','financeiro','engenharia','estoque','leitor')),
 ativo boolean NOT NULL DEFAULT false, permissoes jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(permissoes)='object'),
 PRIMARY KEY(empresa_id,usuario_id)
);
CREATE TABLE martins_hml_v1.registros (
 empresa_id uuid NOT NULL, modulo text NOT NULL CHECK(modulo IN ('funcionarios','frequencia','documentos','financeiro','remuneracao','vales','obras','estoque','epis','orcamentos','rdo')),
 id uuid NOT NULL, versao bigint NOT NULL CHECK(versao>0), dados jsonb NOT NULL CHECK(jsonb_typeof(dados)='object'),
 atualizado_por uuid NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,modulo,id)
);
CREATE TABLE martins_hml_v1.auditoria (
 empresa_id uuid NOT NULL, operacao_id uuid NOT NULL, usuario_id uuid NOT NULL,
 modulo text NOT NULL, registro_id uuid NOT NULL, versao_anterior bigint NOT NULL, versao_nova bigint NOT NULL,
 campos text[] NOT NULL, em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,operacao_id)
);
-- Resposta idempotente restrita a RPC. Sem acesso direto por usuários.
CREATE TABLE martins_hml_v1.operacoes (
 empresa_id uuid NOT NULL, id uuid NOT NULL, usuario_id uuid NOT NULL, modulo text NOT NULL,
 registro_id uuid NOT NULL, versao_esperada bigint NOT NULL, dados jsonb NOT NULL, resposta jsonb NOT NULL,
 PRIMARY KEY(empresa_id,id)
);
CREATE FUNCTION martins_hml_v1.permitido(p_empresa uuid,p_modulo text,p_escrita boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM martins_hml_v1.membros m
 WHERE m.empresa_id=p_empresa AND m.usuario_id=(SELECT auth.uid()) AND m.ativo
 AND p_modulo IN ('funcionarios','frequencia','documentos','financeiro','remuneracao','vales','obras','estoque','epis','orcamentos','rdo')
 AND COALESCE(m.permissoes->p_modulo,'true'::jsonb)='true'::jsonb
 AND (m.papel='administrador'
 OR m.papel='rh' AND (p_modulo IN ('funcionarios','frequencia','documentos') OR NOT p_escrita AND p_modulo='obras')
 OR m.papel='financeiro' AND (p_modulo IN ('financeiro','remuneracao','vales') OR NOT p_escrita AND p_modulo IN ('frequencia','obras'))
 OR m.papel='engenharia' AND p_modulo IN ('obras','rdo','frequencia')
 OR m.papel='estoque' AND (p_modulo IN ('estoque','epis') OR NOT p_escrita AND p_modulo='obras')
 OR m.papel='leitor' AND NOT p_escrita AND p_modulo IN ('obras','rdo')))
$$;
REVOKE ALL ON FUNCTION martins_hml_v1.permitido(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.permitido(uuid,text,boolean) TO authenticated;
ALTER TABLE martins_hml_v1.membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.membros FORCE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.registros FORCE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.auditoria FORCE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.operacoes FORCE ROW LEVEL SECURITY;
CREATE POLICY perfil_proprio ON martins_hml_v1.membros FOR SELECT TO authenticated USING(usuario_id=(SELECT auth.uid()));
CREATE POLICY registros_por_modulo ON martins_hml_v1.registros FOR SELECT TO authenticated USING(martins_hml_v1.permitido(empresa_id,modulo,false));
CREATE POLICY auditoria_restrita ON martins_hml_v1.auditoria FOR SELECT TO authenticated USING(martins_hml_v1.permitido(empresa_id,modulo,false));
REVOKE ALL ON ALL TABLES IN SCHEMA martins_hml_v1 FROM PUBLIC, authenticated;
GRANT SELECT ON martins_hml_v1.membros,martins_hml_v1.registros,martins_hml_v1.auditoria TO authenticated;
CREATE FUNCTION martins_hml_v1.salvar_registro(p_empresa uuid,p_modulo text,p_id uuid,p_versao bigint,p_dados jsonb,p_operacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_atual bigint; v_resposta jsonb; v_operacao martins_hml_v1.operacoes%ROWTYPE;
BEGIN
 IF v_uid IS NULL OR NOT martins_hml_v1.permitido(p_empresa,p_modulo,true) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF p_empresa IS NULL OR p_id IS NULL OR p_operacao IS NULL OR p_versao IS NULL OR p_versao<0
 OR p_dados IS NULL OR jsonb_typeof(p_dados)<>'object' OR octet_length(p_dados::text)>262144
 THEN RAISE EXCEPTION 'Registro inválido' USING ERRCODE='22023'; END IF;
 -- O contrato genérico não pode registrar pagamento nem aprovar exceção de vales.
 IF p_modulo IN ('financeiro','remuneracao','vales') THEN
 RAISE EXCEPTION 'Escrita financeira exige comando de negócio específico; indisponível nesta homologação' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_empresa::text||p_modulo||p_id::text,0));
 SELECT * INTO v_operacao FROM martins_hml_v1.operacoes WHERE empresa_id=p_empresa AND id=p_operacao;
 IF FOUND THEN
  IF v_operacao.usuario_id<>v_uid OR v_operacao.modulo<>p_modulo OR v_operacao.registro_id<>p_id OR v_operacao.versao_esperada<>p_versao OR v_operacao.dados<>p_dados
  THEN RAISE EXCEPTION 'Operação reutilizada com outros dados' USING ERRCODE='23505'; END IF;
  RETURN v_operacao.resposta;
 END IF;
 SELECT versao INTO v_atual FROM martins_hml_v1.registros WHERE empresa_id=p_empresa AND modulo=p_modulo AND id=p_id FOR UPDATE;
 IF COALESCE(v_atual,0)<>p_versao THEN RAISE EXCEPTION 'Conflito de versão; recarregue antes de salvar' USING ERRCODE='40001'; END IF;
 IF p_versao>=9007199254740991 THEN RAISE EXCEPTION 'Limite de versão atingido' USING ERRCODE='22023'; END IF;
 INSERT INTO martins_hml_v1.registros(empresa_id,modulo,id,versao,dados,atualizado_por)
 VALUES(p_empresa,p_modulo,p_id,p_versao+1,p_dados,v_uid)
 ON CONFLICT(empresa_id,modulo,id) DO UPDATE SET versao=excluded.versao,dados=excluded.dados,atualizado_por=v_uid,atualizado_em=now();
 v_resposta:=jsonb_build_object('empresa_id',p_empresa,'modulo',p_modulo,'id',p_id,'versao',p_versao+1,'dados',p_dados);
 INSERT INTO martins_hml_v1.auditoria(empresa_id,operacao_id,usuario_id,modulo,registro_id,versao_anterior,versao_nova,campos)
 VALUES(p_empresa,p_operacao,v_uid,p_modulo,p_id,p_versao,p_versao+1,ARRAY(SELECT jsonb_object_keys(p_dados)));
 INSERT INTO martins_hml_v1.operacoes VALUES(p_empresa,p_operacao,v_uid,p_modulo,p_id,p_versao,p_dados,v_resposta);
 RETURN v_resposta;
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.salvar_registro(uuid,text,uuid,bigint,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.salvar_registro(uuid,text,uuid,bigint,jsonb,uuid) TO authenticated;
COMMIT;
