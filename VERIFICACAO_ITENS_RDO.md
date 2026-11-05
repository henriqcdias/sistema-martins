# Materiais e Ocorrências por itens — 05/11/2026

## Entrega

- Novos acessos com a paleta azul-escuro, branco, cinza e âmbar do sistema.
- Quatro acessos também no menu lateral, preservados após a reconstrução legada do menu.
- Materiais e Ocorrências com adicionar, editar, cancelar edição e remover por item.
- Conteúdo digitado ainda não adicionado é incluído ao salvar o RDO.
- Campos textuais anteriores permanecem compatíveis com os consumidores existentes, incluindo impressão; novas listas são salvas junto do RDO na mesma operação recuperável.
- Texto antigo não é dividido automaticamente; é mantido como um item, preservando os caracteres originais se não houver edição. Não existe migração automática nem escrita ao abrir.
- A requisição recebe um material por item, sem duplicar uma descrição com múltiplas linhas. As quantidades continuam sujeitas à revisão no pedido.
- Ditado direcionado ao novo campo de ocorrência; exportação do preenchimento inclui os campos ainda digitados.

## Verificação

Oito testes automatizados aprovados: legado exato, vários itens/múltiplas linhas, edição/remoção sem mutação da origem, validação, divergência com ferramenta antiga, texto com marcação, salvamento real do controlador em rascunho e falha de persistência preservando as listas na recuperação. Resultado em scripts/RESULTADOS_ITENS_RDO.txt.

No navegador, cenário isolado verificou adicionar material, editar, incluir ocorrência digitada ao salvar, requisitar um material por item e remover ocorrência. No sistema completo foram encontrados os dois editores e os quatro itens do menu lateral depois da inicialização, com cor azul-escuro confirmada. O cenário temporário foi excluído da publicação. Scripts compilados por scripts/check-static.cjs.

Limites: não houve teste em aparelho físico, impressão visual em PDF ou teste de voz com microfone. Os campos textuais usados pela impressão permanecem presentes; a validação não certifica todos os formatos de impressão. Não houve conexão ao Supabase nem alteração do site oficial. Dados locais anteriores preservados; nenhuma exclusão de RDO salvo foi executada.
