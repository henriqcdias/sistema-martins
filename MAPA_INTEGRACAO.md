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

## Inventário de formulários (atualizado em 16/11/2026)

Dos 52 formulários do sistema, nenhum formulário de **cadastro** grava mais só no navegador. A camada `cadastros-servidor.js` intercepta o envio antes do código legado e trava as funções legadas de cadastro (`Object.defineProperty`, resistente a redefinição).

| Situação | Formulários |
|---|---|
| ✅ Gravam no servidor diretamente (`formularios.js`) | funcionário (3 formulários), obra (3, incluindo o cadastro completo da Engenharia), RDO, orçamento |
| ✅ Redirecionados ao cadastro do servidor, já preenchidos | cliente (2), vendedor, motorista (2), veículo, produto (2), depósito, centro de custo (2), conta bancária (2), despesa (movimentação financeira de saída), feriado, preço de insumo, EPI |
| ⛔ Bloqueados de propósito | "Novo fiscal" (criava login com senha no navegador; contas são criadas no Supabase Auth), "Cadastrar empresa" (provisionada no banco) e movimentação financeira de **entrada** (contas a receber ainda sem contrato) |
| 🟡 Lançamentos operacionais ainda locais (próxima etapa, exigem contrato com regra de negócio) | movimentação de estoque (2), pedido de compra (2), cotação, NF-e, abastecimento/manutenção, transferência entre contas, distribuição de EPI, advertência, falta, ausência, férias, ajuste de ponto, recibo, documento da ficha, aditivo (2), etapa de cronograma, item de planilha, orçamento otimizado, permissões CREA |
| — Não se aplica | login, primeiro acesso, link compartilhado |

**Ainda falta nas telas antigas:** as listas e os seletores de Vendas, Estoque, Frota e Gestão de Centros de Custo continuam lendo as chaves locais (por exemplo, 7 chaves de centros de custo e 6 de contas bancárias). Os cadastros novos já vão para o servidor e aparecem em "Cadastros e Despesas", no Financeiro, nas obras e nas despesas. A próxima etapa é fazer essas listas lerem do servidor, tela por tela.

## Estoque no servidor (v4, 16/11/2026)

`supabase/v4`: movimentações **imutáveis**, uma por evento de negócio (entrada, saída, transferência e estorno), com o **saldo derivado** no servidor (quantidades em milésimos inteiros). Regras garantidas no banco: saldo nunca negativo (trava por produto contra baixas simultâneas), reenvio da mesma operação não repete o efeito, estorno só uma vez e nunca de estorno, depósito e produto só da própria empresa (transferência entre empresas é impossível), e gravação de movimento só pela função própria (nem o Master forja saldo pelo contrato genérico). Interface: aba **Estoque** em "Cadastros e Despesas"; os formulários antigos de movimentação redirecionam para ela. **Ainda não ligados:** consumo do RDO, requisição de obra, compras/recebimento, reservas, custo médio, devolução com referência a obra e produção (consomem estoque, mas dependem de seus próprios contratos).

## Compras no servidor (v5, 16/11/2026)

`supabase/v5`: **pedido → aprovação (Master) → recebimento**. O recebimento é um único evento atômico: dá entrada no estoque (v4), gera a obrigação "pendente de conferência" no Financeiro (nada é pago automaticamente) e atualiza o pedido (recebido em parte / recebido). **A mesma nota fiscal não entra duas vezes**, nem por chave de acesso (44 dígitos) nem por fornecedor + número, mesmo vindo de outro pedido. Pedido aprovado não é editado; cancelamento só sem recebimentos; quantidade recebida nunca passa do saldo do pedido. Interface: aba Compras em "Cadastros e Despesas"; os formulários antigos de pedido de compra redirecionam para ela, e o de NF-e é bloqueado. **Ainda local:** cotações/propostas, solicitação de materiais da obra, importação de XML, devolução ao fornecedor e estorno de recebimento.

## Consumo de materiais na obra (v6, 16/11/2026)

`supabase/v6`: consumo de material por **obra**, opcionalmente por **RDO**, com baixa única no estoque. O RDO guarda os materiais como texto livre, por isso o consumo é um evento explícito (obra, RDO, depósito, material e quantidade) na aba Estoque. Regras no banco: um material só é baixado **uma vez por RDO**; consumo nunca passa do saldo e um lote com item sem saldo é recusado inteiro; RDO precisa ser da obra; correção por **devolução** limitada ao consumido (o estorno de consumo é bloqueado); consulta do consumo líquido por obra (`martins_producao_obra_materiais`). **Ainda faltam:** requisição de materiais da obra (solicitar → entregar), vínculo do texto do RDO com os itens e custo apropriado à obra (Gastos).

## Frota, ausências/férias e cotações (v7, 16/11/2026)

`supabase/v7`: três módulos que ainda gravavam só no navegador passam a ser cadastros do servidor (Cadastros e Despesas). Os formulários antigos são interceptados e abrem o cadastro do servidor já preenchido; `submeterAbastecimentoFrotaUi` fica bloqueada.

- **Frota (`frota_eventos`)**: abastecimento e manutenção por veículo. Litros em milésimos, valor em centavos, data não pode ser futura, motorista e obra precisam ser da empresa; o mesmo abastecimento (veículo + data + km) não entra duas vezes.
- **Ausências e férias (`ausencias`)**: falta, atestado, folga e férias. O servidor calcula os dias e **recusa período que coincide com outra ausência do mesmo funcionário**. Sem data final vale um dia.
- **Propostas de cotação (`cotacoes`)**: fornecedor cadastrado ou só o nome, subtotal, frete e desconto; o **total é calculado no servidor** e o desconto não passa do valor.
- **Vendas:** orçamentos já estavam no servidor (v1). **Contas a receber / pedidos de venda ainda não.**
- **Limite conhecido:** a proposta de cotação ainda não se liga à requisição de cotação, que continua local; por isso leva uma "referência" digitada.

## Requisição de materiais da obra (v8, 16/11/2026)

`supabase/v8`: fluxo **solicitar → aprovar → entregar**, na aba "Requisições de material" de Cadastros e Despesas.

- **Solicitar** (`requisicoes_material`): obra, depósito de origem, RDO opcional, data necessária e itens. Número sequencial, estado e "entregue" são definidos pelo servidor. Só se edita enquanto "solicitada".
- **Aprovar ou recusar:** exclusivo do Master, com motivo. **Cancelar:** quem edita requisições, enquanto nada foi entregue.
- **Entregar** (`martins_producao_req_entregar`): evento atômico. Baixa o estoque do depósito como **consumo da obra** (o mesmo da v6, ligado à requisição) e atualiza a requisição. Entrega parcial permitida; nunca passa do pendente nem do saldo; lote com item sem saldo é recusado inteiro; reenvio é idempotente.
- **Integração:** a entrega aparece no consumo líquido da obra e a sobra volta pela devolução da v6. Se a requisição tem RDO, não baixa o material já baixado naquele RDO.
- **Ainda falta:** vínculo do texto livre do RDO com os itens, custo do material apropriado à obra (Gastos) e solicitação pelo celular do mestre de obras (hoje exige permissão de requisição).

## Usuários e permissões (v9, 16/11/2026)

`supabase/v9`: aba "Usuários e permissões" em Cadastros e Despesas, **visível e permitida somente ao Master** (o servidor confere; esconder a aba é só conveniência).

- **Listar** quem tem vínculo com a empresa (nome, e-mail, papel, situação, quantos módulos).
- **Permissões por módulo** (ver / criar / editar) para os 26 módulos, salvas de uma vez, com trilha de auditoria (antes e depois). Criar e editar exigem ver. **Modelos** (Almoxarife, Engenharia, RH, Comercial, Lançador financeiro, Compras, Somente leitura) apenas preenchem a tela; o Master confere e salva.
- **Desativar e reativar** o acesso. O Master não altera o próprio acesso.
- **Vincular uma conta já criada** no Supabase Auth pelo e-mail. A conta (e a senha) continua sendo criada no painel do Supabase; o vínculo nasce **operacional e sem permissão nenhuma**. **Não existe tela nem função que crie ou promova Master** (decisão do banco, como no briefing).
- **Atenção ao evoluir:** a lista de módulos de `martins_producao_permissoes_definir` e do editor da tela precisa acompanhar cada módulo novo.
- **Produção:** esta migração mexe em quem acessa a empresa; só vai para o banco de produção com autorização do Henrique.

## Importação do XML da NF-e no recebimento (16/11/2026)

Sem mudança no banco. Em **Compras → Receber**, o botão de arquivo lê o XML da NF-e **no próprio navegador** (nada vai a terceiros) e **só preenche** o formulário: número da nota (sem zeros à esquerda), chave de acesso (44 dígitos) e a quantidade dos itens que casam com o pedido **pelo código do produto**. Itens sem correspondência ficam de fora e a tela avisa; se o CNPJ/CPF do emitente não é o do fornecedor do pedido, aparece um alerta. XML com DOCTYPE/ENTITY, arquivo que não é NF-e e arquivo grande demais são recusados. Quem grava e impede a nota duplicada continua sendo o servidor (v5).

Ainda não faz: casar item por descrição, criar produto ou fornecedor a partir do XML, ler preços/impostos, nem importar NF de venda.

## Contas a receber (v10, 16/11/2026)

`supabase/v10`: módulo `contas_receber` (Vendas) na aba "Contas a receber". Fecha o módulo de Vendas: orçamentos (v1) → título a receber → recebimentos.

- **Título:** cliente cadastrado (ou só o nome), descrição, valor, vencimento, obra, orçamento e nº do documento. Só se edita enquanto "aberta" e sem recebimento. **Estado, valor recebido e baixas são do servidor.**
- **Recebimento parcial ou total:** valor, data (não futura) e conta bancária opcional. Nunca passa do saldo. Estados: aberta → recebida em parte → recebida.
- **Cancelar:** só título aberto e sem recebimento, com motivo.
- **Estornar recebimento:** exclusivo do Master, com motivo; a baixa **não é apagada**, fica marcada como estornada, e o título volta a "parcial" ou "aberta".
- **Resumo no servidor:** a receber, vencido, nº de títulos abertos e recebido no mês (ignora estornos).
- **Formulário antigo do financeiro:** lançar uma ENTRADA abre o cadastro de contas a receber já preenchido.
- **Também corrigido:** a data "hoje" sugerida nas telas usava UTC e, à noite no Brasil, virava "amanhã" (o servidor recusaria como data futura). Agora usa a data local.
- **A v10 ampliou a lista de módulos de `martins_producao_permissoes_definir` (v9).** O validador v10 garante que a tela de permissões aceita todos os módulos do contexto.
- **Ainda falta:** conciliação bancária (extratos), emissão de boleto/NF, previsão de recebimento por medição e relatório de inadimplência.
