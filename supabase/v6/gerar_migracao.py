"""Gera supabase/v6/migrations/20261116260000_martins_producao_v6_obra_consumo.sql e reverter_v6.sql.
Substitui só martins_producao_estoque_mover (da v4), que passa a recusar o estorno de consumo/devolução de obra
(a correção do consumo é feita por devolução). Uso: python3 supabase/v6/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V4 = AQUI.parent / 'v4' / 'migrations' / '20261116220000_martins_producao_v4_estoque.sql'
SAIDA = AQUI / 'migrations' / '20261116260000_martins_producao_v6_obra_consumo.sql'
REVERTER = AQUI / 'reverter_v6.sql'
m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION public\.martins_producao_estoque_mover\(.*?\$\$.*?\$\$;', (V4).read_text(encoding='utf-8'), re.S)
assert m
mover_v4 = 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
antes = "  IF NOT FOUND OR orig.dados->>'tipo'='estorno' THEN RAISE EXCEPTION 'Movimento original não encontrado ou não estornável' USING ERRCODE='23503'; END IF;"
assert mover_v4.count(antes) == 1
mover_v6 = mover_v4.replace(antes, antes.replace("orig.dados->>'tipo'='estorno'", "orig.dados->>'tipo'='estorno'")
    + "\n  IF orig.dados->>'tipo' IN ('consumo','devolucao_obra') THEN RAISE EXCEPTION 'Consumo de obra não é estornado: registre uma devolução de material' USING ERRCODE='22023'; END IF;")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v6/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2, v3, v4 e v5 aplicadas.\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Função da v4 com a regra de estorno ajustada.\n\n" + mover_v6 + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v6/gerar_migracao.py. Reverte a v6 (só se não houver consumos/devoluções).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos' AND dados->>'tipo' IN ('consumo','devolucao_obra')) THEN\n  RAISE EXCEPTION 'Há consumos ou devoluções de obra; a reversão apagaria dados e foi bloqueada';\n END IF;\nEND $$;\n"
  + mover_v4 + "\n\nDROP FUNCTION public.martins_producao_obra_consumir(uuid,uuid,uuid,uuid,jsonb,uuid,text);\nDROP FUNCTION public.martins_producao_obra_devolver(uuid,uuid,uuid,bigint,text);\nDROP FUNCTION public.martins_producao_obra_materiais(uuid,uuid);\nDROP INDEX martins_producao_v1.consumo_unico_por_rdo;\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v6')
