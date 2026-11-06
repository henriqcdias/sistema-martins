# EPIs e uniformes — devoluções e prazos cadastrados
Base remota: 000226811548.

- Entregas, saldo único e recibos/assinaturas existentes foram mantidos. Devolução parcial ou total identifica entrega, funcionário, quantidade, condição, data, motivo e responsável, com operação idempotente.
- Devolução fica segregada, sem reintroduzir automaticamente equipamento usado no saldo disponível. Recibos assinados não são alterados. Acumulado devolvido não pode ultrapassar o entregue.
- Prazo de substituição é cadastrado em dias, sem valor padrão presumido (zero desativa). A entrega fotografa o prazo; alertas consideram vencimento, substituição e quantidade ainda não devolvida. Antecedência é configurável.
- Relatório de movimentos integrados filtra funcionário, obra e período, com CSV. Consulta original dos recibos legados permanece disponível, sem vincular pessoas por nome automaticamente.
- Teste de inicialização da aplicação completa em 390/1280 pixels revelou que novas chaves de solicitações, devoluções e configuração de períodos ainda precisavam ser incluídas na lista de persistência recuperável. A integração foi corrigida e ganhou seis testes específicos. Após a correção, todos os novos controles inicializam sem erros JavaScript nas duas larguras.

463 testes aprovados; 63 scripts compilados; auditoria de segredos sem achados no escopo. Doze novos testes de devolução, conservação de recibo, estoque, alertas e relatório; seis testes de persistência. O teste completo de inicialização não equivale à homologação integral dos fluxos ou uso em aparelho físico. Nenhum dado definitivo foi usado ou alterado.

Pendente: destinação posterior do estoque segregado conforme procedimento aprovado, homologação com responsáveis reais e integração de arquivos/assinaturas no servidor.
