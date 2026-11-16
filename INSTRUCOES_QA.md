# Sistema Martins — homologação no Supabase QA (somente leitura)

Projeto Supabase QA: `oczxyiakpmgnrpoyhwov`. Produção (`kkjwmnxgcbonbwavaaya`) não é usada: o build QA falha se encontrar essa URL.
Atualização de 16/11/2026: a homologação no Firebase (`sistema-martins-hml.web.app`) **grava** no Supabase QA, por autorização do responsável (veja `PUBLICACAO_FIREBASE.md`). A produção continua somente leitura.

## Opção A — usar a pasta pronta (`Sistema_Martins_QA_publicavel.zip`)
1. Extraia o ZIP.
2. Abra `producao-config.js` num editor de texto e troque `sb_publishable_COLE_AQUI_A_CHAVE_DO_PROJETO_QA` pela chave pública do QA, inteira, incluindo o prefixo `sb_publishable_`.
   Onde achar: Supabase (projeto QA) → Project Settings → API Keys → chave "publishable". Não use `service_role` nem `sb_secret_`.
3. **Teste primeiro no seu computador, sem hospedagem:** abra um terminal na pasta e rode `python3 -m http.server 8080` (Windows: `py -m http.server 8080`). Acesse http://localhost:8080.
4. Só depois, se quiser hospedar: envie a pasta (já com a chave) para uma prévia **privada**, por upload manual. Não promova nem use o site oficial.

## Opção B — gerar você mesmo (código-fonte)
1. Defina `VITE_SUPABASE_QA_ANON_KEY` só no seu terminal.
2. `node --test tests/*.cjs` e depois `node scripts/preparar-build-qa.cjs`. A saída é `dist-qa/`.

## Teste de Funcionários
1. Entre com e-mail e senha de uma conta de teste que exista no Auth do QA.
2. Abra Funcionários e leia a barra de status no topo (ou, no console do navegador, `MartinsOperacional.diagnostico()`).

| Mensagem ou estado | Significado |
|---|---|
| Login: "função martins_producao_contexto não existe…" (`CONTEXTO_CONTRATO_AUSENTE`) | O QA não tem o contrato `martins_producao_*` no schema `public` |
| Login: "contexto empresarial recusou o acesso" | A conta não tem vínculo ou permissão |
| `vazio` | A consulta funcionou e o QA não tem funcionários naquela empresa |
| `sem_permissao_leitura` | O vínculo não tem `funcionarios.ler` |
| `permissao` / `contrato` / `conexao` / `limite` | Negado pelo servidor / RPC ausente / rede / limite de requisições |
| `ok` | Funcionários carregados |

## Conferência do QA (somente leitura, feita por você)
No SQL Editor do projeto **QA**, rode `diagnostico/contratos-producao.sql`. Ele só lê metadados e termina com ROLLBACK. Informa se as RPCs `martins_producao_*` e as tabelas de `martins_producao_v1` existem.
Não rode nada no projeto de produção.

## Limitações
Não houve login real nem conexão com o Supabase. CSP, Service Worker e layout no celular não foram testados em navegador.
