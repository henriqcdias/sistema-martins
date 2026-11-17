"""Gera supabase/v8/migrations/20261116300000_martins_producao_v8_requisicao_material.sql e reverter_v8.sql
a partir da v7 (as funções pode/contexto/salvar/catalogos vêm da v7).
Uso: python3 supabase/v8/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V7 = AQUI.parent / 'v7' / 'migrations' / '20261116280000_martins_producao_v7_frota_ausencias_cotacoes.sql'
SAIDA = AQUI / 'migrations' / '20261116300000_martins_producao_v8_requisicao_material.sql'
REVERTER = AQUI / 'reverter_v8.sql'
V7_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
            "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',"
            "'frota_eventos','ausencias','cotacoes'")
V8_LISTA = V7_LISTA + ",'requisicoes_material'"
def funcao(t, a):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b):
    assert t.count(a) == 1, (a[:70], t.count(a)); return t.replace(a, b)
v7 = V7.read_text(encoding='utf-8')
orig = {n: funcao(v7, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('), ('catalogos', 'public.martins_producao_catalogos(')]}
pode = trocar(orig['pode'], ' AND m IN (' + V7_LISTA + ')', ' AND m IN (' + V8_LISTA + ')')
contexto = trocar(orig['contexto'], 'unnest(ARRAY[' + V7_LISTA + '])', 'unnest(ARRAY[' + V8_LISTA + '])')
catalogos = trocar(orig['catalogos'], 'unnest(ARRAY[' + V7_LISTA + '])', 'unnest(ARRAY[' + V8_LISTA + '])')
salvar = trocar(orig['salvar'], " ELSIF m IN ('frota_eventos','ausencias','cotacoes') THEN d:=martins_producao_v1.preparar_v7(e,m,r,v,d,anterior); END IF;",
  " ELSIF m IN ('frota_eventos','ausencias','cotacoes') THEN d:=martins_producao_v1.preparar_v7(e,m,r,v,d,anterior);\n ELSIF m='requisicoes_material' THEN d:=martins_producao_v1.preparar_v8(e,m,r,v,d,anterior); END IF;")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v8/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2, v3, v4, v5, v6 e v7 aplicadas.\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v7 com o módulo de requisições.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v8/gerar_migracao.py. Reverte a v8 (só se não houver requisições nem permissões do módulo).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='requisicoes_material')\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo='requisicoes_material') THEN\n  RAISE EXCEPTION 'Há requisições de material ou permissões do módulo; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n\n"
  + "\n\n".join(orig.values())
  + "\n\nDROP FUNCTION public.martins_producao_req_entregar(uuid,uuid,uuid,jsonb);\nDROP FUNCTION public.martins_producao_req_estado(uuid,uuid,bigint,text,text,uuid);\nDROP INDEX martins_producao_v1.requisicao_numero_empresa;\nDROP FUNCTION martins_producao_v1.preparar_v8(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros);\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V7_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V7_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v8')
