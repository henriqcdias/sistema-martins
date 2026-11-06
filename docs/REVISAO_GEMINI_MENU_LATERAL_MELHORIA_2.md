# Revisão técnica — Gemini Melhoria 2 (Menu Lateral Inteligente)

**Decisão:** aproveitar a proposta visual, mas não sobrescrever `dist/menu_layout_martins_ui.js` nem substituir integralmente o drawer.

## Verificação no repositório
A branch `melhorias-visuais-gemini-20261106` já contém `dist/menu_layout_martins_ui.js` com estilos, estrutura de menu e carregamento incremental de `martins_header_compacto.js`. A substituição sugerida pelo Gemini eliminaria esses comportamentos.

## Requisitos aprovados para integração incremental
1. Cinco grupos: Operacional, Comercial, Suprimentos, Financeiro e Gestão.
2. Busca de itens sem perder foco, seleção e estado dos grupos.
3. Abrir/recolher grupos com `aria-expanded`, teclado e preservação de foco.
4. Destaque da rota **e subaba**, sem destacar simultaneamente itens da mesma rota.
5. Fechar o drawer no celular **após** navegação bem-sucedida, preservando o comportamento original.
6. Usar as funções e rotas realmente existentes no código; não criar rotas fictícias.
7. Não exibir número de versão no cabeçalho ou rodapé.
8. Não apagar elementos de logout, troca de senha, barra inferior, auditoria ou permissões.
9. Não confiar em `currentLoggedUser.perfil === 'Master'` como autorização: a interface é apenas apresentação; dados e operações dependem de políticas RLS.
10. Não inserir nome de usuário fixo em HTML; renderizar somente dados da sessão verificada.
11. Evitar duplicar a tag de script do menu ou sobrescrever `window.abrirDrawerMenu` repetidamente.
12. Preservar a calculadora de esquadrias e as demais funcionalidades existentes.

## Problemas concretos no código recebido
- `item.rota === window.secaoAtiva` não distingue subabas e pode destacar múltiplos itens.
- A re-renderização completa a cada caractere pode descartar foco/estado.
- `window.secaoAtiva = item.rota` antes da ação não comprova navegação bem-sucedida.
- A proposta HTML remove/oculta controles importantes e inclui texto de versão.
- A proposta pede substituição integral de arquivo que já tem lógica ativa.
- Verificar no código real se `setSubtabSuprimentos`, `setSubtabColab` e as demais rotas estão disponíveis antes de vinculá-las.

## Homologação
Não integrar à `desenvolvimento` ou publicar no Netlify antes de testes desktop, mobile, navegação, logout, perfil limitado, acessibilidade, cache/PWA e ausência de regressões.

**Status:** revisão registrada. Nenhuma alteração visual ativa ou deploy neste commit.
