# Continuidade autônoma — 06/11/2026

Base inicial confirmada: da6cb271040c. Alterações publicadas somente em desenvolvimento, em etapas verificadas.

## Etapas anteriores desta execução
- f81d18441b6c: jornada conferida, horas extras importadas na Remuneração, atraso informativo e sugestão de rateio. 423 testes.
- 094bdeeb403f: lotação histórica e férias/folgas/atestados/afastamentos na ficha do RH. 435 testes.
- 000226811548: solicitações de vales, reserva de limite, entrega confirmada e bloqueio de exceção sem servidor autenticado. 445 testes.
- be8af662607a: devoluções segregadas de EPIs/uniformes, prazos de substituição, relatórios e integração das novas bases à persistência recuperável. 463 testes.

## Revisão transversal final
Negações explícitas de cadastro/RH, Financeiro, Estoque e Vendas prevalecem sobre perfil Master. Orçamentos recusam números ausentes, booleanos, preços negativos, centavos indevidos, estouro numérico e diferenças de total sem origem em arredondamento. Arredondamento legado agregado e por item e preço zero explícito permanecem válidos.

Devoluções armazenadas são reconferidas quanto à entrega, pessoa e quantidade acumulada. Estorno do vale originado em solicitação também atualiza o histórico da solicitação, sem apagar pagamento ou entrega anteriormente declarados.

## Evidências reproduzíveis
474 testes de núcleo/regressão aprovados, zero falhas, ignorados ou pendentes. 63 scripts de aplicação/HTML compilados pelo check estático. Auditoria de segredos sem achados no escopo examinado, sem afirmar auditoria completa do histórico.

Com Playwright/Chromium, executar npm run test:browser. MARTINS_CHROMIUM_EXECUTABLE permite selecionar um Chromium instalado; caso omitido usa o caminho padrão do Playwright.

- Fixture do diálogo de horas em 390 e 1280 pixels: interação com os campos, prévia, gravação e dimensões do diálogo.
- Aplicação completa, origem HTTP local isolada e rede externa bloqueada, nas mesmas larguras: inicialização dos novos controles sem erros JavaScript; acionamento dos handlers de solicitação/aprovação/entrega de vale, ausência pela ficha, fechamento com extras automáticas, entrega e devolução de uniforme. Usa somente pessoas, contas, obras e valores sintéticos.
- Asserções do cenário integrado: vale R$30 pago, saldo R$110 pendente, um fechamento, uma devolução, saldo disponível de uniforme mantido em 3 após a devolução. Nenhuma transferência foi executada.

Os fluxos da aplicação foram acionados programaticamente pelos handlers para verificar integração; não equivalem à revisão visual completa de todas as telas, navegação de ponta a ponta com autenticação real ou teste em aparelho físico. As larguras cobrem comportamento de inicialização e o diálogo de horas, não certificam responsividade integral.

## Pendências e limites
- Exceção de vales acima de 40% permanece bloqueada até backend que autentique administrador, derive a base em dados confiáveis e grave autorização/justificativa/auditoria atomicamente. Não criar liberação por token ou perfil declarados no cliente.
- Supabase: inventário real, autorização/RLS, teste de escrita em homologação e concorrência entre dispositivos. O conector existente de diagnóstico não foi convertido em permissão de escrita.
- Mensalistas: definir/aprovar a base adquirida no período e a distribuição mensal por obra; valor integral do mês não é presumido. Extras operacionais sem aprovação de servidor não ampliam o limite automático de vales.
- Turnos que atravessam meia-noite requerem fluxo próprio; o diálogo atual exige entrada e saída no mesmo dia. Mantido limite preexistente de até 8h normais.
- Destinação de EPIs devolvidos após segregação depende do procedimento aprovado. Prazos de substituição são os cadastrados, sem prazo técnico inventado.
- Homologação visual integral, acessibilidade completa e aparelho físico continuam pendentes. Propostas do Gemini não aprovadas não foram aplicadas.

Main, Netlify oficial e dados definitivos do Supabase preservados. Nenhuma publicação em produção, contratação, migração ou exclusão de dados existentes.

Próxima prioridade: preparar ambiente separado de homologação e completar autenticação/RLS e autorização de vales no servidor, antes de liberar exceções ou usar os fluxos com dados definitivos.
