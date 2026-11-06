# Integração controlada das melhorias Gemini — Sistema Martins

## Autorização
Usuário autorizou integrar as melhorias do Gemini ao código para testar **somente em homologação**. Não autoriza publicação oficial nem migrações na produção.

## Entregas conhecidas
- Menu inteligente incremental e barra mobile: verificar arquivos já presentes em `melhorias-visuais-gemini-20261106`, corrigir botão MENU inoperante na Etapa 48 (issue #2).
- RDO — Melhoria 4: consultar `docs/REVISAO_GEMINI_RDO_MELHORIA_4.md`; código proposto tem bloqueios de autenticação, imagens e HTML inseguro.
- Recibos multi-itens de EPIs — Melhoria 5: consultar `docs/REVISAO_GEMINI_RECIBO_MULTI_ITENS_MELHORIA_5.md`; baixa de estoque exige transação atômica, IDs estáveis e segurança.
- Frequência, RH e Planejamento — proposta do Gemini com commits informados `c9073c0` e `274e460`, ainda não encontrados nesta branch; arquivo proposto `dist/frequencia_equipes_rh_ui.js` ainda não localizado no GitHub. Fonte fornecida pelo usuário em Markdown.

## Critérios de integração (obrigatórios)
1. Manter a branch `melhorias-visuais-gemini-20261106` separada da produção. Integrar apenas com alterações pequenas, testes e rollback.
2. Menu: validar listeners, ordem dos scripts, CSP, IDs do drawer, desktop/mobile, acessibilidade.
3. Frequência: corrigir replicação multi-data (hoje o confirm salva apenas a data atual), impedir duplicidade por empresa+colaborador+data+turno, exigir conferência, não sobrescrever sem confirmação.
4. Remover obras e empresa fixas; filtrar por IDs estáveis e permissões reais do servidor.
5. Substituir HTML concatenado com dados de usuário por DOM seguro/escape; não expor CID e dados sensíveis desnecessariamente.
6. Jornada: não presumir 8h para horários vazios; aplicar jornada contratual, intervalo, adicional noturno e feriados conforme regra aprovada.
7. Vales: 40% do bruto efetivamente trabalhado no período, descontar vales já concedidos, aprovação Master para exceções, verificação transacional no servidor.
8. RDO: fotos privadas no Storage, aprovação e reabertura por perfil autorizado, assinatura com trilha de auditoria.
9. Recibos EPI: múltiplos itens, PDF A4, CA válido quando aplicável, baixa atômica e comprovante imutável.
10. Isolamento das três empresas e Masters Henrique/Camila/Robson; José Henrique somente Calhas e Rufos e financeiro explicitamente compartilhado.
11. Confirmar que Etapa 48 aponta para Supabase `Sistema Martins - Homologação` antes de qualquer teste de escrita; não copiar dados reais.
12. Registrar commits, testes de regressão, evidências e URL publicada de homologação; não afirmar que está integrado ao site antes de comprovar deploy.

## Estado inicial da auditoria
Supabase homologação separado identificado, esquema `martins_hml_v1`, 26 tabelas com RLS, 9 migrações. Isolamento efetivo de usuários e ligação da Etapa 48 ainda não verificados. Não habilitar políticas automaticamente para `operacoes`, `fin_operacoes`, `nfe_operacoes` sem confirmar intenção.

## Aceite
Testes automatizados, funcionais desktop/mobile, isolamento RLS e validação visual antes de qualquer solicitação de publicação oficial.
