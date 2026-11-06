# Materiais da obra e mensagens de estoque — 06/11/2026

Registro de aplicação de materiais exige perfil local autorizado ao estoque e sessão correspondente. Negação explícita prevalece sobre Master. Revalida autor, obra, catálogo e histórico no bloqueio de gravação, após conferência do valor e da aplicação. Essas verificações locais não substituem autorização no servidor.

Lançamento equivalente com outro ID é recusado; nova aplicação pode ser identificada por referência distinta. Repetição do mesmo ID só retorna sucesso se o conteúdo for idêntico. Booleanos, valores vazios e totais fora da precisão segura são recusados. Histórico anterior permanece preservado.

Saldo insuficiente é apresentado também dentro do formulário de movimentação, além do aviso transitório. Nenhuma baixa ocorre no erro.

Registro de aplicação continua separado de transferência e movimentação física. Não cria despesa financeira ou presença/RDO. Reserva e devolução vinculadas ao consumo ainda precisam de fluxo próprio; não foram simuladas como transferências.

Validação: 568 testes automatizados, 64 scripts compilados e auditoria de fontes sem achados. Integração local em navegador a 390/1280 pixels: permissão negada, aplicação autorizada, repetição bloqueada e saldo insuficiente visível, com catálogo preservado e zero movimentos físicos. Dados fictícios e rede externa bloqueada. Sem Supabase remoto ou aparelho físico.
