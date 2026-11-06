-- SQL Editor do PROJETO SEPARADO DE HOMOLOGAÇÃO, após 001 a 005.
-- A identificação de ambiente já foi inserida na migração 004; este script apenas a confere.
-- Preencha somente project_ref e os quatro UUIDs obtidos no painel Auth.
-- Não inserir senha ou chave secreta neste SQL. Não executar no projeto definitivo.
BEGIN;
DO $$
DECLARE
 ref text := 'PREENCHER_PROJECT_REF';
 rh_a uuid := 'PREENCHER_UUID_RH_A';
 rh_b uuid := 'PREENCHER_UUID_RH_B';
 financeiro_a uuid := 'PREENCHER_UUID_FINANCEIRO_A';
 inativo_a uuid := 'PREENCHER_UUID_INATIVO_A';
 empresa_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 empresa_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
BEGIN
 IF ref !~ '^[a-z0-9]{10,40}$' THEN RAISE EXCEPTION 'Preencha a referência do projeto separado'; END IF;
 IF (SELECT count(DISTINCT u) FROM unnest(ARRAY[rh_a,rh_b,financeiro_a,inativo_a]) u)<>4 THEN RAISE EXCEPTION 'Use quatro usuários de teste distintos'; END IF;
 IF (SELECT count(*) FROM auth.users WHERE id=ANY(ARRAY[rh_a,rh_b,financeiro_a,inativo_a]))<>4 THEN RAISE EXCEPTION 'Usuários não encontrados no Auth deste projeto'; END IF;
 IF NOT EXISTS (SELECT 1 FROM martins_hml_v1.ambiente WHERE id=1 AND project_ref=ref AND tipo='homologacao' AND contrato=1) THEN
  RAISE EXCEPTION 'Identificação de homologação ausente ou diferente; interrompido';
 END IF;
 INSERT INTO martins_hml_v1.membros(empresa_id,usuario_id,papel,ativo,permissoes) VALUES
 (empresa_a,rh_a,'rh',true,'{}'),
 (empresa_b,rh_b,'rh',true,'{}'),
 (empresa_a,financeiro_a,'financeiro',true,'{}'),
 (empresa_a,inativo_a,'rh',false,'{}');
END $$;
COMMIT;
NOTIFY pgrst, 'reload schema';
