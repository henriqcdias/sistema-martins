"""Gera supabase/v16/migrations/20261117200000_martins_producao_v16_conciliacao_bancaria.sql e reverter_v16.sql
a partir da v14 (pode/contexto/salvar/catalogos/permissoes_definir já com pedidos_venda).
Uso: python3 supabase/v16/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V14 = AQUI.parent / 'v14' / 'migrations' / '20261117160000_martins_producao_v14_fluxo_orcamento.sql'
SAIDA = AQUI / 'migrations' / '20261117200000_martins_producao_v16_conciliacao_bancaria.sql'
REVERTER = AQUI / 'reverter_v16.sql'
V14_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
             "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',"
             "'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda'")
def funcao(t, a):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b, n=1):
    assert t.count(a) == n, (a[:70], t.count(a)); return t.replace(a, b)
v14 = V14.read_text(encoding='utf-8')
orig = {n: funcao(v14, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('),
                                       ('catalogos', 'public.martins_producao_catalogos('), ('perm', 'public.martins_producao_permissoes_definir(')]}
ANT, NOVO = "'contas_receber','pedidos_venda'", "'contas_receber','pedidos_venda','extratos_bancarios'"
pode = trocar(orig['pode'], ANT, NOVO)
contexto = trocar(orig['contexto'], ANT, NOVO)
catalogos = trocar(orig['catalogos'], ANT, NOVO)
perm = trocar(orig['perm'], ANT, NOVO)
salvar = trocar(orig['salvar'], "IF m IN ('estoque_movimentos','recebimentos_compra','pedidos_venda') THEN", "IF m IN ('estoque_movimentos','recebimentos_compra','pedidos_venda','extratos_bancarios') THEN")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v16/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2 a v10 e v14 aplicadas (v15 é recomendada, mas independente).\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v14 com o módulo de extratos bancários.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos, perm]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v16/gerar_migracao.py. Reverte a v16 (só se não houver linhas de extrato nem permissões do módulo).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='extratos_bancarios')\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo='extratos_bancarios') THEN\n  RAISE EXCEPTION 'Reversão bloqueada: há extratos importados ou permissões do módulo (apagaria a conciliação)'; END IF;\nEND $$;\n"
  + "\n\n".join(orig.values())
  + "\n\nDROP FUNCTION public.martins_producao_extrato_importar(uuid,uuid,uuid,text,jsonb);\nDROP FUNCTION public.martins_producao_extrato_conciliar(uuid,uuid,uuid,bigint,text,uuid,uuid);\nDROP FUNCTION public.martins_producao_extrato_desconciliar(uuid,uuid,uuid,bigint,text);\nDROP INDEX martins_producao_v1.extrato_linha_chave, martins_producao_v1.extrato_alvo_unico;\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V14_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V14_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v16')
