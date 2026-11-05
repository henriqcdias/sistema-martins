# Homologação — preparação da conexão Supabase existente

Data: 05/11/2026. Mesmo sistema completo de homologação. Netlify oficial, nove tabelas e dados existentes não alterados. ALTER de papel já aplicado pelo usuário não repetido. Não foram usadas chaves secretas.

## Implementado
- Tela de conexão de homologação acessível pelo menu do sistema completo. Nenhum projeto antigo selecionado automaticamente.
- Configuração validada de URL HTTPS *.supabase.co e chave sb_publishable_; rejeita secret/service_role/JWT como chave de aplicativo.
- Login Auth preparado com confirmação de identidade no servidor, perfil do UID autenticado e função martins_empresa_autorizada existente. Perfil ativo administrador exigido para o diagnóstico.
- Senha apagada do campo após tentativa; token apenas em memória, sem persistência em localStorage/sessionStorage. Recarregar/expirar exige novo login. Não substitui automaticamente a autenticação demonstrativa do aplicativo principal.
- Consultas de diagnóstico LIMIT 0 das nove tabelas conhecidas e negativa da função para empresa de controle sem vínculo. Não envia registros, não oferece POST/PATCH/DELETE de tabelas de negócio e não modifica SQL.
- CSP da aplicação principal continua connect-src none. Somente a página dedicada permite conexão HTTPS ao Supabase, com script-src self e sem SDK/CDN externos. Nenhum enfraquecimento de políticas RLS ou alteração das permissões de usuários.
- Gerador opcional de configuração pública para build HTML/JS puro; variável secreta não é exportada. Não executado com dados do projeto real.
- Inventário SQL READ ONLY + ROLLBACK preparado para descobrir colunas, FKs, políticas, permissões e rotinas antes de gerar DDL adicional. Não consulta linhas de negócio ou auth.users.
- Plano de integração com mapa de reaproveitamento das nove tabelas, módulos adicionais, testes RLS e limites de migração.

## Testado
- 202 testes automatizados passaram: 178 regressões e 24 testes novos.
- Testes automatizados de URL/chave, identidade, perfis ausentes/inativos/não administradores, função negada, expiração, logout, resposta tardia após desconexão, rotas restritas, cabeçalhos JWT/apikey, falha sem retry, build público e inventário sem DDL/DML.
- Regressões dos módulos existentes incluídas na suíte. Resultado e contagem final em scripts/RESULTADOS_SUPABASE_CONEXAO.txt.
- Navegador em fixture descartável com HTTP simulado: configuração sem conexão automática, transição de login sem credenciais reais, autorização, nove consultas sem linhas, controle negativo e logout desabilitando consultas. Fixture e driver sintéticos removidos da entrega.
- Aplicação completa e página real (sem configuração) conferidas separadamente. Nenhuma senha real foi solicitada ou digitada pela automação.

## Pendências obrigatórias
- Confirmar Project URL e Publishable Key atuais; credenciais antigas encontradas em arquivo não foram presumidas como atuais.
- Executar inventário SQL no projeto e conferir metadados; a sintaxe foi revisada, mas não foi executada em PostgreSQL real nesta sessão.
- Login real, RLS completa entre empresas/perfis, MFA, renovação/persistência de sessão, sincronização entre aparelhos, Storage e tabelas adicionais não homologados.
- Nenhuma coluna/política nova, tabela/bucket ou migração aplicada. Nenhum dado local enviado ao banco. Não afirmar conexão/sincronização pronta até esses testes reais.
- Os adaptadores antigos de RDO/custos dependem de estruturas não confirmadas no relatório de nove tabelas; permanecem desativados no aplicativo principal. A página nova não os aciona.

## Arquivos
- dist/supabase_conexao.html, supabase_conexao.js, supabase_conexao_ui.js, supabase.config.js e supabase_acesso_ui.js.
- scripts/configurar-supabase-publico.cjs e scripts/supabase-conexao.test.cjs.
- supabase/consultas/01_inventario_somente_leitura.sql e supabase/PLANO_INTEGRACAO.md.
