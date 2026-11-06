# Revisão técnica — Melhoria 1 Gemini: cabeçalho compacto e seletor de unidade

Data: 2026-11-06
Branch: `melhorias-visuais-gemini-20261106`
Status: **REVISÃO — não integrada à interface nem homologada**.

## Fonte
Proposta do Gemini encaminhada pelo usuário: substituição do header, seletor flutuante e funções `getEmpresaAtivaId`, `setEmpresaAtivaId`, `toggleDropdownEmpresasHeader`, `atualizarSeletorEmpresaHeader`.

## Evidência de repositório
- O arquivo de distribuição está em `dist/index.html`, não `index.html` na raiz.
- `dist/menu_layout_martins_ui.js` já modifica menu lateral, eventos de abrir/fechar, acessibilidade e deslocamento do header quando aparece o aviso offline.
- `dist/martins.css` é CSS Tailwind compilado; classes arbitrárias sugeridas pelo Gemini podem não existir na folha atual. Usar CSS explícito para componentes novos ou recompilar o Tailwind com o build oficial.
- O arquivo `dist/index.html` não foi disponibilizado integralmente pelo conector na leitura pontual; ainda falta verificar a posição real do header, scripts e seletores antes de substituí-lo.

## Ajustes obrigatórios
1. **Negar por padrão**: não interpretar ausência de `currentLoggedUser.empresas` como acesso irrestrito. A lista deve vir da autorização existente e, futuramente, do servidor/RLS. A UI nunca concede acesso.
2. Separar `empresa_id` jurídica de `unidade_id` operacional; Aços – Telha e Aços – Serralheria têm o mesmo CNPJ.
3. Validar `setEmpresaAtivaId` contra unidades permitidas antes de persistir e disparar evento; limpar seleção inválida ao mudar usuário.
4. Não usar `innerHTML` com `nomeFantasia`, `unidadeOperacional` ou CNPJ de dados persistidos: criar nós com `textContent` para evitar injeção.
5. Não anunciar 'Conectado' nem sinal verde fixo sem estado real da sincronização.
6. Remover nomes/logins e perfis reais hardcoded; preservar preenchimento dinâmico de IDs existentes.
7. Conferir largura 320/360/390/414px, teclado, Escape, clique fora, aria-expanded e foco.
8. Preservar o banner offline e o offset do header do `menu_layout_martins_ui.js`.
9. Verificar se as funções citadas e IDs existem na versão atual; não substituir `<header>` por posição suposta.
10. Testar navegação entre unidades e usuários (Masters, José Henrique, funcionários) sem vazamento de dados e sem usar localStorage como mecanismo de autorização.

## Critérios de aceitação
- Cabeçalho responsivo, sem overflow em celular, mantendo controles atuais.
- Dropdown mostra somente unidades autorizadas e tem estados acessíveis.
- Troca de unidade não altera empresa jurídica por acidente nem produz acesso extra.
- Compatibilidade com o menu lateral, o aviso offline e a autenticação existentes.
- Nenhuma alteração em produção, Supabase ou branch `desenvolvimento`.

## Próxima etapa
Obter trechos atualizados do `dist/index.html` que definem o header e o modelo de sessão/empresa, ajustar a implementação e testar antes de ligar os arquivos. Não aplicar cegamente o HTML do Gemini.
