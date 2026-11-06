# RH — lotação e ausências
Base remota: f81d18441b6c. Continuidade dos cadastros, documentos e históricos salariais existentes.

Ficha do funcionário agora registra lotação por obra com início/fim, histórico, justificativa e cancelamento sem exclusão. Períodos sobrepostos, IDs repetidos, obras ausentes e datas fora do contrato são rejeitados. A obra legada é preservada e não se transforma em histórico presumido.

Férias, folgas, atestados e afastamentos são registrados na mesma configuração consumida por Planejamento e Frequência. Presença existente no período impede o cadastro da ausência até conferência; nenhuma presença ou dado histórico é apagado automaticamente. Cancelamento mantém trilha. Período com fechamento ativo bloqueia alteração pela ficha.

435 testes aprovados; 63 scripts compilados; auditoria de segredos sem achados no escopo. Inclui 12 novos testes de contrato, lotação, sobreposição, conservação de fonte, cancelamento e integração com Frequência/Planejamento. Não foi feita homologação integral da ficha em navegador nem teste em aparelho físico nesta etapa.

Não calcula férias legais ou pagamento de afastamento, não gera despesas e não migra dados. Registros de ausência já confirmados na Frequência não são apagados ao cancelar um período; devem ser conferidos no dia correspondente. Autorização local não substitui servidor/RLS.
