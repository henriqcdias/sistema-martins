-- Aplicar somente após 001/002, em Supabase separado de homologação e com inventário Storage conferido.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='martins-hml-financeiro-v1' AND public) THEN
 RAISE EXCEPTION 'Bucket reservado já é público; implantação interrompida'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='martins-hml-financeiro-v1' AND (file_size_limit IS NULL OR file_size_limit>524288 OR allowed_mime_types IS NULL OR NOT allowed_mime_types<@ARRAY['application/pdf','image/png','image/jpeg'])) THEN RAISE EXCEPTION 'Configuração do bucket existente requer conferência'; END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('martins-hml-financeiro-v1','martins-hml-financeiro-v1',false,524288,ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT(id) DO NOTHING;
CREATE FUNCTION martins_hml_v1.documento_financeiro_permitido(p_nome text,p_escrita boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_nome ~ '^[a-f0-9-]{36}/documentos_financeiros/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|png|jpg)$'
 AND split_part(p_nome,'/',1) ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 THEN martins_hml_v1.permitido(split_part(p_nome,'/',1)::uuid,'financeiro',p_escrita) AND EXISTS(SELECT 1 FROM martins_hml_v1.membros m WHERE m.empresa_id=split_part(p_nome,'/',1)::uuid AND m.usuario_id=(SELECT auth.uid()) AND m.ativo AND COALESCE(m.permissoes->'documentos_financeiros','true'::jsonb)='true'::jsonb) ELSE false END
$$;
REVOKE ALL ON FUNCTION martins_hml_v1.documento_financeiro_permitido(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.documento_financeiro_permitido(text,boolean) TO authenticated;
-- Guardas RESTRICTIVE impedem política permissiva antiga de liberar este bucket.
CREATE POLICY martins_hml_fin_doc_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id<>'martins-hml-financeiro-v1') WITH CHECK(bucket_id<>'martins-hml-financeiro-v1');
CREATE POLICY martins_hml_fin_doc_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'martins-hml-financeiro-v1' OR martins_hml_v1.documento_financeiro_permitido(name,false));
CREATE POLICY martins_hml_fin_doc_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'martins-hml-financeiro-v1' OR martins_hml_v1.documento_financeiro_permitido(name,true));
CREATE POLICY martins_hml_fin_doc_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'martins-hml-financeiro-v1') WITH CHECK(bucket_id<>'martins-hml-financeiro-v1');
CREATE POLICY martins_hml_fin_doc_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'martins-hml-financeiro-v1');
CREATE POLICY martins_hml_fin_doc_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='martins-hml-financeiro-v1' AND martins_hml_v1.documento_financeiro_permitido(name,false));
CREATE POLICY martins_hml_fin_doc_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='martins-hml-financeiro-v1' AND martins_hml_v1.documento_financeiro_permitido(name,true));
CREATE FUNCTION martins_hml_v1.auditar_documento_financeiro() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.bucket_id='martins-hml-financeiro-v1' THEN
  IF NOT martins_hml_v1.documento_financeiro_permitido(NEW.name,true) THEN RAISE EXCEPTION 'Documento não autorizado' USING ERRCODE='42501'; END IF;
  INSERT INTO martins_hml_v1.auditoria(empresa_id,operacao_id,usuario_id,modulo,registro_id,versao_anterior,versao_nova,campos)
  VALUES(split_part(NEW.name,'/',1)::uuid,gen_random_uuid(),auth.uid(),'financeiro',split_part(NEW.name,'/',3)::uuid,0,1,ARRAY['documento_financeiro_privado_criado']);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.auditar_documento_financeiro() FROM PUBLIC;
CREATE TRIGGER martins_hml_auditar_documento_financeiro AFTER INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION martins_hml_v1.auditar_documento_financeiro();
COMMIT;
