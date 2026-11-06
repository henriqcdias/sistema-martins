# Horas da Frequência e Remuneração — 06/11/2026
Base: da6cb271040c. Etapa pequena, sem produção ou escrita no Supabase.

- Conferência de entrada, saída, intervalo informado, jornada normal configurável até o limite já existente de 8h e entrada prevista opcional. Jornada no mesmo dia; virada de turno requer fluxo próprio e permanece bloqueada.
- Atraso é informativo, sem desconto presumido. Horas normais e extras são separadas em intervalos de 15 minutos. Valor da hora extra e obra são explícitos; nenhum percentual trabalhista foi criado.
- Remuneração importa automaticamente extras da Frequência, valida a fotografia e bloqueia redigitação na mesma data. Ausência elimina detalhes de trabalho anteriores.
- Sugestão opcional de rateio pelo custo efetivo: base por obra, extras na obra informada e dedução dos vales já pagos por obra. Centavos distribuídos por maior resto. Mensalistas, extras manuais sem obra e vales sem obra exigem rateio manual.
- Conferência de horas e edição diária bloqueiam funcionário/período com fechamento ativo. Fechamento gera conta pendente e preserva fotografia; não executa pagamento.

Validação: 423 testes aprovados, 63 scripts compilados, auditoria de segredos sem achados no escopo. Fixture de navegador em 390 e 1280 pixels: abertura, cálculo, gravação e limites do diálogo. A fixture encontrou e permitiu corrigir transbordamento de largura por padding. Não equivale a teste integral da aplicação, dispositivo físico, autorização de servidor, RLS ou sincronização entre dispositivos.

Limites: servidor de autorização de exceções de vales continua pendente. Próxima etapa tratará a proibição de exceções por mera identidade local. Não foi alterada regra de remuneração de ausência ou base de mensalista.
