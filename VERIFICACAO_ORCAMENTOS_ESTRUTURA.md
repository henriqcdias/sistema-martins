# Estrutura de propostas e validação de Orçamentos
Data: 05/11/2026

Trabalho sobre o formulário comercial existente, sem apagar orçamentos anteriores ou trocar o fluxo de integração com Vendas/Obras.

Corrigido: validade preenchida passa a ser persistida; bloqueio de quantidade zero/negativa, preço negativo/não numérico e totais fora do limite; IDs únicos em vez de contagem de registros; sequência visível pelo maior número do ano; atualização de subtotal sem recriar a linha a cada tecla, preservando foco.

Estrutura recomposta: empresa, cliente e contato/documento/local, objeto/escopo, itens com rótulos de quantidade/unidade/preço/subtotal, validade, pagamento, prazo e observações. PDF com logo e essas seções, data brasileira e aceite do cliente, sem campos de fiscalização pública. Campos adicionais opcionais para manter compatibilidade com documentos legados.

Não foi feita restauração integral de um arquivo histórico específico: a recuperação é funcional e estrutural a partir do formulário anterior preservado no código. Se a homologação externa identificar diferenças do modelo desejado, ajustar sobre esta base.

Testes: 349 aprovados (342 anteriores, 7 novos). Incluem valores negativos, fracionados, IDs, sequência, preservação dos campos e venda com criação idempotente de obra. PDF fictício gerado, renderizado e inspecionado. Revisão funcional externa e celular físico pendentes.
Próxima etapa: proteção dos formulários, organização dos menus e inativação de estoque.
