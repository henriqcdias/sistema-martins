# Documentos financeiros separados de RH
Base remota: 1610897b4d07, conferida antes das alterações. Os 536 testes da base foram repetidos.

O bucket privado de funcionários continua restrito ao RH/administrador. Novo script 003 prepara bucket privado separado para documentos financeiros, autorizado por perfil Financeiro/administrador e permissão efetiva do servidor. Negação explícita documentos_financeiros prevalece inclusive sobre administrador. Políticas restritivas impedem que uma política permissiva antiga libere o novo bucket; anônimo, outra empresa, sobrescrita e exclusão são bloqueados.

Uploads financeiros são auditados sem copiar o conteúdo do arquivo. Conector e tela de homologação selecionam categoria explicitamente, com permissões e caminhos distintos. O comando genérico continua sem poder pagar, fechar remuneração ou liberar exceções de vales.

543 testes aprovados; 64 scripts compilados; auditoria de segredos sem achados no escopo examinado. Cinco novos testes SQL de proteção financeira e dois de cliente. Navegador + PostgreSQL local passou em 390/1280 pixels, incluindo negativa para RH e troca de perfil na fixture para validar a permissão do Financeiro.

Não houve instalação do script no Supabase remoto. O painel remoto foi acessado somente para conferir disponibilidade e mostrou a tela de login. Este ambiente não possui URL, chave pública ou credenciais de usuários fictícios configuradas. Auth/HTTP dos testes de navegador continuam simulados; as políticas executam em PostgreSQL local. A homologação remota permanece pendente.
