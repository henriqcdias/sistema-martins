# Homologação — Orçamento, Venda e Obra

Data: 05/11/2026. Ambiente privado de homologação, com dados fictícios e comunicação remota desativada. Site oficial e dados definitivos não alterados.

## Implementado
- Conferência antes de confirmar venda, com criar pré-cadastro, vincular obra existente ou venda sem obra.
- Pré-cadastro em Planejamento com cliente, valor e origem; responsável e datas ficam a completar.
- Vínculo com obra existente preserva contrato, cronograma, medições e demais campos; não soma automaticamente contratos.
- Histórico comercial preserva vínculo quando muda a situação. Confirmação repetida reutiliza vínculo; alterações comerciais posteriores exigem revisão.
- Acesso direto da venda para a Gestão da Obra. Novas obras aparecem nos seletores existentes.
- Proteção contra orçamento alterado durante conferência, nomes duplicados e totais inconsistentes.
- Gravação recuperável de orçamento e obra, com backup anterior e recuperação explícita no fluxo existente. Uma recuperação pendente também bloqueia novas gravações de RDO nas bases protegidas até ser resolvida.
- Permissões locais de vendas verificadas na confirmação. Não representam autenticação de servidor.

## Testado
- 48 testes automatizados passaram: 30 regressões existentes e 18 casos novos de vendas/obras e persistência.
- Casos novos incluem criação, vínculo, balcão, preservação das fontes, idempotência, concorrência, totais inválidos, nomes reservados/duplicados, reativação, permissões, gravação conjunta e falha simulada na segunda base com conclusão/reversão.
- Compilação de 33 scripts da aplicação e HTMLs, dependências locais e bloqueio de rede remota verificados.
- Navegador: formulário real de vendas em fixture descartável com armazenamento em memória; abrir, cancelar, confirmar, exibir vínculo, selecionar Gestão e confirmar novamente sem duplicar. Fixture removida da entrega.
- Aplicação completa abriu no navegador local; teste de ponta a ponta com login real não realizado.

## Pendências e limites
- Validação pelo usuário em Android físico: criar orçamento fictício, fechar venda, conferir a obra, repetir confirmação e testar as outras duas modalidades.
- Emissão fiscal, contas a receber, pagamento e baixa de estoque não estão nesta etapa.
- Supabase real e testes com dados definitivos não executados. Integração permanece desativada nesta homologação.
- Fluxo de recuperação é local, conservador e não equivale a transação de banco. Validar também capacidade e disponibilidade do armazenamento no celular.
- Funcionalidades anteriores e RDO original mantidos; não houve migração de registros legados.

## Arquivos
`dist/vendas_obras.js`, `dist/vendas_obras_ui.js`, atualizações nas duas páginas completas e persistência; `scripts/vendas-obras.test.cjs`; `scripts/RESULTADOS_VENDAS_OBRAS.txt`.

## Roteiro para celular
1. Vendas → criar orçamento de teste com cliente e item.
2. Fechar Venda → criar pré-cadastro → conferir nome/valor → confirmar.
3. Abrir Gestão da Obra → conferir cliente/contrato e completar cadastro.
4. Voltar à venda e confirmar novamente: deve manter a mesma obra.
5. Em outros orçamentos fictícios, testar vínculo com obra existente e venda de balcão.
