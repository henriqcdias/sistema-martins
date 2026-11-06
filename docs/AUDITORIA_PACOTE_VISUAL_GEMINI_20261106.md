# Auditoria do pacote visual Gemini — bloqueio de publicação

Data 2026-11-06. Pacote recebido: deploy_martins_testes.zip (9 arquivos, index.html ~5,3 MB). Não enviar o ZIP original para GitHub: contém credenciais embutidas.

## Achados confirmados no HTML recebido
- `initialUsuarios` contém propriedade `senha` para usuários de exemplo, inclusive Masters.
- `getUsuariosDb()` atribui novamente senha fixa para determinados usuários Master.
- A rotina de login aceita senha local e ainda tem atalhos com senhas fixas no código.
- Fluxos de troca e redefinição de senha gravam `senha` em localStorage e sessão em sessionStorage.
- O pacote não contém integração Supabase comprovada: nenhuma ocorrência textual de 'supabase' no HTML.
- Portanto, remover somente o array `initialUsuarios` **não corrige** a autenticação; é necessário substituir o fluxo inteiro e não confiar em `perfil`, `empresas` ou `podePagarDespesas` definidos no navegador.

## Plano de correção (não publicar até conclusão)
1. Extrair diferenças visuais do pacote Gemini comparando com o HEAD atual de `desenvolvimento`. Não substituir `dist/index.html` integralmente.
2. Preservar a calculadora e os atalhos, sem copiar a base de usuários ou dados fictícios como fonte de autorização.
3. Trocar login e troca de senha locais por Supabase Auth; carregar identidade verificada e capacidades do servidor. Nunca gravar senha em localStorage, sessionStorage ou HTML.
4. Remover credenciais fixas e backdoors de login; bloquear acesso operacional até haver sessão autenticada e autorização RLS real.
5. Corrigir nomenclatura PWA, validar cache e service worker; testar computador e celular.
6. Executar testes negativos de acesso cruzado (3 empresas, 4 unidades, Masters, José Henrique e operacionais).
7. Produzir pacote de homologação **somente depois** de testes; sem publicação automática no Netlify.

## Critério de segurança
Não existe modo seguro de publicar o ZIP original simplesmente como 'site de testes' público. Senhas presentes no código devem ser consideradas expostas se o arquivo foi compartilhado com terceiros ou publicado. Avaliar rotação de senhas reutilizadas.

## Limites da auditoria
Presença de funções de calculadora e menus não prova funcionamento. A revisão não equivale a teste de navegador, autenticação remota ou integração de dados.
