# Contratos do Supabase de produção

Extraídos em 16/11/2026 do projeto `kkjwmnxgcbonbwavaaya`, com o MCP do Supabase em modo somente leitura (`supabase_read_only_user`). Nenhum cadastro foi lido. Só foram consultados estrutura, código das funções e contagens.

## Conteúdo

| Pasta | O que é | Confiabilidade |
|---|---|---|
| `migrations/` | As 6 migrações registradas em `supabase_migrations.schema_migrations`, **exatamente** como foram aplicadas | Original. O MD5 de cada arquivo confere com o banco |
| `base/estrutura_anterior_as_migracoes.sql` | Tabelas e funções criadas antes das migrações, sem registro | Reconstruído a partir do catálogo |

O MD5 do corpo das 11 funções `martins_online_*` e `martins_producao_*` ativas em produção é idêntico à última versão definida nas migrações. Portanto, não houve alteração manual depois das migrações.

| Versão | Migração | MD5 |
|---|---|---|
| 20261106160809 | cadastrar_empresas_e_unidades_grupo_martins | bf796cefb4d7cd558de0c2f7fc81fc7b |
| 20261106161019 | restringir_execucao_publica_rls_auto_enable | df2f2884ebdd6e2454eaeb74b053ee14 |
| 20261111214630 | martins_online_ponte_master | 44e7aca7b173b049770d1df6603b87db |
| 20261112091746 | martins_online_leitura_integral_autorizada | bc5f1c08766d2ab2fabbbde9fdc92011 |
| 20261113173937 | martins_producao_operacional_v1 | 2d9bebfe07965569e023008f7619ca5e |
| 20261113175149 | martins_producao_preservar_leitura_e_validar_equipe_rdo | 0478eb2b16dc84181162658214f15657 |

## Recriar em um projeto vazio (QA)

1. `base/estrutura_anterior_as_migracoes.sql`
2. Inserir a Construtora Martins com o id `4d9b925e-732f-4055-8f52-c40373425dd5`, que a primeira migração só atualiza.
3. `migrations/` em ordem de versão.
4. Provisionar usuários de teste: `auth.users`, depois `martins_perfis`, depois `martins_online_acessos` (papel `master`, `ativo = true`) e, para perfis não Master, `martins_producao_v1.permissoes`.

Nunca aplique isso em produção. Lá, tudo já existe.

## Situação da produção em 16/11/2026 (contagens)

| Tabela | Linhas |
|---|---|
| `martins_empresas` / `martins_unidades` | 3 / 4 |
| `auth.users` / `martins_perfis` / `martins_online_acessos` | 3 / 3 / 9 |
| `martins_online_estados` / `martins_online_revisoes` | 1 / 2 (estado do app legado, gravado pela ponte Master) |
| `martins_auditoria` | 14 |
| `martins_producao_v1.*` (registros, permissões, operações, auditoria) | 0 |
| depósitos, produtos, notas, preços, movimentos de estoque | 0 |

## Observações para as próximas fases

1. **Os contratos v1 só cobrem 6 módulos:** `funcionarios`, `obras`, `planejamento`, `rdos`, `frequencia` e `orcamentos`. Financeiro, despesas confidenciais, centros de custo, estoque, compras, produção e frota ainda não têm contrato no servidor.
2. **Há dois modelos de permissão.** As tabelas-base usam `martins_perfis.papel = 'administrador'` (`martins_empresa_autorizada`), e o v1 usa `martins_online_acessos.papel` mais `martins_producao_v1.permissoes`. Um usuário pode ser Master no v1 sem enxergar as tabelas-base.
3. **Privilégios residuais:** `anon` e `authenticated` têm TRUNCATE, REFERENCES, TRIGGER e MAINTAIN nas 9 tabelas-base. O PostgREST não expõe esses comandos, mas TRUNCATE ignora RLS. Sugestão de correção, a aplicar só com autorização:
   ```sql
   REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON
     public.martins_empresas, public.martins_unidades, public.martins_perfis,
     public.martins_auditoria, public.martins_depositos, public.martins_produtos,
     public.martins_notas_compra, public.martins_precos_compra, public.martins_movimentos_estoque
   FROM anon, authenticated;
   ```
4. As tabelas de `martins_producao_v1` têm RLS sem políticas e nenhum privilégio para `anon` e `authenticated`. O acesso acontece só pelas funções `SECURITY DEFINER`, que verificam `martins_producao_v1.pode`.

## Validação local

`validar-contratos.cjs` aplica a base e as 6 migrações num Postgres descartável em WebAssembly (PGlite), com uma simulação mínima do schema `auth`. Depois exercita os contratos: permissões, idempotência, conflito de revisão, CPF duplicado, limite de 8h entre obras, leitura integral sem escrita, isolamento entre empresas e auditoria.

```bash
npm install --no-save @electric-sql/pglite@0.2.17
node supabase/producao/validar-contratos.cjs .
```

Resultado em 16/11/2026: 17 de 17 verificações aprovadas. A trava de MD5 da migração 20261113175149 também passou, o que confirma que a migração anterior foi transcrita sem alterações.
