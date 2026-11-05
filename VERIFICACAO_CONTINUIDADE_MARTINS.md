# Continuidade da reformulação do Sistema Martins
Data: 05/11/2026

## Resultado desta rodada
Continuação sobre a fonte existente da homologação, partindo do commit 6c2023390d3f592b6df71a33eaaf8cb15033278e. Não houve reinício do projeto, alteração do Netlify oficial, migração definitiva ou alteração do Supabase.

| Etapa | Implementado/corrigido | Evidência e estado |
| --- | --- | --- |
| Vales | Limite acumulado local de 40%, fotografia do bruto, justificativa e autorização de administrador; alerta de duplicidade | 14 novos testes; commit 8f871b1. Parcial: backend e apuração mensal pendentes |
| EPI | Assinatura desenhada por toque/caneta/mouse, alternativa manual, PDF com desenho, sequência simples e orientações de uso/conservação | 11 novos testes, PDF renderizado; commit bc25030. Celular físico e segurança online pendentes |
| Orçamentos | Identificação, escopo, condições, validade e observações; subtotais, validação monetária e compatibilidade com venda/obra | 8 novos testes, PDF renderizado; commits 3066976 e 653ca66. Estrutura recomposta; não é restauração integral de arquivo histórico específico |
| Estoque | Inativação/reativação auditada, saldo/histórico conservados e bloqueio de novas operações | 5 novos testes; commit 653ca66. Backend e tela para itens legados de EPI pendentes |
| Formulários | Avisos antes de descartar alterações nos caminhos instrumentados; limpeza de pendência somente após salvar | 4 testes do controlador; commit 653ca66. Fluxos visuais e rascunhos recuperáveis após falha do navegador pendentes |
| Menu/interface | Obras/Planejamento/Divergências, grupos recolhíveis, Financeiro após RH, atalhos e ajustes direcionados de dimensionamento | Compilação; commit 653ca66. Homologação de interação e responsividade ainda pendente |
| Financeiro | Banco da conta, filtro por favorecido/cliente e retorno ao lançamento após cadastro de conta | 3 novos testes de regras; commit 653ca66. Fluxo visual do retorno pendente |
| Frota | Marca/modelo em novos cadastros e texto Cadastrar veículo; legado preservado | 2 novos testes; commit 653ca66 |

## Testes técnicos
node --test scripts/*.test.cjs: 364 testes aprovados, zero falhas, zero ignorados.
São 317 testes da etapa anterior mais 47 casos novos. Resultados em scripts/RESULTADOS_CONTINUIDADE.txt.
node scripts/check-static.cjs: 58 scripts compilados, referências locais presentes, dados fictícios e isolamento de rede da aplicação principal mantidos.
git diff --check: sem problemas de espaços/conflitos.

Os testes financeiros anteriores usam exceções administrativas explícitas nos cenários fictícios acima do limite. Os 14 novos testes de política verificam independentemente os bloqueios. As fixtures novas de conta bancária e frota informam os campos obrigatórios; há testes específicos de compatibilidade com registros antigos.

PDFs de EPI e proposta foram gerados, renderizados e inspecionados. A revisão de UI no navegador chegou à tela de login, sem erro do aplicativo observado no carregamento, e não verificou fluxos autenticados. Não se declara homologação visual completa nem em Android/iOS. Não foi repetida uma varredura manual completa.

## Regras operacionais e limitações
Vales usam o mês civil da entrega como período, com base na Frequência até a data do vale. Não somam Planejamento, RDO ou horas extras digitadas sem aprovação. Vales consumidos no fechamento continuam no acumulado do mês; cancelados deixam de contar. Mensalistas não usam salário mensal inteiro como bruto já trabalhado: exigem conferência e exceção administrativa até definir/implementar a apuração mensal.

A autorização administrativa e a assinatura desenhada são registros locais. Falta validar identidade, regras/RLS e serialização no servidor. Não representam proteção contra manipulação deliberada do dispositivo nem assinatura certificada. Não há sincronização entre dispositivos nesta rodada.

Novos recibos EPI ganham número simples; IDs e identificadores históricos não foram trocados. O recibo não certifica treinamento nem conformidade jurídica integral.

Os avisos de formulário não recuperam dados após encerramento forçado/falha do navegador. O beforeunload depende do navegador. A proteção cobre eventos e rotas instrumentadas, a serem testados funcionalmente.

## Próximas pendências aprovadas
1. Receber/aplicar relatório funcional independente do Gemini, com correções direcionadas.
2. Validar login, perfis/RLS e persistência reais no Supabase, reutilizando o esquema existente; implementar a regra de 40% e sua exceção de modo transacional no backend antes de declarar o requisito concluído online.
3. Completar apuração de mensalistas, extras aprovadas e recibo de pagamento com comprovante.
4. Conferir coleta de assinatura e navegação em celular físico, modais, tabelas e sobreposições.
5. Inativação dos itens legados de EPI e proteção de outros fechamentos programáticos de formulários.
6. Demais pendências do plano: CNPJ automático, calculadoras independentes e correções específicas ainda não descritas como entregues nos relatórios.
7. Parâmetros de jornada de 10h/12h seguem sujeitos à definição; não foram aplicados como limites legais presumidos.

Publicação oficial no Netlify e migração definitiva continuam dependendo de autorização expressa. A homologação mantém o público de acesso existente.
