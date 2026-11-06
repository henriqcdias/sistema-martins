# Lançador Financeiro — contrato e homologação

## Escopo

Lançamentos e notas fiscais são registrados em fin_lancamentos como pendente_conferencia, sem autorização prévia do Master. Esse é o cadastro financeiro do contrato de servidor de homologação; não espelha registros em LocalStorage nem cria pagamento no fluxo de caixa legado. Transição para conferido é conferência documental, não liquidação.

Usar exclusivamente supabase_conexao.html, após login Auth, com modo de homologação. A identificação no servidor deve corresponder à Project URL. Nenhuma configuração ou credencial é preenchida no repositório. O restante do aplicativo local continua preservado, sem fingir autorização remota.

## Provisionamento posterior, por administrador

1. Conferir inventário e aplicar scripts 001 a 007, em ordem, somente em projeto separado de desenvolvimento/homologação. Não reaplicar scripts em esquema existente sem conferir versões.
2. Configurar/expor martins_hml_v1 na API de desenvolvimento, conforme PROCEDIMENTO_REMOTO.md. Manter buckets privados e limites já definidos.
3. Criar usuários fictícios no Supabase Auth. Usar seus UUIDs reais apenas no ambiente, nunca senhas ou tokens em arquivos versionados.
4. Em membros, cadastrar empresa e usuario_id dos perfis: administrador para Master, lancador_financeiro para lançadores; ativo=true. Nenhum usuário pode promover a si mesmo pela API.
5. Em fin_contas, cadastrar referências fictícias com empresa_id, id UUID, nome e ativo. Não importar contas ou saldos definitivos. A tabela fin_saldos é separada; usuário autenticado não possui escrita direta. Inventário, integração de contas definitivas e critérios de saldo serão uma etapa posterior.
6. Declarar a identificação do projeto na tabela ambiente conforme o procedimento existente. A interface verifica project_ref e tipo=homologacao.
7. Conectar com Publishable Key e usuários fictícios na página de homologação; consultar o Financeiro por usuário. Master recebe lista de UUIDs/perfis ativos da própria empresa para concessões. Nomes amigáveis exigem cadastro de identidade de servidor aprovado; não são inferidos do Auth.
8. Validar acesso próprio, compartilhamento visualização/edição, revogação, permissões de conta independentes, documentos e exportações/consultas diretas com usuários de empresas distintas. Nenhum teste remoto foi executado nesta entrega.

## Permissões

- Autor e compartilhado visualizam conforme RLS; edição apenas pendente.
- Todos os movimentos da conta não concede edição nem saldo.
- Usar conta não concede saldo. Ver saldo não concede uso ou outros movimentos.
- Sem configuração por conta, visualização de próprios/compartilhados permanece padrão. Desmarcar movimentos_proprios nessa conta restringe também esses acessos; todos_movimentos é independente.
- Compartilhamento e permissões são revogáveis e auditados. Auditoria completa só para Master.
- Anexo usa empresa/documentos_financeiros/lancamento/objeto.ext; requer linha autorizada. Upload exige edição. Não aceita sobrescrita ou exclusão.
- Arquivos sem correspondência com o novo contrato não são apagados ou mapeados automaticamente.
- Não existem comandos de pagamento, baixa, conciliação ou exceção de vales nessa interface. A conciliação permanece indisponível; nunca é concedida ao Lançador.

## Testes locais reproduzíveis

MARTINS_PGLITE_MODULE pode apontar para instalação externa de @electric-sql/pglite. Executar npm test, npm run check e npm run audit:source. Para navegador, configurar Chromium local e executar npm run test:browser:financeiro e npm run test:browser:hml.

SQL/RLS executados realmente no PGlite; Auth, PostgREST e Storage HTTP simulados. Testes de concorrência usam chamadas concorrentes sobre banco embarcado, não múltiplas conexões Supabase. Ainda faltam validação remota real, sessões paralelas em servidores independentes, limites de volume/paginação e a integração definitiva com o Financeiro de produção.
