# Frota: combustível por km e rastreabilidade — 06/11/2026

Indicador de custo de combustível por km utiliza os mesmos ciclos entre tanques cheios da média km/l. Inclui abastecimentos parciais e seus valores quando o ciclo fecha. Primeiro tanque e trechos ainda incompletos ficam fora do numerador, com valor separado na tela. Distância zero não produz divisão por zero. Indicador físico ao valor cadastrado, sem manutenção, sem equivalência a pagamentos e sem despesa adicional.

Histórico fora da sequência de datas/hodômetro interrompe o indicador sem reordenar nem substituir dados. Totais fora da precisão segura são recusados. Repetir a operação de um abastecimento antigo após registros posteriores continua idempotente, sem duplicar abastecimento ou despesa.

Revisão visual mobile identificou regra CSS que reexibia atalhos ocultos e deslocava MENU para segunda linha. Corrigida precedência; teste verifica sete atalhos visíveis na mesma linha. Sem reorganização ampla de telas.

Validação: 581 testes automatizados aprovados; 64 scripts compilados; auditoria de fontes sem achados no escopo verificado. Testes locais de navegador em 390/1280 pixels validam custo por km, ausência de despesa duplicada, manutenção das despesas pendentes e bloqueio por perfil. Navegação testada também em 360 pixels e nas duas entradas HTML. Captura mobile revisada. Todos os novos roteiros incluídos em npm run test:browser.

Supabase remoto e teste em aparelho físico não realizados. Manutenções, motoristas, alertas de revisão e custo operacional completo por km permanecem pendentes.
