# XSD e assinatura NF-e — 06/11/2026

Validador Python isolado, sem rede: XMLSchema real PL_010g, conferência de hashes dos esquemas, parser sem DTD/entidades, assinatura com SignXML, referência única ao infNFe esperado e bloqueio de wrapping/referências externas. Dados assinados são obtidos do resultado verificado, não de uma busca ambígua no XML.

Oito testes Python aprovados com certificado fictício e chave efêmera. Documento sintético válido passou no XSD completo e na verificação criptográfica; adulteração, XML inválido, wrapping e referência externa falharam. Protocolo alterado manteve assinatura do emitente válida e permaneceu sem consulta oficial, como esperado.

Suíte JavaScript existente: 644 testes aprovados, 64 scripts compilados; dois arquivos Python compilados. Auditoria de fontes sem achados no escopo verificado. Sem Supabase remoto, SEFAZ, publicação, alteração de main ou dados definitivos.

Confiança ICP-Brasil, revogação e consulta fiscal não verificadas. Validador não autoriza integração por si só. Proveniência e limitações do pacote/certificado estão em server/nfe/README.md. O pacote veio de mirror de referência com commit e hashes fixados; download direto do Portal oficial entrou em ciclo de redirecionamento.
