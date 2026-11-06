# Revisão de privilégios — preparação, não executar em produção

Projeto Supabase: `kkjwmnxgcbonbwavaaya`.
Verificação remota somente leitura: papéis `anon` e `authenticated` têm `TRUNCATE`, `TRIGGER` e `REFERENCES` nas nove tabelas públicas. RLS não substitui privilégios de tabela para essas operações.

## Consulta de conferência (somente leitura)
```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'martins_%'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
ORDER BY grantee, table_name, privilege_type;
```

## Proposta para homologação isolada — NÃO EXECUTAR NO PROJETO ATUAL
Após inventário de dependências, grants herdados e testes de aplicação, avaliar revogar somente os privilégios excessivos das nove tabelas identificadas. O SQL abaixo é uma **proposta para revisão**, não uma migração aprovada:

```sql
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.martins_empresas,
  public.martins_unidades,
  public.martins_perfis,
  public.martins_produtos,
  public.martins_depositos,
  public.martins_notas_compra,
  public.martins_precos_compra,
  public.martins_movimentos_estoque,
  public.martins_auditoria
FROM anon, authenticated;
```

Não revogar `SELECT`, `INSERT`, `UPDATE` ou `DELETE` sem revisar contratos. A função `public.martins_empresa_autorizada(uuid)` é `SECURITY DEFINER`, executável por `authenticated` e utilizada nas políticas RLS: **não alterar seus grants isoladamente**. `rls_auto_enable()` já está sem EXECUTE para `anon` e `authenticated`.

## Testes obrigatórios em homologação
1. Confirmar grants antes/depois e efetividade por papéis, inclusive herança de privilégios.
2. Executar os fluxos de estoque, depósitos e notas com usuários autenticados reais e usuários sem acesso.
3. Testar isolamento entre empresas e entre unidades Aços.
4. Testar Master e consulta restrita de José Henrique, inclusive revogação.
5. Testar Storage privado, upload/download e compartilhamento por documento; não há políticas em `storage.objects` no projeto atual.
6. Registrar resultados e rollback antes de solicitar autorização de produção.

**Estado:** somente documento de preparação. Nenhum SQL remoto de alteração foi executado.
