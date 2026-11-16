-- Projeto kkjwmnxgcbonbwavaaya. Somente metadados, sem ler cadastros.
begin read only;
with funcoes as (
    select n.nspname as schema,
           p.proname as nome,
           pg_get_function_arguments(p.oid) as parametros,
           pg_get_function_result(p.oid) as retorno,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_executa,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_executa,
           pg_get_functiondef(p.oid) as definicao
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f' and (
        (n.nspname = 'public' and p.proname in (
            'martins_producao_contexto', 'martins_producao_catalogos',
            'martins_producao_consultar', 'martins_producao_salvar',
            'martins_producao_salvar_lote'))
        or (n.nspname = 'martins_producao_v1' and p.proname in ('pode', 'projetar'))
    )
), tabelas as (
    select c.oid, c.relname as nome, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'martins_producao_v1'
      and c.relname in ('registros', 'operacoes', 'auditoria')
)
select jsonb_build_object(
    'rpc', (select coalesce(jsonb_agg(to_jsonb(f) order by f.schema, f.nome), '[]') from funcoes f),
    'tabelas', coalesce(jsonb_agg(jsonb_build_object(
        'nome', t.nome, 'rls', t.rls,
        'colunas', (select jsonb_agg(jsonb_build_object(
            'nome', a.attname, 'tipo', format_type(a.atttypid, a.atttypmod),
            'obrigatoria', a.attnotnull) order by a.attnum)
            from pg_attribute a where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped),
        'indices', (select jsonb_agg(pg_get_indexdef(i.indexrelid) order by i.indexrelid)
            from pg_index i where i.indrelid = t.oid),
        'restricoes', (select jsonb_agg(pg_get_constraintdef(c.oid) order by c.conname)
            from pg_constraint c where c.conrelid = t.oid),
        'gatilhos', (select jsonb_agg(pg_get_triggerdef(g.oid) order by g.tgname)
            from pg_trigger g where g.tgrelid = t.oid and not g.tgisinternal)
    ) order by t.nome), '[]')
) as contrato_producao
from tabelas t;
rollback;
