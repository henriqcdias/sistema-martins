# Supabase — relatório de segurança e pré-condições (2026-11-06)

Projeto conferido: Sistema Martins, `kkjwmnxgcbonbwavaaya`. Inspeção por ferramentas oficiais, **sem executar DDL/DML**.

## Resultado de verificações remotas
- Histórico de migrações remoto: `[]` (nenhuma migração registrada). Isso **não** significa ausência de objetos no banco: o inventário confirmou nove tabelas públicas.
- Security advisors:
  1. `anon_security_definer_function_executable` (WARN): `public.rls_auto_enable()` executável pelo papel `anon`. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
  2. `authenticated_security_definer_function_executable` (WARN): `public.martins_empresa_autorizada(uuid)` e `public.rls_auto_enable()` executáveis pelo papel `authenticated`. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  3. `auth_leaked_password_protection` (WARN): verificação de senhas comprometidas desativada. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Interpretação
Acessibilidade de `SECURITY DEFINER` exige revisão do corpo, proprietário, dependências e permissões; **não** presumir exploração, mas também **não** presumir segurança. A função `martins_empresa_autorizada` é usada pelas políticas existentes, portanto não revogar EXECUTE indiscriminadamente sem testes. Investigar `rls_auto_enable()` com prioridade por ser invocável sem login.

## Próximas ações, sem produção
1. Inventariar `pg_get_functiondef`, proprietários, `proacl`, dependências e gatilhos das funções sinalizadas, usando apenas SELECT de catálogo.
2. Escrever correções de privilégios para ambiente de homologação isolado, com teste de regressão RLS e sem depender de `user_metadata`.
3. Conferir histórico de migrações locais com o estado remoto antes de planejar qualquer migração.
4. Preparar matriz de testes de Masters, funcionários, José Henrique e unidades Aços.
5. Solicitar aprovação expressa antes de aplicar correções ao projeto Supabase atual.

**Nenhuma mudança remota foi aplicada.**
