# Integração visual incremental — pacote Gemini (06/11/2026)

## Status
Branch isolada criada diretamente do HEAD de `desenvolvimento`. A folha `dist/martins_gemini_mobile_review.css` é **preparatória**: ainda não foi incluída no HTML e não altera o site publicado. Não abrir PR como entrega funcional até concluir integração e testes.

## Origem e escopo
O ZIP fornecido contém um único `index.html` de ~5,3 MB, além de manifest, service worker e ícones. O `dist/index.html` atual do GitHub tem ~2,57 MB e módulos JS separados. Substituição integral não é segura. Melhorias desejadas: drawer, cabeçalho compacto, seis atalhos inferiores, calculadora de esquadrias. A folha adicionada prepara a camada visual responsiva para atalhos com atributos `data-martins-mobile-shortcuts` e `data-martins-mobile-shortcut`, sem alterar regras de negócio.

## Bloqueios
- O pacote original contém credenciais fixas e fluxos de autenticação em localStorage; **não** importar usuários/senhas ou seu `index.html` diretamente.
- Os seis atalhos só funcionarão quando o HTML atual tiver elementos correspondentes, com ações vinculadas às rotas existentes.
- Validar navegação real, compatibilidade PWA e CSS no desktop e celular antes de incorporar a `desenvolvimento`.
- Preservar a calculadora existente e não substituir módulos atuais por uma cópia mais antiga.

## Próxima implementação
1. Mapear os seletores e rotas do `dist/index.html` atual e o arquivo `dist/menu_layout_martins_ui.js`.
2. Criar componente de atalhos que invoque funções atuais sem recriar roteador.
3. Ligar a folha CSS ao HTML atual e validar ausência de regressões.
4. Revisar diferenças do drawer e cabeçalho; aplicar somente trechos necessários.
5. Executar testes em navegador e PWA, incluindo offline/cache e permissões.
6. Só então produzir artefato Netlify e PR para revisão.

**Nenhuma publicação, migração Supabase ou alteração de credenciais foi realizada.**
