# Homologação — Clientes, veículos e abastecimentos

Data: 05/11/2026. Mesmo sistema completo e mesmo endereço privado de homologação. Site oficial não alterado. Sem migração definitiva ou importação automática de demonstrações.

## Implementado
- Acesso lateral “Clientes, veículos e abastecimentos”, mantendo Financeiro e Gestão da Obra separados.
- Usa o cadastro existente `cm_clientes_db`: lista de clientes, cadastro rápido e edição pelo ID por meio do modal já existente. IDs, documentos e referências anteriores são preservados; nenhuma segunda base de clientes foi criada. Alteração do nome de um cliente é refletida no veículo pelo vínculo de ID, sem reescrever históricos comerciais.
- Cadastro de veículo: descrição, placa brasileira normalizada/única, cliente proprietário ou frota da empresa e hodômetro inicial em km inteiros. Base nova começa vazia.
- Abastecimento: data, hodômetro, litros (até 3 casas), valor total, tanque cheio/parcial, combustível líquido, posto/local, empresa, conta e situação financeira. Ao final, obra e centro de custo para destinação do gasto.
- Uma despesa é criada automaticamente no Financeiro, com categoria Transporte e vínculo de origem/veículo. Se houver obra, a parcela aparece em Gastos com a obra; sem obra, fica na frota/administração. Pendentes usam vencimento e entram em contas a pagar.
- Diário recuperável grava abastecimento e despesa juntos, com conferência de versões e backup. Não equivale a transação de banco; falha pendente exige recuperação explícita no fluxo existente de Master.
- Proteção contra placa duplicada, repetição equivalente de abastecimento, mudança de dados após conferência, registro futuro, data/hodômetro retroativo, conta/obra ausente e valor/litros inválidos. A mesma identificação de operação não gera uma segunda despesa.
- Preço por litro calculado como valor/litros. Média km/l calculada somente entre dois tanques cheios, incluindo litros dos registros parciais intermediários e do fechamento; litros do tanque inicial não entram. Média geral ponderada pela soma de km/litros de ciclos completos, sem inventar média antes do primeiro ciclo.
- Último abastecimento ativo pode ser cancelado com motivo, junto da despesa vinculada; histórico permanece e média é recalculada. Não há estorno bancário. Cancelar apenas a despesa no Financeiro não apaga o abastecimento físico; as situações são exibidas separadamente.
- Permissão local financeira e sessão atual verificadas no módulo e na confirmação, pois esta etapa grava gastos. Motoristas/operadores não receberam novas permissões automaticamente.
- Bases novas `cm_veiculos_v1` e `cm_abastecimentos_v1` incluídas na persistência recuperável e no backup geral cm_. Nenhum RDO alterado.

## Testado
- 112 testes automatizados passaram: 88 regressões anteriores e 24 novos casos de veículos, abastecimentos e persistência.
- Placas, vínculo por ID de cliente, preservação das fontes, unidades/valores, sequência de data/hodômetro, despesa/centro/obra, pendente, repetição, média simples/ponderada/parciais, cancelamento, bases inválidas e falha simulada na segunda base com conclusão/reversão.
- Verificação estática de 38 scripts, páginas completas, dependências locais e bloqueio de comunicação remota.
- Navegador em fixture descartável com módulos reais e dados em memória: cadastro de veículo vinculado ao cliente; primeiro abastecimento com despesa automática de R$ 200 no caixa e na obra/centro; segundo tanque com média de 10 km/l (500 km / 50 L); cancelamento do segundo registro e despesa de R$ 250, mantendo R$ 200 pago e R$ 250 cancelado fora do ativo.
- Aplicação completa: módulo como seção independente em main, inicialmente oculto, acesso lateral, Financeiro, aba de gastos e campo de data brasileiro conferidos no DOM.
- Fixture descartável removida antes da publicação. Os testes não gravaram dados de QA no armazenamento real do aplicativo.

## Pendências e limites
- Conferência em Android físico e persistência após recarga pelo usuário. Login real de ponta a ponta, cadastro/edição de cliente pelo novo acesso e troca de permissões não foram testados no navegador de QA; o modal existente foi preservado e sua lógica de clientes continua na suíte anterior.
- Supabase real/sincronização entre aparelhos não testados; esta homologação mantém dados locais e rede remota bloqueada. Fazer backup geral antes de trocar navegador/aparelho.
- Somente placas brasileiras e hodômetro em km inteiros nesta etapa; máquinas sem placa, horímetro, GNV em m³, hodômetro substituído/zerado e viagens não implementados.
- Abastecimentos retroativos anteriores ao último registro não são inseridos para evitar alterar a sequência sem uma conferência própria. Apenas o último ativo é cancelável; correção histórica assistida permanece pendente.
- Edição/arquivamento de veículos, manutenção, multas, documentos/anexos e exportação específica de frota ainda pendentes. Histórico atual é consultável na tela; despesas podem ser exportadas no Financeiro e por obra.
- Não há pagamento real, emissão fiscal, cobrança nem estorno bancário. A integração registra informação manual e a despesa local correspondente.

## Roteiro de teste pelo celular
1. Menu → Clientes, veículos e abastecimentos → cadastrar veículo fictício com placa, cliente ou frota e hodômetro inicial.
2. Selecionar veículo → registrar abastecimento, preencher dados e conta do Financeiro; escolher obra e centro, se aplicável; conferir e confirmar.
3. Conferir despesa em Financeiro → Fluxo e na Gestão da Obra → Gastos.
4. Registrar dois tanques cheios com distância entre eles para fechar a média; testar parcial entre os cheios.
5. Tentar repetir registro e diminuir hodômetro: deve bloquear sem duplicar despesa.
6. Cancelar último registro com motivo e conferir histórico/totais. Recarregar para verificar persistência.

## Arquivos
`dist/veiculos_martins.js`, `dist/veiculos_martins_ui.js`, páginas completas, acesso existente de clientes, persistência e recuperação atualizadas; `scripts/veiculos.test.cjs`; `scripts/RESULTADOS_VEICULOS.txt`.
