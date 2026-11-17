"""Gera supabase/v14/migrations/20261117160000_martins_producao_v14_fluxo_orcamento.sql e reverter_v14.sql
a partir da v10 (pode/contexto/salvar/catalogos/permissoes_definir já com contas_receber).
Uso: python3 supabase/v14/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V10 = AQUI.parent / 'v10' / 'migrations' / '20261116340000_martins_producao_v10_contas_receber.sql'
SAIDA = AQUI / 'migrations' / '20261117160000_martins_producao_v14_fluxo_orcamento.sql'
REVERTER = AQUI / 'reverter_v14.sql'
V10_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
             "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',"
             "'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber'")
V14_LISTA = V10_LISTA + ",'pedidos_venda'"
def funcao(t, a):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b):
    assert t.count(a) == 1, (a[:70], t.count(a)); return t.replace(a, b)
v10 = V10.read_text(encoding='utf-8')
orig = {n: funcao(v10, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('),
                                       ('catalogos', 'public.martins_producao_catalogos('), ('perm', 'public.martins_producao_permissoes_definir(')]}
pode = trocar(orig['pode'], ' AND m IN (' + V10_LISTA + ')', ' AND m IN (' + V14_LISTA + ')')
contexto = trocar(orig['contexto'], 'unnest(ARRAY[' + V10_LISTA + '])', 'unnest(ARRAY[' + V14_LISTA + '])')
catalogos = trocar(orig['catalogos'], 'unnest(ARRAY[' + V10_LISTA + '])', 'unnest(ARRAY[' + V14_LISTA + '])')
perm = trocar(orig['perm'], 'ARRAY[' + V10_LISTA + '];', 'ARRAY[' + V14_LISTA + '];')
salvar = trocar(orig['salvar'], " IF m IN ('estoque_movimentos','recebimentos_compra') THEN RAISE EXCEPTION", " IF m IN ('estoque_movimentos','recebimentos_compra','pedidos_venda') THEN RAISE EXCEPTION")
salvar = trocar(salvar, " IF m='orcamentos' THEN\n IF jsonb_typeof(d->'itens') IS DISTINCT FROM 'array'",
 """ IF m='orcamentos' THEN
 -- número e situação são do servidor; orçamento convertido/entregue não é mais editado
 IF v>0 AND COALESCE(anterior.dados->>'status','') IN ('Convertido em venda','Entregue') THEN RAISE EXCEPTION 'Orçamento já convertido em venda não pode ser editado' USING ERRCODE='22023'; END IF;
 IF v=0 OR NULLIF(anterior.dados->>'numero','') IS NULL THEN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(e::text||'orcamento-numero',0));
 SELECT COALESCE(max((x.dados->>'numero')::bigint),0)+1 INTO total FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='orcamentos';
 d:=(d-'numero')||jsonb_build_object('numero',total::bigint);
 ELSE d:=(d-'numero')||jsonb_build_object('numero',(anterior.dados->>'numero')::bigint); END IF;
 d:=(d-'status'-'historicoStatus'-'pedido_id'-'pedido_numero')||jsonb_build_object('status',CASE WHEN v=0 THEN 'Em elaboração' ELSE COALESCE(NULLIF(CASE anterior.dados->>'status' WHEN 'Em Orçamento' THEN 'Em elaboração' ELSE anterior.dados->>'status' END,''),'Em elaboração') END);
 IF v>0 AND anterior.dados ? 'historicoStatus' THEN d:=d||jsonb_build_object('historicoStatus',anterior.dados->'historicoStatus'); END IF;
 IF v>0 AND anterior.dados ? 'pedido_id' THEN d:=d||jsonb_build_object('pedido_id',anterior.dados->'pedido_id','pedido_numero',anterior.dados->'pedido_numero'); END IF;
 END IF;
 IF m='orcamentos' THEN
 IF jsonb_typeof(d->'itens') IS DISTINCT FROM 'array'""")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v14/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2 a v10 aplicadas (v11 a v13 são independentes).\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v10 com o módulo de pedidos de venda e a regra de orçamento.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos, perm]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v14/gerar_migracao.py. Reverte a v14 (só se não houver pedidos de venda nem permissões do módulo).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='pedidos_venda')\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo='pedidos_venda') THEN\n  RAISE EXCEPTION 'Há pedidos de venda ou permissões do módulo; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n\n"
  + "\n\n".join(orig.values())
  + "\n\nDROP FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean);\nDROP FUNCTION public.martins_producao_orcamento_estado(uuid,uuid,uuid,bigint,text,text);\nDROP INDEX martins_producao_v1.pedido_venda_por_orcamento, martins_producao_v1.pedido_venda_numero_empresa, martins_producao_v1.orcamento_numero_empresa;\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V10_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V10_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v14')
