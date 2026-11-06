# Pedidos antigos entregues sem histórico

Não inferir recebimento zero nem registrar entrega retroativa para recompor histórico.

1. Identificar pedido original e sua referência externa, fornecedor canônico, itens, depósito e responsáveis. Preservar a cópia original/hash no ambiente autorizado. Mapear IDs explicitamente para o contrato de homologação, sem migrar dados definitivos.
2. Conferir NF-e original, documentos de entrega/devolução, movimentos já registrados, saldo físico atual e obrigações financeiras existentes. Diferenças não são resolvidas automaticamente por quantidade ou por valor presumido.
3. Provisionar registro isolado do pedido com legado_entregue=true e referencia_origem identificada. Obrigações antigas devem ter seus IDs conferidos, sem criar substitutas.
4. Master autenticado, com permissão de estoque no servidor, seleciona os lançamentos existentes e registra justificativa documental na interface de homologação. O comando nfe_conferir_pedido valida versão e empresa, registra auditoria e não altera estoque ou pagamentos.
5. Mesmo após conferência, nfe_integrar mantém a entrada retroativa bloqueada. Qualquer ajuste físico futuro requer procedimento específico de inventário, com identificação, conferência, diferença real, responsável e reversão auditada; não é feito por esta rotina nem por caixa marcada na interface.
6. Não apagar pedidos, notas, lançamentos ou movimentos para liberar o fluxo. Divergência exige reconferência e preservação do histórico.

O procedimento foi testado em banco local fictício. Não executado em Supabase remoto ou dados definitivos.
