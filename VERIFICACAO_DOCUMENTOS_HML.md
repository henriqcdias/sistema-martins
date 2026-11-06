# Documentos privados e integração de homologação
Base remota: f54bde8b55be.

Upload do conector usa bucket privado reservado, caminho composto de UUIDs, tipo conferido por assinatura do arquivo, máximo 512 KB e x-upsert=false. Não envia o nome original no caminho, não sobrescreve e não retorna URL pública. Download exige endpoint autenticado, reconfirma permissão no servidor e limita bytes do fluxo. Troca de configuração e logout removem os links Blob e arquivo selecionado da página.

Políticas Storage de homologação possuem guardas restritivas contra políticas permissivas anteriores, bloqueiam anônimo e proíbem alteração/exclusão do bucket reservado. Configuração de bucket existente incompatível interrompe o script, sem alterá-la. Trigger audita autoria e identificação do documento, sem conteúdo binário. Estes scripts continuam destinados somente a projeto separado; não foram aplicados remotamente.

521 testes automatizados aprovados, 64 scripts compilados; auditoria de segredos sem achados no escopo examinado. São 21 testes PostgreSQL de RLS/Storage e demais testes de núcleo/conector/transporte. A suíte inclui transferência recusada, tipo errado, arquivo grande, perda de sessão e conflito sem sobrescrita.

Teste adicional de navegador + SQL local em 390/1280 pixels, executado por npm run test:browser:hml: tela real de homologação, controles acionados, gravação de registro e auditoria, upload/download privado, renovação e limpeza no logout. PostgreSQL e políticas são reais no PGlite; Auth, PostgREST e serviço Storage são simulados pelo transporte de teste. Não houve login remoto ou validação de RLS do projeto Supabase real. Testes de navegador anteriores de Horas, RH, Remuneração e EPIs também repetidos.

Pendências: configuração e inventário de homologação remota, teste com dois usuários Auth reais e duas empresas, políticas do projeto real, serviço Storage HTTP, revisão de MFA e migração das estruturas canônicas. O comando genérico permanece impedido de registrar pagamento/fechamento/exceção de vale.
