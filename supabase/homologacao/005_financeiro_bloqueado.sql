-- Não autoriza operações financeiras. Somente declara o bloqueio no servidor de homologação.
BEGIN;
CREATE FUNCTION martins_hml_v1.estado_financeiro(p_empresa uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT martins_hml_v1.permitido(p_empresa,'financeiro',false) THEN
 RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('homologado',false,'pagamentos',false,'fechamentos',false,'excecoes_vales',false,'motivo','homologacao_remota_pendente');
END $$;
REVOKE ALL ON FUNCTION martins_hml_v1.estado_financeiro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION martins_hml_v1.estado_financeiro(uuid) TO authenticated;
COMMIT;
