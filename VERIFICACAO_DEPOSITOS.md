# Homologação — Depósitos e movimentação de materiais

Data: 05/11/2026. Aplicação completa no mesmo endereço privado de homologação. Site oficial/Netlify e dados definitivos não alterados; nenhum endpoint Supabase ativado.

## Implementado
- Suprimentos → Estoque & Depósitos: cadastro de nome, local, responsável, situação e vínculo com uma ou mais obras. Edição preserva ID/histórico; depósito com saldo não pode ser desativado. Sem exclusão permanente.
- Substituição do seletor demonstrativo que repetia o mesmo saldo geral por opções reais: Total geral, Sem localização definida e depósitos cadastrados. Nenhum material existente é atribuído automaticamente à matriz/canteiro.
- Localização explícita de saldo não localizado para depósito, transferência entre depósitos e devolução para sem localização. O total global é preservado nessas operações.
- Entradas/saídas no modal existente agora selecionam local e passam por conferência. Atualizam catálogo global e histórico de locais juntos. Saída sem localização só pode usar saldo não localizado; saída de depósito usa o saldo daquele depósito.
- Histórico de movimentos com produto, unidade de compra, quantidade, origem, destino, data, observação e autor. Identificação de operação repetida não duplica estoque.
- Quantidades calculadas em escala inteira de seis casas para evitar resíduos de soma. Quantidades antigas incompatíveis não são arredondadas ou migradas automaticamente: a operação é recusada para conferência.
- Valor estimado na tabela corresponde ao saldo do local selecionado × preço de compra cadastrado. Valores sem preço ficam identificados. Coluna de conversão segue a multiplicação pelo fator já usada na tabela anterior; não houve reinterpretação/migração dos fatores de medida existentes.
- Gestão da Obra → aba Depósitos da obra, ao lado das abas existentes. Mostra local/responsável/vínculos e saldos por produto. Saldo compartilhado de um depósito não significa reserva exclusiva nem gasto financeiro de cada obra vinculada.
- Validação bloqueia redução do saldo global/exclusão de produto que deixaria material localizado sem cobertura. Fluxo de cadastro rápido de produto preservado, com atualização controlada da versão do catálogo no movimento que estava aberto.
- Bases novas cm_depositos_locais_v1 e cm_movimentos_depositos_v1 incluídas no diário recuperável e backup geral. Catálogo existente cm_produtos_fator_db_v1 preservado como total global.
- Sem lançamento automático no Financeiro, consumo na Gestão ou texto no RDO. Registrar material utilizado continua no fluxo separado já existente.
- Controle de permissão local para alterações (Master/estoque/suprimentos/almoxarifado/administração autorizados), sem mudar permissões de usuários nem equivaler a autorização de servidor.

## Testado
- 178 testes automatizados passaram: 157 regressões anteriores e 21 novos casos de depósitos/saldos/recuperação.
- Cadastro/vínculos sem alterar estoque, nomes duplicados, obra ausente, edição, saldo sem localização, transferências, devolução, entrada/saída, insuficiência, precisão decimal, repetição de operação, desativação com saldo, bloqueio de exclusão/redução inconsistente, imutabilidade das fontes, referências inválidas, permissões e gravação recuperável.
- Falha simulada na segunda base: catálogo e movimentos voltaram ao estado anterior; conclusão/reversão explícitas conferidas.
- Compilação estática: 44 scripts da aplicação/HTML, dependências locais e bloqueio remoto verificados.
- Navegador em fixture descartável com módulos reais e armazenamento em memória: cadastro de Canteiro QA ligado à Obra A sem mover as 50 unidades; localização de 20 com total global mantido em 50; tabela do depósito mostrou 20 e avaliação de R$ 500; Gestão mostrou depósito e saldo; saída de 4 resultou em 16 no depósito e 30 não localizadas, com global 46.
- Aplicação completa no DOM: painel em Suprimentos, aba dentro da Gestão, local no modal existente, data brasileira e acessos de Financeiro/Relatórios/RH preservados.
- Fixture removida antes da publicação. Nenhum movimento de QA executado no armazenamento real da aplicação.

## Pendências e limites
- Conferência em Android físico, fluxo completo com login real, cadastro rápido de produto enquanto o modal está aberto e persistência após recarga não testados de ponta a ponta no navegador de QA.
- Dados locais neste navegador; sincronização Supabase, RLS/permissões de servidor e migração de saldos definitivos permanecem pendentes. O site oficial não foi alterado.
- Esta localização cobre o catálogo de materiais; estoque/distribuição de uniformes e EPIs permanece separado, sem migração para depósitos.
- Pedidos de compra, recebimento de nota fiscal, inventário por lote, custo médio/FIFO e integração contábil/financeira não foram automatizados nesta etapa. A etapa não afirma homologação nova do fluxo de pedidos.
- Correção/estorno formal de movimento está pendente; histórico não é apagado. Pode ser registrada movimentação compensatória explícita quando aplicável, com referência no motivo, sem alterar movimentos antigos.
- Alteração de nome de obra não migra vínculos automaticamente; vínculos indisponíveis são identificados na edição para revisão. Não há reserva exclusiva por obra em depósito compartilhado.
- Valor é estimado ao preço atual cadastrado, não custo contábil histórico. Conversões de medida antigas devem ser conferidas separadamente por regra de unidade; autoridade do saldo e dos movimentos é a unidade de compra.

## Roteiro pelo celular
1. Suprimentos → Estoque & Depósitos → Cadastrar depósito; informar local, responsável e marcar obra.
2. Conferir que cadastrar não move o total geral e que o saldo aparece como sem localização definida.
3. Localizar/transferir material: produto, origem sem localização, destino depósito, quantidade e data → conferir/confirmar.
4. Selecionar depósito na tabela e comparar com Total geral. Testar entrada/saída do local escolhido e tentativa acima do saldo disponível.
5. Gestão → selecionar obra → Depósitos da obra; conferir vínculo e saldo. Trocar obra e verificar os depósitos correspondentes.
6. Recarregar e verificar persistência; usar backup geral antes de trocar navegador/aparelho.

## Arquivos
`dist/depositos_martins.js`, `dist/depositos_martins_ui.js`, duas páginas completas, persistência e recuperação; `scripts/depositos.test.cjs`; `scripts/RESULTADOS_DEPOSITOS.txt`.
