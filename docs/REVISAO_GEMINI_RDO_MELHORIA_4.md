# Revisão técnica — Gemini Melhoria 4 (RDO)

Branch: melhorias-visuais-gemini-20261106. Status: **proposta recebida; integração funcional bloqueada até conferência do módulo atual**.

## Escopo visual aprovado para preparação
- Atividades como itens independentes, com edição e exclusão, sem duplicar o estado já existente.
- Seleção múltipla de fotos, arrastar e soltar, câmera móvel, miniaturas e legendas.
- Associação de fotos a atividades, preservando IDs persistentes e anexos existentes.
- Layout responsivo e acessível, preservando impressão, assinatura e aprovação.

## Incompatibilidades detectadas no código proposto
1. `window.currentRdoAtividades` e `window.currentRdoFotos` criam estado paralelo e não persistem os dados; não devem substituir o modelo atual.
2. `FileReader.readAsDataURL` não comprime fotos, não faz upload ao Supabase e pode consumir muita memória; não prometer armazenamento.
3. `podeReabrirRdoAprovado` autoriza pelo nome contendo “taiane” ou perfil “Engenharia”; inseguro. Reabertura deve usar permissão autenticada e validação no servidor.
4. `new Date().toISOString().split('T')[0]` usa UTC, não a data local da obra; validar fuso e regras de data existentes.
5. `calcularHorasTrabalhadas` devolve 8h para entradas ausentes, subtrai 60 min por padrão e pode divergir das regras de jornadas já homologadas. Exemplo 22:00–06:00 com 60 min de intervalo resulta 7h líquidas, não 8h.
6. `innerHTML` incorpora descrição, etapa e legenda sem escape; há risco de injeção de HTML. Usar textContent e criação de elementos.
7. O botão possui `onclick` inline e recebe `onclick` novamente no JS; remover duplicidade.
8. Substituir os blocos 4 e 5 de `index.html` pode remover listeners e elementos usados no RDO, relatórios e impressão.
9. Caminho de storage é somente string local, não comprova bucket, controle de acesso, versionamento ou persistência. Não usar nome de arquivo sem sanitização e chave única.
10. Não assumir IDs ou nomes de funções sem confirmar no código da branch funcional atual.

## Plano de integração segura
1. Localizar implementação atual do RDO e identificar contratos de dados, funções e eventos já existentes.
2. Aplicar apenas melhorias visuais incrementais sobre componentes reais, evitando recriar estado.
3. Integrar drag-and-drop ao upload existente, respeitando tamanho, tipo, segurança e persistência.
4. Manter aprovação/reabertura e cálculo de jornadas sob controle do Work funcional e validações do servidor.
5. Executar testes de criação, edição, salvamento, recarga, histórico, impressão, celular e isolamento por empresa.

Não realizar merge, publicação no Netlify ou migração no Supabase sem autorização expressa.