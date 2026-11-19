"""Gera supabase/v17/migrations/20261118120000_martins_producao_v17_apontamentos_henrique.sql e reverter_v17.sql
a partir da v16 (pode/contexto/salvar/catalogos/permissoes_definir já com extratos_bancarios).
Uso: python3 supabase/v17/gerar_migracao.py"""
import pathlib, re
AQUI = pathlib.Path(__file__).resolve().parent
V16 = AQUI.parent / 'v16' / 'migrations' / '20261117200000_martins_producao_v16_conciliacao_bancaria.sql'
SAIDA = AQUI / 'migrations' / '20261118120000_martins_producao_v17_apontamentos_henrique.sql'
REVERTER = AQUI / 'reverter_v17.sql'
V16_LISTA = ("'funcionarios','obras','planejamento','rdos','frequencia','orcamentos','clientes','fornecedores','vendedores','motoristas','veiculos',"
             "'produtos','depositos','centros_custo','contas_bancarias','despesas','feriados','precos_insumo','epis','estoque_movimentos','pedidos_compra','recebimentos_compra',"
             "'frota_eventos','ausencias','cotacoes','requisicoes_material','contas_receber','pedidos_venda','extratos_bancarios'")
def funcao(t, a):
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(a) + r'.*?\$\$.*?\$\$;', t, re.S); assert m, a
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]
def trocar(t, a, b, n=1):
    assert t.count(a) == n, (a[:80], t.count(a)); return t.replace(a, b)
v16 = V16.read_text(encoding='utf-8')
orig = {n: funcao(v16, a) for n, a in [('pode', 'martins_producao_v1.pode('), ('contexto', 'public.martins_producao_contexto('), ('salvar', 'public.martins_producao_salvar('),
                                       ('catalogos', 'public.martins_producao_catalogos('), ('perm', 'public.martins_producao_permissoes_definir(')]}
ANT, NOVO = "'pedidos_venda','extratos_bancarios'", "'pedidos_venda','extratos_bancarios','epi_entregas'"
pode = trocar(orig['pode'], ANT, NOVO); contexto = trocar(orig['contexto'], ANT, NOVO); catalogos = trocar(orig['catalogos'], ANT, NOVO); perm = trocar(orig['perm'], ANT, NOVO)
catalogos = trocar(catalogos, "jsonb_build_object('id',x.id,'nome',x.dados->>'nome','funcao',x.dados->>'funcao','status',x.dados->>'status')", "jsonb_build_object('id',x.id,'nome',x.dados->>'nome','funcao',x.dados->>'funcao','status',x.dados->>'status','crea',NULLIF(btrim(x.dados->>'crea'),''))")
salvar = trocar(orig['salvar'], " ELSIF m='contas_receber' THEN d:=martins_producao_v1.preparar_v10(e,m,r,v,d,anterior); END IF;",
 " ELSIF m='contas_receber' THEN d:=martins_producao_v1.preparar_v10(e,m,r,v,d,anterior);\n ELSIF m='epi_entregas' THEN d:=martins_producao_v1.preparar_v17(e,m,r,v,d,anterior); END IF;")
salvar = trocar(salvar, "'enderecoLocalizacao','responsavelTecnico','encarregado'", "'enderecoLocalizacao','responsavelTecnico','responsavel_tecnico_id','encarregado'")
salvar = trocar(salvar, " IF m='obras' AND NULLIF(trim(d->>'codigo'),'') IS NULL THEN RAISE EXCEPTION 'Código obrigatório' USING ERRCODE='22023'; END IF;",
 """ IF m='obras' AND NULLIF(trim(d->>'codigo'),'') IS NULL THEN RAISE EXCEPTION 'Código obrigatório' USING ERRCODE='22023'; END IF;
 IF m='obras' AND NULLIF(d->>'responsavel_tecnico_id','') IS NOT NULL THEN
 SELECT x.dados->>'nome' INTO nome_rt FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='funcionarios' AND x.id=(d->>'responsavel_tecnico_id')::uuid AND NULLIF(btrim(x.dados->>'crea'),'') IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'O responsável técnico precisa ser um funcionário cadastrado com CREA' USING ERRCODE='22023'; END IF;
 d:=d||jsonb_build_object('responsavelTecnico',nome_rt);
 END IF;""")
salvar = trocar(salvar, " IF m='rdos' THEN\n dia:=(d->>'data')::date;IF dia IS NULL",
 """ IF m='rdos' THEN
 IF v>0 AND COALESCE(anterior.dados->>'status','')='aprovado' THEN RAISE EXCEPTION 'RDO aprovado não pode ser editado; reabra o RDO (com motivo) para alterar' USING ERRCODE='22023'; END IF;
 d:=d-'aprovado_por'-'aprovado_por_nome'-'aprovado_em'-'rt_id'-'rt_nome'-'rt_crea'-'historicoStatus';
 IF v>0 AND anterior.dados ? 'historicoStatus' THEN d:=d||jsonb_build_object('historicoStatus',anterior.dados->'historicoStatus'); END IF;
 END IF;
 IF m='rdos' THEN
 dia:=(d->>'data')::date;IF dia IS NULL""")
salvar = trocar(salvar, "vistos uuid[]:=ARRAY[]::uuid[];\nBEGIN", "vistos uuid[]:=ARRAY[]::uuid[]; nome_rt text;\nBEGIN")
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text("-- GERADO por supabase/v17/gerar_migracao.py. Não edite à mão.\n-- Pré-requisito: producao, v2 a v10, v14 e v16 aplicadas.\nBEGIN;\n" + (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip()
  + "\n\n-- Funções existentes, copiadas da v16 com o módulo de recibos de EPI, a regra do RDO aprovado e o responsável técnico da obra.\n\n" + "\n\n".join([pode, contexto, salvar, catalogos, perm]) + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
REVERTER.write_text("-- GERADO por supabase/v17/gerar_migracao.py. Reverte a v17 (só se não houver recibos de EPI nem permissões do módulo; RDOs aprovados voltam a rascunho).\nBEGIN;\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo='epi_entregas')\n  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo='epi_entregas') THEN\n  RAISE EXCEPTION 'Reversão bloqueada: há recibos de EPI ou permissões do módulo (apagaria entregas)'; END IF;\nEND $$;\n"
  "UPDATE martins_producao_v1.registros SET dados=(dados-'aprovado_por'-'aprovado_por_nome'-'aprovado_em'-'rt_id'-'rt_nome'-'rt_crea')||jsonb_build_object('status','rascunho') WHERE modulo='rdos' AND dados->>'status'='aprovado';\n"
  + "\n\n".join(orig.values())
  + "\n\nDROP FUNCTION public.martins_producao_rdo_estado(uuid,uuid,uuid,bigint,text,text);\nDROP FUNCTION public.martins_producao_nomes(uuid,uuid[]);\nDROP FUNCTION martins_producao_v1.preparar_v17(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros);\nDROP INDEX martins_producao_v1.epi_entrega_numero;\n"
  "CREATE OR REPLACE FUNCTION martins_producao_v1.projetar(x martins_producao_v1.registros) RETURNS jsonb\nLANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$\n SELECT CASE WHEN x.modulo<>'obras' OR public.martins_online_master(x.empresa_id) THEN to_jsonb(x)\n ELSE jsonb_set(to_jsonb(x),'{dados}',COALESCE((SELECT jsonb_object_agg(k,v) FROM jsonb_each(x.dados) kv(k,v)\n WHERE k IN ('nome','codigo','status','clienteResponsavel','enderecoLocalizacao','responsavelTecnico','encarregado','equipesVinculadas','equipesTerceirizadas','dataInicio','previsaoConclusao','situacaoAtual','descricao')),'{}'::jsonb)) END\n$$;\n"
  "ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;\nALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (" + V16_LISTA + "));\n"
  "ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;\nALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (" + V16_LISTA + "));\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado v17')
