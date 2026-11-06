# Proposta 01 — autorizações multiempresa e quatro unidades

**NÃO APLICAR NO SUPABASE REMOTO.** Especificação de migração para revisão, não arquivo de migração executável. Data: 2026-11-06.

## 1. Inventário e compatibilidade
A base atual possui `public.martins_empresas`, `martins_unidades`, `martins_perfis` (chave primária `usuario_id` e `empresa_id` opcional), nove tabelas públicas com RLS e função `martins_empresa_autorizada(uuid)`. Essa função exige `papel='administrador'` e uma única `empresa_id`. Portanto, **não** basta inserir três Masters em `martins_perfis` nem mudar nomes de papéis. Não sobrescrever `martins_perfis` nem trocar seu UUID.

As migrações `supabase/homologacao/001..009` usam `martins_hml_v1` e devem permanecer isoladas até análise de compatibilidade.

## 2. Entidades
- Empresa jurídica 1: Construtora Martins, CNPJ 35.951.480/0001-50 — confirmar se corresponde ao registro existente; preservar seu UUID.
- Empresa jurídica 2: Calhas e Rufos Martins, CNPJ 60.408.057/0001-56.
- Empresa jurídica 3: Aços RR Ltda, CNPJ 48.044.404/0001-03.
- Quatro unidades: Construtora Martins, Calhas e Rufos Martins, Aços – Telha, Aços – Serralheria. As duas Aços usam o mesmo `empresa_id` e `unidade_id` distintos.
- Antes de criar empresas: validar CNPJs, correspondência da empresa existente e ausência de duplicatas por CNPJ normalizado.
- `martins_unidades.empresa_id` já possui FK; definir chave de unicidade `(empresa_id, nome)` após verificação de duplicatas.

## 3. Novas estruturas propostas
`martins_acessos_empresas(usuario_id uuid, empresa_id uuid, papel text, ativo boolean, criado_em timestamptz, concedido_por uuid)` com PK composta, FK para `auth.users` e `martins_empresas`. Papéis permitidos: `master`, `operacional`, `restrito`. **Não** assumir que um papel concede automaticamente todas as ações.

`martins_acessos_unidades(usuario_id uuid, unidade_id uuid, ativo boolean, concedido_por uuid)` com PK composta e FK para `martins_unidades`. Validar que cada concessão de unidade também possui concessão ativa para a empresa proprietária.

`martins_capacidades(usuario_id uuid, empresa_id uuid, capacidade text, permitido boolean, concedido_por uuid)` com PK composta e catálogo fechado de capacidades. Exemplos: `financeiro_lancar`, `financeiro_marcar_pago`, `financeiro_ver_compartilhado`, `financeiro_ver_saldo`, `financeiro_ver_extrato`, `financeiro_conciliar`, `documentos_privados`, `compras_gerir`, `rh_gerir`. Capacidade de conciliação e acesso bancário exclusiva de Masters, salvo compartilhamento explícito e granular de leitura financeira (nunca execução de PIX/transferência).

`martins_compartilhamentos_financeiros`: empresa, documento/registro, destinatário, concedente, escopo de leitura, expiração/revogação, auditoria. Compartilhar um lançamento não libera extratos e saldos por herança.

Todas as novas tabelas expostas exigem RLS habilitada desde a criação, sem políticas genéricas `TO authenticated USING(true)`. Concessões só por operação administrativa auditada; usuários não podem conceder a si mesmos o papel Master.

## 4. Regras de autorização
- Henrique, Camila e Robson: três contas Auth individuais, cada uma com acesso Master às três empresas e às quatro unidades. Não criar contas a partir de nomes sem identificação confirmada.
- Leonardo, Edson Carlos de Deus, Jennifer, Letícia, Gabriel: acessos operacionais por empresa e capacidades adequadas, incluindo registrar despesas pagas sem aprovação prévia, **não** acesso automático a extratos/saldos nem movimentação bancária.
- José Henrique: somente empresa Calhas e Rufos Martins, e somente registros financeiros explicitamente compartilhados.
- Aços – Telha e Aços – Serralheria: separar dados gerenciais por `unidade_id`; consolidação jurídica por `empresa_id`. Transferência de estoque entre unidades não é venda fiscal.
- Revogação de acesso deve impedir novas leituras e gravações após revalidação de sessão; não confiar exclusivamente em JWT com claims desatualizados.

## 5. Mudanças obrigatórias na função e no legado
Não substituir `martins_empresa_autorizada` diretamente sem inventariar todas as dependências. Criar uma função de autorização versionada, revisar `SECURITY DEFINER`, `search_path` e `EXECUTE` público, e migrar políticas por etapas. Considerar que tabelas com `empresa_id` e `unidade_id` precisam de integridade composta para impedir associação de produto de uma empresa com depósito de outra. Revisar concessões `TRUNCATE`, `REFERENCES`, `TRIGGER` a `anon`/`authenticated`.

## 6. Testes de aceitação obrigatórios (em homologação isolada)
| Identidade | Caso | Esperado |
|---|---|---|
| Master Henrique | Ler/operar as três empresas | Permitir conforme capacidade |
| Master Camila | Mesmo acesso independente | Permitir |
| Master Robson | Mesmo acesso independente | Permitir |
| Leonardo | Marcar despesa paga sem aprovação | Permitir e auditar |
| Gabriel | Tentar ler extrato bancário | Negar |
| José Henrique | Ler dados da Construtora | Negar |
| José Henrique | Ler despesa Calhas não compartilhada | Negar |
| José Henrique | Ler despesa Calhas explicitamente compartilhada | Permitir apenas leitura |
| Usuário Aços – Telha | Ler estoque Aços – Serralheria sem concessão | Negar |
| Usuário revogado | Repetir consulta e escrita | Negar |
| Usuário sem login | Acessar documentos privados | Negar |
| Usuário autenticado | Tentar elevar próprio papel a Master | Negar |
| Master | Conciliação manual | Permitir e auditar |
| Operacional | Conciliar banco | Negar |

## 7. Sequência para execução futura, sob autorização
1. Backup, validação da empresa existente e teste de restauração.
2. Migração canônica gerada com Supabase CLI em ambiente local, com histórico coerente.
3. Testes reais de RLS por identidade, Storage, integridade e concorrência.
4. Relatório de impacto e rollback.
5. Solicitar aprovação explícita para aplicar no Supabase remoto.
6. Aplicação controlada e verificação pós-implantação; **não** publicar automaticamente o site oficial.

**Estado atual:** somente proposta e inventário; nenhuma migração aplicada.
