# Homologação — Gastos com a obra e caixa local

Data: 05/11/2026. Aplicação completa mantida no mesmo endereço privado de homologação. Dados fictícios; comunicações remotas bloqueadas. Site oficial não alterado, nenhuma migração definitiva executada.

## Implementado
- Gestão da Obra → Gastos com a obra; atalho na barra lateral “Gastos com a obra / Caixa”. Paleta original e navegação existentes preservadas.
- Caixa local de despesas e receitas, com empresa, favorecido/origem, categoria, conta/forma, descrição, data e situação. O módulo anterior continha previsões/contas demonstrativas, sem uma base local estruturada de fluxo de caixa; esta etapa acrescenta essa base sem converter demonstrações em lançamentos.
- Rateio por valores entre múltiplas obras, com fechamento exato em centavos. Sem rateio, o lançamento pertence à administração e aparece na visão geral.
- Consulta por obra selecionada ou todas as obras/administração, empresa, categoria, período e tipo. Valores pagos/recebidos, pendentes e cancelados separados; receitas não são despesas. Totais ativos por empresa e categoria incluem pagos e pendentes, excluindo cancelados.
- Período considera data do lançamento, e não data de pagamento. Não é extrato bancário nem relatório contábil de saldo de contas.
- Registrar pagamento/recebimento é uma informação manual; não executa transferência bancária. A transição vale para o lançamento inteiro e todos seus rateios; pagamento parcial não implementado.
- Cancelamento exige motivo e mantém registro/histórico; não apaga lançamentos. Correções podem ser feitas cancelando e lançando novamente. Lançamentos cancelados não podem ser reativados nesta etapa.
- CSV dos filtros contém parcela da obra, total do lançamento e rateios, com proteção contra fórmulas em campos textuais.
- Gravação com conferência da versão, backup anterior e recuperação explícita no mecanismo já existente. Recuperação pendente também bloqueia bases protegidas de RDO/Vendas; resolução exige Master no fluxo existente.
- Permissão financeira local: Master, Financeiro, Administrativo, Diretoria ou permissão financeira explícita, com sessão atual conferida. Isso é controle da interface e não autorização de servidor.
- Base nova `cm_fluxo_caixa_obras_v1` começa vazia. Nenhum lançamento, consumo, pedido, venda ou orçamento anterior é importado/duplicado automaticamente. O backup geral existente inclui chaves cm_, incluindo a nova base e seu backup.

## Testado
- 68 testes automatizados passaram: 48 regressões anteriores e 20 novos testes de caixa.
- Centavos, datas inválidas, rateios, preservação das fontes, obra ausente/duplicada, administração, receitas separadas, filtros, agrupamentos, pagamento idempotente, cancelamento/histórico, permissão, CSV, conflito entre abas e recuperação de falha simulada.
- Verificação estática: 35 scripts compilados, dependências locais e bloqueio de comunicação remota verificados.
- Navegador em fixture descartável com módulos reais e armazenamento em memória: abertura da aba, formulário, rateio de uma obra, conferência, voltar sem alterar, salvar, registrar pagamento, cancelar com motivo e consultar histórico. Totais passaram de pendente para pago e depois para cancelado fora do ativo. Fixture removida da publicação.
- Aplicação completa: presença do acesso lateral, aba, diálogo e campos de data brasileiros conferida no DOM. Não foi realizado fluxo completo com login real no navegador de QA.

## Pendências e limites
- Teste do usuário em Android físico e persistência ao reabrir a página.
- Supabase real, sincronização entre dispositivos, importação de caixa de sistemas externos e conciliação bancária não implementados nesta etapa. Registros permanecem neste navegador; mantenha backup geral.
- Integração automática com folha, vendas, materiais e veículos ainda pendente. Não somar consumo estimado ao caixa manual, pois poderia duplicar custos.
- Pagamentos parciais, edição de lançamento, anexos e saldo por conta são etapas futuras. Para corrigir um lançamento, cancelar com motivo e registrar outro.
- Nenhuma emissão fiscal, movimentação bancária, baixa automática de estoque ou migração definitiva.

## Arquivos
`dist/gastos_obras.js`, `dist/gastos_obras_ui.js`, duas páginas completas atualizadas, persistência/recuperação atualizadas, `scripts/gastos-obras.test.cjs` e `scripts/RESULTADOS_GASTOS_OBRAS.txt`.

## Roteiro de teste pelo celular
1. Gestão → selecionar obra → Gastos com a obra → Registrar lançamento.
2. Preencher empresa, favorecido, categoria, conta/forma, descrição, data, valor e adicionar a obra ao rateio com o mesmo valor.
3. Conferir e confirmar; verificar pendente no resumo.
4. Registrar pagamento/recebimento com data; verificar valor pago e histórico.
5. Em outro registro fictício, ratear entre duas obras e conferir que a visão geral não duplica o total.
6. Testar filtro e CSV; cancelar um registro com motivo e conferir que sai do ativo, mantendo histórico.
7. Recarregar e verificar persistência. Testar também venda previamente entregue para regressão no celular.
