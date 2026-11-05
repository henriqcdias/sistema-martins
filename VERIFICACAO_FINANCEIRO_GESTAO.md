# Homologação — Financeiro separado da Gestão da Obra

Data: 05/11/2026. Mesmo sistema completo e mesmo endereço privado de homologação. Site oficial e dados definitivos não alterados.

## Implementado
- Seção Financeiro na barra lateral, com Cadastrar contas, Fluxo de caixa e Contas a pagar / receber.
- Contas de referência de caixa/banco/outros: cadastro com ID, nome, tipo e autor; sem credenciais bancárias e sem operação bancária.
- No fluxo, lançamento normal de despesa/receita, situação, data, vencimento, empresa, favorecido, categoria, conta, valor e descrição. Campos finais: Obra e depois Centro de custo. Administração sem obra também aceita centro de custo.
- Rateio entre obras mantido como alternativa explícita; cada parcela tem obra, centro de custo e valor. A soma precisa fechar o total em centavos.
- Contas a pagar/receber: consulta somente de pendentes, com vencidas, hoje, futuras e sem vencimento; filtro por período de vencimento e tipo. Criar conta a pagar/receber abre o lançamento pendente no fluxo, sem criar uma segunda base ou duplicar valores.
- Fluxo mantém filtros por tipo, empresa, obra, categoria, centro e data do lançamento. Pagamento/recebimento e cancelamento com histórico preservados.
- Gastos com a obra é uma aba exclusiva da Gestão, junto de Boletim, Observações, Planilha e demais abas. Não está no grupo Financeiro e não contém formulário financeiro. Mostra despesas da obra selecionada, por empresa/centro/período, com valores pagos, pendentes e cancelados separados.
- Trocar a obra atualiza a consulta sem misturar gastos. CSV da Gestão exporta apenas a parcela e centro da obra selecionada; CSV financeiro conserva dados do lançamento inteiro e seus rateios.
- Acesso à consulta de obra pode ser dado à Engenharia/Gestão sem dar acesso ao Financeiro. Controles são locais da interface, não autorização de servidor.
- Mesma base de lançamentos `cm_fluxo_caixa_obras_v1`, com campos opcionais adicionais. Registros anteriores sem vencimento/centro não são modificados; aparecem como Não informado / Sem centro de custo (anterior). Contas manuais antigas permanecem no histórico, sem vínculo automático com novos cadastros.
- Conta nova em `cm_contas_financeiras_v1`, incluída na gravação recuperável, backup anterior e backup geral cm_. Não houve limpeza de dados, migração ou regravação em massa.

## Testado
- 88 testes automatizados passaram: 68 existentes e 20 novos de contas, vencimentos, centros, compatibilidade, permissões, exportação e persistência/recuperação.
- Compilação estática de 36 scripts da aplicação/HTML e dependências locais verificadas, com rede remota bloqueada nesta homologação.
- Navegador, fixture descartável com fontes em memória e módulos reais: seção Financeiro; cadastro de conta após conferência; lançamento com obra/centro final; gravação e exibição em Contas a pagar/receber por vencimento.
- Navegador: consulta de despesa fictícia na aba da Gestão com centro Fundação e R$ 100; ao trocar da obra A para B, tabela e totais ficaram vazios/zero. Fixture removida antes da publicação.
- Aplicação completa conferida no DOM: Financeiro como seção independente em main, inicialmente oculta; Gastos dentro da Gestão; acesso lateral financeiro presente; atalho antigo misto removido; calendário e campo de data brasileiro presentes. Login real de ponta a ponta não executado no navegador de QA.

## Pendências e limites
- Conferência em Android físico, persistência entre recargas e validação do usuário no seu navegador.
- Supabase real, sincronização entre aparelhos e conciliação bancária permanecem pendentes. Dados são locais neste navegador; usar backup geral antes de mudanças de aparelho.
- Cadastro de centros é por texto no lançamento, com sugestões; ainda não há catálogo gerenciado de centros. Pagamentos parciais, saldo inicial/extrato por conta, transferências bancárias, edição de contas e anexos não implementados.
- Nenhuma conta de banco é acessada; registrar pagamento é apenas informar que ocorreu. Não há emissão fiscal, cobrança, pagamento real ou integração automática com folha/veículos/materiais/vendas.
- Contas demonstrativas e previsões anteriores não são importadas como despesas reais.

## Teste pelo celular
1. Menu → Financeiro → Cadastrar contas → cadastrar referência fictícia de Caixa.
2. Fluxo → lançar despesa pendente com vencimento, empresa, fornecedor, conta, valor e descrição; ao final escolher obra e preencher centro de custo.
3. Conferir e confirmar. Verificar em Contas a pagar/receber, incluindo o filtro de vencimentos.
4. Menu → Gestão → selecionar a obra → aba Gastos com a obra: conferir a parcela/centro. Trocar obra e verificar que os gastos não se misturam.
5. Registrar pagamento no Financeiro e voltar à aba da Gestão para conferir o valor pago. Testar receita separadamente em A receber.
6. Consultar registros anteriores sem centro/vencimento, exportar CSV, recarregar a página e verificar persistência.

## Arquivos
`dist/financeiro_martins.js`, `dist/gastos_obras.js`, `dist/gastos_obras_ui.js`, páginas completas, persistência e recuperação; `scripts/financeiro.test.cjs`; `scripts/RESULTADOS_FINANCEIRO.txt`.
