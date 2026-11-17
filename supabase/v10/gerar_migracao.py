"""Gera supabase/v10/migrations/20261116340000_martins_producao_v10_contas_receber.sql e reverter_v10.sql.
pode/contexto/salvar/catalogos vêm da v8; martins_producao_permissoes_definir vem da v9 (com a lista de módulos ampliada).
Uso: python3 supabase/v10/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V8 = AQUI.parent / 'v8' / 'migrations' / '20261116300000_martins_producao_v8_requisicao_material.sql'
V9 = AQUI.parent / 'v9' / 'migrations' / '20261116320000_martins_producao_v9_usuarios_perfis.sql'
SAIDA = AQUI / 'migrations' / '20261116340000_martins_producao_v10_contas_receber.sql'
REVERTER = AQUI / 'reverter_v10.sql'
V8_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
            "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',"
            "'frota_eventos','ausencias','cotacoes','requisicoes_material'")
V10_LISTA = V8_LISTA + ",'contas_receber'"
def funcao(t, a):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b):
    assert t.count(a) == 1, (a[:70], t.count(a)); return t.replace(a, b)
v8 = V8.read_text(encoding='utf-8'); v9 = V9.read_text(encoding='utf-8')
orig = {n: funcao(v8, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('), ('catalogos', 'public.martins_producao_catalogos(')]}
perm9 = funcao(v9, 'public.martins_producao_permissoes_definir(')
lista_perm8 = "ARRAY[" + V8_LISTA + "]"
pode = trocar(orig['pode'], ' AND m IN (' + V8_LISTA + ')', ' AND m IN (' + V10_LISTA + ')')
contexto = trocar(orig['contexto'], 'unnest(ARRAY[' + V8_LISTA + '])', 'unnest(ARRAY[' + V10_LISTA + '])')
catalogos = trocar(orig['catalogos'], 'unnest(ARRAY[' + V8_LISTA + '])', 'unnest(ARRAY[' + V10_LISTA + '])')
salvar = trocar(orig['salvar'], " ELSIF m='requisicoes_material' THEN d:=martins_producao_v1.preparar_v8(e,m,r,v,d,anterior); END IF;",
  " ELSIF m='requisicoes_material' THEN d:=martins_producao_v1.preparar_v8(e,m,r,v,d,anterior);\n ELSIF m='contas_receber' THEN d:=martins_producao_v1.preparar_v10(e,m,r,v,d,anterior); END IF;")
perm10 = trocar(perm9, lista_perm8, "ARRAY[" + V10_LISTA + "]")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v10/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2 a v9 aplicadas.\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v8/v9 com o módulo de contas a receber.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos, perm10]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v10/gerar_migracao.py. Reverte a v10 (só se não houver contas a receber nem permissões do módulo).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='contas_receber')\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo='contas_receber') THEN\n  RAISE EXCEPTION 'Há contas a receber ou permissões do módulo; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n\n"
  + "\n\n".join(orig.values()) + "\n\n" + perm9
  + "\n\nDROP FUNCTION public.martins_producao_receber_totais(uuid);\nDROP FUNCTION public.martins_producao_receber_estornar(uuid,uuid,uuid,bigint,uuid,text);\nDROP FUNCTION public.martins_producao_receber_estado(uuid,uuid,uuid,bigint,text,text);\nDROP FUNCTION public.martins_producao_receber_baixar(uuid,uuid,uuid,bigint,bigint,date,uuid,text);\nDROP FUNCTION martins_producao_v1.preparar_v10(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros);\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V8_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V8_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v10')
