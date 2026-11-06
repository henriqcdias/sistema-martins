# Recuperação da Frequência — 06/11/2026

Base remota: 6d333b0bd16e8b7966d9329e09e2889234401c8e, branch desenvolvimento.

## Recuperação
O remoto ainda estava na etapa RDO. A busca nos diretórios disponíveis encontrou versões até etapa48, sem os arquivos da execução interrompida de Frequência. A fonte atual foi recuperada do GitHub, incluindo os HTMLs verificados pelo hash original, e as correções ausentes foram reconstruídas sobre essa base. Os 407 testes relatados anteriormente não foram usados como evidência desta etapa.

## Alterações
- Validação compartilhada de data realizada em Brasília, cadastro único, vigência, funcionário ativo e indisponibilidades.
- Horas normais editáveis de até 8h, em intervalos de 15 minutos; rateio entre obras validado e preservado na edição de observação.
- Faltas e demais ausências removem rateios, horários e horas anteriores, sem exigir RDO.
- Lotes são integralmente validados antes da gravação única com proteção concorrente e backup existentes.
- Frequência mantém situação salva, inclusive afastamento e sem apontamento, sem convertê-la em folga pelo calendário. Indisponibilidades cadastradas aparecem no destino; funcionários fora da vigência não aparecem como disponíveis.
- Ambas as páginas HTML permanecem idênticas.
- Continuidade RH/Remuneração: fechamento aceita sábado, domingo e chuva já existentes na Frequência, mantendo horas zeradas e sem desconto presumido.
- Integração existente com RDO, Obras, remuneração e vales preservada. Planejamento não gera presença futura nem despesa.

## Evidência atual
409 testes aprovados, zero falhas ou testes ignorados. Inclui os 387 testes da base, 21 novos testes de Frequência e 1 de integração com remuneração.
63 scripts compilados pelo check estático. Auditoria de publicação sem achados no escopo examinado; não equivale a uma auditoria completa de histórico ou dados pessoais.

## Limites e continuidade
Validação automatizada em dados sintéticos. Não foi feita homologação visual completa, teste em aparelho físico, autenticação real, RLS ou sincronização entre dispositivos. A proteção local não substitui autorização no servidor.
Horas extraordinárias continuam no fluxo existente de apuração de Remuneração, com horas e valor explicitamente conferidos; não foi criada classificação automática nem presumidos adicionais legais. A integração automática das extras na Frequência e homologação online continuam pendentes.
Preservado o limite de vales de 40% do bruto trabalhado, com exceção administrativa justificada conforme a implementação existente. Apuração automática de mensalistas permanece dependente da regra aprovada.
Nenhuma publicação, migração ou escrita no Supabase foi executada. Main e Netlify oficial preservados.
