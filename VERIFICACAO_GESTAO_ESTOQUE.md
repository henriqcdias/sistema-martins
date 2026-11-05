# Gestão de materiais, estoque e navegação — 05/11/2026

## Alterações

- Atalhos grandes do topo ocultados; acessos preservados no menu lateral e dois botões adicionados à barra inferior, mantendo os cinco anteriores.
- Requisição retirada do formulário do RDO e disponibilizada em Gestão da Obra > Materiais da obra, usando a obra selecionada na Gestão e sem copiar o texto do RDO.
- Registro de materiais utilizados na Gestão: data, produto do cadastro, quantidade na unidade de compra, valor unitário, observação, autor e total estimado por obra. Histórico separado, incluído no backup pelo prefixo existente. Não aparece no RDO nem modifica seus campos.
- O registro de consumo é gerencial: não baixa estoque nem cria lançamento financeiro automaticamente. Essas operações permanecem separadas e explícitas.
- Busca por nome/código e cadastro rápido no formulário de entrada/saída do estoque. Após cadastrar, o novo produto fica selecionado; quantidade e tipo do movimento não são limpos.
- Cadastro novo começa com saldo zero; valida código repetido, unidades, fator e valores. Identificação por UUID.
- X, Cancelar e toque fora dos modais do estoque passaram a esconder também o estilo direto de exibição, que se sobrepunha à classe hidden. Escape fecha o modal superior do estoque. Altura com rolagem para telas pequenas.
- Movimento exige produto identificado e quantidade válida, sem escolher silenciosamente o primeiro cadastro. Saída acima do saldo é recusada.
- Leitura/gravação do catálogo passa a informar erros e preservar conteúdo corrompido, em lugar de retornar dados iniciais ou omitir erro de quota.

## Verificação

18 testes automatizados aprovados (10 de Gestão/estoque e 8 de itens do RDO). Saída em scripts/RESULTADOS_GESTAO_ESTOQUE.txt. Cobertura: cadastro/duplicidade/valores, movimentos por produto, saldo insuficiente, consumo separado de RDO/estoque/financeiro, datas e vínculos, concorrência do histórico, repetição de operação, falha de quota e regressão dos itens do RDO. Compilação dos 26 scripts concluída.

Navegador: presença dos campos e botões confirmada no sistema completo; topo invisível, sete botões inferiores, requisição ausente do RDO. Cenário isolado com os modais extraídos do sistema confirmou cadastro, seleção automática, quantidade digitada preservada, fechamento pelo X e consumo no histórico da Gestão. O cenário temporário foi excluído da publicação; suas gravações fictícias não integram a fonte do site.

Limites: teste em aparelho físico, saldo real, importação em volume, concorrência entre navegadores e integração financeira/Supabase reais não executados. Os novos registros são locais por navegador. Gestão registra estimativa do consumo, não conciliação automática com compras/estoque/financeiro. Registros e materiais históricos do RDO não foram apagados nem migrados. O site oficial não foi alterado; publicação restrita ao ambiente privado de homologação.
