# NF-e → Recebimento → Contas a Pagar: contrato isolado

Aplicar 008 somente após 001..007 em ambiente separado, com inventário e autorização administrativa. Não executado remotamente nesta entrega.

## Fonte confiável e isolamento

Notas, pedido, catálogo e depósitos são provisionados por serviço confiável com os mesmos IDs previamente conferidos, sem criação automática de produto pelo XML. referencia_origem preserva a identificação do pedido original. Evidências XML devem ser produzidas por server/nfe/validator.py, com bytes/hash e dados extraídos exclusivamente do elemento assinado. O cliente autenticado não pode escrever evidências, confiança, situação fiscal ou saldos diretamente.

Validador não aprova confiança ICP-Brasil nem faz consulta oficial. Dados não sintéticos ficam bloqueados enquanto XSD, assinatura e confiança não estiverem aprovados pelo serviço. Situação autorizada/cancelada/denegada fora de fixture exige registro de consulta oficial, protocolo, fonte e data. Não há conector SEFAZ nesta entrega.

Em testes, teste_sintetico=true é provisionado exclusivamente pelo dono do banco local e aparece no resultado/interface. Nunca aceitar esse campo do navegador nem usar esse provisionamento em dados reais. As fixtures SQL simulam evidências para testar negócios; o roteiro qa-nfe-fim-a-fim valida de fato XSD e assinatura de XML sintético antes de integrar.

## Transação suportada

nfe_integrar é exclusivo do Master com permissão de estoque no contrato atual. Valida empresa, projeto de homologação, fornecedor, nota normal, unidades/produtos do catálogo, quantidades da nota e pedido, depósito ativo e conferência prévia de obrigações existentes. Grava recebimento e parcelas em uma única transação PostgreSQL; erro em qualquer parcela reverte saldo, recebimento, vínculo e lançamentos anteriores da operação.

Múltiplas entregas parciais reutilizam as parcelas. Operação idempotente e documento de entrega único por nota. Parcelas com chave empresa/nota/número única e vínculo financeiro único. Valores, vencimentos, fornecedor, emissão, chave e hash preservados. Pagamento=false e estado pendente_conferencia. Nenhuma conta bancária, baixa ou conciliação é executada.

Obrigação anterior identificada exige vínculo explícito e equivalência de valor, vencimento e fornecedor; não é substituída. Obrigações com referência de chave/número da nota ou pedido são bloqueio adicional contra duplicação. Obrigações legadas sem referência confiável exigem conferência documental pelo Master; o sistema não adivinha a origem por semelhança de valores.

O lançamento usa fin_lancamentos e suas políticas existentes, não escreve em LocalStorage nem traduz pendente_conferencia para pago/pendente comum no fluxo legado. Lançador só vê parcelas compartilhadas conforme RLS; não pode liberar estoque nem acessar XML fiscal global. Não há migração ou espelhamento automático para as bases locais antigas.

## Casos e limites

Suportado automaticamente: nota normal numérica, recebimento parcial/múltiplo e parcelas integralmente informadas/conferidas. Sem parcelas, não inventar vencimento. Complementares, devoluções fiscais, ajustes, canceladas e denegadas interrompem a transação e exigem fluxo fiscal específico; não são tratadas como uma compra normal. Devoluções físicas locais existentes continuam preservadas, sem gerar crédito financeiro ou evento fiscal presumido.

XML e vínculos fundamentais são imutáveis no servidor; alterações de evidência/situação têm auditoria própria sem copiar XML no log. Documentos reais requerem confiança/serviço fiscal provisionados e homologação remota posterior. Chaves alfanuméricas podem ser avaliadas pelo pacote XSD, mas não são aceitas pelo contrato transacional numérico atual.

## Operação local e testes

Instalar requisitos Python isoladamente, executar npm test, npm run test:nfe:validacao, npm run test:nfe:integracao, npm run test:browser:nfeintegracao, npm run check e npm run audit:source. Variáveis MARTINS_NFE_PYTHONPATH, MARTINS_PGLITE_MODULE e MARTINS_CHROMIUM_EXECUTABLE permitem instalações externas.

Banco PGlite executa SQL/RLS reais; Auth/PostgREST/Storage são simulados. Concorrência foi exercitada por chamadas concorrentes ao banco embarcado, não por múltiplas sessões remotas. Segurança de produção e consulta fiscal oficial não foram homologadas. Procedimento de pedidos antigos: PROCEDIMENTO_PEDIDOS_LEGADOS.md.
