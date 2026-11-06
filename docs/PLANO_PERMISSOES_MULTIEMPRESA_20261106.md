# Sistema Martins — contrato de permissões multiempresa (06/11/2026)

## Estado confirmado no Supabase
Projeto `kkjwmnxgcbonbwavaaya`. Três empresas jurídicas e quatro unidades operacionais foram cadastradas. Há apenas uma conta autenticada e um perfil denominado **Administrador inicial**, associado à Construtora Martins. Não há comprovação suficiente para atribuir essa conta a um Master nominal.

## Modelo de acesso proposto
- Henrique, Camila e Robson: papel **master**, com acesso explícito às três empresas; cada concessão exige associação inequívoca ao `auth.users.id`.
- José Henrique: somente **Calhas e Rufos Martins**. Acesso a dados financeiros apenas quando compartilhados por autorização granular explícita.
- Funcionários: acesso mínimo necessário por empresa, unidade, módulo e ação; nunca inferir acesso a partir de nome ou `user_metadata`.
- Aços – Telha e Aços – Serralheria compartilham a mesma empresa jurídica, mas exigem segregação por `unidade_id` em operações e estoque.

## Contrato técnico
1. Criar tabela de associação usuário–empresa com unicidade por par, papel controlado e campo ativo, referenciando `auth.users` e `martins_empresas`.
2. Criar associações de unidade quando necessárias; negar acesso se a unidade não pertencer à empresa autorizada.
3. Não confiar em `localStorage`, seletor visual, parâmetros de URL ou `raw_user_meta_data` para autorização.
4. Políticas RLS de leitura e escrita devem verificar identidade, empresa, papel, propriedade e compartilhamentos; `UPDATE` exige `USING` e `WITH CHECK`.
5. Separar visualização de despesas, criação, edição, conferência, pagamento e operações bancárias. Marcar como pago não autoriza transferências ou PIX.
6. Acesso a anexos privados deve ser verificado no Storage por empresa, usuário, tarefa e documento.
7. Manter o perfil inicial e as políticas atuais até migração validada. Não atribuir Master a contas sem identificação inequívoca.
8. A função `martins_empresa_autorizada(uuid)` atual usa `SECURITY DEFINER` e consulta `martins_perfis` para papel `administrador`. Revisar dependências e implementar transição compatível antes de substituir.
9. A função `rls_auto_enable()` teve execução pública revogada na migração `restringir_execucao_publica_rls_auto_enable`.
10. Testar com sessões reais: Master de três empresas, José Henrique restrito, colaborador de uma empresa, usuário sem vínculo e tentativa de cruzar `empresa_id`/`unidade_id`.

## Critérios de ativação
- Contas autenticadas verificadas; nenhuma conta criada por adivinhação.
- Migração revisada e aplicada com sucesso, com auditoria posterior.
- RLS e Storage testados contra leitura e escrita cruzadas.
- Compatibilidade com branch `desenvolvimento` conferida.
- Nenhum deploy Netlify é autorizado por este documento.

**Status:** especificação preparada no GitHub. Nenhuma nova concessão de acesso foi ativada por este commit.
