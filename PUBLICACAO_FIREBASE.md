# Publicação no Firebase Hosting

O Firebase serve só o frontend. O banco e a autenticação v5 continuam no Supabase, e os contratos não mudam. O site oficial do Netlify (`construtoramartins.netlify.app`) continua como está até a homologação ser aprovada.

| Destino Firebase | Pasta publicada | Gerada por | Supabase |
|---|---|---|---|
| `homologacao` | `dist-qa/` | `node scripts/preparar-build-qa.cjs` | QA `oczxyiakpmgnrpoyhwov` |
| `producao` | `dist-producao/` | `node scripts/preparar-build-producao.cjs` | Produção `kkjwmnxgcbonbwavaaya` |

Os dois builds mantêm as gravações bloqueadas (`PREVIA_SOMENTE_LEITURA`).

O `firebase.json` reproduz as regras de `dist-producao-fonte/_headers` e `_redirects`: rotas da SPA, cabeçalhos de segurança e `sw.js` sem cache. A homologação também envia `X-Robots-Tag: noindex`. O teste `tests/firebase-hosting.cjs` falha se as duas configurações divergirem. A CSP continua na tag `<meta>` do `index.html`, que cada build ajusta para o seu projeto Supabase.

## 1. Preparação (uma vez, feita por um responsável do Grupo Martins)

1. Crie um projeto no [console do Firebase](https://console.firebase.google.com) **numa conta do Grupo Martins**. O plano gratuito (Spark) basta para o Hosting. Adicione o desenvolvedor como colaborador.
2. Em Hosting, crie dois sites, por exemplo `martins-erp-hml` (homologação) e `martins-erp` (produção).
3. No terminal, na raiz do repositório:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add                          # escolha o projeto e dê o alias "default"
   firebase target:apply hosting homologacao martins-erp-hml
   firebase target:apply hosting producao martins-erp
   ```
   Isso cria o `.firebaserc`, que pode ser versionado porque não contém segredos.
4. No Supabase **QA**, em Authentication → URL Configuration, adicione `https://martins-erp-hml.web.app/**` às Redirect URLs. Sem isso, os links de recuperação de senha e de convite voltam para o endereço antigo. Repita no projeto de produção somente quando ele for liberado.

## 2. Publicar a homologação (somente leitura)

```bash
node --test tests/*.cjs
export VITE_SUPABASE_QA_ANON_KEY='sb_publishable_...'   # chave publicável do QA, nunca sb_secret_ nem service_role
rm -rf dist-qa && node scripts/preparar-build-qa.cjs
firebase emulators:start --only hosting:homologacao     # opcional: testa em http://127.0.0.1:5000
firebase deploy --only hosting:homologacao
```

Para uma prévia temporária, sem trocar o que está no ar, use um canal de prévia. A URL expira em 7 dias:

```bash
firebase hosting:channel:deploy revisao --only homologacao --expires 7d
```

## 3. Publicar a produção (somente com autorização do Grupo Martins)

```bash
export VITE_MARTINS_ENV=PRODUCAO
export VITE_SUPABASE_PROD_URL=https://kkjwmnxgcbonbwavaaya.supabase.co
export VITE_SUPABASE_PROD_ANON_KEY='sb_publishable_...'
rm -rf dist-producao && node scripts/preparar-build-producao.cjs
firebase deploy --only hosting:producao
```

## Reversão

O Firebase guarda cada versão publicada. Para voltar à anterior, abra Hosting → site → Histórico de versões e use **Reverter** na versão desejada. Como o Supabase não muda, a reversão não afeta os dados. Até a produção ser validada no Firebase, o Netlify continua sendo o caminho de volta.

## Não publique

- `dist/`: árvore de referência de QA, que carrega `qa-*.js`.
- Chaves `sb_secret_` ou `service_role`. Os builds e os testes bloqueiam essas chaves.
