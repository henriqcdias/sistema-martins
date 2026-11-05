# Recibos de EPI e assinatura na tela
Data: 05/11/2026

Implementado: coleta de traços por Pointer Events (toque/caneta/mouse), confirmação do nome e consentimento do colaborador, registro de data de Brasília e responsável pela coleta. O PDF incorpora o desenho vetorial e conserva campos manuais. Trata-se de assinatura eletrônica desenhada; não é assinatura digital certificada.

Novos recibos usam EPI-0001 e sequência, mantendo batchId/IDs internos. Recibos existentes mantêm suas identificações. Não há reemissão automática ou renumeração de históricos.

O texto impresso não traz assinatura pendente. O controle interno indica se houve coleta. Orientações resumidas de uso, limpeza, guarda, conservação, comunicação de danos e reposição foram revistas com base nos itens 6.5, 6.6 e 6.7 da NR-6. Devolução é descrita como procedimento interno, não como imposição da norma. O recibo não atesta treinamento não realizado e não substitui orientação por equipamento.
Fonte oficial consultada: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/NR06atualizada2023.pdf

A assinatura não baixa estoque novamente. Gravação do recibo e histórico do colaborador é conjunta e recuperável. Recusa desenho vazio/inválido, perfil não autorizado, nome diferente, consentimento ausente, substituição de assinatura existente e conflito entre abas. Alteração posterior do conteúdo identificado é detectada; esta comparação local não oferece certificação ou proteção contra manipulação deliberada.

Testes: 342 aprovados (331 anteriores e 11 novos). PDF real assinado gerado, texto e número conferidos, renderizado e inspecionado: uma página, desenho visível e campos manuais presentes. Testada recuperação de falha entre recibo e histórico sem movimentar estoque novamente.

Pendências: teste físico em Android/iOS pelo homologador; persistência/sincronização Supabase e assinatura certificada caso futuramente requerida. A coleta desenhada não deve ser apresentada como conformidade jurídica integral da documentação eletrônica. Os registros continuam locais e entram nas bases já cobertas pelo backup geral.

Netlify oficial, Supabase e dados definitivos preservados.
Próxima etapa: estrutura e validação de Orçamentos.
