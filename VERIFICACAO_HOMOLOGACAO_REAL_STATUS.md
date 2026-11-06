# Homologação real do Supabase — estado e preparação
Data: 06/11/2026. Base inicial conferida: 1610897b4d07.

## O que foi verificado
Branch desenvolvimento e commits existentes conferidos antes das alterações. Os 536 testes da base passaram novamente. Foram procuradas configuração de homologação e ferramentas de acesso; não havia credenciais ou projeto separado identificados. O painel do Supabase foi aberto somente para leitura e mostrou a tela de login. Não houve autenticação administrativa ou alteração de configuração remota.

## Etapas desta execução
- d4c5efc1a525: documentos financeiros separados de RH, bucket privado, políticas por perfil/empresa, negação explícita, auditoria e não sobrescrita. 543 testes.
- 6ae82e2ecc4b: executor remoto opt-in, identificação do ambiente no servidor, configuração privada, quatro usuários fictícios, provisionamento atômico e guia manual. 558 testes.
- Etapa final: estado financeiro declarado pelo servidor, sempre bloqueado, e validação rigorosa do contrato no cliente. Não autoriza pagamento, fechamento ou exceção de vale. Identidade e permissão são verificadas no servidor; perfil local não as substitui.

## Evidências finais
| Camada | Evidência executada | Resultado |
|---|---|---|
| Núcleo, conector, executor e PostgreSQL local | Suíte automatizada completa | 563 testes aprovados, zero falhas ou ignorados |
| Aplicação estática | Compilação de scripts/HTML | 64 scripts compilados |
| Segredos | Auditoria no escopo de arquivos versionados | Sem achados |
| Navegador + PostgreSQL local | 390/1280 pixels, tela real de homologação, Auth/HTTP simulados | RH versus Financeiro, gravação, auditoria, upload/download, renovação, logout e estado financeiro bloqueado aprovados |
| Roteiro remoto | Teste completo com transporte injetado | 20 verificações do executor aprovadas somente na simulação; não são testes no Supabase remoto |
| Supabase remoto nesta execução | Preflight sem configuração e painel exigindo login | BLOQUEADO, remotoExecutado=false, testesRemotosExecutados=0 |

A execução local não prova login, RLS ou Storage do projeto remoto. Nenhum recurso remoto foi criado ou alterado. O executor mantém explicitamente origem e resultado; erro de rede ou identificação divergente não vira aprovação de segurança.

## O que falta do responsável pelo ambiente
Procedimento exato em supabase/homologacao/PROCEDIMENTO_REMOTO.md:
1. Entrar no Dashboard e selecionar projeto separado de desenvolvimento/homologação, existente ou gratuito; nunca o definitivo.
2. Conferir inventário e, em projeto ainda sem esse schema, aplicar scripts 001 a 005. Acrescentar martins_hml_v1 aos Exposed schemas da Data API, sem ampliar grants existentes.
3. Criar quatro usuários Auth fictícios e provisionar RH A, RH B, Financeiro A e perfil inativo A com seus UUIDs no script separado. Nenhuma senha vai no SQL.
4. Preencher o arquivo privado fora do repositório a partir do exemplo vazio. Usar Project URL e Publishable Key, sem service_role ou chave secreta. Não compartilhar senhas na conversa ou GitHub.
5. Executar primeiro preflight e depois o comando com --executar. Conferir o JSON gerado sem segredos. Dados sintéticos permanecem para revisão; não há DELETE nem limpeza automática.

## Limites e próximas prioridades
- Exceções de vales acima de 40% permanecem bloqueadas. A consulta estado_financeiro retorna pagamentos, fechamentos e exceções como false; não é autorização financeira homologada.
- Comandos financeiros transacionais, MFA, base adquirida de mensalistas, mapeamento das tabelas canônicas e uso com dados definitivos dependem de homologação posterior. Nenhuma regra trabalhista foi presumida.
- Logout revoga refresh; JWT de acesso pode permanecer válido até expirar. Não se declarou revogação imediata desse token como aprovada.
- Revogação durante sessão requer ação administrativa controlada no membro fictício. Concorrência HTTP real só será comprovada com o executor no projeto remoto.
- Teste em aparelho físico e revisão visual integral continuam pendentes. Não foram aplicadas propostas não aprovadas do Gemini, nem desenvolvido o módulo Esquadrias/Serralheria.

Main, Netlify de produção e dados definitivos preservados. Nenhum serviço pago contratado. Próxima prioridade: completar o acesso/configuração manual do projeto separado e executar o roteiro real, antes de liberar qualquer operação financeira online.
