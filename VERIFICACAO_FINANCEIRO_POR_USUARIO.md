# Controle Financeiro por Usuário — servidor local — 06/11/2026

Script 006 amplia o papel do membro para lancador_financeiro, sem depender de perfil LocalStorage. Contrato dedicado de lançamentos com autoria obtida do JWT, estado pendente_conferencia obrigatório na criação, revisão otimista e operações idempotentes. Não registra pagamento, baixa ou conciliação. Comando de conferência é exclusivo do administrador, auditado e não equivale a pagamento.

RLS protege lançamentos próprios/compartilhados, metadados de contas, saldos, concessões e auditoria. Escritas diretas são negadas. Master compartilha em lote, separando visualização/edição e revogação. Alterações e concessões usam bloqueio por empresa e auditoria. Edição só enquanto pendente. Negação explícita e desativação do membro vencem concessões.

Permissões independentes por conta: usar como referência, movimentos próprios/compartilhados, todos os movimentos e saldo. Sem concessão específica, próprios/compartilhados continuam disponíveis; uso de conta exige autorização. Não existe endpoint de conciliação neste contrato. Pagamentos e exceções de vales continuam bloqueados.

Storage financeiro reusa bucket privado e guardas RESTRICTIVE, agora vinculado ao ID do lançamento autorizado. Upload exige edição; leitura segue acesso atual, inclusive revogação. Sobrescrita e exclusão continuam bloqueadas. Arquivos antigos sem vínculo no novo contrato não são migrados, apagados nem liberados automaticamente: inventário e mapeamento serão necessários na homologação.

Testes SQL executados em PostgreSQL embarcado PGlite, com identidades JWT e Storage simulados: são políticas e funções SQL reais executadas localmente, não autenticação nem Storage reais do Supabase remoto. Incluem isolamento entre usuários/empresas, consultas e agregações, falsificação de payload, grants independentes, revogação, concorrência, versões, idempotência, documentos e acesso anônimo.

Nenhum script aplicado remotamente. Integração de interface e APIs específicas é a próxima etapa. Não considerar segurança homologada em produção.
