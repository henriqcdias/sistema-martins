-- Auxiliar da interface de homologação. Sem dados de Auth, saldos ou conciliação.
BEGIN;
CREATE FUNCTION martins_hml_v1.fin_usuarios(e uuid) RETURNS TABLE(usuario_id uuid,papel text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT martins_hml_v1.fin_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT m.usuario_id,m.papel FROM martins_hml_v1.membros m WHERE m.empresa_id=e AND m.ativo AND m.papel IN ('administrador','financeiro','lancador_financeiro') ORDER BY m.usuario_id;
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.fin_usuarios(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.fin_usuarios(uuid) TO authenticated;
COMMIT;
