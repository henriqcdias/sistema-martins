# Auditoria da importação inicial no GitHub

Destino autorizado: repositório privado henriqcdias/sistema-martins, branch desenvolvimento.
Referência remota verificada: main em 175b5de896f30a05218624fdec086456b9aa58e2, contendo somente README.md.
Fonte de origem: versão mais recente da homologação eaf5cce951d3cb365e1ee94dfadd2103c7cfebf5, acrescida das verificações de preparação locais.

## Saneamento
- Removidas senhas padrão da conta demonstrativa, de inputs HTML e de instruções de acesso.
- Primeiro acesso local passa a receber senha escolhida no navegador, sem segredo no código.
- Removidas referências nominais de pessoas de telas, comentários e fallbacks. Atribuições/licenças de bibliotecas públicas foram preservadas.
- Retirada a lista de nomes de usuário da expressão de reconhecimento de administrador; o perfil explícito é mantido.
- Removida configuração pública Supabase embutida da página antiga de custos. URL/chave são lidas de configuração vazia.
- Removido endpoint pré-preenchido de exemplo de sincronização.
- index.html alinhado ao arquivo principal atual, incluindo melhorias que antes estavam apenas na outra entrada.
- Nenhum banco, cadastro ou arquivo do navegador foi importado.

## Credenciais e rotação
Não foram identificadas chaves secretas reais de Supabase, tokens GitHub, chaves privadas ou credenciais AWS no snapshot saneado, pelas regras aplicadas e revisão dirigida. Foram encontradas credenciais padrão de demonstração no material antigo; elas não foram incluídas nesta importação.

As senhas padrão antigas devem ser substituídas nos ambientes em que estavam em uso, especialmente se reutilizadas em contas reais. Não houve acesso nem alteração dessas contas. A importação da fonte não invalida senhas que já estejam guardadas em um navegador ou implantação anterior.

A chave publishable encontrada não é chave secreta e sua exposição, isoladamente, não indica necessidade de revogação. Ela foi retirada para não vincular o código a um projeto específico. Nenhuma chave foi revogada ou substituída no Supabase. Referência oficial: https://supabase.com/docs/guides/getting-started/api-keys

Fixtures de testes contêm identificadores e credenciais sintéticos, explicitamente usados em respostas simuladas; não autorizam acesso a serviços. Não representam dados de pessoas.

## Histórico e arquivos
O README existente foi preservado byte a byte. A árvore de origem inclui apenas arquivos atuais saneados, não o diretório .git nem o histórico antigo da hospedagem. O commit da importação deve ser filho da referência remota existente, sem force push.
.openai, .env, chaves, backups, bancos locais e artefatos particulares são excluídos. .gitignore mantém dist, testes e documentação versionáveis.

## Validação
369 testes automatizados aprovados (364 anteriores e 5 novos de primeiro acesso e consistência das entradas).
60 scripts compilados. Auditoria de publicação sem achados de credenciais nos arquivos de aplicação/documentação examinados. Busca complementar de e-mails, CPF/CNPJ, URLs de projeto e chaves verificou somente fixtures sintéticas fora dos exemplos nulos.
O novo primeiro acesso e o saneamento não foram conferidos funcionalmente em celular físico. Autenticação local continua demonstrativa; não se declara segurança de produção, RLS ou sincronização homologadas.

A obtenção de package-lock foi tentada apenas no cache local e não havia metadados disponíveis. Não foi criado lock fictício. Dependências principais estão fixadas, e o README de desenvolvimento instrui npm install antes dos testes.

Netlify oficial, dados definitivos do Supabase, main e público de acesso da homologação não foram alterados.
