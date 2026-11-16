# Sistema Martins — correções sobre o commit e854bf2 (release/producao-v5)

Escopo: somente leitura. Nenhuma gravação foi liberada, nenhum SQL foi aplicado, nada foi publicado.
Arquivos alterados: `dist-producao-fonte/auth-v5.js`, `dist-producao-fonte/formularios.js`.
Arquivo novo: `tests/sessao-renovacao-e-diagnostico.cjs`. Os diffs estão nesta pasta.

## Correção 1 — Logout indevido (auth-v5.js)
- **Problema:** o token de acesso dura cerca de 1 h e nunca era renovado com a página aberta. Depois disso `obterContextoSegurancaAutenticadoWork()` passava a devolver `null`, as consultas falhavam com "Sessão expirada" e a tela parecia deslogada, com listas vazias.
  Além disso, um erro transitório (HTTP 500) na consulta de contexto durante o F5 apagava o refresh token (`CONTEXTO_INDISPONIVEL` não estava na lista de falhas preservadas).
- **Solução:** nova `renovarSessaoWork()`, agendada antes do vencimento, executada antes de cada RPC que esteja a menos de 30 s de expirar e ao voltar à aba. Usa só o refresh token da própria sessão, exige o mesmo UID, revalida os vínculos no servidor, descarta resposta de sessão trocada e faz uma única renovação por vez. Refresh recusado, UID diferente ou vínculo revogado encerram a sessão. Falha de rede ou erro transitório mantém a sessão e tenta de novo em 30 s. `CONTEXTO_INDISPONIVEL` no F5 não apaga mais o refresh token.
- **Inalterado:** login, `requisicaoWork` (lista fechada de endpoints), bloqueio de gravação, cifragem de rascunhos.
- **Teste:** 9 testes sintéticos novos (renovação, concorrência, refresh recusado, rede, outro UID, vínculo revogado, gravação continua bloqueada, agendamento/cancelamento, F5 com erro 500).
- **Depende do Supabase real:** confirmar que o projeto devolve `user` na resposta de refresh e que o tempo de vida do token é o esperado.

## Correção 2 — Diagnóstico da carga de Funcionários (formularios.js)
- **Problema:** a carga não distinguia causas. Sem permissão de leitura, o módulo era pulado em silêncio. Falhas viravam "Consulta indisponível: funcionarios" sem motivo. Lista vazia aparecia como "Consulta concluída".
- **Solução:** o estado fica em `document.body.dataset.cargaFuncionarios` e em `MartinsOperacional.diagnostico()`, com os valores `ok`, `vazio`, `sem_permissao_leitura`, `conexao`, `permissao`, `contrato`, `limite`, `resposta`. A mensagem de status explica o motivo.
- **Teste:** 5 testes sintéticos novos. A suíte antiga continua passando.
- **Depende do Supabase real:** só o login real mostrará qual estado ocorre.

## Resultado dos testes (Node 22, dados sintéticos, sem rede)
- Suíte original: 18/18. Suíte completa com os novos: 32/32.
- Os 14 testes novos falham no código original, o que confirma que detectam o problema.
- Build de produção: aprovado numa cópia temporária com chave fictícia; sem chave, o build bloqueia.
- **Não executado:** login com Supabase real, dados reais, navegador, layout no celular, Fluxo de Caixa, escrita. Os SQLs de `diagnostico/` não foram executados nem revisados.

## Como interpretar o diagnóstico (Funcionários)
| Estado | Significado | Ação |
|---|---|---|
| `vazio` | A consulta funcionou e a empresa não tem funcionários | Verificar se os dados estão neste projeto/empresa |
| `sem_permissao_leitura` | O vínculo não tem `funcionarios.ler` | Ajustar permissões do vínculo (por quem administra) |
| `permissao` | O servidor negou (RLS/RPC/sessão) | Revisar RLS e `martins_producao_consultar/catalogos` |
| `contrato` | RPC ausente ou schema `public` não exposto | Conferir RPCs instaladas e schemas expostos |
| `conexao` / `limite` | Rede ou limite de requisições | Tentar novamente |

## Implantação (sem alterar a produção)
1. Extrair o ZIP num checkout limpo (sem a pasta `dist-producao`).
2. Definir as variáveis `VITE_MARTINS_ENV=PRODUCAO`, `VITE_SUPABASE_PROD_URL=https://kkjwmnxgcbonbwavaaya.supabase.co` e `VITE_SUPABASE_PROD_ANON_KEY` (chave `sb_publishable_…`), só no ambiente de build.
3. Rodar `node --test tests/*.cjs` e depois `node scripts/preparar-build-producao.cjs`.
4. Enviar `dist-producao/` manualmente para a **prévia protegida**, sem promover o site oficial.
5. Seguir o aceite manual de `diagnostico/previa-netlify-producao.md`: somente leitura, sem "Desbloquear edição".

## Pendências que impedem uso com dados reais
- Habilitar gravações exige autorização sua e conferir ao vivo a RPC `martins_producao_salvar`.
- Fluxo de Caixa: consulta produtiva ainda indisponível, contrato financeiro a criar e revisar.
- Conversão de orçamento em pedido e edição de cálculos dependem das gravações.
- Revisar RLS e isolamento entre empresas no banco, com contas reais de teste.
- A paginação de `consultar` assume ordenação por `id` no servidor; confirmar.
