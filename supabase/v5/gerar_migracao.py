"""Gera supabase/v5/migrations/20261116240000_martins_producao_v5_compras.sql e reverter_v5.sql a partir da v4.
Uso: python3 supabase/v5/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V4 = AQUI.parent / 'v4' / 'migrations' / '20261116220000_martins_producao_v4_estoque.sql'
SAIDA = AQUI / 'migrations' / '20261116240000_martins_producao_v5_compras.sql'
REVERTER = AQUI / 'reverter_v5.sql'
V4_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
            "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos'")
V5_LISTA = V4_LISTA + ",'pedidos_compra','recebimentos_compra'"
def funcao(t, a):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b):
    assert t.count(a) == 1, (a[:70], t.count(a)); return t.replace(a, b)
v4 = V4.read_text(encoding='utf-8')
orig = {n: funcao(v4, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('), ('catalogos', 'public.martins_producao_catalogos(')]}
pode = trocar(orig['pode'], ' AND m IN (' + V4_LISTA + ')', ' AND m IN (' + V5_LISTA + ')')
contexto = trocar(orig['contexto'], 'unnest(ARRAY[' + V4_LISTA + '])', 'unnest(ARRAY[' + V5_LISTA + '])')
catalogos = trocar(orig['catalogos'], 'unnest(ARRAY[' + V4_LISTA + '])', 'unnest(ARRAY[' + V5_LISTA + '])')
salvar = trocar(orig['salvar'], " IF m='estoque_movimentos' THEN RAISE EXCEPTION 'Movimentos de estoque só são gravados por martins_producao_estoque_mover' USING ERRCODE='42501'; END IF;",
  " IF m IN ('estoque_movimentos','recebimentos_compra') THEN RAISE EXCEPTION 'Este registro só é gravado pela função própria do módulo' USING ERRCODE='42501'; END IF;")
salvar = trocar(salvar, " ELSIF m IN ('feriados','precos_insumo','epis') THEN d:=martins_producao_v1.preparar_v3(e,m,r,v,d,anterior); END IF;",
  " ELSIF m IN ('feriados','precos_insumo','epis') THEN d:=martins_producao_v1.preparar_v3(e,m,r,v,d,anterior);\n ELSIF m='pedidos_compra' THEN d:=martins_producao_v1.preparar_v5(e,m,r,v,d,anterior); END IF;")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v5/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2, v3 e v4 aplicadas.\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v4 com os módulos de compras.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v5/gerar_migracao.py. Reverte a v5 (só se não houver pedidos/recebimentos).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo IN ('pedidos_compra','recebimentos_compra'))\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo IN ('pedidos_compra','recebimentos_compra')) THEN\n  RAISE EXCEPTION 'Há pedidos, recebimentos ou permissões de compras; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n"
  + "\n\n".join(orig.values())
  + "\n\nDROP FUNCTION public.martins_producao_compras_receber(uuid,uuid,uuid,uuid,jsonb,jsonb);\nDROP FUNCTION public.martins_producao_compras_estado(uuid,uuid,bigint,text,text,uuid);\nDROP FUNCTION martins_producao_v1.preparar_v5(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros);\nDROP INDEX martins_producao_v1.pedido_numero_empresa, martins_producao_v1.recebimento_chave_unica, martins_producao_v1.recebimento_nf_fornecedor;\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V4_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V4_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v5')
