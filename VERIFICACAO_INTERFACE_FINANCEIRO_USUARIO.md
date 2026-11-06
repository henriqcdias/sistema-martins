# Interface e APIs do Lançador Financeiro — 06/11/2026

Interface adicionada à página isolada supabase_conexao.html, usando o cliente Auth existente e comandos específicos do servidor. Não utiliza LocalStorage para identidade, permissões, documentos ou registros. Criar/editar despesa ou nota, listar autorizados, anexar/baixar documento, compartilhar/revogar em lote, conceder quatro permissões independentes por conta e conferir sem pagar. Auditoria e saldos consultados separadamente com RLS.

As APIs conferem a identidade e a identificação do projeto de homologação. Operações sensíveis continuam sem endpoint. A consulta inicial não busca saldos nem auditoria. Logout/renovação limpa registros e URLs de documentos; erros de acesso retiram dados da consulta sem apagar o formulário preenchido. Repetição de gravação mantém o mesmo ID até confirmação.

Testes: 608 aprovados na suíte completa, 64 scripts compilados, auditoria de fontes sem achados no escopo verificado. Navegador local em 390 e 1280 pixels: Lançador cria pendente, segundo usuário não vê; Master compartilha; destinatário consulta anexo privado e usa conta sem saldo; revogação e logout retiram acesso/dados. Roteiro anterior de homologação de RH/Financeiro continua passando. Revisão visual mobile realizada; tabelas financeiras usam rolagem horizontal. Sem teste em aparelho físico.

SQL e RLS são reais no banco local PGlite. Auth e protocolos HTTP do Supabase são simulados. Nenhum teste remoto, publicação, migração de dados definitivos ou alteração de main. Perfil de produção e integração definitiva dependem da homologação real. Procedimento administrativo está em supabase/homologacao/FINANCEIRO_POR_USUARIO.md.
