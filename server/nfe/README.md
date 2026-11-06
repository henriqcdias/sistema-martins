# Validação NF-e offline

Instalar dependências de requirements.txt em ambiente isolado. Executar `python server/nfe/validator.py < documento.xml`. Nenhuma chamada de rede é feita. Para testes: `npm run test:nfe:validacao`; MARTINS_NFE_PYTHON e MARTINS_NFE_PYTHONPATH permitem selecionar instalação isolada.

O resultado distingue XSD, assinatura criptográfica com o certificado embutido, prazo do certificado, confiança ICP-Brasil e situação fiscal. Criptografia válida não significa certificado confiável. O protocolo não é coberto pela assinatura do emitente. O resultado nunca autoriza integração, nunca consulta SEFAZ e não escreve no banco.

O pacote de cinco XSDs inclui procNFe 4.00 e dependências do PL_010g. Cópia obtida no repositório de referência nfephp-org/sped-nfe, commit fixado no manifesto. Portal oficial lista o pacote, mas download direto redirecionou em ciclo; não declaramos download oficial direto nem conferência com hash publicado pela SEFAZ. Archive e cada esquema possuem hash local, verificado em toda execução. Conteúdo inalterado e importações fora do pacote bloqueadas.

As fixtures são documentos fictícios completos, assinados com chave efêmera criada em memória e certificado autoassinado, nunca gravados. O XSD real é aplicado, não uma cópia simplificada para testes. NF-e legada RSA-SHA1 é aceita somente para verificação; não se promove essa assinatura a confiança fiscal. Assinatura SHA256 é aceita criptograficamente, mas aprovação de leiaute continua dependendo do XSD aplicável.

Pendente para ambiente real: conferir pacote oficial/cronograma aplicável ao emitente; provisionar política de confiança ICP-Brasil, cadeia, revogação e identificação do titular; preparar acesso oficial SEFAZ com certificado e endpoints apropriados por UF/ambiente; validar eventos e notas anteriores com o pacote correspondente. Sem esse provisionamento, confiança e situação fiscal permanecem não verificadas e não podem ser fabricadas pela interface.
