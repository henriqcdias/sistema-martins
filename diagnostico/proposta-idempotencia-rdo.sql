-- Proposta de estrutura auxiliar. Não aplicar sem revisão do catálogo e da RPC.
-- Reutilizar o registro de operações existente se ele atender ao mesmo contrato.
-- O proprietário da futura RPC deve ser dedicado e receber somente os privilégios
-- necessários, em revisão separada. Este arquivo não expõe a tabela na Data API.
BEGIN;

CREATE SCHEMA martins_operacoes_internas;
REVOKE ALL ON SCHEMA martins_operacoes_internas FROM PUBLIC, anon, authenticated;

CREATE TABLE martins_operacoes_internas.rdo_operacoes (
  empresa_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  operacao_id uuid NOT NULL,
  requisicao jsonb NOT NULL,
  resposta jsonb,
  criada_em timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (empresa_id, autor_id, operacao_id)
);

ALTER TABLE martins_operacoes_internas.rdo_operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON martins_operacoes_internas.rdo_operacoes FROM PUBLIC, anon, authenticated;

COMMIT;
