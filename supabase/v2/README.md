# Contratos v2: cadastros, centros de custo e despesas confidenciais

A v2 é uma extensão **aditiva** dos contratos de produção (`supabase/producao/`). Não remove nem altera registros. Ela implementa no banco as regras do *Manual de funções e integração* (seções 2, 3, 10, 11, 12, 19 e 24) e do briefing de 15/11/2026 (seção 4).

**Situação:** testada localmente (53 de 53 verificações). **Ainda não foi aplicada em nenhum banco.** Aplicar primeiro no QA; em produção, só com autorização.

## O que muda

| Módulo (`modulo`) | Regras garantidas pelo banco |
|---|---|
| `clientes`, `fornecedores` | Nome obrigatório; CPF/CNPJ normalizado (11 ou 14 dígitos) e único por empresa |
| `vendedores`, `motoristas` | Vínculo opcional com `funcionario_id` da mesma empresa; **um por funcionário**, para não duplicar a pessoa; não aceitam campos de permissão. Motorista: categoria e validade da CNH |
| `veiculos` | Placa normalizada (antiga ou Mercosul) e única por empresa |
| `produtos` | Descrição obrigatória; código único por empresa |
| `depositos` | Nome único por empresa; **um único principal**, que não pode ser inativado. Sem exclusão (inativar com `ativo: false`) |
| `centros_custo` | Código único; `tipo` obra (exige `obra_id` da empresa) ou administrativo |
| `contas_bancarias` | Nome obrigatório |
| `despesas` | Ver abaixo |

### Despesas

- **Centro de custo selecionado de cadastro** (`centro_custo_id` existente e ativo na empresa). Texto livre é recusado.
- `classificacao`: `obra` exige `obra_id`, e o centro de uma obra só serve àquela obra; `administrativa` não se vincula a obra.
- Valor em centavos inteiros (`valor_centavos`), `competencia` obrigatória, `vencimento` opcional.
- **Estado definido pelo servidor:** toda despesa nasce `pendente_conferencia`, mesmo que o payload diga outra coisa. Só o Master muda o estado, por `martins_producao_despesa_estado`, na ordem `pendente_conferencia → aprovado → pago → confirmado → conciliado` (ou `cancelado` nas duas primeiras etapas). A operação é idempotente.
- Quem não é Master cria e edita **só as próprias** despesas e **só enquanto pendentes**. Depois da aprovação, o conteúdo financeiro fica congelado.
- **Confidencial:** só o Master marca ou desmarca. A despesa confidencial **não aparece para quem não é Master**: nem na listagem, nem na consulta por id, nem nos catálogos (vale também para o administrador com leitura integral e para outras empresas). Quem não é Master também não consegue sobrescrevê-la.
- `martins_producao_despesas_totais(empresa, de, ate)`, disponível para Master e leitura integral: o total geral inclui as confidenciais. Para quem não é Master, elas aparecem em uma única linha agregada (`confidenciais_centavos`), fora dos centros de custo.

### Funções alteradas

`pode`, `martins_producao_contexto`, `martins_producao_consultar`, `martins_producao_salvar` e `martins_producao_catalogos` são **copiadas literalmente da produção** por `gerar_migracao.py`, com alterações pontuais e conferidas. O frontend continua chamando as mesmas funções; os catálogos ganham as listas `centros_custo`, `fornecedores`, `contas_bancarias`, `depositos`, `clientes` e `vendedores`.

## Arquivos

| Arquivo | Uso |
|---|---|
| `parte_nova.sql` | Objetos novos (fonte, editável) |
| `gerar_migracao.py` | Gera a migração e a reversão: `python3 supabase/v2/gerar_migracao.py` |
| `migrations/20261116120000_…sql` | Migração gerada, que é o arquivo a aplicar. Não edite à mão |
| `reverter_v2.sql` | Volta as 5 funções às versões de produção e remove a v2. **É bloqueado se já existirem dados v2** |
| `validar-v2.cjs` | Testes num Postgres descartável: `npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v2/validar-v2.cjs .` |

## Para aplicar no QA

No SQL Editor do projeto **QA**, rode o arquivo de `migrations/`. Depois, para dar acesso a um Lançador Financeiro:

```sql
insert into martins_producao_v1.permissoes (usuario_id, empresa_id, modulo, ler, criar, editar)
values ('<uid do usuário>', '<empresa>', 'despesas', true, true, true);
```

## O que ainda falta

- **Ligar as telas** de cadastro e de despesas a essas funções, no padrão do `formularios.js`. Hoje elas gravam no `localStorage`.
- Compartilhamento de despesa com usuários específicos (existe em `martins_hml_v1`, só no QA).
- Anexos e comprovantes (Storage com acesso controlado).
