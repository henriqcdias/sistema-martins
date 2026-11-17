"""Gera supabase/v4/migrations/20261116220000_martins_producao_v4_estoque.sql e reverter_v4.sql a partir da v3 aplicada.
Uso: python3 supabase/v4/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V3 = AQUI.parent / 'v3' / 'migrations' / '20261116200000_martins_producao_v3_cadastros_auxiliares.sql'
SAIDA = AQUI / 'migrations' / '20261116220000_martins_producao_v4_estoque.sql'
REVERTER = AQUI / 'reverter_v4.sql'
V3_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
            "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis'")
V4_LISTA = V3_LISTA + ",'estoque_movimentos'"

def funcao(texto, assinatura):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(assinatura) + r'.*?\$\$.*?\$\$;', texto, re.S)
    assert m, assinatura
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b):
    assert t.count(a) == 1, (a[:70], t.count(a)); return t.replace(a, b)
v3 = V3.read_text(encoding='utf-8')
orig = {n: funcao(v3, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('), ('catalogos', 'public.martins_producao_catalogos(')]}
pode = trocar(orig['pode'], ' AND m IN (' + V3_LISTA + ')', ' AND m IN (' + V4_LISTA + ')')
contexto = trocar(orig['contexto'], 'unnest(ARRAY[' + V3_LISTA + '])', 'unnest(ARRAY[' + V4_LISTA + '])')
catalogos = trocar(orig['catalogos'], 'unnest(ARRAY[' + V3_LISTA + '])', 'unnest(ARRAY[' + V4_LISTA + '])')
salvar = trocar(orig['salvar'], " IF m IN ('clientes'",
  " IF m='estoque_movimentos' THEN RAISE EXCEPTION 'Movimentos de estoque só são gravados por martins_producao_estoque_mover' USING ERRCODE='42501'; END IF;\n IF m IN ('clientes'")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v4/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2 e v3 aplicadas.\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v3 com o módulo de estoque.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v4/gerar_migracao.py. Reverte a v4 (só se não houver movimentos).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos')\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo='estoque_movimentos') THEN\n  RAISE EXCEPTION 'Há movimentos ou permissões de estoque; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n"
  + "\n\n".join(orig.values())
  + "\n\nDROP FUNCTION public.martins_producao_estoque_mover(uuid,uuid,text,uuid,uuid,uuid,bigint,text,uuid);\nDROP FUNCTION public.martins_producao_estoque_saldos(uuid);\nDROP FUNCTION martins_producao_v1.saldo(uuid,uuid,uuid);\nDROP INDEX martins_producao_v1.estorno_unico;\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V3_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V3_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v4')
