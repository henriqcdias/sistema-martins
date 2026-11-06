# Classificação de despesas — contrato e continuidade

Base conferida no GitHub: `5157a0be66248ab249246f6054081ba31ada395f`, branch desenvolvimento, pai `6320ac32826aef415569273a643c91fad8be5de0`.

## Implementação desta etapa

A interface Classificação de despesas está no Financeiro e no menu lateral, com fila de Compras. Usa somente o armazenamento local de homologação, com gravação recuperável conjunta e comparação da versão da base. Não existe integração bancária nem chamada remota nova.

1. Master vincula explicitamente a obra e libera o usuário de Compras à operação. Operações lógicas: Construtora Martins (principal) e Calhas e Rufos (separada); nenhum CNPJ, sócio ou cadastro pessoal é criado. José Henrique não é identificado por nome nem recebe acesso automático: o Master seleciona a conta correta existente e libera apenas Calhas e Rufos.
2. Lançar uma despesa manual no Financeiro, com a empresa responsável e sem obra, usando os recursos existentes. O campo empresa deve corresponder exatamente à operação selecionada. Registros antigos com outros nomes exigem conferência; não são migrados automaticamente.
3. Vincular esse lançamento existente à classificação. Não cria outra despesa, nota, estoque, parcela ou obrigação. Origens canônicas opcionais identificam NF-e + parcela, conta a pagar e transação bancária; a mesma referência não pode vincular duas despesas na operação. Sem referências, não existe detecção semântica automática de duplicidade.
4. Encaminhar uma parcela a um usuário liberado para Compras. O valor fica reservado para evitar encaminhamento sobreposto. Compras só vê suas tarefas, com valor da parcela e orientação, e propõe obra, centro de custo, categoria, fornecedor, materiais/serviços e finalidade. Pode anexar até dez documentos PDF/PNG/JPEG de até 1 MB cada. Armazenamento local pode atingir a quota antes disso; falhas preservam a operação recuperável.
5. Somente Master aprova/rejeita/retira tarefas. Aprovação parcial atualiza os rateios do mesmo lançamento, mantendo o saldo restante pendente. Propostas não entram no custo da obra. Rateio por obra continua único; uma segunda proposta para obra já classificada requer consolidar pelo comando de reclassificação.
6. Master pode substituir toda a distribuição com motivo obrigatório e histórico anterior/posterior, retirando antes as tarefas pendentes. Distribuição pode permanecer parcial ou vazia. Pagamentos manuais legítimos posteriores ao vínculo não bloqueiam reclassificação; mudanças no valor ou identificação original exigem conferência.
7. Conciliação é confirmação manual, exclusiva do Master, com referência única por empresa e auditoria. Não paga, transfere, baixa ou muda a situação do caixa. Não equivale a extrato consultado em banco.
8. Relatório e CSV mostram valores total, classificado, pendente e reservado, sempre em centavos internamente. Despesas canceladas não entram no ativo. Gastos por obra e total da empresa continuam consultando o lançamento financeiro único.

Registros legados continuam sujeitos à validação anterior de rateio integral. Apenas registros explicitamente classificados recebem `classificacaoVersao: 1` e aceitam rateios parciais. O total financeiro segue integral na empresa, mesmo com saldo sem classificação.

## Limites de segurança e integração

O isolamento desta nova tela é lógico e local, não uma barreira de segurança contra alguém com acesso ao armazenamento ou ao código do navegador. Não está homologado para usuários reais ou vários dispositivos. As demais telas legadas não receberam isolamento global entre empresas nesta etapa. O fluxo remoto existente de NF-e e Financeiro por usuário foi preservado; sua RLS não protege automaticamente a nova base local.

A configuração da nova fila não altera o papel global do usuário. Não modifica RH ou Frequência: a administração continua usando os controles existentes. Atribuir rotinas administrativas centralizadas no servidor requer concessões por empresa; não se deve conceder acesso financeiro por consequência de uma permissão de RH.

O arquivo `supabase/homologacao/009_classificacao_despesas.sql` implementa o núcleo de servidor, testado em PostgreSQL local (PGlite): vínculos com despesas existentes, referências únicas, delegação de Compras, tarefas, propostas, aprovação/reclassificação, conciliação, auditoria e relatório `cd_saldos` com RLS. Não foi aplicado remotamente nem conectado à tela local. Usa IDs UUID de empresas/obras existentes, sem cadastrar empresas reais. Os IDs lógicos da tela local não são enviados automaticamente ao servidor.

O servidor não cria financeiro nem estoque; rateios ficam separados em `cd_despesas`. A integração da consulta remota de gastos por obra a esses rateios ainda é pendente. Repetições com revisão antiga são recusadas sem novos efeitos; ainda não existe retorno idempotente da mesma resposta via ID de operação para esse contrato.

Antes de ativação remota, completar as integrações e verificações abaixo:

| Entidade / comando | Contrato obrigatório |
| --- | --- |
| Empresas e membros | IDs internos estáveis, sem exigir CNPJ; participação explicitamente concedida pelo Master; funcionalidades e documentos concedidos separadamente |
| Despesa classificada | FK composta `(empresa_id, lancamento_id)` para `fin_lancamentos`, sem copiar obrigação financeira; versão e total verificados no servidor |
| Obras | FK composta para obra da mesma empresa; dados legados permanecem pendentes de vínculo explícito |
| Origem da despesa | Associação NF-e/parcela, obrigação existente e movimento bancário com unicidade composta por empresa, tipo e ID externo; NF-e com várias parcelas usa chave + número da parcela |
| Tarefas de Compras | Destinatário e parcela definidos pelo Master; RLS revela somente tarefa atribuída e documentos liberados, sem acesso ao extrato completo |
| Propostas e rateios | Estados encaminhada → proposta → aprovada/rejeitada/retirada; bloqueio do lançamento e soma em centavos dentro da mesma transação; nenhuma escrita direta por clientes |
| Reclassificação | Revisão esperada, justificativa, auditoria imutável, preservação da origem e invalidação explícita de propostas anteriores |
| Documentos | Bucket privado, conteúdo/tamanho/hash validados no servidor, vínculo composto com empresa e tarefa, acesso revogável por documento |
| Conciliação | RPC Master verificado com `auth.uid()` e membro ativo; referência da transação única; não chamar `fin_conferir` como se fosse conciliação bancária |
| Concorrência | Versão esperada, lock por empresa e rollback completo já implementados; falta ID de operação com resposta idempotente |
| Migração local/remota | Exportar e conferir explicitamente; não sincronizar automaticamente a nova chave como um registro genérico financeiro |

Não executar scripts no Supabase remoto sem autorização expressa. As migrações anteriores permanecem inalteradas.

## Arquitetura futura de Open Finance

`MartinsClassificacao.banking` declara capacidades; provedores reais e todas as ações automáticas estão desativados. Somente entrada manual está disponível. OFX e CSV são formatos planejados, ainda sem parser ou tela de importação.

O próximo adaptador recebe arquivo/autorização, produz uma **prévia** de movimentos normalizados e permite confirmação humana da importação. Um movimento importado não é uma despesa nova automaticamente. Deve primeiro buscar vínculo com obrigação/NF-e existente e manter casos ambíguos pendentes.

Contrato normalizado proposto: empresaId, contaId, origem (`manual`, `ofx`, `csv`, `open_finance`), idExterno/FITID, dataContabil, valorCentavos assinado, moeda, descricao, hashArquivo, numeroLinha e consentimentoId quando aplicável. Unicidade por `(empresaId, contaId, origem, idExterno)`; arquivos sem ID precisam de hash e revisão de colisões. Valores iguais no mesmo dia não bastam para deduplicar.

Separar `adaptador → prévia → movimentos imutáveis → sugestões de vínculo → aprovação Master → classificação`. Não guardar tokens bancários no navegador. Um provedor futuro precisará de serviço servidor, consentimento com escopos mínimos, expiração, revogação e auditoria. Nunca permitir que webhook/importação execute pagamento, transferência, baixa ou conciliação automática.

## Pendências preservadas

Validação oficial da cadeia ICP-Brasil e consulta oficial SEFAZ continuam pendentes; a NF-e não está pronta para produção. Sem publicação, merge em main, migração definitiva ou acesso a banco real nesta etapa.
