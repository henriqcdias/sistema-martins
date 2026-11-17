"""Gera supabase/v3/migrations/20261116200000_martins_producao_v3_cadastros_auxiliares.sql e reverter_v3.sql.

As funções existentes (pode, contexto, salvar, catalogos) são copiadas LITERALMENTE da
migração v2 (a última aplicada) e recebem só a inclusão dos módulos v3, conferida por contagem.

Uso: python3 supabase/v3/gerar_migracao.py
"""
import pathlib
import re

AQUI = pathlib.Path(__file__).resolve().parent
V2 = AQUI.parent / 'v2' / 'migrations' / '20261116120000_martins_producao_v2_cadastros_financeiro.sql'
SAIDA = AQUI / 'migrations' / '20261116200000_martins_producao_v3_cadastros_auxiliares.sql'
REVERTER = AQUI / 'reverter_v3.sql'

V2_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores',"
            "'motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas'")
V3_NOVOS = ['feriados', 'precos_insumo', 'epis']
V3_LISTA = V2_LISTA + ",'" + "','".join(V3_NOVOS) + "'"
V2_NOVOS = "'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas'"


def funcao(texto, assinatura):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(assinatura) + r'.*?\$\$.*?\$\$;', texto, re.S)
    assert m, assinatura
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]


def trocar(texto, antes, depois, vezes=1):
    assert texto.count(antes) == vezes, (antes[:80], texto.count(antes))
    return texto.replace(antes, depois)


v2 = V2.read_text(encoding='utf-8')
originais = {n: funcao(v2, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('),
                                           ('salvar', 'public.martins_producao_salvar('), ('catalogos', 'public.martins_producao_catalogos(')]}

pode = trocar(originais['pode'], ' AND m IN (' + V2_LISTA + ')', ' AND m IN (' + V3_LISTA + ')')
contexto = trocar(originais['contexto'], 'unnest(ARRAY[' + V2_LISTA + '])', 'unnest(ARRAY[' + V3_LISTA + '])')
catalogos = trocar(originais['catalogos'], 'unnest(ARRAY[' + V2_LISTA + '])', 'unnest(ARRAY[' + V3_LISTA + '])')
salvar = trocar(originais['salvar'],
                " IF m IN (" + V2_NOVOS + ") THEN d:=martins_producao_v1.preparar_v2(e,m,r,v,d,anterior); END IF;\n",
                " IF m IN (" + V2_NOVOS + ") THEN d:=martins_producao_v1.preparar_v2(e,m,r,v,d,anterior);\n"
                " ELSIF m IN ('" + "','".join(V3_NOVOS) + "') THEN d:=martins_producao_v1.preparar_v3(e,m,r,v,d,anterior); END IF;\n")

SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v3/gerar_migracao.py. Não edite à mão.\n"
                 "-- Pré-requisito: supabase/producao/migrations e supabase/v2/migrations aplicadas.\nBEGIN;\n"
                 + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
                 + "\n\n-- Funções existentes, copiadas da v2 com os módulos v3.\n\n"
                 + "\n\n".join([pode, contexto, salvar, catalogos])
                 + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')

REVERTER.write_text("-- GERADO por supabase/v3/gerar_migracao.py. Reverte a v3 (só se não houver dados v3).\nBEGIN;\n"
                    "DO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo IN ('" + "','".join(V3_NOVOS) + "'))\n"
                    "  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo IN ('" + "','".join(V3_NOVOS) + "')) THEN\n"
                    "  RAISE EXCEPTION 'Há registros ou permissões de módulos v3; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n"
                    + "\n\n".join(originais.values())
                    + "\n\nDROP FUNCTION public.martins_producao_auditoria(uuid,text,uuid,integer);"
                    + "\n\nDROP FUNCTION martins_producao_v1.preparar_v3(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros);\n"
                    "DROP INDEX martins_producao_v1.feriados_data_empresa, martins_producao_v1.epis_codigo_empresa;\n"
                    "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\n"
                    "ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V2_LISTA + "));\n"
                    "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\n"
                    "ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V2_LISTA + "));\n"
                    "NOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado:', SAIDA.relative_to(AQUI.parent.parent))
print('gerado:', REVERTER.relative_to(AQUI.parent.parent))
