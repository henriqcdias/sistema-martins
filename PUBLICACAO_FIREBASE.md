# Publicação no Firebase Hosting

O Firebase serve só o frontend. O banco e a autenticação v5 continuam no Supabase, e os contratos não mudam. O site oficial do Netlify (`construtoramartins.netlify.app`) continua como está até a homologação ser aprovada.

| Destino Firebase | Pasta publicada | Gerada por | Supabase |
|---|---|---|---|
| `homologacao` | `dist-qa/` | `node scripts/preparar-build-qa.cjs` | QA `oczxyiakpmgnrpoyhwov` |
| `producao` | `dist-producao/` | `node scripts/preparar-build-producao.cjs` | Produção `kkjwmnxgcbonbwavaaya` |

Os dois builds mantêm as gravações bloqueadas (`PREVIA_SOMENTE_LEITURA`).

O `firebase.json` reproduz as regras de `dist-producao-fonte/_headers` e `_redirects`: rotas da SPA, cabeçalhos de segurança e `sw.js` sem cache. A homologação também envia `X-Robots-Tag: noindex`. O teste `tests/firebase-hosting.cjs` falha se as duas configurações divergirem. A CSP continua na tag `<meta>` do `index.html`, que cada build ajusta para o seu projeto Supabase.

## 1. Projeto atual

| | |
|---|---|
| Projeto Firebase | `sistema-martins-erp` (plano Spark), criado em 16/11/2026 na conta pessoal do desenvolvedor. **Pendente:** transferir para uma conta do Grupo Martins (Configurações do projeto → Usuários e permissões → adicionar a conta do Grupo como Proprietário e, depois, remover a conta pessoal) |
| Homologação | site `sistema-martins-hml`, em https://sistema-martins-hml.web.app |
| Produção | site `sistema-martins-erp`, em https://sistema-martins-erp.web.app. Não publicar sem autorização |

O `.firebaserc` versionado já liga o repositório ao projeto e aos dois destinos. Para publicar de outra máquina: `npm install -g firebase-tools` e `firebase login` com uma conta que seja membro do projeto.

No Supabase **QA**, em Authentication → URL Configuration, adicione `https://sistema-martins-hml.web.app/**` às Redirect URLs. Sem isso, os links de recuperação de senha e de convite voltam para o endereço antigo. Repita no projeto de produção, com `https://sistema-martins-erp.web.app/**`, somente quando ele for liberado.

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
