-- Contratos v13: BACKUP E RESTAURAÇÃO da empresa. Escrito à mão; pré-requisito: producao..v12 aplicadas.
-- Complementa (não substitui) os backups do próprio Supabase: é uma cópia lógica, em JSON, feita pelo Master.
--  * EXPORTAR (Master): todos os registros da empresa (todos os módulos, inclusive despesas confidenciais), com contagem por
--    módulo e um checksum dos registros e revisões. Fica registrado na auditoria. O arquivo tem dados pessoais e sigilosos.
--  * RESTAURAR (Master): só em empresa VAZIA (nunca sobrescreve nem mistura). Confere formato, contagem e checksum; tudo ou
--    nada. Preserva ids, revisões e datas; reescreve o id da empresa dentro dos dados; autor que não existe mais vira quem
--    restaura. NÃO restaura: histórico de auditoria, permissões de usuários e operações já processadas (isso é da conta/empresa).
--  * O saldo de estoque é derivado dos movimentos, portanto volta junto. A restauração confia no conteúdo do arquivo (é do Master)
--    e não repete as validações de cada módulo; o checksum protege contra arquivo incompleto ou alterado em registros/revisões.
BEGIN;

CREATE FUNCTION public.martins_producao_backup_exportar(e uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE regs jsonb; total int; resumo jsonb; chk text;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('modulo',r.modulo,'id',r.id,'revisao',r.revisao,'dados',r.dados,'criado_por',r.criado_por,'atualizado_por',r.atualizado_por,'criado_em',r.criado_em,'atualizado_em',r.atualizado_em) ORDER BY r.modulo,r.id),'[]'::jsonb)
  INTO regs FROM martins_producao_v1.registros r WHERE r.empresa_id=e;
 total := jsonb_array_length(regs);
 SELECT COALESCE(jsonb_object_agg(t.m,t.n),'{}'::jsonb) INTO resumo FROM (SELECT x->>'modulo' m, count(*) n FROM jsonb_array_elements(regs) x GROUP BY 1) t;
 SELECT md5(COALESCE(string_agg((x->>'modulo')||':'||(x->>'id')||':'||(x->>'revisao'),',' ORDER BY ord),'')) INTO chk FROM jsonb_array_elements(regs) WITH ORDINALITY AS t(x,ord);
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'backup',gen_random_uuid(),auth.uid(),gen_random_uuid(),'criar',NULL,jsonb_build_object('acao','exportar','total',total,'checksum',chk));
 RETURN jsonb_build_object('formato','martins-backup','versao_formato',1,'gerado_em',now(),'empresa_origem',e,'total',total,'por_modulo',resumo,'checksum',chk,'registros',regs);
END $$;

CREATE FUNCTION public.martins_producao_backup_importar(e uuid, op uuid, backup jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; regs jsonb; total int; chk text; resposta jsonb; inseridos int;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR jsonb_typeof(backup) IS DISTINCT FROM 'object' OR backup->>'formato' IS DISTINCT FROM 'martins-backup' OR backup->>'versao_formato' IS DISTINCT FROM '1' OR jsonb_typeof(backup->'registros') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Arquivo de backup inválido ou de formato desconhecido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','backup_importar','e',e,'chk',backup->>'checksum','t',backup->>'total');
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'backup-restaurar',0));
 IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE empresa_id=e) THEN RAISE EXCEPTION 'Esta empresa já tem dados: a restauração só é permitida em empresa vazia (nada foi alterado)' USING ERRCODE='22023'; END IF;
 regs := backup->'registros'; total := jsonb_array_length(regs);
 IF total < 1 OR total > 200000 OR total IS DISTINCT FROM (backup->>'total')::int THEN RAISE EXCEPTION 'Backup incompleto: a quantidade de registros não confere com o cabeçalho' USING ERRCODE='22023'; END IF;
 SELECT md5(COALESCE(string_agg((x->>'modulo')||':'||(x->>'id')||':'||(x->>'revisao'),',' ORDER BY ord),'')) INTO chk FROM jsonb_array_elements(regs) WITH ORDINALITY AS t(x,ord);
 IF chk IS DISTINCT FROM backup->>'checksum' THEN RAISE EXCEPTION 'Backup alterado ou corrompido: o checksum dos registros não confere (nada foi restaurado)' USING ERRCODE='22023'; END IF;
 INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por,criado_em,atualizado_em)
  SELECT e, x.modulo, x.id, x.revisao,
         (x.dados - 'empresa_id' - 'empresaId') || CASE WHEN x.dados ? 'empresa_id' THEN jsonb_build_object('empresa_id',e) ELSE '{}'::jsonb END || CASE WHEN x.dados ? 'empresaId' THEN jsonb_build_object('empresaId',e) ELSE '{}'::jsonb END,
         CASE WHEN EXISTS(SELECT 1 FROM auth.users u WHERE u.id=x.criado_por) THEN x.criado_por ELSE auth.uid() END,
         CASE WHEN EXISTS(SELECT 1 FROM auth.users u WHERE u.id=x.atualizado_por) THEN x.atualizado_por ELSE auth.uid() END,
         COALESCE(x.criado_em,now()), COALESCE(x.atualizado_em,now())
  FROM jsonb_to_recordset(regs) AS x(modulo text,id uuid,revisao bigint,dados jsonb,criado_por uuid,atualizado_por uuid,criado_em timestamptz,atualizado_em timestamptz);
 GET DIAGNOSTICS inseridos = ROW_COUNT;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'backup',gen_random_uuid(),auth.uid(),op,'criar',NULL,jsonb_build_object('acao','restaurar','total',inseridos,'checksum',chk,'empresa_origem',backup->>'empresa_origem','gerado_em',backup->>'gerado_em'));
 resposta := jsonb_build_object('empresa_id',e,'total',inseridos,'checksum',chk);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_backup_exportar(uuid), public.martins_producao_backup_importar(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_backup_exportar(uuid), public.martins_producao_backup_importar(uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
