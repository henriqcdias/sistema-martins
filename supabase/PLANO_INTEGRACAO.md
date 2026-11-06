# Integração incremental com o Supabase existente

Base informada pelo usuário em 05/11/2026: nove tabelas, RLS ativa e função martins_empresa_autorizada. Única mudança permanente já aplicada: martins_perfis.papel text. Não repetir essa alteração nem recriar a função.

## Estado do código analisado
A aplicação completa de homologação usa HTML/JavaScript puro com persistência local. O repositório desta homologação foi analisado; ainda não foi comprovado que o pacote atualmente servido pelo Netlify oficial corresponde a este commit. Não houve alteração no Netlify.

Há adaptadores antigos em integracao_rdo_remoto_ui.js e custos_obras.html que dependem de martins_rh_admin, martins_funcionarios, martins_obras, martins_rdos_integrados e RPCs de custos/RDO não confirmados no banco descrito. Um arquivo antigo contém URL/chave pública; essa configuração não foi presumida como atual nem copiada para o novo conector.

## Etapa preparada nesta versão
- Acesso no menu a supabase_conexao.html, dentro do mesmo pacote completo.
- Configuração explícita Project URL + Publishable Key, sem conexão no carregamento e sem chave secreta.
- Auth por API HTTP oficial, confirmação de identidade pelo endpoint /auth/v1/user, leitura do próprio perfil e autorização pela função existente.
- Sessão somente em memória; senha e tokens não entram no backup nem no localStorage. A versão atual inclui renovação explícita em memória, com confirmação da identidade e perfis no servidor; ao recarregar é necessário novo login.
- Diagnóstico das nove tabelas com LIMIT 0. Não carrega linhas de negócio, não altera esquema e não envia dados locais.
- Configuração opcional de build para HTML puro por scripts/configurar-supabase-publico.cjs.

## O que falta para conexão real
1. Confirmar a Project URL e a Publishable Key atuais pelo painel do Supabase. Podem ser preenchidas diretamente na nova tela; não enviar senha ou chave secreta por conversa.
2. Rodar consultas/01_inventario_somente_leitura.sql no SQL Editor e guardar o JSON de estrutura. O script abre transação READ ONLY e termina com ROLLBACK; não repete ALTER TABLE. Não retorna registros de negócio, usuários ou senhas.
3. Comparar as colunas/constraints/políticas retornadas com os adaptadores antes de preparar DDL. Não basta saber os nomes das tabelas para reaproveitar unidades, movimentos e notas sem duplicação.
4. Testar login real com um usuário de homologação, depois o perfil administrador e a função existente. O banco informado pode conter dados reais: esta etapa só consulta perfil/autorização e acesso à tabela sem linhas.

## Mapa de reaproveitamento (nenhuma importação automática)
| Fonte local / módulo | Estrutura remota a reaproveitar ou conferir | Condição antes de gravar |
|---|---|---|
| Catálogo de materiais | martins_produtos, martins_unidades, martins_precos_compra | Conferir unidades/fatores, campos monetários, UUID e empresa_id; não criar outro catálogo |
| Depósitos locais | martins_depositos | Conferir campos existentes e mapear IDs locais para UUID; sem redistribuir saldo |
| Histórico de materiais | martins_movimentos_estoque | Conferir entradas/saídas/transferências e regras transacionais; não importar o total como uma nova entrada |
| Notas de compra | martins_notas_compra | Conferir identificadores únicos e relacionamentos com preços/movimentos; impedir importação duplicada |
| Empresas e perfis | martins_empresas, martins_perfis | Usar empresa_id e usuário Auth; não promover usuários ou criar administrador automaticamente |
| Auditoria | martins_auditoria | Conferir colunas, autoria e escrita pelo servidor antes de integrar logs |
| Obras, Planejamento, Frequência e RDO | Conferir se já existem; adaptador atual espera martins_obras, martins_funcionarios e martins_rdos_integrados | Definir uma única estrutura canônica e preservar revisão/idempotência; não criar uma segunda tabela de RDO concorrente |
| Financeiro, clientes, veículos e RH | Conferir tabelas existentes no inventário completo | Planejar chaves, histórico, valores em centavos e acesso a dados de RH antes de criar qualquer tabela |
| Documentos e fotos | Storage privado + metadados vinculados à empresa/obra/funcionário | Criar políticas de bucket e paths após confirmar o esquema; não expor documentos publicamente |

## Testes RLS necessários antes da sincronização
- Dois usuários de empresas distintas, um usuário sem perfil e um perfil inativo; testar consultas reais com os JWTs correspondentes.
- Cobrir SELECT/INSERT/UPDATE/DELETE conforme permissões esperadas, incluindo empresa_id trocado e referências cruzadas entre empresas.
- Escrever somente em tabelas/ambiente de testes com descarte controlado; não usar linhas reais para provar bloqueio.
- Não tratar retorno vazio/HTTP 200 com LIMIT 0 como prova de RLS, nem a função booleana como homologação de todas as políticas.
- Nenhuma sincronização entra em produção antes de prova de isolamento, tratamento de conflito, backup e aprovação da migração.

## Publicação de homologação em Netlify, quando autorizada
Esta versão não mudou variáveis, comandos de build ou arquivos do site oficial.
Para um site separado, o pacote pode usar configuração manual pela tela. Se houver build com Node, as variáveis públicas esperadas pelo gerador são SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY; o comando é node scripts/configurar-supabase-publico.cjs e a pasta estática é dist. Em HTML puro, criar uma variável no painel sem gerar o arquivo público não injeta o valor no navegador. Não usar variáveis VITE_ para este código que não usa Vite.
O gerador só escreve dist/supabase.config.js, contendo URL e chave pública, e não exporta outras variáveis do ambiente. Configuração inválida interrompe o build. O arquivo já versionado começa vazio e não conecta automaticamente.

## Referências primárias consultadas
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api
- https://supabase.com/docs/reference/self-hosting-auth

## Limite desta entrega
Conector de autenticação/diagnóstico pronto para ser configurado, com testes simulados. Nenhuma conexão real, tabela adicional, política, bucket, migração ou sincronização de módulos foi executada nesta etapa. O inventário real é a dependência para o próximo DDL, evitando duplicar estruturas.


## Atualização de desenvolvimento — segurança isolada
Os commits a partir de 75f406987e17 acrescentam o contrato separado em homologacao/README.md: RLS, permissões, RPC com revisão/idempotência e Storage privado. Há conector e tela opt-in para dados sintéticos deste schema. Financeiro/Remuneração/Vales não aceitam escrita pelo comando genérico. Nenhum script foi aplicado ao projeto remoto; a dependência de inventário e homologação real permanece.

Testes PostgreSQL reais no PGlite verificam políticas com roles/claims sintéticas. Testes de navegador usam PostgreSQL local e serviços Auth/PostgREST/Storage simulados; não são evidência de isolamento ou login no projeto Supabase remoto. Ver VERIFICACAO_DOCUMENTOS_HML.md e o relatório mais recente desta execução.
