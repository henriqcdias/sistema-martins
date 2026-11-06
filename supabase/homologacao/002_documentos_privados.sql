-- Aplicar somente após 001, em Supabase separado de homologação e com inventário Storage conferido.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='martins-hml-documentos-v1' AND public) THEN
 RAISE EXCEPTION 'Bucket reservado já é público; implantação interrompida'; END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('martins-hml-documentos-v1','martins-hml-documentos-v1',false,524288,ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT(id) DO NOTHING;
CREATE FUNCTION martins_hml_v1.documento_permitido(p_nome text,p_escrita boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_nome ~ '^[a-f0-9-]{36}/documentos/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|png|jpg)$'
 AND split_part(p_nome,'/',1) ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 THEN martins_hml_v1.permitido(split_part(p_nome,'/',1)::uuid,'documentos',p_escrita) ELSE false END
$$;
REVOKE ALL ON FUNCTION martins_hml_v1.documento_permitido(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.documento_permitido(text,boolean) TO authenticated;
-- Guardas RESTRICTIVE impedem política permissiva antiga de liberar este bucket.
CREATE POLICY martins_hml_doc_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id<>'martins-hml-documentos-v1') WITH CHECK(bucket_id<>'martins-hml-documentos-v1');
CREATE POLICY martins_hml_doc_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'martins-hml-documentos-v1' OR martins_hml_v1.documento_permitido(name,false));
CREATE POLICY martins_hml_doc_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'martins-hml-documentos-v1' OR martins_hml_v1.documento_permitido(name,true));
CREATE POLICY martins_hml_doc_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'martins-hml-documentos-v1') WITH CHECK(bucket_id<>'martins-hml-documentos-v1');
CREATE POLICY martins_hml_doc_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'martins-hml-documentos-v1');
CREATE POLICY martins_hml_doc_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='martins-hml-documentos-v1' AND martins_hml_v1.documento_permitido(name,false));
CREATE POLICY martins_hml_doc_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='martins-hml-documentos-v1' AND martins_hml_v1.documento_permitido(name,true));
COMMIT;
