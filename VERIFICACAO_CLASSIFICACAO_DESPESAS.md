# Verificação — classificação de despesas por obra

Data: 06/11/2026. Base remota conferida: 5157a0be66248ab249246f6054081ba31ada395f (desenvolvimento), pai 6320ac32826aef415569273a643c91fad8be5de0.

Fonte recuperada pelo conector GitHub; Git direto não autenticou. Os arquivos recuperados foram comparados pelos hashes de blobs Git com a árvore original, antes do envio. O envio usa árvore base e pai remotos reais, preservando o histórico; o commit de snapshot local não é enviado.

## Entrega

- Nova tela local de classificação, relatório e CSV de saldo não classificado, incluindo despesas ainda sem vínculo.
- Distribuição parcial, fila de Compras com parcela reservada, proposta com documentos e aprovação exclusiva do Master.
- Reclassificação com motivo, versões e auditoria anterior/posterior, preservando total, empresa, conta, data e situação financeira.
- Conciliação manual exclusiva do Master com referência única na operação. Não chama pagamento, transferência ou baixa.
- Liberação explícita de Compras por operação e vínculo explícito de obras. Nenhuma conta pessoal criada ou identificada por nome.
- Rateios aprovados locais integram o mesmo lançamento usado nos gastos por obra. Não há cópia de obrigação ou de estoque.
- Contrato de servidor 009, separado da tela local, com FK por empresa, RPC, RLS, saldo parcial e trilha de auditoria testados em PostgreSQL local sintético.
- Contrato de arquitetura Open Finance com provedores e ações automáticas desativados. OFX/CSV planejados, sem importador implementado.

## Validação

- Suíte completa JavaScript: 690 testes aprovados, sem falhas, cancelamentos ou testes ignorados.
- 19 testes novos de domínio/persistência e 10 testes novos (incluindo o agrupador) de PostgreSQL/RLS.
- Python NF-e: 10 testes aprovados; dependências fixadas instaladas no ambiente, sem alterações em requirements.
- Check estático: 66 scripts compilados e dependências presentes.
- Auditoria de publicação com novos arquivos incluídos: 237 arquivos versionados, nenhum achado.
- As duas entradas HTML mantêm conteúdo idêntico.
- Revisão do navegador: aplicação abriu e mostrou primeiro acesso. Fluxo autenticado completo, validação visual da nova tela, responsividade e aparelho físico não foram homologados nesta execução.

## Limitações

Tela nova é local: não compartilha tarefas entre dispositivos. Segurança local não substitui RLS. Contrato SQL não foi aplicado remotamente; falta conectar tela, anexos privados e consulta remota de gastos por obra. Isolamento global das telas legadas por empresa, liberações remotas por documento e integração de identidade/concessões ainda exigem implementação e homologação específicas. Compras recebe acesso à operação apenas por seleção explícita do Master; José Henrique não recebeu acesso automático.

Origens informadas são únicas por operação, mas detectar duplicidade semântica entre documentos/obrigações existentes requer completar o vínculo remoto. O novo fluxo nunca gera outra obrigação; as proteções anteriores da NF-e permanecem intactas. Não há consulta bancária real, importador OFX/CSV, emissão de pagamentos ou conciliação automática.

ICP-Brasil e SEFAZ oficiais permanecem pendentes. Nenhuma publicação, alteração em main, migração definitiva ou modificação do Supabase remoto.
