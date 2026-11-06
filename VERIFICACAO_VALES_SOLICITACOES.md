# Vales — solicitações, reservas e confirmação de entrega
Base remota: 094bdeeb403f.

- Solicitação, aprovação operacional dentro de 40%, cancelamento justificado e confirmação de entrega têm estados e históricos separados.
- Solicitar ou aprovar não cria despesa paga. Aprovação reserva limite e impede fracionamento entre pedidos. Entrega aprovada revalida a Frequência e o acumulado; somente a confirmação de valor já entregue ou vínculo a uma despesa efetivamente paga cria o vale pago, mantendo pagamento, vale e solicitação vinculados.
- Vales consumidos continuam no acumulado. Reservas já convertidas em pagamento não contam duas vezes. IDs são idempotentes; solicitação repetida e pagamento duplo são bloqueados.
- Exceções acima de 40% estão bloqueadas no núcleo e na interface. Master local, identidade declarada e checkbox não liberam exceção. Não existe atualmente backend de autorização de vales integrado; a função de autenticação existente é apenas de diagnóstico, e nenhuma chamada foi feita ao Supabase.
- A política aprovada continua: exceção somente por administrador autenticado no servidor, com justificativa e auditoria. Sua habilitação ficou pendente, sem criar mecanismo inseguro de liberação.
- Base de mensalistas continua sem regra automática presumida; extras sem aprovação de servidor não ampliam o limite automático. No fechamento, as extras operacionais conferidas continuam importadas da Frequência.

445 testes aprovados; 63 scripts compilados; auditoria de segredos sem achados no escopo. Dez novos testes do ciclo de solicitação, reserva, aprovação, confirmação e bloqueio de falsa autenticação. Testes antigos de Financeiro passaram a usar vales de R$40, dentro do limite; casos de grandes vales históricos usam fixture sintética concedida sob remuneração anterior maior, sem liberar exceções novas. Os testes de desconto único, líquido zero, estorno, backup e recuperação continuam executados.

Limites: aprovação normal e armazenamento continuam locais. Não equivalem a autorização/RLS do servidor ou concorrência entre dispositivos. Homologação visual integral desta etapa ainda pendente. Nenhuma produção, migração ou dado definitivo foi alterado.
