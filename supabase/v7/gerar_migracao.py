"""Gera supabase/v7/migrations/20261116280000_martins_producao_v7_frota_ausencias_cotacoes.sql e reverter_v7.sql
a partir da v5 (as funções pode/contexto/salvar/catalogos não mudaram na v6).
Uso: python3 supabase/v7/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V5 = AQUI.parent / 'v5' / 'migrations' / '20261116240000_martins_producao_v5_compras.sql'
SAIDA = AQUI / 'migrations' / '20261116280000_martins_producao_v7_frota_ausencias_cotacoes.sql'
REVERTER = AQUI / 'reverter_v7.sql'
V5_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
            "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra'")
NOVOS = ['frota_eventos', 'ausencias', 'cotacoes']
V7_LISTA = V5_LISTA + ",'" + "','".join(NOVOS) + "'"
LISTA_NOVOS = "'" + "','".join(NOVOS) + "'"
def funcao(t, a):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b):
    assert t.count(a) == 1, (a[:70], t.count(a)); return t.replace(a, b)
v5 = V5.read_text(encoding='utf-8')
orig = {n: funcao(v5, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('), ('catalogos', 'public.martins_producao_catalogos(')]}
pode = trocar(orig['pode'], ' AND m IN (' + V5_LISTA + ')', ' AND m IN (' + V7_LISTA + ')')
contexto = trocar(orig['contexto'], 'unnest(ARRAY[' + V5_LISTA + '])', 'unnest(ARRAY[' + V7_LISTA + '])')
catalogos = trocar(orig['catalogos'], 'unnest(ARRAY[' + V5_LISTA + '])', 'unnest(ARRAY[' + V7_LISTA + '])')
salvar = trocar(orig['salvar'], " ELSIF m='pedidos_compra' THEN d:=martins_producao_v1.preparar_v5(e,m,r,v,d,anterior); END IF;",
  " ELSIF m='pedidos_compra' THEN d:=martins_producao_v1.preparar_v5(e,m,r,v,d,anterior);\n ELSIF m IN (" + LISTA_NOVOS + ") THEN d:=martins_producao_v1.preparar_v7(e,m,r,v,d,anterior); END IF;")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v7/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2, v3, v4 e v5 aplicadas (a v6 é independente).\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v5 com os módulos v7.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v7/gerar_migracao.py. Reverte a v7 (só se não houver registros ou permissões dos módulos v7).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo IN (" + LISTA_NOVOS + "))\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo IN (" + LISTA_NOVOS + ")) THEN\n  RAISE EXCEPTION 'Há registros ou permissões de frota, ausências ou cotações; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n\n"
  + "\n\n".join(orig.values())
  + "\n\nDROP INDEX martins_producao_v1.frota_abastecimento_unico;\nDROP FUNCTION martins_producao_v1.preparar_v7(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros);\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V5_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V5_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v7')
