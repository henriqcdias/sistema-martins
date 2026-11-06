# Obras e Planejamento por equipe

Base remota: fbab38cd95586af1fe51dfbd0b33009085b80aa5, branch desenvolvimento.

## Implementado e corrigido
- Nova aba Gestão da Obra → Equipe e Planejamento, com consulta por dia, semana e mês.
- Comparação separada de horas planejadas, frequência, RDO aprovado e rascunho; distribuição do mesmo colaborador entre obras, equipe e tipo de vínculo.
- Pessoas distintas e dias com equipe no período; divergências e impedimentos visíveis sem exclusão de registros legados.
- Gastos reais por obra/período reutilizam o rateio do Financeiro, conforme permissão já existente. Não soma estimativas nem gera despesas.
- CSV da equipe com neutralização de fórmulas e atalho para o planejamento existente.
- Resumo do período de planejamento filtrado pela obra selecionada, em vez de somar outras obras.
- Planejamento de equipe/individual, cópia de planejamento e réplica de frequência passam a verificar admissão/encerramento.
- Confirmação de presença a partir do planejamento bloqueia data futura; datas de referência usam Brasília.

## Testes
383 testes aprovados, zero falhas: 369 anteriores e 14 novos.
62 scripts compilados; auditoria de publicação sem achados no escopo examinado.

Novos casos: isolamento por obra, distribuição, terceirizados, fonte histórica preservada, rascunho separado, pessoas distintas no período, indisponibilidade, excesso e duplicidade de legado, rateio financeiro, CSV, fontes inválidas, admissão/encerramento, validação atômica de período e bloqueio de presença futura.

Revisão visual de componente isolado com dados fictícios em 1100 px e 390 px: campos e botões alinhados, alternância para semana funcionando, tabela com rolagem horizontal interna. Medidas observadas: corpo móvel 351 px de largura e conteúdo 351 px; tabela de 960 px contida em área rolável de 327 px. Foram corrigidas quebras inadequadas da data e dos títulos das colunas após inspeção.
O teste isolado usa fontes em memória e não grava dados de negócio. Não testa login nem navegação completa da aplicação. Android/iOS físicos, instalação PWA, toque real e fluxo completo continuam pendentes.

## Persistência, autenticação e segurança
A etapa consulta as bases locais existentes. NÃO há sincronização entre dispositivos nem persistência real Supabase homologada.
O inventário remoto completo e um ambiente de teste com login/perfis/RLS continuam necessários antes de habilitar escrita online. Nada foi aplicado no banco definitivo.
A fonte atual não possui senha padrão; cadastros legados já armazenados em navegadores ainda podem usar a senha guardada anteriormente pelo mecanismo local. Essas senhas devem ser trocadas nos respectivos ambientes. Não foram acessadas, expostas nem alteradas senhas reais.

## Limites e próximo passo
Horas acima de 8h são sinalizadas como problema de planejamento regular já existente; não foram adotados os parâmetros ainda não definidos de 10h/12h.
Custos são despesas por data de lançamento, não competência de folha, previsão ou custo calculado por hora.
Próxima etapa: revisão direcionada de aprovação/reabertura de RDO e das negações explícitas de permissão.
Main, Netlify oficial e dados definitivos do Supabase preservados.
