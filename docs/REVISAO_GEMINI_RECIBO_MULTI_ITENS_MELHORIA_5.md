# Revisão técnica — Gemini Melhoria 5: recibo multi-itens de uniformes e EPIs

**Status:** proposta visual recebida; código de movimentação financeira/estoque NÃO aprovado para integração direta.

## Requisitos aceitos
- Um recibo único com vários itens e botão para adicionar/remover itens antes de confirmar.
- Tabela com descrição, quantidade, tamanho, CA somente quando aplicável e validado.
- Recibo A4 padronizado com dados reais da empresa, funcionário, obra, data, número, termo e assinaturas.
- Histórico, reimpressão e vínculo aos registros de estoque e colaborador.
- Interface responsiva e compatibilidade com registros anteriores.

## Bloqueadores do código enviado
1. A alegada baixa 'atômica' não é atômica: estoque, distribuições e colaboradores são gravados separadamente, sem transação, rollback ou idempotência.
2. A validação final de saldo verifica cada linha isoladamente; o mesmo produto em linhas repetidas pode ultrapassar o saldo total.
3. Número `REC-` derivado de seis dígitos de `Date.now()` pode colidir; exigir ID persistente e sequência por empresa sob controle do servidor.
4. Funcionário identificado pelo nome permite homônimos e erros de vínculo; exigir IDs estáveis e empresa autorizada.
5. CA fictício/padrão (`C.A. 43.120`, `C.A. 38.450`, `C.A. Válido MTE`) é inadequado; não presumir CA para uniformes nem validade sem cadastro/verificação.
6. `innerHTML` e `document.write` interpolam dados de usuário/empresa sem escape, criando risco de injeção.
7. `window.open` pode falhar por bloqueio de pop-up; impressão/PDF precisa de tratamento de falha e documento persistido.
8. `new Date().toISOString().split('T')[0]` é UTC e pode divergir da data local.
9. O código não demonstra assinatura eletrônica, imutabilidade do recibo emitido, auditoria, reimpressão real nem persistência segura entre dispositivos.
10. Não há comprovação de integração com as funções/IDs atuais do sistema; substituir modal e handler pode quebrar a entrega existente.
11. Dados da empresa, contato e endereço devem vir de cadastro validado, nunca de exemplos ou fallback inventado.
12. A redação do termo NR-06 deve ser revisada para refletir obrigações aplicáveis; não misturar uniformes comuns e EPIs como se todos exigissem CA.

## Plano de execução
1. Inspecionar fluxo atual de entrega, estoque, funcionários, recibos e permissões na branch de desenvolvimento.
2. Definir contrato de dados com recibo-cabeçalho, itens, movimentos, assinatura e documento imutável.
3. Implementar transação única no backend, checagem agregada de saldo, isolamento por empresa e chave de idempotência; sem migração remota não autorizada.
4. Integrar somente interface incremental e visual A4 após confirmar contratos reais.
5. Testar vários itens, saldo insuficiente, concorrência, repetição de envio, falha parcial, permissões, histórico, impressão e celular.

**Restrições:** não alterar Supabase remoto, produção, Netlify ou branch desenvolvimento sem autorização expressa.