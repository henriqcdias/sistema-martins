# Reserva → Consumo → Devolução — 06/11/2026

Journal de operações usa o catálogo único e os depósitos existentes. Reserva protege disponibilidade por produto/local entre obras, sem baixa física ou custo. Saída/transferência comuns respeitam o reservado. Consumo parcial referencia reserva, reduz estoque e saldo reservado e registra custo de aplicação. Devolução referencia consumo, repõe estoque no local conferido e reduz custo proporcional original. Liberação reverte somente a parte ainda reservada. Devolução não reabre reserva consumida.

Quantidades até seis casas decimais, custos unitários explícitos com duas casas e centavos seguros. Proporção de devoluções usa aritmética inteira, preservando exatamente os centavos do consumo original ao encerrar. Somatório da tela da obra também é em centavos.

Operações, movimentos e custos são vinculados por IDs e preservados no histórico. Repetição do ID é idempotente; conteúdo divergente e operação equivalente são recusados. Novas aplicações efetivamente distintas exigem referência/justificativa distinta. Saldo excedente, referências adulteradas, conflitos entre abas e dados inconsistentes falham sem substituir bases. Gravação recuperável de até quatro bases sob o bloqueio existente, com revisão de todas as fontes antes de confirmar. EPI e uniformes continuam no fluxo específico.

Interface em Gestão da Obra / Materiais, com conferência de obra, quantidade, saldo e custo antes de salvar. O registro manual anterior sem baixa continua identificado e preservado; não foi convertido automaticamente em movimento físico.

Nenhuma ação grava no fluxo de caixa, paga, cria despesa ou altera RDO. Custo de aplicação não é somado automaticamente à despesa de compra. Não há migração ou alteração de cadastros existentes.

Validação: 623 testes automatizados aprovados, 64 scripts compilados e auditoria de fontes sem achados no escopo verificado. Testes de navegador em 390 e 1280 pixels executaram reserva, consumo parcial, devolução parcial, liberação e excesso de saldo. Cenário: saldo inicial 10, reserva 6, consumo 4 a R$12,50, devolução 1 e liberação 2: saldo final 7, custo líquido R$37,50; financeiro e RDO intactos. Suíte de navegador anterior também passou. Captura mobile revisada; sem teste em aparelho físico.

Este fluxo usa persistência local existente, com perfil/sessão local e dados fictícios. Não é autorização de estoque homologada no Supabase. A segurança financeira do novo contrato foi testada separadamente em SQL/RLS local. Permanecem recebimento parcial, conferência XML, integração de compras e homologação remota.
