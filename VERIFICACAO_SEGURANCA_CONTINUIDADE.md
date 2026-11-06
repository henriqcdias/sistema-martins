# Continuidade de segurança e jornadas — 06/11/2026

Base remota inicial conferida: 173d61b0525f. Os cinco commits anteriores foram inspecionados e os 474 testes da base foram repetidos antes das alterações.

## Etapas salvas nesta execução
- 75f406987e17: contrato isolado de homologação com RLS, membros provisionados fora da aplicação, permissões por módulo, auditoria e RPC com versão/idempotência. Políticas de Storage restritivas. 494 testes.
- f54bde8b55be: renovação de Auth somente em memória, identidade/permissões reconferidas por operação, sincronização opt-in com resultado incerto, conflito e reconciliação. 510 testes.
- 04237fd5924a: upload e download privado sem URL pública nem sobrescrita, auditoria dos documentos e teste de tela com SQL local. 521 testes.
- Etapa final: jornadas observadas que atravessam dias, preservação cronológica e bloqueio do fechamento até conferência.

## Jornadas entre dias e remuneração
Horários completos e intervalos explícitos são registrados em base própria recuperável. Minutos civis observados são separados por data, sem arredondamento, conversão de fuso, adicional noturno, hora reduzida ou critério de pagamento presumido. Não gera presença, despesa ou remuneração automaticamente.

Duplicidade/sobreposição, datas inválidas, intervalo incompatível e vínculo contratual inválido bloqueiam o registro. Pendência que toca o período impede o fechamento; para conferir, os minutos diários devem corresponder às horas normais e extras explicitamente registradas na Frequência. Mudança posterior da Frequência invalida a conferência antes de fechar. Cancelamento justificado mantém o histórico; alteração em período já fechado é bloqueada pela tela.

Mensalistas continuam exigindo base explícita aprovada para o período. Não foi presumido salário mensal integral adquirido nem rateio mensal por obra. O limite automático de vales não incorpora extras sem aprovação do servidor; exceções acima de 40% permanecem bloqueadas no núcleo e na interface.

## Validação desta execução
536 testes automatizados aprovados, zero falhas ou ignorados. Inclui 21 testes em PostgreSQL PGlite com RLS/roles, 16 novos testes de Auth/sincronização, 10 de transferência de documentos e 15 de jornadas entre dias. Os testes anteriores de financeiro, estoque, RDO, RH e recuperação continuam executados.

64 scripts de aplicação/HTML compilados. Auditoria de segredos sem achados no escopo examinado. Não equivale a auditoria completa do histórico ou a autorização de uso em produção.

Navegador em 390/1280 pixels:
- Diálogo de horas e registro/conferência de jornada entre dias, com verificação de largura e ausência de erros JavaScript.
- Integração sintética de solicitações/pagamentos declarados, fechamento, férias pela ficha e entregas/devoluções de uniformes.
- Tela de homologação com PostgreSQL real local, login HTTP simulado, RPC versionada, auditoria, upload/download privado, renovação e limpeza de tokens/conteúdo no logout. O teste verifica que a página de conexão não grava sessão em localStorage ou sessionStorage.

Auth, PostgREST e Storage HTTP são simulados; políticas SQL executam no PostgreSQL local. PGlite serializa uma instância; teste concorrente não substitui conexões independentes em Supabase remoto. Não declarar Auth, RLS, sincronização ou Storage do projeto real como homologados.

## Bloqueios e próxima prioridade
Não havia URL/chave pública configurada, credenciais de usuários de homologação, inventário remoto ou acesso administrativo ao Supabase neste ambiente. Por isso nenhum script, bucket, política, usuário ou dado foi criado/modificado no banco remoto. Código e testes ficaram preparados para um projeto separado de homologação; não foram ligados automaticamente às bases locais nem às tabelas definitivas existentes.

Próximo passo: disponibilizar projeto separado e inventário somente leitura, conferir schema exposto/ownership e mapear as tabelas canônicas. Validar com dois usuários Auth reais, duas empresas, perfil revogado, operações simultâneas em conexões independentes e serviço Storage real. Só depois completar comandos financeiros específicos, base de mensalistas e autorização transacional de exceções de vales. O comando genérico atual não pode pagar, fechar remuneração ou aprovar exceção de vale.

Main, Netlify de produção e dados definitivos preservados. Nenhum serviço pago contratado. Esquadrias/Serralheria e propostas visuais não aprovadas do Gemini não foram implementados. Teste em aparelho físico, revisão visual integral e MFA permanecem pendentes.
