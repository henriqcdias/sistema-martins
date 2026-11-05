# Desenvolvimento do MARTINS RDO MASTER

Esta é a fonte completa da versão mais recente de homologação, com saneamento para versionamento privado. O README da raiz pertence ao repositório e foi preservado.

## Estrutura
- dist/: aplicação HTML/JavaScript, estilos, bibliotecas distribuídas e logomarca.
- scripts/: testes, verificações e configuração pública.
- supabase/: plano de integração e consulta de inventário somente de leitura.
- VERIFICACAO_*.md: registros técnicos das etapas.
- AGENTS.md: regras permanentes para colaboração.

A pasta dist contém a fonte atual e deve ser versionada. Não há etapa de build obrigatória.

## Verificação local
Requer Node.js 22 ou posterior. Instalar as dependências de teste com npm install.
Executar npm test, npm run check e npm run audit:source.
As versões principais das dependências de teste estão fixadas no package.json. A obtenção de dependências precisa de acesso ao registro npm.

Para abrir a aplicação, servir dist por HTTP local. Não hospedar esta versão como produção sem homologação.

## Primeiro acesso de demonstração
Não há senha padrão incluída na fonte. Em navegador sem conta local configurada, usar o painel Primeiro acesso neste navegador para definir uma senha exclusiva de demonstração e depois entrar com o usuário teste.

O procedimento recusa sobrescrever cadastros existentes, múltiplos usuários ou contas já configuradas. Não migra nem limpa armazenamento do navegador. Este acesso preserva o mecanismo local legado e não é Supabase Auth. O armazenamento local de senhas não está homologado para produção; usar somente dados fictícios e uma senha exclusiva de teste.

## Supabase
dist/supabase.config.js permanece com URL e chave vazias. As telas de diagnóstico existentes continuam disponíveis. A página antiga custos_obras.html também lê a configuração pública, sem URL/chave embutidas.

A chave publishable é pública; secret/service_role não devem ser usadas no frontend. RLS, autenticação real, autorização no servidor e sincronização entre dispositivos permanecem pendentes. Nenhum dado online foi modificado nesta importação.

## GitHub e publicação
Usar desenvolvimento para as próximas alterações. Não fazer push automático para main. Registrar cada etapa após seus testes e auditar o conteúdo antes de enviar.

A fonte foi importada como snapshot saneado sobre o histórico já existente do repositório. O histórico antigo da hospedagem não foi transportado, para não incluir versões não auditadas. Metadados particulares de hospedagem foram excluídos. Não há workflow de deploy e nenhum acionamento do Netlify oficial.
