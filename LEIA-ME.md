# Sistema Martins | Fonte de homologação

- Branch de origem: `release/producao-v5`
- Commit: `e854bf2807ffb9a006e8a44d5182ffd030c32ebe`
- Destino da prévia de referência: `dynamic-douhua-a2bd9a.netlify.app`

O ZIP contém a árvore do commit, com duas exceções de sanitização documentadas: a chave pública QA foi omitida de `dist/qa-public-settings.js` e o manifesto `.openai/hosting.json` foi retirado para desvincular a cópia do Site hospedado. Este README e o manifesto SHA-256 foram adicionados ao pacote. As fontes incluem o HTML e o bundle JavaScript mantidos no repositório.

## Estrutura

- `dist-producao-fonte/`: fonte estática da prévia produtiva, incluindo autenticação v5 em `auth-v5.js` e `auth-ui-v5.js`, formulários, cliente de integração, HTML, bundle, CSS, recursos e regras Netlify.
- `dist/`: árvore de referência de QA, sem chave configurada. É mantida para edição e regressões e fica fora do deploy de produção.
- `integracao/`: adaptação de Frequência.
- `scripts/` e `netlify.toml`: build, validação de ambiente e geração do Service Worker.
- `tests/` e `diagnostico/`: suítes locais, contratos e SQLs de revisão. Não aplique os SQLs como parte do build.

## Desenvolvimento e publicação autorizada

Execute os testes na raiz com `node --test tests/*.cjs`. Para gerar a prévia, configure `VITE_MARTINS_ENV=PRODUCAO`, `VITE_SUPABASE_PROD_URL=https://kkjwmnxgcbonbwavaaya.supabase.co` e `VITE_SUPABASE_PROD_ANON_KEY` com a chave publicável do próprio projeto (formato `sb_publishable_…`). Injete a chave no ambiente de build, mantendo o repositório sem credenciais. Execute `node scripts/preparar-build-producao.cjs`. A saída é `dist-producao/`, a pasta para deploy manual na prévia protegida aprovada. O ZIP de fontes precisa ser extraído e compilado antes do envio. A prévia mantém as gravações operacionais bloqueadas. A consulta produtiva do Fluxo de Caixa ainda está indisponível, embora o módulo faça parte do código.
