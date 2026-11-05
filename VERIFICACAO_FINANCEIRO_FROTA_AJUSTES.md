# Contas financeiras e cadastro da frota
Data: 05/11/2026

Financeiro:
- Banco específico no cadastro de nova conta bancária; contas antigas sem essa identificação continuam legíveis.
- Filtro por parte do nome de fornecedor/favorecido/cliente no fluxo e em Contas a Pagar/Receber, sem distinguir maiúsculas e acentos, com totais e CSV do filtro.
- Cadastro rápido de conta retorna ao lançamento, seleciona a nova conta e mantém os valores preenchidos. Há botão para retornar sem salvar conta.
- Conta financeira continua obrigatória; permitir título sem conta fica para avaliação posterior.

Frota:
- Novos cadastros exigem marca e modelo; veículos antigos continuam válidos.
- Botão padronizado como Cadastrar veículo, com marca/modelo na conferência e seleção.
- Integração de abastecimento e despesa preservada.

Testes novos: 3 de Financeiro e 2 de Frota, aprovados. Regressão geral: 364 aprovados, zero falhas, e compilação de 58 scripts. Os casos financeiros anteriores foram adaptados para informar banco no cadastro novo; contas legadas continuam cobertas.
Pendente: conferência visual/funcional do retorno ao lançamento, banco e frota no ambiente autenticado e em celular, além da persistência real no Supabase. Nenhuma operação bancária foi executada.
