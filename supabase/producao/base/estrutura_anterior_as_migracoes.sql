-- Estrutura-base do projeto de produção (kkjwmnxgcbonbwavaaya) criada ANTES das
-- migrações versionadas, provavelmente pelo SQL Editor. Ela não existe em
-- supabase_migrations, então foi RECONSTRUÍDA em 16/11/2026 a partir do catálogo
-- (pg_attribute, pg_constraint, pg_policies, pg_get_functiondef e ACLs), com
-- acesso somente leitura. Não é o SQL original.
--
-- Uso: recriar o ambiente em um projeto vazio (QA ou local), ANTES de supabase/producao/migrations.
-- Não rode em produção: os objetos já existem lá, e o script falha de propósito
-- (CREATE sem IF NOT EXISTS) para não mascarar diferenças.
--
-- Privilégios: aqui só se reproduzem os privilégios efetivos (SELECT/INSERT/UPDATE).
-- Em produção, anon e authenticated também têm TRUNCATE, REFERENCES, TRIGGER e
-- MAINTAIN nessas tabelas, sobra dos grants padrão do Supabase. O PostgREST não
-- expõe TRUNCATE, mas ele ignora RLS. Recomenda-se revogar em produção; veja o README.

BEGIN;

CREATE TABLE public.martins_empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT martins_empresas_pkey PRIMARY KEY (id)
);

CREATE TABLE public.martins_unidades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT martins_unidades_pkey PRIMARY KEY (id),
  CONSTRAINT martins_unidades_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id)
);

CREATE TABLE public.martins_perfis (
  usuario_id uuid NOT NULL,
  empresa_id uuid,
  nome text,
  ativo boolean NOT NULL DEFAULT true,
  crea_numero text,
  crea_uf text,
  crea_ativo boolean NOT NULL DEFAULT false,
  crea_verificado_em timestamp with time zone,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  papel text NOT NULL DEFAULT 'colaborador'::text,
  CONSTRAINT martins_perfis_pkey PRIMARY KEY (usuario_id),
  CONSTRAINT martins_perfis_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id),
  CONSTRAINT martins_perfis_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Autorização das tabelas-base: exige papel 'administrador' em martins_perfis.
-- É um modelo diferente do martins_online_acessos usado por martins_producao_v1.
CREATE FUNCTION public.martins_empresa_autorizada(p_empresa uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.martins_perfis p
    WHERE p.usuario_id = (SELECT auth.uid())
      AND p.empresa_id = p_empresa
      AND p.ativo = true
      AND p.papel = 'administrador'
  );
$function$;

CREATE TABLE public.martins_auditoria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  usuario_id uuid,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  detalhes jsonb,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT martins_auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT martins_auditoria_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id),
  CONSTRAINT martins_auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id)
);

CREATE TABLE public.martins_depositos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  unidade_id uuid,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT martins_depositos_pkey PRIMARY KEY (id),
  CONSTRAINT martins_depositos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id),
  CONSTRAINT martins_depositos_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.martins_unidades(id)
);

CREATE TABLE public.martins_produtos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  unidade_id uuid,
  codigo text,
  descricao text NOT NULL,
  unidade_compra text NOT NULL DEFAULT 'UN'::text,
  unidade_estoque text NOT NULL DEFAULT 'UN'::text,
  unidade_venda text NOT NULL DEFAULT 'UN'::text,
  emb_fat_kg_m numeric(14,6),
  ultimo_custo_compra numeric(16,4),
  custo_metro_comercial numeric(16,4),
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT martins_produtos_pkey PRIMARY KEY (id),
  CONSTRAINT martins_produtos_empresa_id_codigo_key UNIQUE (empresa_id, codigo),
  CONSTRAINT martins_produtos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id),
  CONSTRAINT martins_produtos_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.martins_unidades(id),
  CONSTRAINT martins_produtos_custo_metro_comercial_check CHECK ((custo_metro_comercial >= (0)::numeric)),
  CONSTRAINT martins_produtos_emb_fat_kg_m_check CHECK ((emb_fat_kg_m > (0)::numeric)),
  CONSTRAINT martins_produtos_ultimo_custo_compra_check CHECK ((ultimo_custo_compra >= (0)::numeric))
);

CREATE TABLE public.martins_notas_compra (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  fornecedor_nome text,
  fornecedor_cnpj text,
  numero text,
  serie text,
  chave_acesso text,
  emitida_em date,
  valor_total numeric(16,2),
  arquivo_storage_path text,
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT martins_notas_compra_pkey PRIMARY KEY (id),
  CONSTRAINT martins_notas_compra_empresa_id_chave_acesso_key UNIQUE (empresa_id, chave_acesso),
  CONSTRAINT martins_notas_compra_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id),
  CONSTRAINT martins_notas_compra_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id),
  CONSTRAINT martins_notas_compra_valor_total_check CHECK ((valor_total >= (0)::numeric))
);

CREATE TABLE public.martins_precos_compra (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  produto_id uuid NOT NULL,
  nota_id uuid,
  fornecedor_nome text,
  quantidade numeric(16,4) NOT NULL,
  unidade text NOT NULL,
  preco_unitario numeric(16,4) NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT martins_precos_compra_pkey PRIMARY KEY (id),
  CONSTRAINT martins_precos_compra_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id),
  CONSTRAINT martins_precos_compra_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES public.martins_notas_compra(id),
  CONSTRAINT martins_precos_compra_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.martins_produtos(id),
  CONSTRAINT martins_precos_compra_preco_unitario_check CHECK ((preco_unitario >= (0)::numeric)),
  CONSTRAINT martins_precos_compra_quantidade_check CHECK ((quantidade > (0)::numeric))
);

CREATE TABLE public.martins_movimentos_estoque (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  produto_id uuid NOT NULL,
  deposito_origem_id uuid,
  deposito_destino_id uuid,
  tipo text NOT NULL,
  quantidade numeric(16,4) NOT NULL,
  custo_unitario numeric(16,4),
  nota_id uuid,
  observacao text,
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT martins_movimentos_estoque_pkey PRIMARY KEY (id),
  CONSTRAINT martins_movimentos_estoque_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id),
  CONSTRAINT martins_movimentos_estoque_deposito_destino_id_fkey FOREIGN KEY (deposito_destino_id) REFERENCES public.martins_depositos(id),
  CONSTRAINT martins_movimentos_estoque_deposito_origem_id_fkey FOREIGN KEY (deposito_origem_id) REFERENCES public.martins_depositos(id),
  CONSTRAINT martins_movimentos_estoque_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.martins_empresas(id),
  CONSTRAINT martins_movimentos_estoque_nota_id_fkey FOREIGN KEY (nota_id) REFERENCES public.martins_notas_compra(id),
  CONSTRAINT martins_movimentos_estoque_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.martins_produtos(id),
  CONSTRAINT martins_movimentos_estoque_check CHECK (((deposito_origem_id IS NOT NULL) OR (deposito_destino_id IS NOT NULL))),
  CONSTRAINT martins_movimentos_estoque_check1 CHECK (((tipo <> 'transferencia'::text) OR ((deposito_origem_id IS NOT NULL) AND (deposito_destino_id IS NOT NULL) AND (deposito_origem_id <> deposito_destino_id)))),
  CONSTRAINT martins_movimentos_estoque_custo_unitario_check CHECK ((custo_unitario >= (0)::numeric)),
  CONSTRAINT martins_movimentos_estoque_quantidade_check CHECK ((quantidade > (0)::numeric)),
  CONSTRAINT martins_movimentos_estoque_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text, 'transferencia'::text, 'ajuste'::text, 'producao'::text])))
);

-- Não é SECURITY DEFINER: depende da política de INSERT de martins_depositos.
CREATE FUNCTION public.martins_criar_deposito(p_empresa uuid, p_nome text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.martins_empresa_autorizada(p_empresa) THEN
    RAISE EXCEPTION 'Acesso nao autorizado';
  END IF;
  IF p_nome IS NULL OR length(trim(p_nome)) < 3 THEN
    RAISE EXCEPTION 'Informe um nome valido';
  END IF;
  INSERT INTO public.martins_depositos (empresa_id, nome, ativo)
  VALUES (p_empresa, trim(p_nome), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- RLS (em produção: ativada, não forçada) e políticas.
ALTER TABLE public.martins_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_notas_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_precos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.martins_movimentos_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY martins_empresas_admin_select ON public.martins_empresas AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(id));
CREATE POLICY martins_unidades_admin_select ON public.martins_unidades AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_perfis_admin_select ON public.martins_perfis AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_auditoria_admin_select ON public.martins_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_depositos_admin_select ON public.martins_depositos AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_depositos_admin_insert ON public.martins_depositos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_depositos_admin_update ON public.martins_depositos AS PERMISSIVE FOR UPDATE TO authenticated USING (public.martins_empresa_autorizada(empresa_id)) WITH CHECK (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_produtos_admin_select ON public.martins_produtos AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_produtos_admin_insert ON public.martins_produtos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_produtos_admin_update ON public.martins_produtos AS PERMISSIVE FOR UPDATE TO authenticated USING (public.martins_empresa_autorizada(empresa_id)) WITH CHECK (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_notas_admin_select ON public.martins_notas_compra AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_precos_admin_select ON public.martins_precos_compra AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));
CREATE POLICY martins_movimentos_admin_select ON public.martins_movimentos_estoque AS PERMISSIVE FOR SELECT TO authenticated USING (public.martins_empresa_autorizada(empresa_id));

-- Privilégios efetivos.
REVOKE ALL ON public.martins_empresas, public.martins_unidades, public.martins_perfis,
  public.martins_auditoria, public.martins_depositos, public.martins_produtos,
  public.martins_notas_compra, public.martins_precos_compra, public.martins_movimentos_estoque
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.martins_empresas, public.martins_unidades, public.martins_perfis,
  public.martins_auditoria, public.martins_notas_compra, public.martins_precos_compra,
  public.martins_movimentos_estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.martins_depositos, public.martins_produtos TO authenticated;

REVOKE ALL ON FUNCTION public.martins_empresa_autorizada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.martins_empresa_autorizada(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.martins_criar_deposito(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.martins_criar_deposito(uuid, text) TO authenticated;

-- Ativa RLS automaticamente em toda tabela nova do schema public. A migração
-- 20261106161019 revoga a execução pública desta função, então ela precisa existir.
-- Projetos novos do Supabase podem já tê-la: por isso, CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
      WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      EXECUTE FUNCTION public.rls_auto_enable();
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sem permissão para criar o event trigger ensure_rls; ative RLS manualmente em tabelas novas.';
END $$;

COMMIT;
