# Homologação — Relatórios de mão de obra, uniformes e estoque

Data: 05/11/2026. Sistema completo no mesmo endereço privado de homologação. Site oficial, RDO original e dados definitivos não alterados. Sem migração.

## Implementado
- Módulo Relatórios com acesso pela barra lateral, mantendo os módulos de Financeiro, Gestão, Veículos e demais acessos.
- Mão de obra: período de até 31 dias, obra e colaborador; compara planejamento, Frequência, RDO aprovado e rascunho em colunas independentes, sem somar fontes entre si. Mostra situação, pendências da conferência, pessoas e pessoa-dia. Ausências são contadas uma vez por pessoa/dia na visão geral, mesmo quando há planejamento em mais de uma obra. Não calcula remuneração nem folha paga.
- Uniformes/EPIs entregues: até 366 dias, obra registrada no momento da entrega, colaborador e busca de item. Exibe identificação/lote, quantidade, responsável e vínculo histórico. Registros legados por nome são identificados; nomes ambíguos não recebem ID automaticamente. Não altera recibo ou baixa estoque ao consultar.
- Estoque: posição atual de materiais e uniformes/EPIs, filtros por origem/categoria/situação/busca. Quantidades agrupadas por unidade; unidades distintas não são somadas. Reposição depende do mínimo cadastrado; mínimo ausente não é inventado. Preço ausente não vira zero e itens sem avaliação são contados separadamente. Avaliação é saldo × preço de compra cadastrado, com arredondamento por item, sem representar pagamento/custo contábil.
- CSV do filtro com valores numéricos em padrão brasileiro, avisos de origem e indicação de escopo; campos textuais protegidos contra fórmulas. Mudanças de filtros/fontes exigem atualização antes de exportar.
- Consultas leem diretamente as bases com validação, sem chamar inicializadores que gravam dados. Recuperação local pendente bloqueia o relatório para evitar leitura de uma operação pela metade. Base ausente é identificada quando a consulta utiliza valores iniciais do aplicativo.
- Correção de preservação: removida do getter de estoque de uniformes a regra que substituía a base ao encontrar EST-01. Agora a leitura preserva EST-01, não grava dados e recusa conteúdo corrompido sem substituí-lo. Alteração nas duas páginas completas.
- Permissão local conforme tipo de relatório e sessão atual; não altera permissões de usuários nem equivale a autorização de servidor.

## Testado
- 133 testes automatizados passaram: 112 regressões anteriores e 21 testes novos de relatórios/preservação.
- Horas por fonte, rateio entre obras, ausência sem RDO, contagem de pessoa-dia, rascunho separado, período/futuro, entregas históricas, homônimos, filtros, quantidade/ID inválido, preços ausentes/zero, unidades, saldo inválido, avaliação, CSV, permissões e imutabilidade das fontes.
- Getter real extraído de cada HTML testado com estoque EST-01 e armazenamento que rejeita qualquer gravação; conteúdo preservado. JSON corrompido é recusado sem sobrescrita.
- Verificação estática: 40 scripts compilados e dependências locais presentes; comunicação remota permanece bloqueada.
- Navegador, fixture descartável com módulos reais e dados em memória: relatório com 8h de Frequência e 8h de RDO em colunas distintas; entrega de duas peças por colaborador; estoque com dois sacos avaliados em R$ 51 e uniforme sem preço/sem avaliação; filtro de reposição reduziu para uma linha e botão CSV preparou essa consulta. Fixture removida da entrega.
- Aplicação completa no DOM: seção em main inicialmente oculta, acesso lateral, campos de data brasileiros e acessos de Financeiro, Gastos e Veículos preservados.

## Pendências e limites
- Conferência em Android físico, abertura do CSV no aplicativo do celular e fluxo completo com login real; não realizados no navegador de QA. O conteúdo do CSV foi verificado por testes automatizados; o salvamento físico no Android depende da conferência do usuário.
- PDF específico dos relatórios e gráficos não implementados nesta etapa. Exportação disponível em CSV.
- Estoque não é histórico por data nem inventário por obra/depósito. Não reconstrói movimentos antigos nem inventa custos de uniformes sem preço.
- Ausência sem obra aparece em todas as obras; filtro por uma obra não atribui ausências a ela sem registro correspondente. Totais de horas são registros a conferir, não folha de pagamento.
- Relatório de mão de obra reutiliza a conferência existente de Planejamento/Frequência/RDO, com seus avisos de identificação e dados inválidos. Entrega antiga só pode ser vinculada pelo nome quando único; renomeações antigas não são migradas automaticamente.
- Supabase real e sincronização entre aparelhos seguem pendentes. Dados permanecem locais neste navegador; nenhum endpoint remoto foi ativado.

## Roteiro pelo celular
1. Menu → Relatórios → Mão de obra: escolher período, obra e colaborador; conferir as colunas de Frequência e RDO separadamente.
2. Uniformes/EPIs entregues: filtrar colaborador e obra; conferir quantidades e responsável conforme o histórico de entrega.
3. Saldo atual de estoque: testar origem, categoria e situação Repor; itens sem preço ou mínimo devem continuar identificados.
4. Exportar CSV do filtro e abrir no celular. Alterar uma busca e verificar que é necessário atualizar antes de exportar.
5. Voltar aos módulos existentes e conferir que registros e saldos continuam preservados.

## Arquivos
`dist/relatorios_martins.js`, `dist/relatorios_martins_ui.js`, duas páginas completas com correção da leitura de estoque; `scripts/relatorios.test.cjs`; `scripts/RESULTADOS_RELATORIOS.txt`.
