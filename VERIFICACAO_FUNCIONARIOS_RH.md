# Homologação — Funcionários, remuneração e documentos

Data: 05/11/2026. Mesma aplicação completa no endereço privado de homologação. Nenhuma alteração no site oficial, migração definitiva ou dado real de funcionário usado nos testes.

## Implementado
- Extensão dos formulários existentes de novo funcionário e edição: remuneração de referência em reais, periodicidade mensal/diária/hora e vigência. A alteração salarial é uma opção explícita; editar nome/contrato sem marcá-la preserva remuneração anterior.
- Histórico de remuneração com antes/depois, vigência, autor e data. Valores legados sem periodicidade/vigência permanecem identificados como legados; não são migrados nem presumidos como mensais.
- IDs de novos colaboradores gerados por UUID; edição preserva ID, recibos assinados, entregas, ocorrências e campos adicionais. Nova validação impede gravar em cadastro com IDs ambíguos.
- Salvamento com conferência da versão da base, backup anterior e diário recuperável; falhas de armazenamento deixaram de ser silenciadas no salvador legado. Formulário novo/edição intercepta o submit para impedir o salvamento antigo em duplicidade.
- Cadastro rápido aberto a partir do RDO mantém a inclusão do novo colaborador na equipe com seu ID. Cadastro aberto pelo quadro de funcionários não acrescenta alguém ao RDO que estava em preenchimento.
- Na Ficha existente, seção Remuneração e documentos cadastrais. Mostra referência salarial e histórico; documentos gerais ficam separados dos recibos de EPI, preservados na seção original.
- Documentos: categoria, título, data, arquivo PDF/JPEG/PNG, identificação do colaborador, autor e histórico. Até 512 KB por arquivo, sem compressão ou transformação automática. Validação de assinatura inicial/MIME/tamanho e SHA-256 para duplicatas; não é análise de segurança/conteúdo completo do PDF.
- Abrir/baixar arquivo por link local Blob, arquivar e restaurar com motivo. Arquivar não exclui arquivo nem libera espaço. Não há exclusão permanente ou compartilhamento automático no WhatsApp.
- Base documental separada `cm_documentos_colaboradores_v1`, incluída no backup geral cm_. Limite agregado de 2 MiB de caracteres de dados codificados, além da quota real do navegador; armazenamento pode esgotar antes desse limite devido a outras bases, backups e diário. Falha não é tratada como sucesso e requer recuperação explícita quando houver operação pendente.
- Controle local diferencia cadastro básico (inclui Engenharia autorizada) de remuneração/documentos (RH/Administração/Financeiro autorizados). Não equivale a autorização de servidor; não foram ampliadas permissões dos usuários existentes.
- Melhoria no mecanismo comum de recuperação: reverter uma operação cujas bases já voltaram ao estado anterior não tenta criar cópia extra da proposta descartada, evitando falha de espaço desnecessária. Sem executar recuperação em dados reais.
- Sem geração de folha, encargos, pagamento, gasto automático, rateio financeiro ou alteração de RDO já salvo. Vigência é informação cadastral; não há motor de aplicação automática de salários por competência.

## Testado
- 157 testes automatizados passaram: 133 regressões e 24 novos testes de RH, documentos, backup e recuperação.
- Preservação de ID/históricos/campos, valores e periodicidades, vigência, legado sem inferência, duplicidade, contrato, validação de PDF/JPEG/PNG, hash, limite local, arquivo duplicado, arquivamento/restauração, permissões e falha de quota.
- SHA-256 alternativo comparado com implementação padrão Node em blocos de 0 a 512 KiB. Essa alternativa foi adicionada após observar SubtleCrypto indisponível no endereço HTTP da prévia, sem alterar permissões/segurança do navegador.
- Backup geral criado e restaurado em destino vazio de teste, com documentos e remuneração preservados; restauração em destino não vazio recusada.
- Verificação estática: 42 scripts compilados, dependências locais presentes e bloqueio de comunicação remota mantido.
- Navegador em fixture descartável com formulários reais extraídos da aplicação, fontes em memória e módulos reais: edição para R$ 2.500,50 mensal com vigência; novo funcionário com diária R$ 120; submit antigo não executado em duplicidade; seleção simulada de PDF sintético, validação, conferência, gravação, links de abrir/baixar e arquivamento com motivo/histórico.
- O seletor nativo de arquivos e a renderização completa do PDF não foram automatizados: a fixture criou um File sintético e disparou o evento de seleção. Restauração de arquivado foi testada no núcleo automatizado; a tela exibiu a ação correspondente.
- Aplicação completa: campos nos dois formulários, seção dentro da ficha, diálogo de documento e datas brasileiras conferidos no DOM; acessos a Relatórios, Veículos e Financeiro preservados. Fixture removida da publicação.

## Pendências e limites
- Conferência em Android físico, seleção real de arquivo/câmera, abrir/baixar documento e persistência depois de recarregar. Login real de ponta a ponta e operação do cadastro rápido no formulário completo de RDO não testados no navegador de QA.
- Arquivos grandes, armazenamento remoto, sincronização Supabase e controle de acesso no servidor pendentes. Nesta homologação, os dados permanecem locais neste navegador e a rede remota está bloqueada.
- Os recibos de EPI existentes continuam com seu fluxo anterior; não foram migrados, reclassificados ou compartilhados pelos novos controles.
- Fotos não são reduzidas automaticamente: devem respeitar 512 KB. Quota do navegador pode exigir arquivo menor e/ou recuperação da gravação pendente. Arquivar não libera espaço.
- Composição de folha por competência, cálculo de encargos, descontos, férias, 13º, ponto remunerado e integração automática ao Financeiro não fazem parte desta etapa.

## Roteiro pelo celular
1. Quadro de funcionários → editar cadastro → marcar Informar/atualizar remuneração → valor, periodicidade e vigência → salvar.
2. Reabrir a Ficha e conferir valor/histórico; editar outro campo sem marcar alteração salarial e verificar preservação da remuneração.
3. Ficha → Documentos do cadastro → arquivo fictício pequeno PDF/JPEG/PNG, categoria, título e data → conferir/confirmar.
4. Abrir/baixar, arquivar com motivo, mostrar arquivados e restaurar. Conferir que os recibos de EPI continuam na área original.
5. Fazer backup geral antes de trocar navegador/aparelho. Recarregar e conferir persistência.

## Arquivos
`dist/rh_martins.js`, `dist/rh_martins_ui.js`, páginas completas, persistência/recuperação e salvador legado de colaboradores; `scripts/rh.test.cjs`; `scripts/RESULTADOS_RH.txt`.
