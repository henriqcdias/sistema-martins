-- Somente projeto separado de homologação. O responsável provisiona a única linha no SQL Editor.
BEGIN;
CREATE TABLE martins_hml_v1.ambiente (
 id smallint PRIMARY KEY CHECK(id=1),
 project_ref text NOT NULL CHECK(project_ref ~ '^[a-z0-9]{10,40}$'),
 tipo text NOT NULL CHECK(tipo='homologacao'),
 contrato smallint NOT NULL CHECK(contrato=1)
);
ALTER TABLE martins_hml_v1.ambiente ENABLE ROW LEVEL SECURITY;
ALTER TABLE martins_hml_v1.ambiente FORCE ROW LEVEL SECURITY;
REVOKE ALL ON martins_hml_v1.ambiente FROM PUBLIC,authenticated;
GRANT SELECT ON martins_hml_v1.ambiente TO authenticated;
CREATE POLICY ambiente_para_membro_ativo ON martins_hml_v1.ambiente FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM martins_hml_v1.membros m WHERE m.usuario_id=(SELECT auth.uid()) AND m.ativo));
COMMIT;
