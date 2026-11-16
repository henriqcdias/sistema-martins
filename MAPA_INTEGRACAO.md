# Mapa de integração: manual funcional × situação real do código

Levantamento de 16/11/2026, feito sobre a branch `release/producao-v5`, o banco de produção (`kkjwmnxgcbonbwavaaya`, só leitura) e o banco QA (`oczxyiakpmgnrpoyhwov`). Responde à seção 31 do *Manual de funções, lançamentos e integração entre módulos*.

## Conclusão em uma frase

**Quase todas as telas do manual já existem, mas só 6 módulos gravam no servidor.** O restante grava no `localStorage` do navegador de quem lançou, e por isso os dados não são compartilhados entre usuários nem entre aparelhos.

## Como o sistema persiste dados hoje

| Camada | O que tem | Observação |
|---|---|---|
| Frontend (`app-martins.min.js` + `index.html`) | Telas de praticamente todos os módulos do manual | Cerca de **350 chaves de `localStorage`**, com vários cadastros duplicados em versões (`cm_centros_custo_*`: 6 chaves; `cm_contas_bancarias_*`: 5; `cm_colaboradores_*`: 6; `cm_lancamentos_financeiros_*`: 4) |
| Contratos v1 no servidor (`martins_producao_*`) | `funcionarios`, `obras`, `planejamento`, `rdos`, `frequencia`, `orcamentos` | Em produção e no QA. Têm permissão por empresa, idempotência, controle de revisão, auditoria e limite de 8h |
| Contratos v2 (este repositório, `supabase/v2/`) | Cadastros (clientes, fornecedores, vendedores, motoristas, veículos, produtos, depósitos, centros de custo, contas bancárias) e **despesas com confidencialidade** | Proposta testada localmente, **ainda não aplicada** em nenhum banco |
| `martins_hml_v1` (só no QA) | Financeiro por usuário (pendente de conferência, conferência pelo Master, compartilhamento, acesso por conta), classificação de despesas e NF-e | Usa outro modelo de acesso (`membros`) e não existe em produção. As regras de financeiro foram aproveitadas na v2 |

Legenda: ✅ grava no servidor · 🟦 contrato v2 pronto (falta aplicar e ligar a tela) · 🟡 tela existe, grava só no navegador · 🔴 regra ausente.

## 2. Cadastros principais

| Informação | Situação | Observação |
|---|---|---|
| Empresas | ✅ | `martins_empresas` (3 em produção) |
| Usuários e vínculos | ✅ | Supabase Auth + `martins_perfis` + `martins_online_acessos` |
| Perfis e permissões | ✅ parcial | `martins_producao_v1.permissoes` por empresa × módulo × (ler, criar, editar). Faltam excluir, aprovar, exportar e compartilhar, e o nível "setor" |
| Funcionários | ✅ | CPF único por empresa |
| Motoristas | 🟦 | v2: vínculo com funcionário (sem duplicar a pessoa), CNH, categoria e validade |
| Vendedores | 🟦 | v2: vínculo opcional com funcionário, sem conceder permissão administrativa |
| Clientes | 🟦 | v2: CPF/CNPJ único por empresa |
| Fornecedores | 🟦 | v2: CPF/CNPJ único por empresa |
| Obras | ✅ | Código único por empresa; campos financeiros só para o Master |
| Centros de custo | 🟦 | v2: código único, tipo obra/administrativo, vínculo com obra e inativação |
| Depósitos | 🟦 | v2: nome único, um único principal por empresa, inativação (sem exclusão) |
| Produtos e materiais | 🟦 | v2: código único por empresa |
| Perfis, componentes e vidros (esquadrias) | 🟡 | Tela existe |
| Bobinas | 🟡 | Tela existe (`cm_bobinas_chapas_calhas_v16`) |
| Veículos | 🟦 | v2: placa única por empresa |
| Contas bancárias | 🟦 | v2 |

**Regra "funcionário, motorista e vendedor são a mesma pessoa":** na v2, motorista e vendedor referenciam `funcionario_id`, e o banco impede dois motoristas (ou dois vendedores) para o mesmo funcionário na mesma empresa.

## 3 a 9. Configurações, RH, Obras, RDO e Medições

| Item | Situação | Observação |
|---|---|---|
| Permissões validadas no backend | ✅ v1 / 🟦 v2 | Para os módulos com contrato. Os demais decidem no navegador |
| Auditoria | ✅ | `martins_producao_v1.auditoria` guarda antes e depois de toda gravação |
| Frequência (8h entre obras, sem falta automática, situações) | ✅ | O servidor recusa mais de 8h normais por pessoa e dia, somando as obras |
| RDO (data não futura, equipe, 8h) | ✅ | Número sequencial por obra |
| Folha, vales (limite de 40%), EPI, advertências, documentos | 🟡 | Telas existem. O limite de 40% está só no navegador (`cm_vales_*`) |
| Gestão de Obras (9 abas), BDI, avanço ponderado | 🟡 | Telas existem; só o cadastro da obra é ✅ |
| Medições, glosas, revisões | 🟡 | |
| Consumo no RDO gera baixa de estoque | 🔴 | Hoje é só local (`cm_chaves_baixa_estoque_rdo`) e depende de contratos de estoque |

## 10 a 18. Comercial, Compras, Estoque e Produção

| Item | Situação |
|---|---|
| Orçamentos | ✅ (itens, totais calculados no servidor, vínculo com obra) |
| Conversão orçamento → pedido; Pedidos Convertidos | 🟡 |
| Compras (solicitação → pedido → recebimento → obrigação) | 🟡 (as tabelas-base de compras em produção estão vazias e não estão ligadas) |
| Estoque: movimentos, transferências, reservas, saldo | 🟡 (`martins_movimentos_estoque` existe em produção, vazia e sem contrato de gravação) |
| Produção: telhas, calhas e rufos, slitter, esquadrias, retalhos ≥ 600 mm | 🟡 |

## 19 a 24. Financeiro, Fiscal e Frota

| Item | Situação | Observação |
|---|---|---|
| Despesas com centro de custo escolhido de lista | 🟦 | v2: `centro_custo_id` precisa existir e estar ativo na empresa; não aceita texto livre |
| Despesa de obra × administrativa | 🟦 | v2: `classificacao = obra` exige `obra_id`; `administrativa` não |
| **Despesas confidenciais** | 🟦 | v2: só o Master marca ou desmarca. Não aparecem para não Masters em listagem, consulta por id nem catálogo. Os totais contabilizam o valor sem revelar detalhes |
| Lançador Financeiro → "pendente de conferência" | 🟦 | v2: o estado é sempre definido pelo servidor; quem não é Master só cria e edita enquanto pendente |
| Obrigação → aprovação → pagamento → confirmação → conciliação | 🟦 parcial | v2: transições de estado só pelo Master e só na ordem permitida. Extrato OFX e conciliação continuam 🟡 |
| Contas a receber, medição → recebível | 🟡 | |
| Orçamento por obra (alertas de 80% e 100%) | 🟡 | |
| NF-e (XML) sem duplicidade | 🟡 em produção; existe em `martins_hml_v1` (só QA) | |
| Frota: abastecimentos, consumo médio | 🟡 | |

## 25 a 27. Dashboard, relatórios, auditoria e documentos

| Item | Situação |
|---|---|
| Dashboard e relatórios com dados reais | 🟡 Leem do `localStorage`. Só ficam reais quando os módulos gravarem no servidor |
| Visualização de PDF antes de imprimir | 🟡 Não verificado em navegador nesta rodada |
| Documentos privados sem link público | 🟡 Não há Storage configurado nos contratos v1/v2 |

## Ordem recomendada

1. **Aplicar a v2 no QA** (`supabase/v2/`), depois da revisão, e ligar as telas de cadastro e de despesas às funções `martins_producao_*`, no mesmo padrão do `formularios.js`.
2. Estoque (movimentos, transferências, saldo) com uma movimentação por evento de negócio.
3. Compras → estoque → contas a pagar, sem duplicar com o XML.
4. Produção (ordens; consumo e entrada só na confirmação).
5. Folha e vales no servidor (limite de 40%).
6. Unificar os modelos de permissão (`martins_perfis.papel` × `martins_online_acessos`) e acrescentar excluir, aprovar, exportar e compartilhar.
