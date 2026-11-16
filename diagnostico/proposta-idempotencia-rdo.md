# Proposta de persistência e idempotência do RDO

A definição final da RPC depende das constraints, da autoria, dos gatilhos, das
políticas de RDO e da função de autorização instaladas no QA. Reaproveitar o
registro de operações instalado somente se for possível registrar a alteração
na tabela operacional e a resposta na mesma transação, com chave por empresa,
usuário e operação. Se não houver mecanismo compatível, a proposta SQL separada
define o registro mínimo, sem expor uma nova tabela à Data API.

## Contrato da RPC proposta

- Entrada com empresa, obra, RDO e operação em UUID, versão esperada e payload
  com lista explícita de campos editáveis. O servidor deriva o autor de auth.uid().
- Validar vínculo ativo, permissão do módulo e escopo de obra antes de consultar
  a operação anterior ou retornar o resultado. Não usar o catálogo de Frequência
  como autorização de escrita do RDO.
- Reservar a operação com INSERT ... ON CONFLICT DO NOTHING. Se já existir,
  ler a operação em uma instrução separada, comparar a requisição normalizada
  (incluindo obra, RDO e versão esperada) e devolver a resposta original.
  Mesmo UUID com parâmetros diferentes resulta em conflito.
- No primeiro envio, conferir estado e versão e gravar por chave composta.
  Atualização usa condição de versão esperada e incrementa exatamente uma vez.
  Registrar auditoria e confirmação na mesma transação. Qualquer erro desfaz a
  reserva e a mutação. Uma operação já confirmada mantém a resposta original.
- O navegador conserva o mesmo UUID e payload no rascunho até receber resposta
  válida, incluindo identidade do RDO, empresa, obra e versão. O fluxo atual
  continua local. Importação exige conciliação explícita e uma chave estável por
  empresa, origem e ID legado, além da chave de retry por operação.

## Aceite e reversão

Testar primeiro em PostgreSQL isolado com duas conexões: retries simultâneos com
o mesmo UUID, reuso com payload diferente, duas operações distintas sobre a
mesma versão, perda de resposta após commit, revogação com o mesmo token e
referência cruzada de empresa/obra. Conferir uma versão e um evento de auditoria
por gravação. No QA, após aprovação, repetir em sessões autenticadas e reler
o mesmo UUID e versão após F5 e em outro dispositivo.

Reversão: manter a escrita desabilitada até o aceite. Em regressão após
publicação, desabilitar o cliente de escrita e republicar a v9. Preservar
registros e comprovantes de operações confirmadas. Retirar a RPC da API somente
em mudança aprovada, após conferir integrações que dependem dela.
