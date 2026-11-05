# Homologação — Uniformes e EPIs integrados ao estoque

Data: 05/11/2026. Aplicação completa de homologação, mantendo o bloco anterior de RH. Netlify oficial, Supabase e dados definitivos não foram alterados. Não houve migração de estoque ou de recibos antigos.

## Implementado

- Cadastro geral de produtos pergunta Material comum, Uniforme ou EPI. Uniformes/EPIs têm tamanho e mínimo; EPI exige número de CA e data de validade do produto/lote. Unidade de compra UN ou PAR e fator 1; saldo e entregas em quantidades inteiras.
- Cadastro aberto pela gestão de EPIs também cria produto no catálogo geral, sem criar uma segunda quantidade no cadastro antigo. Categoria, tamanho, preço e saldo inicial permanecem disponíveis. Escolher categoria de proteção sugere tipo EPI; CA/validade ficam visíveis e obrigatórios.
- Os produtos classificados aparecem automaticamente na gestão de Uniformes/EPIs como projeção do catálogo, com seu saldo atual. Itens antigos permanecem na base original, identificados separadamente. Não há junção automática de itens com nomes iguais.
- Seleção de produto já cadastrado para classificá-lo como Uniforme/EPI, mantendo ID e saldo, sem recadastrar. Recusa unidades/embalagens incompatíveis em vez de converter automaticamente. Revisão explícita de classificação, CA, validade, tamanho e mínimo em itens existentes, com histórico de antes/depois e autor. Quantidade preservada. Itens antigos sem classificação devem ser revisados antes da nova entrega; não presumimos que uma peça é EPI pelo nome.
- Entrega com lista de itens, quantidade própria por linha, colaborador por ID, data de Brasília, obra/local, motivo e observação. Produtos do catálogo permitem escolher depósito ou saldo sem localização; itens antigos usam a base original. Planejamento, Frequência e RDO não são modificados.
- Validações: saldo de cada origem, quantidade inteira positiva, seleção duplicada, colaborador ativo, entrega não futura nem anterior à admissão, CA informado e validade do EPI. EPI vencido na data atual fica bloqueado, inclusive para lançamento retroativo; validade no dia atual é aceita. Não existe consulta externa de CA.
- Conferência antes de confirmar: todas as linhas aparecem com quantidades, CA e validade. Gravação reúne catálogo, movimentos de depósitos, estoque antigo quando usado, distribuições e histórico do colaborador em operação recuperável. Mecanismo de persistência ampliado de até três para até cinco bases, com backups anteriores, verificação de versão e recuperação explícita.
- Lote único de recibo, com uma linha histórica por item e cópia dos dados do colaborador/produto na entrega. Alterar depois o nome do colaborador ou o CA do produto não muda o recibo anterior. Repetir a mesma identificação com os mesmos dados não baixa novamente; dados diferentes com a mesma identificação são recusados.
- Prévia do recibo único e geração de PDF real com logo, identificação, relação dos itens, CA/validade e campos de assinatura. O documento indica assinatura pendente; não há assinatura eletrônica automática. Comprovantes assinados continuam no fluxo de anexos da ficha existente.
- Números fixos e frases que simulavam CA/aprovação foram retirados dos templates antigos. Dados ausentes aparecem como não informados; recibos antigos gravados e anexos existentes não foram reescritos.
- Relatório de estoque evita contar o produto do catálogo e sua projeção de EPI duas vezes, mantendo o valor estimado conhecido do item vinculado. Relatório de entregas reconhece o ID do colaborador, mesmo após mudança de nome.
- Ajustes rápidos de item vinculado abrem o movimento do catálogo, com seleção de origem. Atalhos antigos de exclusão não podem apagar recibos integrados ou produtos vinculados; limpeza em lote fica bloqueada quando há recibos integrados. Exclusão/estorno de entregas integradas não foi acrescentado nesta etapa.
- Dados textuais dos novos produtos são apresentados com proteção de HTML nos renderizadores de estoque/entregas existentes. Não foram ampliadas permissões dos usuários cadastrados; o fluxo verifica perfil/sessão local autorizado a EPIs/estoque/RH.

## Testado

**259 testes automatizados aprovados:** 220 regressões e 39 novos testes. Resultado integral em `scripts/RESULTADOS_EPIS.txt`.

- Classificação, CA/validade obrigatórios, unidades/fator, saldos inteiros, legado sem inferência e revisão sem migração.
- Entrega múltipla com quantidades distintas, mistura de catálogo/legado, baixa por depósito e preservação de demais saldos.
- Saldo insuficiente em qualquer linha impede a proposta inteira, sem mutar as bases de origem. Bloqueios de vencimento, datas, inatividade, quantidades inválidas e itens repetidos.
- IDs únicos, pessoas com nomes iguais, repetição idempotente, conflito de identificação e consistência do agrupamento do recibo.
- Preservação de dados anteriores, recibos assinados e cópias dos dados da entrega; identificação por ID nos relatórios e ausência de dupla contagem do estoque.
- Gravação recuperável de cinco bases, conflito após conferência e falhas simuladas em cada uma das cinco bases. Recuperação por concluir e por reverter verificada, incluindo falha na quinta base. Backup geral restaurado em destino vazio de teste, preservando estoque, CA, entrega e históricos.
- PDF real extraído e conferido: todos os itens, CA, validade e assinatura; sem cabeçalho de RDO ou assinatura de fiscalização. Logo presente em todas as páginas. PDF A4 sintético renderizado e inspecionado: logo, texto, itens e assinaturas visíveis, sem cortes no caso testado.
- Verificação estática: **50 scripts compilados**, dependências locais presentes, fontes fictícias e bloqueio de rede principal preservado. Conexão Supabase continua isolada e opcional.

No navegador, fixture descartável com os formulários reais e módulos reais, usuário e armazenamento sintéticos em memória: cadastro de luva com categoria de proteção, CA e validade, aparecimento no catálogo projetado; revisão de botina antiga sem mudar o saldo; entrega de dois capacetes e uma camisa, revisão, confirmação, saldo de 5→3 e 3→2, recibo conjunto e geração de PDF com links de abrir/baixar. Tentativa de entregar 99 unidades bloqueada com mensagem Saldo insuficiente em estoque e botão de fechar funcional. Fixture removida antes da publicação.

Aplicação completa: módulos, classificação no cadastro geral, painel e diálogo de entrega carregados no DOM, sem erro de aplicação observado. O fluxo autenticado completo não foi exercitado nesta rodada; os fluxos interativos foram validados na fixture de teste.

## Pendências e limites

- Homologação funcional local: dados não sincronizam entre aparelhos. Nenhuma tabela ou política Supabase foi criada/modificada. Netlify permanece para a fase posterior dos módulos.
- CA é um número informado pelo usuário/fornecedor; o sistema não confirma existência, situação ou adequação do equipamento. A validade cadastrada é do EPI/produto/lote, não uma afirmação de validade do certificado. Cada tamanho/lote com validade diferente precisa de cadastro próprio. Não há controle de lote/serial independente do produto.
- Campos e recibo não comprovam conformidade normativa, aptidão do equipamento, treinamento ou assinatura. Revisão técnica do texto e documentação permanece necessária; não foi realizada homologação jurídica de NR-06.
- Não foi implementada coleta de assinatura digital. Anexar/abrir comprovante assinado usa a ficha existente; esse fluxo completo não foi retestado no celular nesta rodada.
- Login completo, Android físico, impressão no dispositivo, download efetivo pelo gerenciador do celular e documento com cinquenta itens ainda precisam de conferência. O PDF sintético de dois itens foi conferido no navegador, por extração automatizada e renderização.
- Produtos do catálogo com saldo já localizado devem ser entregues a partir do depósito correto. Não há escolha automática da origem nem conversão de caixa/pacote para peças neste fluxo.
- Estoque antigo e catálogo continuam fontes distintas para itens diferentes. O sistema não tenta decidir se dois cadastros existentes representam o mesmo saldo. Isso evita migração ou soma presumida de dados.
- Estorno/devolução da entrega integrada, consolidação de recibos legados por colaborador com todos os novos campos, alertas de validade por notificação e consulta oficial de CA são evoluções pendentes. Os recibos novos são acessíveis pelo ID da entrega/lote nas ações existentes.
- Controle de acesso continua local; ACL completa e autorização de servidor/RLS permanecem pendentes. Sem navegador com Web Locks, a persistência usa conferência de versão e diário recuperável; não equivale a transação de servidor entre dispositivos.
- Nenhum lançamento automático no Financeiro, pagamento, consumo em obra ou alteração do RDO. Folha/vales e demais módulos do backlog continuam pendentes.

## Roteiro para teste pelo celular

1. Recursos Humanos → Gestão de Uniformes/EPIs → Cadastrar produto.
2. Cadastrar um produto fictício; marcar EPI e informar CA/validade. Para uniforme, escolher Uniforme. O saldo será único no catálogo.
3. Se houver item antigo, abrir Revisar classificação/CA antes da entrega. Não repetir no catálogo um saldo que já exista na base antiga.
4. Entrega com vários itens → colaborador → obra/local → adicionar cada produto com sua quantidade/origem → conferir → confirmar.
5. No recibo, Gerar PDF com logo → Abrir PDF/Baixar PDF. Conferir dados, itens, CA/validade e assinaturas em branco.
6. Conferir saldos e histórico; fazer backup geral dos testes antes de trocar de navegador. Não usar documentos ou dados pessoais reais na homologação.

## Arquivos

Núcleo e interface novos: `dist/epis_martins.js`, `dist/epis_martins_ui.js`. Integrações: materiais, depósitos, persistência recuperável, relatório, PDF e as duas páginas completas. Testes: `scripts/epis.test.cjs`, `scripts/RESULTADOS_EPIS.txt` e este relatório.
