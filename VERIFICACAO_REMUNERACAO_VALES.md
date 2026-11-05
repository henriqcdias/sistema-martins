# Homologação — Remuneração, Diárias e Vales

Data: 05/11/2026. Incremento da aplicação completa de homologação, preservando RH, EPIs, estoque, RDO, Planejamento e Financeiro existentes. Nenhuma alteração no Netlify oficial, banco Supabase, migração definitiva ou pagamento bancário.

## Implementado

- Aba Remuneração e Vales dentro de Colaboradores/RH, com acesso na barra lateral e edição da ficha salarial existente. Não foi criado cadastro paralelo de pessoas. Colaboradores inativos continuam consultáveis para períodos anteriores ao encerramento.
- Apuração individual de até 31 dias pela Frequência Diária. Planejamento e RDO não entram na soma. Período futuro, fora do contrato, sem referência salarial ou com periodicidade alterada durante o período fica bloqueado para conferência.
- Remuneração vigente por dia, usando histórico de valores/periodicidades/vigências do cadastro. Valor legado sem periodicidade não é presumido como mensal ou diária. Alteração de valor no período é aplicada conforme a vigência; mudança de periodicidade exige períodos separados.
- Diárias: escolha explícita entre diária integral por dia com presença ou proporcional às horas/jornada de referência informada. Um dia com várias obras conta uma vez; obras e horas permanecem discriminadas para conferência. Não há presunção de remuneração legal de ausências.
- Valor por hora: horas regulares com presença multiplicadas pela referência vigente. Jornadas e alocações devem ter intervalos de 15 minutos; inconsistências na fonte são bloqueadas, não arredondadas silenciosamente.
- Mensalistas: base aprovada para o período informada explicitamente pelo responsável. O módulo mostra a referência cadastral, mas não presume proporcionalidade ou desconto de falta/atestado. Isso é apuração operacional, não folha legal automática.
- Horas extras por data, com presença no período, quantidade aprovada e valor da hora extra em reais. Percentual legal não é presumido. Não há extra inferida de Planejamento/RDO. Limite de consistência: soma regular e extra até 24h por dia; não representa autorização de jornada.
- Extrato com dias/horas/situações, referências vigentes, base, extras, bruto, vales e líquido. Avisos identificam dias sem apontamento e ausências. Exportação CSV da prévia ou do fechamento salvo, com proteção contra fórmulas em campos textuais.
- Vales: controle apenas do RH; vínculo a despesa de mão de obra já paga; ou registro explícito de despesa declarada já paga. A terceira opção exige confirmação de que o valor foi entregue e acesso ao Financeiro; não transfere dinheiro. Para novo registro, permite empresa, conta, obra e centro de custo.
- Vale somente de controle precisa ser conciliado antes do desconto. Vínculo exige despesa paga, mesmo valor/data de pagamento e ausência de outro vínculo. A associação é escolhida/conferida pelo responsável; não é conciliação bancária automática.
- Fechamento exige conferência explícita e acesso sensível ao RH mais permissão financeira. Vales selecionados devem ser do colaborador, estar disponíveis e conciliados com despesas pagas da mesma empresa do fechamento. Vales anteriores podem ser usados, mas posteriores ao fim do período não. Não há líquido negativo nem desconto duplicado.
- Gera no Contas a Pagar apenas o líquido, como despesa pendente de Mão de obra, com conta, empresa, vencimento e destino explícito: administração, uma obra ou rateio manual entre obras/centros. Vales já pagos não são lançados novamente. Se o líquido for zero, salva o fechamento sem criar conta de valor zero.
- Fechamento guarda cópia da apuração e histórico. Bloqueia período sobreposto do mesmo colaborador, inclusive em outra empresa ou com a conta já paga. Repetição da mesma identificação não cria outra conta; identificação reaproveitada com dados diferentes é recusada.
- Estorno de fechamento ainda pendente, com motivo, cancela a conta gerada e libera os vales para nova conferência, mantendo o histórico. Se a conta já foi marcada paga ou estiver inconsistente, estorno automático é bloqueado. Fechamento com líquido zero também pode ser estornado sem criar contas.
- Estorno de vale não consumido: se o registro de despesa foi criado pelo vale, cancela esse registro; se foi vinculado a despesa preexistente, preserva a despesa e libera apenas o vínculo. Vale já descontado exige primeiro o estorno do fechamento permitido.
- O Financeiro genérico mantém a ação de registrar pagamento. Cancelamento de conta/vale vinculado a fechamento é direcionado ao módulo de Remuneração para preservar a coerência das bases.
- Persistência recuperável conjunta de vales, fechamentos e caixa, com backups anteriores, conferência de versão e recuperação explícita. Duas novas bases locais: `cm_vales_rh_v1` e `cm_fechamentos_rh_v1`, incluídas no backup geral. Não há inicialização ou importação automática de dados antigos.
- Datas do novo fluxo e histórico apresentados em Brasília; instantes registrados em ISO/UTC. Campos novos e linhas dinâmicas reutilizam o formatador brasileiro/calendário existente. Cores e estrutura visual do sistema preservadas.

## Testado

**306 testes automatizados aprovados:** 259 regressões e 47 testes novos de Remuneração/Vales. Resultado integral em `scripts/RESULTADOS_REMUNERACAO.txt`.

- Diária integral/proporcional, valor por hora, múltiplas obras, vigências históricas/correções, legado sem inferência e mudança de periodicidade.
- Base mensal explícita, valores de extra, ausência de presença, extra duplicada/sem valor e consistência de horas/datas/contrato.
- Vales de controle, conciliação posterior, vínculo a despesa existente, declaração de valor já pago e ausência de duplicação de despesa.
- Bloqueios por data/valor/categoria/vínculo, outra pessoa/empresa, seleção repetida, vale indisponível ou superior ao bruto e despesa cancelada depois do cadastro.
- Conta pendente com líquido correto, revisão/conta/vencimento/rateio obrigatórios, período sobreposto, repetição idempotente, período adjacente e líquido zero.
- Estorno de fechamento pendente e de líquido zero; bloqueio após registro de pagamento; liberação de vales; preservação de despesa preexistente e histórico. Bloqueio do cancelamento genérico de vínculos já consumidos.
- Integração real entre os núcleos: bruto R$ 240,00, vale pago R$ 50,00 e líquido pendente R$ 190,00. Contas a Pagar mostra R$ 190,00; Gestão da Obra soma R$ 50,00 pagos e R$ 190,00 pendentes, total R$ 240,00, sem duplicidade.
- Falha simulada em cada uma das três bases durante a gravação; recuperação por concluir e reverter; conflito de outra aba; backup/restauração em destino vazio e recusa de totais inconsistentes.
- Regressões de RH/documentos, EPIs, estoque/depósitos, RDO, propostas, financeiro/frota e preparação Supabase passaram.
- Verificação estática final aprovada: **52 scripts compilados**, dependências locais presentes, fontes fictícias, rede principal bloqueada e conector Supabase isolado/opt-in.

Navegador: fixture descartável com módulo/núcleos reais, sessão e armazenamento sintéticos em memória. Prévia de duas presenças/12h com diária integral de R$ 120,00 resultou em R$ 240,00 e avisos de três dias sem apontamento. Registrado vale fictício de R$ 50,00 como já entregue, com conta/empresa/obra. Seleção do vale, revisão e confirmação geraram fechamento com líquido de R$ 190,00 e histórico da conta pendente. Estorno com motivo marcou o fechamento/conta como estornados/cancelados e devolveu o vale à situação aberta, preservando o registro pago do vale e os históricos. Fixture removida antes da publicação.

O navegador apresentou falhas intermitentes de transporte/tempo de resposta nos cliques de automação. Foi possível concluir o fluxo usando o controle acessível documentado, após verificar o estado, sem repetir confirmações já executadas. Foi corrigida uma mensagem antiga de prévia que permanecia após salvar; a verificação estática final foi repetida após esse ajuste textual.

## Pendências e limites

- Este módulo não é motor de folha trabalhista/fiscal. Encargos, INSS/FGTS/IRRF, férias, 13º, adicional noturno, descanso remunerado, convenções, afastamentos remunerados e descontos legais não são calculados. Não foi feita homologação jurídica/contábil. Regras e valores operacionais precisam ser conferidos pelo responsável.
- Mensalistas usam base manual aprovada para o período; não há cálculo automático de admissão/desligamento proporcional. Horas extras usam valor explícito informado, sem presumir percentual ou divisor legal.
- Dados permanecem neste navegador; não há sincronização online entre aparelhos, conexão bancária, comprovante bancário, transferência ou importação automática de vales antigos. Supabase/Netlify permanecem para etapa posterior autorizada.
- Rateio financeiro do líquido é explicitamente informado; o detalhamento de horas por obra auxilia a conferência, mas não distribui custos automaticamente. Despesa do vale conserva seu próprio rateio. A classificação correta dos dois é necessária para representar o bruto por obra.
- Conciliação de vale exige escolha humana da despesa correta; igualdade de valor/data não comprova favorecido bancário. Vínculos não dispensam documentos comprobatórios.
- Estorno automático de fechamento cuja conta já esteja paga fica bloqueado; ajuste posterior exige procedimento financeiro específico ainda não implementado. Não há devolução real de dinheiro por esta tela.
- A interface foi exercitada na fixture sintética, sem login completo da aplicação ou Android físico. Navegação de todas as entradas do menu, formatação dinâmica de datas no aparelho, download físico do CSV e fluxo completo pelo Financeiro visual ainda exigem conferência. Os núcleos de Contas a Pagar/Gastos foram testados de forma integrada.
- Horas extras, mensalista, conciliação posterior e rateio múltiplo foram testados no núcleo automatizado; a rodada interativa de navegador usou diária integral, vale novo, uma obra, fechamento e estorno. Não considerar esses outros fluxos aprovados em aparelho real.
- O extrato monetário foi adicionado nesta nova aba. O relatório operacional antigo não foi reescrito nem convertido em demonstrativo salarial legal. PDF/holerite de remuneração permanece como evolução futura; a exportação disponível neste bloco é CSV.
- Permissões reutilizam o acesso sensível ao RH existente; lançar/vincular despesas e confirmar/estornar fechamento exige também acesso financeiro. Perfis com negação explícita de RH ou inativos são recusados. ACL completa e autorização por servidor/RLS continuam pendentes.
- Não foi publicada alteração no site oficial nem realizada migração definitiva. Nenhuma conta real ou dado real de colaborador foi usado nos testes.

## Roteiro pelo celular

1. RH → Remuneração e Vales → selecionar colaborador de teste. Na ficha, informar remuneração com periodicidade e vigência se ainda não existir referência completa.
2. Conferir o período da Frequência. Escolher regra de diária ou informar a base aprovada para mensalista; extras, quando houver, precisam de data/horas/valor explicitamente conferidos.
3. Registrar vale de controle ou, com permissão financeira, vincular a despesa paga/cadastrar registro de valor já entregue. Não duplicar uma despesa existente.
4. Selecionar vales conciliados → Calcular/conferir extrato. Conferir dias sem apontamento, ausências e valores.
5. Informar empresa, conta, vencimento e obra/centro ou rateio do saldo líquido. Marcar revisão e conferir o fechamento antes de confirmar.
6. Consultar Contas a Pagar e Gastos com a Obra. Registrar pagamento é uma anotação no sistema; a transferência é externa.
7. Para corrigir fechamento ainda pendente, usar estorno com motivo na aba de remuneração. Não apagar históricos. Fazer backup geral antes de trocar de navegador/aparelho.

## Arquivos

`dist/remuneracao_martins.js`, `dist/remuneracao_martins_ui.js`, integração em persistência/Financeiro/formatador de datas, duas páginas completas, `scripts/remuneracao.test.cjs`, `scripts/RESULTADOS_REMUNERACAO.txt` e este relatório.
