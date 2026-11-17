-- GERADO por supabase/v6/gerar_migracao.py. Reverte a v6 (só se não houver consumos/devoluções).
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos' AND dados->>'tipo' IN ('consumo','devolucao_obra')) THEN
  RAISE EXCEPTION 'Há consumos ou devoluções de obra; a reversão apagaria dados e foi bloqueada';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.martins_producao_estoque_mover(e uuid, op uuid, tipo text, produto uuid, origem uuid, destino uuid, qtd bigint, motivo text DEFAULT NULL, ref uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; novo_id uuid := gen_random_uuid(); o uuid := origem; d uuid := destino; q bigint := qtd; p uuid := produto;
 orig martins_producao_v1.registros; prod martins_producao_v1.registros; dep martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb;
BEGIN
 IF martins_producao_v1.pode(e,'estoque_movimentos',CASE WHEN tipo='estorno' THEN 'editar' ELSE 'criar' END) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF op IS NULL OR tipo IS NULL OR tipo NOT IN ('entrada','saida','transferencia','estorno') OR length(COALESCE(motivo,''))>500 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','estoque','e',e,'tipo',tipo,'p',produto,'o',origem,'d',destino,'q',qtd,'m',motivo,'r',ref);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 IF tipo='estorno' THEN
  IF ref IS NULL OR NULLIF(trim(motivo),'') IS NULL THEN RAISE EXCEPTION 'Estorno exige o movimento original e o motivo' USING ERRCODE='22023'; END IF;
  SELECT * INTO orig FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='estoque_movimentos' AND id=ref;
  IF NOT FOUND OR orig.dados->>'tipo'='estorno' THEN RAISE EXCEPTION 'Movimento original não encontrado ou não estornável' USING ERRCODE='23503'; END IF;
  IF EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='estoque_movimentos' AND x.dados->>'tipo'='estorno' AND x.dados->>'ref_id'=ref::text) THEN
   RAISE EXCEPTION 'Este movimento já foi estornado' USING ERRCODE='23505'; END IF;
  p := (orig.dados->>'produto_id')::uuid; q := (orig.dados->>'quantidade_milli')::bigint;
  o := NULLIF(orig.dados->>'destino_id','')::uuid; d := NULLIF(orig.dados->>'origem_id','')::uuid;  -- inverte o efeito
 ELSE
  IF q IS NULL OR q<=0 OR q>1000000000000 THEN RAISE EXCEPTION 'Quantidade inválida (milésimos inteiros, maior que zero)' USING ERRCODE='22023'; END IF;
  IF (tipo='entrada' AND (d IS NULL OR o IS NOT NULL)) OR (tipo='saida' AND (o IS NULL OR d IS NOT NULL)) OR (tipo='transferencia' AND (o IS NULL OR d IS NULL OR o=d)) THEN
   RAISE EXCEPTION 'Depósitos incompatíveis com o tipo de movimento' USING ERRCODE='22023'; END IF;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||p::text||'estoque',0));
 SELECT * INTO prod FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='produtos' AND id=p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produto não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF tipo<>'estorno' AND NOT COALESCE((prod.dados->>'ativo')::boolean,true) THEN RAISE EXCEPTION 'Produto inativo' USING ERRCODE='22023'; END IF;
 FOR dep IN SELECT * FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='depositos' AND id IN (o,d) LOOP
  IF tipo<>'estorno' AND NOT COALESCE((dep.dados->>'ativo')::boolean,true) THEN RAISE EXCEPTION 'Depósito inativo' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (o IS NOT NULL AND NOT martins_producao_v1.existe(e,'depositos',o)) OR (d IS NOT NULL AND NOT martins_producao_v1.existe(e,'depositos',d)) THEN RAISE EXCEPTION 'Depósito não pertence à empresa' USING ERRCODE='23503'; END IF;
 IF o IS NOT NULL AND martins_producao_v1.saldo(e,p,o) < q THEN RAISE EXCEPTION 'Saldo insuficiente no depósito de origem' USING ERRCODE='23514'; END IF;
 INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por)
  VALUES(e,'estoque_movimentos',novo_id,1,jsonb_strip_nulls(jsonb_build_object('tipo',tipo,'produto_id',p,'origem_id',o,'destino_id',d,'quantidade_milli',q,'motivo',NULLIF(trim(motivo),''),'ref_id',ref)),auth.uid(),auth.uid())
  RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'estoque_movimentos',novo_id,auth.uid(),op,'criar',NULL,to_jsonb(novo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','estoque_movimentos','id',novo_id,'revisao',1,
   'saldo_origem',CASE WHEN o IS NULL THEN NULL ELSE martins_producao_v1.saldo(e,p,o) END,'saldo_destino',CASE WHEN d IS NULL THEN NULL ELSE martins_producao_v1.saldo(e,p,d) END);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

DROP FUNCTION public.martins_producao_obra_consumir(uuid,uuid,uuid,uuid,jsonb,uuid,text);
DROP FUNCTION public.martins_producao_obra_devolver(uuid,uuid,uuid,bigint,text);
DROP FUNCTION public.martins_producao_obra_materiais(uuid,uuid);
DROP INDEX martins_producao_v1.consumo_unico_por_rdo;
NOTIFY pgrst,'reload schema';
COMMIT;
