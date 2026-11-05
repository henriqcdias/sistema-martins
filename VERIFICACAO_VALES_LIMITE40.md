# Vales e limite acumulado de 40%
Data: 05/11/2026

Implementação local na homologação. O período operacional adotado é o mês civil da data de entrega. A base considera Frequência com presença até a data do vale, remuneração vigente e regra explícita de diária/jornada. Horas extras digitadas e ainda sem aprovação não ampliam a base. Todos os vales não cancelados do mês contam, inclusive consumidos no fechamento, evitando que o desconto libere novo limite.

No limite exato, o lançamento é permitido; acima dele exige perfil Master/Administrador ativo, confirmação e justificativa. A fotografia da base e da autorização fica no histórico. Perfis de RH/Financeiro não recebem poder de exceção automaticamente, e uma negação explícita de autorizarVales prevalece. A sessão é revalidada ao confirmar.

Alerta para mesmo colaborador, valor e data exige reconhecimento de possível duplicidade. ID da operação mantém idempotência. Gravação conjunta, conciliação, desconto único e estorno continuam existentes.

Mensalistas: não se usa salário mensal integral como valor já trabalhado. Enquanto não houver regra de apuração mensal aprovada, o limite automático é zero e o lançamento exige conferência/justificativa administrativa. Essa limitação está visível na tela.

Testes: 331 aprovados (317 anteriores, 14 novos casos). Regressão financeira adaptada para usar exceções administrativas explícitas nas operações fictícias acima do limite; novos testes verificam independentemente limite, um centavo acima, acumulado, consumidos/cancelados, retroativo, mensalistas, duplicidade, arredondamento e permissões.

Pendente para conclusão de segurança: regras no backend/Supabase, autenticação real, serialização entre dispositivos, teste de sincronização e apuração mensal aprovada. Os perfis locais e o armazenamento local não oferecem garantia contra manipulação no dispositivo. Não houve alteração no Supabase, Netlify oficial ou dados definitivos. Não declarar esse requisito como homologado online.

Próxima etapa: recibos de EPI com assinatura eletrônica desenhada e alternativa manual.
