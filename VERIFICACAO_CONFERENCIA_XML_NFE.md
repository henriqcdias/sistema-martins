# Conferência estrutural de NF-e XML — 06/11/2026

Etapa local de importação/conferência, ainda não uma validação fiscal completa ou integração final de Contas a Pagar. Referência de estrutura: documentação técnica do Portal NF-e, https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=HO2V+vzhFBk%3D .

Suporta XML processado nfeProc, namespace NF-e, infNFe 4.00, modelo 55, chave numérica de 44 posições com DV e protocolo declarado compatível. Confere correspondência da chave com emitente, série, número e mês/ano. Recusa XML malformado, DTD, entidades, tamanho superior a 512 KB, itens duplicados, quantidades não decimais e valores inválidos. Não aceita silenciosamente chaves alfanuméricas ou codificações diferentes de UTF-8 nesta etapa.

Lê itens, quantidades, unidades, preços com precisão decimal, totais e duplicatas. Aponta diferenças entre produtos/total/parcelas sem ajustar frete, tributos, descontos ou regras financeiras. Interface permite mapear itens ao pedido e catálogo existentes e conferir quantidades, unidades, fornecedor e preço quando o pedido possuir preço explícito. Divergências e vínculos pendentes permanecem registrados; salvar a nota como em_conferencia não significa resolver as divergências nem autorizar entrada ou pagamento.

Preserva XML original (bytes em base64, incluindo BOM), SHA-256, resumo, fornecedor, pedido, vínculos, divergências, justificativa e autoria. Download recupera o original. Duplicidade é bloqueada pela chave, inclusive com outro nome de arquivo. Conferência usa revisão da base de notas, pedidos e catálogo antes de gravar. Parcelas só produzem propostas pendentes, com identificador estável; nenhum vencimento é inventado.

Validação: 644 testes automatizados aprovados, 64 scripts compilados e auditoria de fontes sem achados no escopo verificado. Navegador em 390/1280 pixels: análise XML sintético, chave duplicada, modelo incompatível, bloqueio de DTD, preservação exata dos bytes/hash e ausência de escrita em estoque/Financeiro. Suíte de navegador anterior passou. Sem aparelho físico e sem Supabase remoto.

Pendências materiais: validar assinatura XML e XSD completo, situação fiscal atual, chaves alfanuméricas conforme leiautes atuais, codificações adicionais, edição/revisão posterior da conferência preservada, vínculo transacional nota-item-recebimento e anexos adicionais. Integração real de parcelas a Contas a Pagar requer comando específico no servidor; avaliação detalhada em AVALIACAO_INTEGRACAO_FINANCEIRO_NFE.md. Até lá as notas permanecem em conferência, sem gerar obrigação automática.
