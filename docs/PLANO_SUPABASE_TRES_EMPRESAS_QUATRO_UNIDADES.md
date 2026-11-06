# Sistema Martins — plano de migração multiempresa (pré-aprovação)

Data: 2026-11-06. Origem: inventário **somente leitura** do projeto Supabase Sistema Martins, sa-east-1. Base GitHub: desenvolvimento @ 3b5b9cd48ba27aef9f1b3883db1e59ef4488354a.

**Status: proposta técnica; não executar SQL remoto.** Nenhuma empresa, usuário, permissão ou registro foi alterado.

## Inventário confirmado
- 9 tabelas públicas: martins_empresas, martins_unidades, martins_perfis, martins_produtos, martins_depositos, martins_notas_compra, martins_precos_compra, martins_movimentos_estoque e martins_auditoria.
- RLS habilitado nas nove tabelas. Existem políticas SELECT por empresa; INSERT/UPDATE foram identificadas apenas para produtos e depósitos.
- 1 registro de empresa, 1 perfil e 0 unidades (não inferir identidade dos registros sem conferência controlada).
- 8 buckets privados: rdo-fotos, funcionarios, obras, notas-fiscais, contratos, comprovantes, veiculos e projetos-engenharia. Nenhuma política em storage.objects identificada.
- A função public.martins_empresa_autorizada(uuid) é SECURITY DEFINER e autoriza somente perfil ativo com papel='administrador' e empresa_id correspondente. **Não representa três Masters multiempresa**.
- Foram identificados privilégios TRUNCATE, REFERENCES e TRIGGER para anon/authenticated em tabelas públicas; revisar/revogar privilégios excessivos antes da operação.
- O banco remoto ainda não contém as tabelas canônicas de Financeiro, RH, RDO e demais módulos existentes na aplicação local.

## Modelo-alvo aprovado pelo usuário
Empresas jurídicas (3): Construtora Martins (35.951.480/0001-50); Calhas e Rufos Martins (60.408.057/0001-56); Aços RR Ltda (48.044.404/0001-03).

Unidades (4): Construtora Martins; Calhas e Rufos Martins; Aços – Telha; Aços – Serralheria. As duas últimas pertencem à Aços RR Ltda, com contabilidade gerencial separada e consolidação por CNPJ. **Não criar quarta empresa jurídica.**

Masters (3): Henrique, Camila, Robson, acesso integral às três empresas e quatro unidades, com autenticação individual e auditoria. Equipe operacional: Leonardo, Edson Carlos de Deus, Jennifer, Letícia e Gabriel; permissão operacional ampla e registro de despesas pagas, sem acesso bancário automático nem execução de transferências. José Henrique: somente Calhas e Rufos Martins, e dados financeiros apenas se explicitamente compartilhados. Não cadastrar contas por nomes automaticamente.

## Sequência de preparação
1. **Pré-migração:** conferir qual é a empresa já registrada e seu UUID, além do perfil existente; produzir backup lógico/estrutural e plano de rollback, sem sobrescrever o UUID.
2. **Entidades:** reutilizar martins_empresas; adicionar as duas empresas faltantes apenas após conferência; vincular quatro martins_unidades às três empresas, com unicidade por empresa/nome e FKs coerentes.
3. **Autorização:** substituir a regra baseada em um único martins_perfis.empresa_id por concessões por usuário/empresa/unidade e capacidades; Master como papel distinto, sem usar user_metadata editável. Avaliar função SECURITY DEFINER atual, EXECUTE para PUBLIC e grants de tabelas.
4. **Isolamento:** adicionar validações de empresa/unidade coerentes para estoque, depósitos, notas e movimentos; impedir vínculos cruzados por FKs isoladas; testar negação entre empresas e entre unidades Aços.
5. **Storage:** políticas em storage.objects baseadas em autenticação, empresa, recurso, documento e concessão; bucket privado sozinho não autoriza upload/download. Sem URL pública para documentos financeiros/RH.
6. **Financeiro:** escolher modelo canônico de lançamentos, obrigações, rateios parciais, anexos, compras, status pago, histórico e idempotência; impedir que encaminhar para Compras duplique obrigação; conciliação exclusiva Master.
7. **Homologação:** aplicar e testar primeiro em ambiente isolado com dados fictícios e diferentes identidades; testar leitura/escrita cruzada, revogação, arquivos, transações concorrentes e sincronização entre dispositivos.
8. **Implantação:** apresentar SQL e impactos para autorização **expressa** antes de qualquer execução no Supabase existente. Não publicar Netlify oficial nem alterar main.

## Bloqueios e critérios de aceite
- Nenhuma migração remota autorizada neste documento.
- Não usar a política atual como prova de isolamento multiempresa.
- Não expor saldos/extratos a equipe operacional por padrão.
- Não considerar o sistema operacionalmente pronto sem testes reais de RLS e Storage por usuário.
- Preservar as migrações 001–009 de supabase/homologacao; reconciliar contratos antes de aplicar.
