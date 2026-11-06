# Integração Financeiro / Lançador / NF-e — avaliação técnica

A conferência XML e o recebimento físico são eventos distintos. Recebimento só movimenta estoque após confirmação. Importar/preservar XML não recebe material, não altera preço cadastrado e não cria obrigação, pagamento ou conciliação.

O contrato servidor fin_lancamentos utiliza estado pendente_conferencia, versão, autoria do JWT e RLS própria. O fluxo local legado utiliza registros com status pendente/pago/cancelado e rateios. Esses estados não são equivalentes: converter pendente_conferencia diretamente em pago ou mesmo em pendente comum elimina a etapa de conferência e pode duplicar obrigações. Nenhuma conversão automática foi adicionada.

Parcelas do XML são extraídas exatamente como informadas, em centavos e com vencimento original. Sem parcelas, não se inventa vencimento ou condição de pagamento. Propostas têm status pendente_conferencia, pagamento=false e chave estável NFE-[chave]-[numero]. Nesta entrega não são lançamentos de Contas a Pagar.

Para a ligação efetiva, falta um comando específico no servidor que registre o vínculo empresa/chave/numero_parcela com unicidade transacional, reconfira a identidade e permissão de conta, preserve o lançamento original e recuse reimportação com conteúdo divergente. Deve manter conferência documental separada de liquidação e respeitar compartilhamentos/anexos. Não enviar dados de LocalStorage assumindo que representem usuário autenticado.

A página de homologação do Lançador continua isolada e com operações sensíveis bloqueadas. A homologação remota segue não autorizada nesta execução. Aplicação de políticas, integração definitiva de contas e validação de sessões paralelas dependem da futura homologação real. Não houve chamadas ao Supabase remoto.
