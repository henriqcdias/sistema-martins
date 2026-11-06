# Recebimentos parciais — 06/11/2026

Recebimentos vinculados à base cm_pedidos_db existente, sem recriar pedidos. Eventos imutáveis por pedido: recebimento, devolução ao fornecedor e cancelamento do saldo pendente. Cada evento registra data, fornecedor, autor/sessão, depósito, itens do catálogo, quantidades, documento/referência e justificativa de conferência. Documento nesta etapa é referência textual; anexos binários e XML não foram implementados neste commit.

Solicitado, recebido bruto, devolvido, recebido líquido, cancelado e pendente são derivados do histórico. Recebimentos múltiplos/ parciais não excedem saldo autorizado. Devolução referencia recebimento original, valida fornecedor e saldo físico; reserva de outra obra não pode ser consumida para devolver ao fornecedor. Cancelamento de pendente não movimenta estoque. Correção física usa devolução auditada e novo recebimento identificado, sem apagar eventos.

Produto é vinculado explicitamente ao catálogo único no primeiro evento; vínculo posterior não muda silenciosamente. Divergência de unidade bloqueia conversão automática. Pedidos com recebimentos não permitem remoção/substituição dos itens pela função de salvamento. Marcar Entregue manualmente exige recebimento integral. Pedido legado Entregue sem histórico de recebimentos exige conferência prévia, evitando presumir saldo vazio e dar entrada novamente.

Preparação não escreve estoque. Confirmação reconfere todas as bases e sessão, usa bloqueio existente e gravação recuperável de catálogo, movimentos e recebimentos. ID idempotente; documento/entrega repetido, conteúdo divergente, revisão desatualizada e excesso são recusados. Nenhum pagamento, baixa ou obrigação financeira é criado.

Validação: 635 testes automatizados aprovados, 64 scripts compilados e auditoria de fontes sem achados no escopo verificado. Navegador local a 390/1280 pixels: recebe 4+3 de pedido de 10, devolve 1 e cancela 2; estoque 6 e pendente 2, histórico preservado e Financeiro intacto. Duplicidade, negativa de perfil e confirmação antes da entrada também testados. Suíte anterior de navegador passou. Captura mobile revisada; sem aparelho físico.

Persistência e permissões de estoque seguem locais com dados fictícios, sem segurança de estoque homologada em servidor. Nenhum Supabase remoto, main, publicação ou dado definitivo alterado. Próxima etapa: conferência XML e anexos, depois integração financeira específica, mantendo pendências separadas de pagamentos.
