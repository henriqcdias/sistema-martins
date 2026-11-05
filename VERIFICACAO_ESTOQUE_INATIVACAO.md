# Materiais ativos e inativos
Data: 05/11/2026

O cadastro geral substitui Excluir por Inativar/Reativar. Exige perfil autorizado, motivo e grava a autoria/data no histórico de situação. Mantém o mesmo ID, saldo, classificações, movimentos e entregas anteriores. Materiais antigos sem o campo ativo são tratados como ativos.

Novas entradas, saídas, transferências, consumo e entregas de EPI/uniforme do catálogo recusam material inativo. Seletores de movimento e transferência deixam de oferecer esses itens. As consultas de estoque continuam mostrando os saldos, inclusive inativos. O salvamento pelo cadastro tradicional bloqueia remoção física.

Testes novos: 5 aprovados, cobrindo preservação, reativação, validações, bloqueios e retirada da seleção de EPI. Não houve migração ou alteração de registros do usuário.
Limite: não constitui trava contra manipulação de localStorage; falta regra equivalente no banco. Situação de materiais do catálogo geral implementada; gestão específica de inativação dos itens legados de EPI ainda precisa ser oferecida na tela.
