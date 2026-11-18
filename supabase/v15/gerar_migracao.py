"""Gera supabase/v15/migrations/20261117180000_martins_producao_v15_custo_parcelas_relatorios.sql e reverter_v15.sql.
Substitui consumir/devolver (v6), req_entregar (v8) e preparar_v10 (v10) por versões com o custo gravado / whitelist ampliada.
Uso: python3 supabase/v15/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent
def ler(d, nome): return (RAIZ / d / 'migrations' / nome).read_text(encoding='utf-8')
V6 = ler('v6', '20261116260000_martins_producao_v6_obra_consumo.sql'); V8 = ler('v8', '20261116300000_martins_producao_v8_requisicao_material.sql')
V10 = ler('v10', '20261116340000_martins_producao_v10_contas_receber.sql'); V12 = ler('v12', '20261117120000_martins_producao_v12_gastos_obra.sql'); V14 = ler('v14', '20261117160000_martins_producao_v14_fluxo_orcamento.sql')
SAIDA = AQUI / 'migrations' / '20261117180000_martins_producao_v15_custo_parcelas_relatorios.sql'; REVERTER = AQUI / 'reverter_v15.sql'
def funcao(t, a, publico=True):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b):
    assert t.count(a) == 1, (a[:80], t.count(a)); return t.replace(a, b)
consumir0 = funcao(V6, 'public.martins_producao_obra_consumir('); devolver0 = funcao(V6, 'public.martins_producao_obra_devolver(')
entregar0 = funcao(V8, 'public.martins_producao_req_entregar('); prep0 = funcao(V10, 'martins_producao_v1.preparar_v10(')
gastos0 = funcao(V12, 'public.martins_producao_obra_gastos('); converter0 = re.search(r'CREATE FUNCTION public\.martins_producao_orcamento_converter\(.*?\$\$.*?\$\$;', V14, re.S).group(0)
consumir = trocar(consumir0, "'obra_id',obra,'rdo_id',rdo,'motivo',NULLIF(trim(motivo),'')))", "'obra_id',obra,'rdo_id',rdo,'motivo',NULLIF(trim(motivo),''),'custo_unitario_centavos',martins_producao_v1.custo_medio(e,p)))")
entregar = trocar(entregar0, "'requisicao_id',requisicao,'motivo','Requisição nº '||(rq.dados->>'numero')))", "'requisicao_id',requisicao,'motivo','Requisição nº '||(rq.dados->>'numero'),'custo_unitario_centavos',martins_producao_v1.custo_medio(e,p)))")
devolver = trocar(devolver0, "'ref_id',consumo,'motivo',trim(motivo)))", "'ref_id',consumo,'motivo',trim(motivo),'custo_unitario_centavos',NULLIF(c.dados->>'custo_unitario_centavos','')::bigint))")
prep = trocar(prep0, "'estado','recebido_centavos','baixas')) THEN", "'estado','recebido_centavos','baixas','pedido_id','pedido_numero','parcela','parcelas')) THEN")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v15/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2 a v10 e v14 aplicadas.\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas de versões anteriores com o custo gravado no consumo e a whitelist das parcelas.\n\n" + "\n\n".join([consumir, entregar, devolver, prep]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v15/gerar_migracao.py. Reverte a v15 (só se não houver parcelas geradas por pedido). Consumos já gravados mantêm o custo.\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND NULLIF(dados->>'pedido_id','') IS NOT NULL) THEN\n  RAISE EXCEPTION 'Há contas a receber geradas por pedido; a reversão apagaria vínculos e foi bloqueada';\n END IF;\nEND $$;\n\n"
  + "\n\n".join([consumir0, entregar0, devolver0, prep0, gastos0])
  + "\n\nDROP FUNCTION public.martins_producao_financeiro_relatorios(uuid,date,date);\nDROP FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean,integer,date,integer);\n" + converter0
  + "\nREVOKE ALL ON FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean) FROM PUBLIC,anon;\nGRANT EXECUTE ON FUNCTION public.martins_producao_orcamento_converter(uuid,uuid,uuid,bigint,boolean) TO authenticated;\n"
  "DROP FUNCTION martins_producao_v1.custo_medio(uuid,uuid);\nDROP INDEX martins_producao_v1.conta_receber_parcela_unica;\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v15')
