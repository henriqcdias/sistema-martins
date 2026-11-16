"""Gera supabase/v2/migrations/20261116120000_martins_producao_v2_cadastros_financeiro.sql.

As funções existentes (pode, contexto, consultar, salvar) são copiadas LITERALMENTE
das migrações de produção e recebem só as alterações abaixo, cada uma conferida por
contagem. Assim não há transcrição manual do código que já roda em produção.

Uso: python3 supabase/v2/gerar_migracao.py
"""
import pathlib
import re

AQUI = pathlib.Path(__file__).resolve().parent
PROD = AQUI.parent / 'producao' / 'migrations'
SAIDA = AQUI / 'migrations' / '20261116120000_martins_producao_v2_cadastros_financeiro.sql'

V1 = "('funcionarios','obras','planejamento','rdos','frequencia','orcamentos')"
V2_NOVOS = ['clientes', 'fornecedores', 'vendedores', 'motoristas', 'veiculos', 'produtos',
            'depositos', 'centros_custo', 'contas_bancarias', 'despesas']
TODOS = "('funcionarios','obras','planejamento','rdos','frequencia','orcamentos','" + "','".join(V2_NOVOS) + "')"


def funcao(arquivo, assinatura):
    """Extrai 'CREATE [OR REPLACE] FUNCTION <assinatura>...$$;' de uma migração."""
    texto = (PROD / arquivo).read_text(encoding='utf-8')
    m = re.search(r'CREATE (?:OR REPLACE )?FUNCTION ' + re.escape(assinatura) + r'.*?\$\$.*?\$\$;', texto, re.S)
    assert m, assinatura
    return 'CREATE OR REPLACE FUNCTION ' + m.group(0).split('FUNCTION ', 1)[1]


def trocar(texto, antes, depois, vezes=1):
    assert texto.count(antes) == vezes, (antes[:70], texto.count(antes))
    return texto.replace(antes, depois)


M5 = '20261113173937_martins_producao_operacional_v1.sql'
M6 = '20261113175149_martins_producao_preservar_leitura_e_validar_equipe_rdo.sql'

# pode: aceita os módulos v2.
pode = trocar(funcao(M6, 'martins_producao_v1.pode('), ' AND m IN ' + V1, ' AND m IN ' + TODOS)

# contexto: devolve as permissões de todos os módulos.
contexto = trocar(funcao(M5, 'public.martins_producao_contexto('),
                  "unnest(ARRAY['funcionarios','obras','planejamento','rdos','frequencia','orcamentos'])",
                  "unnest(ARRAY" + TODOS.replace('(', '[').replace(')', ']') + ")")

# consultar: despesa confidencial só para Master; quem não é Master vê apenas as próprias,
# salvo administrador com leitura integral. Vale para listagem e para consulta por id.
consultar = trocar(funcao(M5, 'public.martins_producao_consultar('),
                   " AND (r IS NULL OR x.id=r) AND (apos IS NULL OR x.id>apos) ORDER BY x.id LIMIT limite) t)",
                   " AND (r IS NULL OR x.id=r) AND (apos IS NULL OR x.id>apos)\n"
                   " AND (x.modulo<>'despesas' OR public.martins_online_master(e) OR (NOT COALESCE((x.dados->>'confidencial')::boolean,false)\n"
                   "  AND (x.criado_por=auth.uid() OR public.martins_online_leitor(e))))\n"
                   " ORDER BY x.id LIMIT limite) t)")

# salvar: depois da revisão conferida, os módulos v2 passam por preparar_v2.
salvar = trocar(funcao(M6, 'public.martins_producao_salvar('),
                " IF (v=0 AND FOUND) OR (v>0 AND (NOT FOUND OR anterior.revisao<>v)) THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;\n",
                " IF (v=0 AND FOUND) OR (v>0 AND (NOT FOUND OR anterior.revisao<>v)) THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;\n"
                " IF m IN ('" + "','".join(V2_NOVOS) + "') THEN d:=martins_producao_v1.preparar_v2(e,m,r,v,d,anterior); END IF;\n")

# catálogos: listas de seleção (id + rótulo) para não digitar texto livre.
catalogos = """CREATE OR REPLACE FUNCTION public.martins_producao_catalogos(e uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE lancar boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY""" + TODOS.replace('(', '[').replace(')', ']') + """) m WHERE COALESCE(martins_producao_v1.pode(e,m,'ler'),false)) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
 lancar := COALESCE(martins_producao_v1.pode(e,'despesas','criar'),false);
 RETURN jsonb_build_object('empresa_id',e,
 'obras',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','codigo',x.dados->>'codigo') ORDER BY x.id) FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='obras'),'[]'::jsonb),
 'funcionarios',CASE WHEN martins_producao_v1.pode(e,'funcionarios','ler') OR martins_producao_v1.pode(e,'rdos','ler') OR martins_producao_v1.pode(e,'frequencia','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','funcao',x.dados->>'funcao','status',x.dados->>'status') ORDER BY x.id) FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='funcionarios'),'[]'::jsonb) ELSE '[]'::jsonb END,
 'centros_custo',CASE WHEN lancar OR martins_producao_v1.pode(e,'centros_custo','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'codigo',x.dados->>'codigo','nome',x.dados->>'nome','tipo',x.dados->>'tipo','obra_id',x.dados->>'obra_id') ORDER BY x.dados->>'codigo') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='centros_custo' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'fornecedores',CASE WHEN lancar OR martins_producao_v1.pode(e,'fornecedores','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome') ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='fornecedores' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'contas_bancarias',CASE WHEN lancar OR martins_producao_v1.pode(e,'contas_bancarias','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome') ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='contas_bancarias' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'depositos',CASE WHEN martins_producao_v1.pode(e,'depositos','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome','principal',COALESCE((x.dados->>'principal')::boolean,false)) ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='depositos' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'clientes',CASE WHEN martins_producao_v1.pode(e,'clientes','ler') OR martins_producao_v1.pode(e,'orcamentos','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',x.dados->>'nome') ORDER BY x.dados->>'nome') FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='clientes' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END,
 'vendedores',CASE WHEN martins_producao_v1.pode(e,'vendedores','ler') OR martins_producao_v1.pode(e,'orcamentos','ler') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'nome',COALESCE(x.dados->>'nome',f.dados->>'nome'),'funcionario_id',x.dados->>'funcionario_id') ORDER BY x.id) FROM martins_producao_v1.registros x LEFT JOIN martins_producao_v1.registros f ON f.empresa_id=x.empresa_id AND f.modulo='funcionarios' AND f.id::text=x.dados->>'funcionario_id' WHERE x.empresa_id=e AND x.modulo='vendedores' AND COALESCE((x.dados->>'ativo')::boolean,true)),'[]'::jsonb) ELSE '[]'::jsonb END);
END $$;"""

cabecalho = """-- GERADO por supabase/v2/gerar_migracao.py. Não edite à mão.
-- Contratos v2: cadastros (clientes, fornecedores, vendedores, motoristas, veículos,
-- produtos, depósitos, centros de custo, contas bancárias) e despesas com confidencialidade.
-- Pré-requisito: migrações de supabase/producao/migrations aplicadas.
BEGIN;
"""
corpo = '\n\n'.join([
    (AQUI / 'parte_nova.sql').read_text(encoding='utf-8').strip(),
    '-- 7. Funções existentes, copiadas da produção com as alterações v2.',
    pode, contexto, consultar, salvar, catalogos,
])
SAIDA.parent.mkdir(exist_ok=True)
SAIDA.write_text(cabecalho + corpo + "\n\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n", encoding='utf-8')
print('gerado:', SAIDA.relative_to(AQUI.parent.parent))

# Reversão: devolve as 5 funções às versões de produção e remove os objetos v2.
# Recusa se já houver registro de módulo v2, para nunca apagar dados.
REVERTER = AQUI / 'reverter_v2.sql'
originais = [funcao(M6, 'martins_producao_v1.pode('), funcao(M5, 'public.martins_producao_contexto('),
             funcao(M5, 'public.martins_producao_consultar('), funcao(M6, 'public.martins_producao_salvar('),
             funcao(M5, 'public.martins_producao_catalogos(')]
REVERTER.write_text("""-- GERADO por supabase/v2/gerar_migracao.py. Reverte a v2 (só se não houver dados v2).
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM martins_producao_v1.registros WHERE modulo IN ('""" + "','".join(V2_NOVOS) + """'))
  OR EXISTS(SELECT 1 FROM martins_producao_v1.permissoes WHERE modulo IN ('""" + "','".join(V2_NOVOS) + """')) THEN
  RAISE EXCEPTION 'Há registros ou permissões de módulos v2; a reversão apagaria dados e foi bloqueada';
 END IF;
END $$;
""" + '\n\n'.join(originais) + """

DROP FUNCTION public.martins_producao_despesa_estado(uuid,uuid,bigint,text,text,uuid);
DROP FUNCTION public.martins_producao_despesas_totais(uuid,date,date);
DROP FUNCTION martins_producao_v1.preparar_v2(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros);
DROP FUNCTION martins_producao_v1.existe(uuid,text,uuid);
DROP INDEX martins_producao_v1.pessoas_documento_empresa, martins_producao_v1.vinculo_funcionario_empresa,
 martins_producao_v1.veiculos_placa_empresa, martins_producao_v1.produtos_codigo_empresa, martins_producao_v1.depositos_nome_empresa,
 martins_producao_v1.depositos_principal_empresa, martins_producao_v1.centros_custo_codigo_empresa;
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN """ + V1 + """);
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN """ + V1 + """);
NOTIFY pgrst,'reload schema';
COMMIT;
""", encoding='utf-8')
print('gerado:', REVERTER.relative_to(AQUI.parent.parent))
