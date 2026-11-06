# Executor da homologação remota e procedimento administrativo
Base remota: d4c5efc1a525.

Executor novo é opt-in: preflight não conecta. Exige URL e referência correspondentes, confirmação de projeto isolado, quatro usuários fictícios de perfis/empresas distintos e declaração de homologação no próprio servidor. O script 004 cria essa declaração somente leitura para a aplicação. Provisionamento é separado, valida Auth e aborta sem membros parciais. Não promove usuários automaticamente nem sobrescreve perfis existentes.

Roteiro remoto tem 19 verificações de Auth, renovação, perfis, RLS direto pela API, auditoria, inatividade, autopromoção recusada, concorrência por versão, Storage privado, RH/Financeiro, sobrescrita, bloqueio financeiro genérico e logout/refresh revogado. Não depende apenas de negativas do cliente como prova de segurança. Logout não é anunciado como invalidação imediata de JWT de acesso: sua validade até expirar é uma limitação explícita.

Resultado separa preflight, transporte simulado e execução remota. Relatórios não imprimem e-mail, senha, chave ou token. Erro de rede não é aprovação de permissão. Registros/arquivos sintéticos ficam para conferência; sem DELETE ou limpeza automática.

558 testes aprovados; 64 scripts compilados; auditoria de segredos sem achados no escopo. Onze testes novos do executor, dois de identificação do ambiente e dois do provisionamento. O roteiro completo passou SOMENTE com transporte simulado; isso é teste do executor, não homologação remota.

Execução real desta rodada: preflight_local BLOQUEADO, remotoExecutado=false, testesRemotosExecutados=0. Painel Supabase acessível somente após login; URL/chave pública e usuários fictícios não configurados neste ambiente. Nenhum recurso remoto foi modificado.

Passos exatos em supabase/homologacao/PROCEDIMENTO_REMOTO.md. Credenciais devem ficar em arquivo privado fora do repositório, nunca na conversa ou GitHub. Main, Netlify de produção e dados definitivos preservados.
