// Cadastros e Despesas no servidor (contratos v2).
// Local único de cadastro para clientes, fornecedores, vendedores, motoristas, veículos,
// produtos, depósitos, centros de custo, contas bancárias e despesas — como pede o Manual
// de integração (seção 2). Toda regra de negócio é validada no banco; esta tela só coleta,
// envia e relê. Nenhum texto do servidor é inserido como HTML.
(function () {
  'use strict';
  const W = window, D = document;
  const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

  // ---------- Definição dos módulos (campos e rótulos) ----------
  const CNH = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'];
  const MODULOS = {
    clientes: { titulo: 'Clientes', colunas: ['nome', 'documento', 'telefone', 'cidade'], campos: [
      ['nome', 'Nome ou razão social', 'texto', { obrigatorio: true }], ['documento', 'CPF/CNPJ', 'texto'],
      ['telefone', 'Telefone', 'texto'], ['email', 'E-mail', 'email'], ['cidade', 'Cidade', 'texto'], ['observacao', 'Observação', 'area']] },
    fornecedores: { titulo: 'Fornecedores', colunas: ['nome', 'documento', 'telefone'], campos: [
      ['nome', 'Nome ou razão social', 'texto', { obrigatorio: true }], ['documento', 'CPF/CNPJ', 'texto'],
      ['telefone', 'Telefone', 'texto'], ['email', 'E-mail', 'email'], ['observacao', 'Observação', 'area']] },
    vendedores: { titulo: 'Vendedores', colunas: ['nome', 'funcionario_id', 'comissao_pct'], campos: [
      ['funcionario_id', 'Funcionário vinculado (recomendado)', 'ref', { catalogo: 'funcionarios', vazio: 'Sem vínculo (vendedor externo)' }],
      ['nome', 'Nome (se não for funcionário)', 'texto'], ['telefone', 'Telefone', 'texto'], ['comissao_pct', 'Comissão (%)', 'numero']] },
    motoristas: { titulo: 'Motoristas', colunas: ['nome', 'funcionario_id', 'cnh_categoria', 'cnh_validade'], campos: [
      ['funcionario_id', 'Funcionário vinculado (recomendado)', 'ref', { catalogo: 'funcionarios', vazio: 'Sem vínculo (motorista externo)' }],
      ['nome', 'Nome (se não for funcionário)', 'texto'], ['cnh_numero', 'Número da CNH', 'texto'],
      ['cnh_categoria', 'Categoria', 'opcoes', { opcoes: CNH.map(c => [c, c]) }], ['cnh_validade', 'Validade da CNH', 'data']] },
    veiculos: { titulo: 'Veículos', colunas: ['placa', 'modelo', 'tipo', 'combustivel'], campos: [
      ['placa', 'Placa', 'texto', { obrigatorio: true }], ['modelo', 'Modelo', 'texto'], ['tipo', 'Tipo', 'texto'],
      ['combustivel', 'Combustível', 'opcoes', { opcoes: [['diesel', 'Diesel'], ['gasolina', 'Gasolina'], ['etanol', 'Etanol'], ['flex', 'Flex']] }],
      ['motorista_id', 'Motorista habitual', 'ref', { catalogo: 'motoristas', vazio: 'Nenhum' }]] },
    produtos: { titulo: 'Produtos e materiais', colunas: ['codigo', 'descricao', 'unidade', 'categoria'], campos: [
      ['codigo', 'Código (SKU)', 'texto'], ['descricao', 'Descrição', 'texto', { obrigatorio: true }],
      ['unidade', 'Unidade', 'opcoes', { opcoes: [['UN', 'Unidade'], ['KG', 'Quilo'], ['M', 'Metro'], ['M2', 'Metro²'], ['M3', 'Metro³'], ['L', 'Litro'], ['CX', 'Caixa'], ['BR', 'Barra']] }],
      ['categoria', 'Categoria', 'texto'], ['observacao', 'Características técnicas', 'area']] },
    depositos: { titulo: 'Depósitos', colunas: ['nome', 'principal', 'localizacao'], campos: [
      ['nome', 'Nome', 'texto', { obrigatorio: true }], ['localizacao', 'Localização', 'texto'],
      ['responsavel_id', 'Responsável', 'ref', { catalogo: 'funcionarios', vazio: 'Não definido' }], ['principal', 'Depósito principal da empresa', 'sim']] },
    centros_custo: { titulo: 'Centros de custo', colunas: ['codigo', 'nome', 'tipo', 'obra_id'], campos: [
      ['codigo', 'Código', 'texto', { obrigatorio: true }], ['nome', 'Nome', 'texto', { obrigatorio: true }],
      ['tipo', 'Tipo', 'opcoes', { opcoes: [['administrativo', 'Administrativo da empresa'], ['obra', 'Gasto de obra']], obrigatorio: true }],
      ['obra_id', 'Obra (só para tipo obra)', 'ref', { catalogo: 'obras', vazio: 'Nenhuma' }], ['descricao', 'Descrição', 'area']] },
    contas_bancarias: { titulo: 'Contas bancárias', colunas: ['nome', 'banco', 'agencia', 'conta'], campos: [
      ['nome', 'Apelido da conta', 'texto', { obrigatorio: true }], ['banco', 'Banco', 'texto'], ['agencia', 'Agência', 'texto'],
      ['conta', 'Conta', 'texto'], ['tipo', 'Tipo', 'opcoes', { opcoes: [['corrente', 'Corrente'], ['poupanca', 'Poupança'], ['pagamento', 'Pagamento']] }]] },
    despesas: { titulo: 'Despesas', colunas: ['competencia', 'descricao', 'valor_centavos', 'centro_custo_id', 'estado'], semAtivo: true, campos: [
      ['descricao', 'Descrição', 'texto', { obrigatorio: true }], ['valor_centavos', 'Valor (R$)', 'dinheiro', { obrigatorio: true }],
      ['competencia', 'Competência', 'data', { obrigatorio: true }], ['vencimento', 'Vencimento', 'data'],
      ['classificacao', 'Classificação', 'opcoes', { opcoes: [['administrativa', 'Gasto administrativo da empresa'], ['obra', 'Gasto de obra']], obrigatorio: true }],
      ['obra_id', 'Obra (só para gasto de obra)', 'ref', { catalogo: 'obras', vazio: 'Nenhuma' }],
      ['centro_custo_id', 'Centro de custo', 'ref', { catalogo: 'centros_custo', vazio: 'Selecione', obrigatorio: true }],
      ['fornecedor_id', 'Fornecedor ou beneficiário', 'ref', { catalogo: 'fornecedores', vazio: 'Não informado' }],
      ['conta_bancaria_id', 'Conta bancária', 'ref', { catalogo: 'contas_bancarias', vazio: 'Não informada' }],
      ['documento_numero', 'Nº do documento', 'texto'], ['observacao', 'Observação', 'area'],
      ['confidencial', 'Despesa confidencial — visível somente aos Masters', 'sim', { somenteMaster: true }]] },
    contas_receber: { titulo: 'Contas a receber', colunas: ['vencimento', 'cliente_id', 'descricao', 'valor_centavos', 'recebido_centavos', 'estado'], semAtivo: true, campos: [
      ['cliente_id', 'Cliente cadastrado', 'ref', { catalogo: 'clientes', vazio: 'Outro (informe o nome abaixo)' }], ['cliente_nome', 'Nome do cliente (se não cadastrado)', 'texto'],
      ['descricao', 'Descrição (ex.: Medição 1 - Obra X)', 'texto', { obrigatorio: true }], ['valor_centavos', 'Valor a receber (R$)', 'dinheiro', { obrigatorio: true }],
      ['vencimento', 'Vencimento', 'data', { obrigatorio: true }], ['competencia', 'Competência', 'data'],
      ['obra_id', 'Obra', 'ref', { catalogo: 'obras', vazio: 'Nenhuma' }], ['numero_documento', 'Nº do documento / nota', 'texto'], ['observacao', 'Observação', 'area']] },
    pedidos_venda: { titulo: 'Pedidos de venda', colunas: ['numero', 'orcamento_numero', 'data', 'cliente', 'total', 'estado'], semAtivo: true, somenteLeitura: true, campos: [
      ['numero', 'Pedido', 'texto'], ['orcamento_numero', 'Orçamento', 'texto'], ['data', 'Data', 'data'], ['cliente', 'Cliente', 'texto'], ['total', 'Total', 'texto'], ['estado', 'Situação', 'texto']] },
    feriados: { titulo: 'Feriados', colunas: ['data', 'nome', 'abrangencia'], campos: [
      ['data', 'Data', 'data', { obrigatorio: true }], ['nome', 'Descrição', 'texto', { obrigatorio: true }],
      ['abrangencia', 'Abrangência', 'opcoes', { opcoes: [['municipal', 'Municipal'], ['estadual', 'Estadual'], ['nacional', 'Nacional'], ['empresa', 'Recesso da empresa']] }]] },
    precos_insumo: { titulo: 'Preços de insumos', colunas: ['data', 'nome', 'unidade', 'preco_centavos'], campos: [
      ['nome', 'Produto / insumo', 'texto', { obrigatorio: true }], ['categoria', 'Categoria', 'texto'], ['unidade', 'Unidade', 'texto', { obrigatorio: true }],
      ['preco_centavos', 'Preço unitário pago (R$)', 'dinheiro', { obrigatorio: true }], ['data', 'Data da compra', 'data'],
      ['fornecedor_id', 'Fornecedor', 'ref', { catalogo: 'fornecedores', vazio: 'Não informado' }],
      ['centro_custo_id', 'Centro de custo', 'ref', { catalogo: 'centros_custo', vazio: 'Não informado' }],
      ['rendimento', 'Rendimento / custo por metro', 'texto'], ['observacao', 'Observação', 'area']] },
    estoque: { titulo: 'Estoque', colunas: [], campos: [] },
    compras: { titulo: 'Compras', colunas: [], campos: [] },
    requisicoes: { titulo: 'Requisições de material', colunas: [], campos: [] },
    usuarios: { titulo: 'Usuários e permissões', colunas: [], campos: [] },
    gastos_obra: { titulo: 'Gastos da obra', colunas: [], campos: [] },
    backup: { titulo: 'Backup e restauração', colunas: [], campos: [] },
    epis: { titulo: 'EPIs e uniformes', colunas: ['codigo', 'nome', 'tamanho', 'estoque_minimo'], campos: [
      ['nome', 'Descrição', 'texto', { obrigatorio: true }], ['codigo', 'Código de referência', 'texto'], ['categoria', 'Categoria', 'texto'],
      ['tamanho', 'Tamanho / numeração', 'texto'], ['preco_centavos', 'Preço unitário de custo (R$)', 'dinheiro'], ['estoque_minimo', 'Estoque mínimo para alerta', 'numero']] },
    frota_eventos: { titulo: 'Frota (abastecimentos e manutenções)', colunas: ['data', 'tipo', 'veiculo_id', 'litros_milli', 'valor_centavos'], campos: [
      ['tipo', 'Tipo', 'opcoes', { opcoes: [['abastecimento', 'Abastecimento'], ['manutencao', 'Manutenção']], obrigatorio: true }],
      ['veiculo_id', 'Veículo', 'ref', { catalogo: 'veiculos', vazio: 'Selecione', obrigatorio: true }], ['data', 'Data', 'data', { obrigatorio: true }],
      ['km', 'Quilometragem (odômetro)', 'numero'], ['litros', 'Litros (só abastecimento)', 'numero'], ['valor_centavos', 'Valor (R$)', 'dinheiro', { obrigatorio: true }],
      ['posto', 'Posto ou oficina', 'texto'], ['motorista_id', 'Motorista', 'ref', { catalogo: 'motoristas', vazio: 'Não informado' }],
      ['obra_id', 'Obra atendida', 'ref', { catalogo: 'obras', vazio: 'Nenhuma' }], ['descricao', 'Serviço realizado (manutenção)', 'area']] },
    ausencias: { titulo: 'Ausências e férias', colunas: ['funcionario_id', 'tipo', 'inicio', 'fim', 'dias', 'situacao'], campos: [
      ['funcionario_id', 'Funcionário', 'ref', { catalogo: 'funcionarios', vazio: 'Selecione', obrigatorio: true }],
      ['tipo', 'Tipo', 'opcoes', { opcoes: [['falta', 'Falta'], ['atestado_medico', 'Atestado médico'], ['folga', 'Folga'], ['ferias', 'Férias']], obrigatorio: true }],
      ['inicio', 'Início', 'data', { obrigatorio: true }], ['fim', 'Fim (vazio = um dia)', 'data'],
      ['situacao', 'Situação', 'opcoes', { opcoes: [['confirmado', 'Confirmado'], ['programado', 'Programado'], ['em_analise', 'Em análise'], ['em_andamento', 'Em andamento'], ['usufruido', 'Usufruído']] }],
      ['motivo', 'Motivo / observação', 'texto']] },
    cotacoes: { titulo: 'Propostas de cotação', colunas: ['referencia', 'fornecedor_id', 'total_centavos', 'prazo_dias', 'situacao'], campos: [
      ['referencia', 'O que está sendo cotado', 'texto', { obrigatorio: true }],
      ['fornecedor_id', 'Fornecedor cadastrado', 'ref', { catalogo: 'fornecedores', vazio: 'Outro (informe o nome abaixo)' }], ['fornecedor_nome', 'Nome do fornecedor (se não cadastrado)', 'texto'],
      ['subtotal_centavos', 'Subtotal (R$)', 'dinheiro', { obrigatorio: true }], ['frete_centavos', 'Frete (R$)', 'dinheiro'], ['desconto_centavos', 'Desconto (R$)', 'dinheiro'],
      ['prazo_dias', 'Prazo de entrega (dias)', 'numero'], ['condicao', 'Condição de pagamento', 'texto'],
      ['situacao', 'Situação', 'opcoes', { opcoes: [['aberta', 'Em análise'], ['escolhida', 'Escolhida'], ['recusada', 'Recusada']] }]] },
  };
  const ORDEM = Object.keys(MODULOS);
  const ESTADOS_REC = { aberta: 'Aberta', parcial: 'Recebida em parte', recebida: 'Recebida', cancelada: 'Cancelada' };
  const ESTADOS = { pendente_conferencia: 'Pendente de conferência', aprovado: 'Aprovado', pago: 'Pago', confirmado: 'Confirmado', conciliado: 'Conciliado', cancelado: 'Cancelado' };
  const PROXIMOS = { pendente_conferencia: ['aprovado', 'cancelado'], aprovado: ['pago', 'cancelado'], pago: ['confirmado'], confirmado: ['conciliado'] };
  const ACAO = { aprovado: 'Aprovar', pago: 'Registrar pagamento', confirmado: 'Confirmar', conciliado: 'Conciliar', cancelado: 'Cancelar' };
  const ERROS = { '23505': 'Já existe um cadastro com este documento, código, placa ou nome nesta empresa.',
    '23503': 'Uma referência escolhida não pertence à empresa ativa. Atualize a lista e selecione novamente.',
    '42501': 'Sem permissão para esta operação.', '40001': 'Outro usuário alterou este registro. Recarregue antes de salvar.',
    PREVIA_SOMENTE_LEITURA: 'Esta publicação está em modo somente leitura; gravações ainda não foram liberadas.' };

  // ---------- Estado ----------
  let painel = null, aba = null, empresa = null, uid = null, api = null, catalogos = {}, registros = new Map(), pendente = null;

  const el = (tag, attrs = {}, ...filhos) => {
    const n = D.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'texto') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'classe') n.className = v; else n.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f instanceof Node ? f : D.createTextNode(String(f)));
    return n;
  };
  const contexto = () => W.obterContextoSegurancaAutenticadoWork?.() || null;
  const vinculo = () => contexto()?.vinculos?.find(v => v.empresa_id === empresa) || null;
  const pode = (m, a) => m === 'usuarios' || m === 'backup' ? master() : m === 'gastos_obra' ? (a === 'ler' && (master() || vinculo()?.papelServidor === 'administrador')) : vinculo()?.permissoes?.[m === 'estoque' ? 'estoque_movimentos' : m === 'compras' ? 'pedidos_compra' : m === 'requisicoes' ? 'requisicoes_material' : m]?.[a] === true;
  const master = () => vinculo()?.papelServidor === 'master';
  const gravacao = () => W.gravacaoHabilitadaWork?.() === true;
  const reais = c => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const centavos = texto => {
    const limpo = String(texto || '').trim().replace(/[R$\s]/g, '');
    if (!limpo) return null;
    const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
    if (/^-/.test(normal)) throw Error('O valor não pode ser negativo. Informe um valor maior que zero.');
    if (!/^\d+(\.\d{1,2})?$/.test(normal)) throw Error('Valor inválido. Use números com até 2 casas decimais, por exemplo 1.234,56.');
    if (Number(normal) <= 0) throw Error('O valor precisa ser maior que zero.');
    return Math.round(Number(normal) * 100);
  };
  const rotuloRef = (cat, id) => {
    if (!id) return '';
    const x = (catalogos[cat] || []).find(i => i.id === id);
    return x ? [x.codigo, x.nome || x.descricao || x.placa].filter(Boolean).join(' · ') : '—';
  };
  function mensagem(texto, erro = false) {
    const s = painel?.querySelector('[data-cs=status]');
    if (s) { s.textContent = texto; s.dataset.erro = String(erro); }
  }
  const TECNICA = /duplicate key|violates|constraint|function public\.|PGRST|invalid input/i;
  function traduzir(e) { const m = e?.message || ''; if (m && ['23505', '23503'].includes(e?.code) && !TECNICA.test(m)) return m; return ERROS[e?.code] || m || 'Falha inesperada.'; }

  // ---------- Dados ----------
  async function sincronizarSessao() {
    const c = contexto();
    const novaEmpresa = W.empresaFrequenciaWork || (c?.empresas?.length === 1 ? c.empresas[0] : null);
    if (!c || c.uid !== uid || novaEmpresa !== empresa) {
      uid = c?.uid || null; empresa = novaEmpresa; registros = new Map(); catalogos = {}; pendente = null;
      api = c && W.MartinsProducaoClient && W.MartinsProducaoRpc ? W.MartinsProducaoClient.create({ rpc: W.MartinsProducaoRpc, context: contexto }) : null;
    }
    if (!c) throw Error('Entre com sua conta para acessar os cadastros.');
    if (!UUID.test(empresa || '')) throw Error('Selecione a empresa no cabeçalho.');
  }
  async function carregarCatalogos() {
    const cat = await W.MartinsProducaoRpc.catalogos(empresa);
    if (cat?.empresa_id !== empresa) throw Error('Catálogo inválido.');
    catalogos = cat;
    if (pode('veiculos', 'ler')) catalogos.veiculos = [...(await listarTodos('veiculos'))].filter(r => r.dados.ativo !== false).map(r => ({ id: r.id, codigo: r.dados.placa, nome: r.dados.modelo }));
    if (pode('motoristas', 'ler')) catalogos.motoristas = [...(await listarTodos('motoristas'))].map(r => ({ id: r.id, nome: r.dados.nome || rotuloRef('funcionarios', r.dados.funcionario_id) }));
  }
  async function listarTodos(m) {
    const linhas = []; let apos = null;
    for (let i = 0; i < 100; i++) {
      const pagina = await api.load(empresa, m, null, { after: apos, limit: 200 });
      linhas.push(...pagina);
      if (pagina.length < 200) return linhas;
      apos = pagina.at(-1).id;
    }
    throw Error('Consulta exige paginação adicional.');
  }
  async function carregarAba() {
    await sincronizarSessao();
    mensagem('Consultando o servidor…');
    await carregarCatalogos();
    if (aba === 'estoque') return carregarEstoque();
    if (aba === 'compras') return carregarCompras();
    if (aba === 'requisicoes') return carregarRequisicoes();
    if (aba === 'usuarios') return carregarUsuarios();
    if (aba === 'gastos_obra') return carregarGastosObra();
    if (aba === 'backup') return carregarBackup();
    const linhas = await listarTodos(aba);
    registros = new Map(linhas.map(r => [r.id, r]));
    desenhar();
    mensagem(`${MODULOS[aba].titulo}: ${linhas.length} registro(s) da empresa ativa.`);
  }

  // ---------- Gravação ----------
  async function salvar(id, dados) {
    if (!gravacao()) throw Object.assign(Error(ERROS.PREVIA_SOMENTE_LEITURA), { code: 'PREVIA_SOMENTE_LEITURA' });
    const anterior = id ? registros.get(id) : null;
    const chave = JSON.stringify([aba, id, dados]);
    // Reenvio após falha reutiliza a MESMA operação (idempotência no servidor).
    if (!pendente || pendente.chave !== chave) {
      const cmd = api.prepare({ empresa, modulo: aba, id: id || crypto.randomUUID(), revisao: anterior ? Number(anterior.revisao) : 0, dados });
      pendente = { chave, op: cmd.operacao };
    }
    const r = await api.send(pendente.op);
    pendente = null;
    registros.set(r.registro.id, r.registro);
    return r.registro;
  }
  async function mudarEstado(reg, estado, motivo) {
    if (!gravacao()) throw Object.assign(Error(ERROS.PREVIA_SOMENTE_LEITURA), { code: 'PREVIA_SOMENTE_LEITURA' });
    const op = crypto.randomUUID();
    const r = await W.MartinsProducaoRpc.despesaEstado({ e: empresa, r: reg.id, v: Number(reg.revisao), estado, motivo, op });
    if (r?.id !== reg.id || r.estado !== estado) throw Error('Mudança de estado não confirmada pelo servidor.');
  }

  // ---------- Interface ----------
  function campoEntrada([nome, rotulo, tipo, opc = {}], valor) {
    const id = 'cs-' + nome;
    let input;
    if (tipo === 'area') input = el('textarea', { id, rows: 2 });
    else if (tipo === 'sim') input = el('input', { id, type: 'checkbox' });
    else if (tipo === 'opcoes' || tipo === 'ref') {
      input = el('select', { id });
      input.add(new Option(tipo === 'ref' ? (opc.vazio || 'Selecione') : 'Selecione', ''));
      const lista = tipo === 'ref' ? (catalogos[opc.catalogo] || []).map(x => [x.id, rotuloRef(opc.catalogo, x.id)]) : opc.opcoes;
      for (const [v, t] of lista) input.add(new Option(t, v));
    } else input = el('input', { id, type: tipo === 'data' ? 'date' : tipo === 'email' ? 'email' : 'text', inputmode: tipo === 'dinheiro' || tipo === 'numero' ? 'decimal' : null });
    if (tipo === 'sim') input.checked = valor === true;
    else if (tipo === 'dinheiro') input.value = valor ? (Number(valor) / 100).toFixed(2).replace('.', ',') : '';
    else input.value = valor ?? '';
    if (opc.obrigatorio) input.required = true;
    const linha = el('label', { classe: tipo === 'sim' ? 'cs-campo cs-check' : 'cs-campo', for: id }, tipo === 'sim' ? [input, el('span', { texto: rotulo })] : [el('span', { texto: rotulo + (opc.obrigatorio ? ' *' : '') }), input]);
    return linha;
  }
  function lerFormulario(form, def) {
    const d = {};
    for (const [nome, rotulo, tipo, opc = {}] of def.campos) {
      const input = form.querySelector('#cs-' + nome);
      if (!input) continue;
      if (tipo === 'sim') { d[nome] = input.checked; continue; }
      const v = input.value.trim();
      if (!v && opc.obrigatorio) throw Error('Preencha o campo "' + rotulo.replace(/ \(.+\)$/, '') + '".');
      // Campo opcional vazio vai como null: na edição, isso limpa o valor anterior.
      if (!v) { d[nome] = null; continue; }
      if (tipo === 'dinheiro') { d[nome] = centavos(v); continue; }
      if (tipo === 'numero') { const n = Number(v.replace(',', '.')); if (!Number.isFinite(n)) throw Error('Número inválido em ' + nome); d[nome] = n; continue; }
      d[nome] = v;
    }
    return d;
  }
  function abrirFormulario(reg, inicial = null) {
    const def = MODULOS[aba];
    const dados = reg?.dados || inicial || {};
    const campos = def.campos.filter(c => !(c[3]?.somenteMaster && !master()));
    const form = el('form', { classe: 'cs-form', novalidate: true });
    form.append(el('h3', { texto: (reg ? 'Editar · ' : 'Novo · ') + def.titulo }));
    const grade = el('div', { classe: 'cs-grade' }, campos.map(c => campoEntrada(c, dados[c[0]])));
    form.append(grade);
    if (reg && !def.semAtivo) form.append(campoEntrada(['ativo', 'Ativo (desmarque para inativar; cadastros não são excluídos)', 'sim'], dados.ativo !== false));
    const erro = el('p', { classe: 'cs-erro', role: 'alert' });
    const botoes = el('div', { classe: 'cs-acoes' },
      el('button', { type: 'submit', classe: 'cs-primario', texto: 'Salvar no servidor', disabled: !gravacao() }),
      el('button', { type: 'button', classe: 'cs-secundario', texto: 'Cancelar', onclick: () => desenhar() }));
    form.append(erro, botoes);
    if (!gravacao()) form.append(el('p', { classe: 'cs-aviso', texto: ERROS.PREVIA_SOMENTE_LEITURA }));
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const enviar = form.querySelector('button[type=submit]');
      enviar.disabled = true; erro.textContent = '';
      try {
        const d = lerFormulario(form, { campos: [...campos, ...(reg && !def.semAtivo ? [['ativo', '', 'sim']] : [])] });
        // Na edição, campos que o usuário não pode ver/alterar são preservados do registro atual.
        const base = reg ? { ...reg.dados } : {};
        delete base.estado;
        await salvar(reg?.id || null, { ...base, ...d });
        mensagem('Salvo e confirmado pelo servidor.');
        // As demais telas (obra, RDO, frequência…) usam os catálogos do formularios.js: atualiza para refletir o novo cadastro.
        W.MartinsOperacional?.carregar?.().catch(() => {});
        await carregarAba();
      } catch (e) { erro.textContent = traduzir(e); enviar.disabled = !gravacao(); }
    });
    const corpo = painel.querySelector('[data-cs=corpo]');
    corpo.replaceChildren(form);
    form.querySelector('input,select,textarea')?.focus();
  }
  const ROTULOS_TIPO = { abastecimento: 'Abastecimento', manutencao: 'Manutenção', falta: 'Falta', atestado_medico: 'Atestado médico', folga: 'Folga', ferias: 'Férias' };
  const ROTULOS_SIT = { confirmado: 'Confirmado', programado: 'Programado', em_analise: 'Em análise', em_andamento: 'Em andamento', usufruido: 'Usufruído', aberta: 'Em análise', escolhida: 'Escolhida', recusada: 'Recusada' };
  function formatar(m, coluna, d) {
    const v = d[coluna];
    if (coluna === 'valor_centavos') return reais(v || 0);
    if (coluna === 'estado') return (m === 'contas_receber' ? ESTADOS_REC[v] : ESTADOS[v]) || v || '';
    if (coluna === 'principal') return v ? 'Principal' : '';
    if (coluna === 'funcionario_id') return rotuloRef('funcionarios', v) || 'Externo';
    if (coluna === 'centro_custo_id') return rotuloRef('centros_custo', v) || (v ? 'Inativo' : '');
    if (coluna === 'obra_id') return rotuloRef('obras', v);
    if (coluna === 'cnh_validade' || coluna === 'competencia' || coluna === 'vencimento' || coluna === 'data') return v ? String(v).split('-').reverse().join('/') : '';
    if (coluna === 'preco_centavos') return v === undefined || v === null ? '' : reais(v);
    if (coluna === 'total_centavos' || coluna === 'recebido_centavos') return reais(v || 0);
    if (m === 'pedidos_venda') {
      if (coluna === 'numero') return v ? 'PV-' + String(v).padStart(4, '0') : '';
      if (coluna === 'orcamento_numero') return v ? 'ORC-' + String(v).padStart(4, '0') : '';
      if (coluna === 'total') return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      if (coluna === 'estado') return { aberto: 'Aberto', entregue: 'Entregue', cancelado: 'Cancelado' }[v] || v || '';
    }
    if (coluna === 'cliente_id') return rotuloRef('clientes', v) || d.cliente_nome || '';
    if (coluna === 'veiculo_id') return rotuloRef('veiculos', v) || (v ? 'Inativo' : '');
    if (coluna === 'litros_milli') return v ? (Number(v) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' L' : '';
    if (coluna === 'inicio' || coluna === 'fim') return v ? String(v).split('-').reverse().join('/') : '';
    if (coluna === 'dias') return v ? v + (Number(v) === 1 ? ' dia' : ' dias') : '';
    if (coluna === 'prazo_dias') return v === undefined || v === null ? '' : v + ' dias';
    if (coluna === 'fornecedor_id' && m === 'cotacoes') return rotuloRef('fornecedores', v) || d.fornecedor_nome || '';
    if (coluna === 'tipo' && ROTULOS_TIPO[v]) return ROTULOS_TIPO[v];
    if (coluna === 'situacao' && ROTULOS_SIT[v]) return ROTULOS_SIT[v];
    if (coluna === 'abrangencia') return { municipal: 'Municipal', estadual: 'Estadual', nacional: 'Nacional', empresa: 'Recesso da empresa' }[v] || v || '';
    if (coluna === 'nome' && !v && d.funcionario_id) return rotuloRef('funcionarios', d.funcionario_id);
    return v ?? '';
  }
  // ---------- Estoque (v4): movimentações imutáveis; o saldo vem do servidor ----------
  const TIPOS_MOV = { entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência', estorno: 'Estorno', consumo: 'Consumo na obra', devolucao_obra: 'Devolução da obra' };
  const milli = v => { const n = Number(String(v).trim().replace(/\./g, '').replace(',', '.')); if (!Number.isFinite(n) || n <= 0) throw Error('Informe uma quantidade maior que zero.'); return Math.round(n * 1000); };
  const qtd = m => (Number(m) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  let pendenteEstoque = null;
  async function carregarEstoque() {
    const [produtos, depositos, saldosBrutos, movs] = await Promise.all([listarTodos('produtos').catch(() => []), listarTodos('depositos').catch(() => []),
      W.MartinsProducaoRpc.estoqueSaldos(empresa), listarTodos('estoque_movimentos')]);
    const nomeP = id => { const p = produtos.find(x => x.id === id); return p ? [p.dados.codigo, p.dados.descricao || p.dados.nome].filter(Boolean).join(' · ') : '—'; };
    const nomeD = id => depositos.find(x => x.id === id)?.dados.nome || (id ? '—' : '');
    const ativos = l => l.filter(x => x.dados.ativo !== false);
    const corpo = painel.querySelector('[data-cs=corpo]');
    const secoes = [];
    if (pode('estoque', 'criar')) {
      const sel = (id, lista, rotulo, vazio) => { const s = el('select', { id }); s.add(new Option(vazio, '')); for (const x of lista) s.add(new Option(rotulo(x), x.id)); return s; };
      const tipo = el('select', { id: 'est-tipo' }); for (const t of ['entrada', 'saida', 'transferencia']) tipo.add(new Option(TIPOS_MOV[t], t));
      const prod = sel('est-produto', ativos(produtos), x => nomeP(x.id), 'Produto'), orig = sel('est-origem', ativos(depositos), x => x.dados.nome, 'Depósito de origem'), dest = sel('est-destino', ativos(depositos), x => x.dados.nome, 'Depósito de destino');
      const q = el('input', { id: 'est-qtd', type: 'text', inputmode: 'decimal', placeholder: 'Quantidade', 'aria-label': 'Quantidade' });
      const motivo = el('input', { id: 'est-motivo', type: 'text', placeholder: 'Motivo / documento (opcional)', maxlength: '500' });
      const erro = el('p', { classe: 'cs-erro', role: 'alert' });
      const ajustar = () => { orig.hidden = tipo.value === 'entrada'; dest.hidden = tipo.value === 'saida'; }; tipo.addEventListener('change', ajustar); ajustar();
      const botao = el('button', { type: 'button', classe: 'cs-primario', texto: 'Registrar movimento', disabled: !gravacao(), onclick: async () => {
        botao.disabled = true; erro.textContent = '';
        try {
          const args = { e: empresa, tipo: tipo.value, produto: prod.value, origem: tipo.value === 'entrada' ? null : orig.value || null, destino: tipo.value === 'saida' ? null : dest.value || null, qtd: milli(q.value), motivo: motivo.value.trim() || null, ref: null };
          if (!args.produto) throw Error('Escolha o produto.');
          // Reenvio após falha usa o MESMO identificador: o servidor não baixa duas vezes.
          const chave = JSON.stringify(args); if (!pendenteEstoque || pendenteEstoque.chave !== chave) pendenteEstoque = { chave, op: crypto.randomUUID() };
          await W.MartinsProducaoRpc.estoqueMover({ ...args, op: pendenteEstoque.op }); pendenteEstoque = null;
          mensagem('Movimento registrado e confirmado pelo servidor.'); W.MartinsOperacional?.carregar?.().catch(() => {}); await carregarEstoque();
        } catch (e) { erro.textContent = traduzir(e); botao.disabled = !gravacao(); }
      } });
      secoes.push(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Registrar movimento' }), el('div', { classe: 'cs-acoes' }, tipo, prod, orig, dest, q, motivo, botao), erro,
        !gravacao() ? el('p', { classe: 'cs-aviso', texto: ERROS.PREVIA_SOMENTE_LEITURA }) : null,
        !produtos.length || !depositos.length ? el('p', { classe: 'cs-aviso', texto: 'Cadastre ao menos um produto e um depósito (abas Produtos e Depósitos) antes de movimentar.' }) : null));
    }
    // Consumo de material na obra (baixa única por RDO e produto); correção por devolução.
    if (pode('estoque', 'criar') && (catalogos.obras || []).length) {
      const rdosTodos = await listarTodos('rdos').catch(() => []);
      const so = (id, lista, vazio) => { const s = el('select', { id }); s.add(new Option(vazio, '')); for (const [v, t] of lista) s.add(new Option(t, v)); return s; };
      const obraSel = so('co-obra', (catalogos.obras || []).map(o => [o.id, o.nome]), 'Obra'), rdoSel = so('co-rdo', [], 'RDO (opcional)');
      obraSel.addEventListener('change', () => { rdoSel.replaceChildren(new Option('RDO (opcional)', '')); for (const r of rdosTodos.filter(x => x.dados.obra_id === obraSel.value).sort((a, b) => String(b.dados.data).localeCompare(String(a.dados.data)))) rdoSel.add(new Option('RDO ' + r.dados.numero + ' · ' + String(r.dados.data).split('-').reverse().join('/'), r.id)); });
      const refRdo = el('p', { classe: 'cs-aviso', 'data-co': 'ref-rdo', hidden: true });
      rdoSel.addEventListener('change', () => { const r = rdosTodos.find(x => x.id === rdoSel.value), txt = String(r?.dados?.materiais || '').trim(); refRdo.hidden = !txt; refRdo.textContent = txt ? 'Materiais informados no RDO (texto livre, só para referência): ' + txt : ''; });
      const depSel = so('co-deposito', ativos(depositos).map(x => [x.id, x.dados.nome]), 'Depósito'), prodSel = so('co-produto', ativos(produtos).map(x => [x.id, nomeP(x.id)]), 'Material');
      const qc = el('input', { id: 'co-qtd', type: 'text', inputmode: 'decimal', placeholder: 'Quantidade', 'aria-label': 'Quantidade consumida' }), erroC = el('p', { classe: 'cs-erro', role: 'alert' });
      const bc = el('button', { type: 'button', classe: 'cs-primario', texto: 'Registrar consumo', disabled: !gravacao(), onclick: async () => {
        bc.disabled = true; erroC.textContent = '';
        try {
          if (!obraSel.value || !depSel.value || !prodSel.value) throw Error('Escolha a obra, o depósito e o material.');
          const args = { e: empresa, obra: obraSel.value, deposito: depSel.value, itens: [{ produto_id: prodSel.value, qtd_milli: milli(qc.value) }], rdo: rdoSel.value || null, motivo: null };
          const k = JSON.stringify(args); if (!pendenteEstoque || pendenteEstoque.chave !== k) pendenteEstoque = { chave: k, op: crypto.randomUUID() };
          await W.MartinsProducaoRpc.obraConsumir({ ...args, op: pendenteEstoque.op }); pendenteEstoque = null;
          mensagem('Consumo registrado: baixa única no estoque.'); await carregarEstoque();
        } catch (e) { erroC.textContent = traduzir(e); bc.disabled = !gravacao(); }
      } });
      secoes.push(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Consumo de material na obra' }), el('div', { classe: 'cs-acoes' }, obraSel, rdoSel, depSel, prodSel, qc, bc), refRdo, erroC,
        el('p', { classe: 'cs-aviso', texto: 'Um material só pode ser baixado uma vez por RDO. Se baixou a mais, registre uma devolução na linha do consumo (abaixo).' })));
    }
    const saldos = saldosBrutos.map(s => el('tr', {}, el('td', { 'data-rotulo': 'Produto', texto: nomeP(s.produto_id) }), el('td', { 'data-rotulo': 'Depósito', texto: nomeD(s.deposito_id) }), el('td', { 'data-rotulo': 'Saldo', texto: qtd(s.saldo_milli) })));
    secoes.push(el('section', {}, el('h3', { texto: 'Saldos (calculados pelo servidor)' }), el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' },
      el('thead', {}, el('tr', {}, ['Produto', 'Depósito', 'Saldo'].map(t => el('th', { texto: t })))), el('tbody', {}, saldos.length ? saldos : [el('tr', {}, el('td', { colspan: 3, classe: 'cs-vazio', texto: 'Nenhum saldo. Registre uma entrada para começar.' }))])))));
    const estornados = new Set(movs.filter(m => m.dados.tipo === 'estorno').map(m => m.dados.ref_id));
    const ordenadas = movs.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 100);
    const linhas = ordenadas.map(m => {
      const d = m.dados, podeEstornar = pode('estoque', 'editar') && !['estorno', 'consumo', 'devolucao_obra'].includes(d.tipo) && !estornados.has(m.id);
      const devolvidoMilli = d.tipo === 'consumo' ? movs.filter(x => x.dados.tipo === 'devolucao_obra' && x.dados.ref_id === m.id).reduce((t, x) => t + Number(x.dados.quantidade_milli), 0) : 0;
      const restante = d.tipo === 'consumo' ? Number(d.quantidade_milli) - devolvidoMilli : 0;
      const nomeObra = id => (catalogos.obras || []).find(o => o.id === id)?.nome || '';
      const devolver = d.tipo === 'consumo' && restante > 0 && pode('estoque', 'editar') ? (() => {
        const qd = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'Qtd a devolver', 'aria-label': 'Quantidade a devolver' }), mo = el('input', { type: 'text', placeholder: 'Motivo da devolução', 'aria-label': 'Motivo da devolução' });
        return el('div', { classe: 'cs-estado' }, qd, mo, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Devolver ao estoque', disabled: !gravacao(), onclick: async () => {
          try { await W.MartinsProducaoRpc.obraDevolver({ e: empresa, op: crypto.randomUUID(), consumo: m.id, qtd: milli(qd.value), motivo: mo.value.trim() }); mensagem('Devolução registrada.'); await carregarEstoque(); } catch (e) { mensagem(traduzir(e), true); } } }));
      })() : null;
      const motivo = el('input', { type: 'text', placeholder: 'Motivo do estorno', 'aria-label': 'Motivo do estorno', maxlength: '500' });
      return el('tr', {}, el('td', { 'data-rotulo': 'Quando', texto: new Date(m.criado_em).toLocaleString('pt-BR') }), el('td', { 'data-rotulo': 'Tipo', texto: TIPOS_MOV[d.tipo] + (estornados.has(m.id) ? ' (estornado)' : '') }),
        el('td', { 'data-rotulo': 'Produto', texto: nomeP(d.produto_id) }), el('td', { 'data-rotulo': 'De → Para', texto: [nomeD(d.origem_id), nomeD(d.destino_id)].filter(Boolean).join(' → ') + (d.obra_id ? ' · obra: ' + nomeObra(d.obra_id) : '') }),
        el('td', { 'data-rotulo': 'Quantidade', texto: qtd(d.quantidade_milli) }), el('td', { 'data-rotulo': 'Motivo', texto: d.motivo || '' }),
        el('td', {}, podeEstornar ? el('div', { classe: 'cs-estado' }, motivo, el('button', { type: 'button', classe: 'cs-perigo', texto: 'Estornar', disabled: !gravacao(), onclick: async () => {
          if (!motivo.value.trim()) { motivo.focus(); mensagem('Informe o motivo do estorno.', true); return; }
          try { await W.MartinsProducaoRpc.estoqueMover({ e: empresa, op: crypto.randomUUID(), tipo: 'estorno', produto: null, origem: null, destino: null, qtd: null, motivo: motivo.value.trim(), ref: m.id }); mensagem('Movimento estornado.'); await carregarEstoque(); }
          catch (e) { mensagem(traduzir(e), true); } } })) : devolver));
    });
    secoes.push(el('section', {}, el('h3', { texto: 'Movimentações (as 100 mais recentes)' }), el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' },
      el('thead', {}, el('tr', {}, ['Quando', 'Tipo', 'Produto', 'De → Para', 'Quantidade', 'Motivo', ''].map(t => el('th', { texto: t })))), el('tbody', {}, linhas.length ? linhas : [el('tr', {}, el('td', { colspan: 7, classe: 'cs-vazio', texto: 'Nenhuma movimentação.' }))])))));
    corpo.replaceChildren(...secoes);
    mensagem('Estoque: ' + saldosBrutos.length + ' saldo(s) e ' + movs.length + ' movimentação(ões) da empresa ativa.');
  }
  // ---------- Compras (v5): pedido -> aprovação (Master) -> recebimento atômico ----------
  const SIT_PED = { rascunho: 'Rascunho', aprovado: 'Aprovado', recebido_parcial: 'Recebido em parte', recebido: 'Recebido', cancelado: 'Cancelado' };
  let pendenteCompras = null, pendenteDevolucao = null;
  async function enviarPedido(id, rev, d) {
    const chave = JSON.stringify([id, rev, d]); if (!pendenteCompras || pendenteCompras.chave !== chave) {
      const cmd = api.prepare({ empresa, modulo: 'pedidos_compra', id: id || crypto.randomUUID(), revisao: rev, dados: d }); pendenteCompras = { chave, op: cmd.operacao };
    }
    const r = await api.send(pendenteCompras.op); pendenteCompras = null; return r;
  }
  // Leitura do XML da NF-e no próprio navegador (nada é enviado a terceiros). O XML só PREENCHE o
  // formulário de recebimento; quem decide e grava é o servidor (que ainda impede a mesma nota duas vezes).
  function lerNFe(texto) {
    if (typeof texto !== 'string' || texto.length > 3000000) throw Error('Arquivo grande demais para ser uma NF-e.');
    if (/<!DOCTYPE|<!ENTITY/i.test(texto)) throw Error('XML recusado por segurança (contém declaração DOCTYPE/ENTITY).');
    const doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw Error('O arquivo não é um XML válido.');
    const um = (raiz, nome) => raiz?.getElementsByTagNameNS('*', nome)[0] || null, tx = (raiz, nome) => (um(raiz, nome)?.textContent || '').trim();
    const inf = um(doc, 'infNFe'); if (!inf) throw Error('Este XML não é uma NF-e (elemento infNFe não encontrado).');
    const chave = (inf.getAttribute('Id') || '').replace(/\D/g, '');
    const ide = um(inf, 'ide'), emit = um(inf, 'emit');
    const itens = [...inf.getElementsByTagNameNS('*', 'det')].map(det => { const prod = um(det, 'prod'); return { codigo: tx(prod, 'cProd'), descricao: tx(prod, 'xProd'), qtd: Number(tx(prod, 'qCom').replace(',', '.')) }; });
    const numero = tx(ide, 'nNF').replace(/^0+(?=\d)/, '');
    if (chave.length !== 44 && !numero) throw Error('Não encontrei a chave de acesso nem o número da nota neste XML.');
    return { chave: chave.length === 44 ? chave : '', numero, emitenteDoc: tx(emit, 'CNPJ') || tx(emit, 'CPF'), emitenteNome: tx(emit, 'xNome'), itens };
  }
  async function carregarCompras() {
    const [produtos, depositos, pedidos, recebs] = await Promise.all([listarTodos('produtos').catch(() => []), listarTodos('depositos').catch(() => []), listarTodos('pedidos_compra'), listarTodos('recebimentos_compra').catch(() => [])]);
    const nomeF = id => (catalogos.fornecedores || []).find(x => x.id === id)?.nome || '—';
    const nomeP = id => { const p = produtos.find(x => x.id === id); return p ? [p.dados.codigo, p.dados.descricao || p.dados.nome].filter(Boolean).join(' · ') : '—'; };
    const corpo = painel.querySelector('[data-cs=corpo]'); const secoes = [];
    const totalPed = p => p.dados.itens.reduce((t, i) => t + Math.round(i.qtd_milli * i.preco_centavos / 1000), 0);
    if (pode('compras', 'criar')) {
      const forn = el('select', { id: 'cp-fornecedor' }); forn.add(new Option('Fornecedor', '')); for (const f of catalogos.fornecedores || []) forn.add(new Option(f.nome, f.id));
      const cc = el('select', { id: 'cp-centro' }); cc.add(new Option('Centro de custo', '')); for (const c of catalogos.centros_custo || []) cc.add(new Option(rotuloRef('centros_custo', c.id), c.id));
      const obra = el('select', { id: 'cp-obra' }); obra.add(new Option('Sem obra (administrativo)', '')); for (const o of catalogos.obras || []) obra.add(new Option(o.nome, o.id));
      const linhas = el('div', {}); const erro = el('p', { classe: 'cs-erro', role: 'alert' });
      const novaLinha = () => { const p = el('select', { 'aria-label': 'Produto' }); p.add(new Option('Produto', '')); for (const x of produtos.filter(z => z.dados.ativo !== false)) p.add(new Option(nomeP(x.id), x.id));
        linhas.append(el('div', { classe: 'cs-acoes', 'data-linha': '' }, p, el('input', { type: 'text', inputmode: 'decimal', placeholder: 'Quantidade', 'aria-label': 'Quantidade' }), el('input', { type: 'text', inputmode: 'decimal', placeholder: 'Preço unit. (R$)', 'aria-label': 'Preço unitário' }))); };
      novaLinha();
      const salvarBtn = el('button', { type: 'button', classe: 'cs-primario', texto: 'Salvar pedido (rascunho)', disabled: !gravacao(), onclick: async () => {
        salvarBtn.disabled = true; erro.textContent = '';
        try {
          const itens = [...linhas.querySelectorAll('[data-linha]')].map(l => { const [p, q, pr] = l.querySelectorAll('select,input'); if (!p.value) throw Error('Escolha o produto de cada linha.'); return { produto_id: p.value, qtd_milli: milli(q.value), preco_centavos: centavos(pr.value) }; });
          if (!forn.value) throw Error('Escolha o fornecedor.'); if (!cc.value) throw Error('Escolha o centro de custo.');
          await enviarPedido(null, 0, { fornecedor_id: forn.value, centro_custo_id: cc.value, obra_id: obra.value || null, itens });
          mensagem('Pedido salvo e confirmado pelo servidor.'); await carregarCompras();
        } catch (e) { erro.textContent = traduzir(e); salvarBtn.disabled = !gravacao(); }
      } });
      secoes.push(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Novo pedido de compra' }), el('div', { classe: 'cs-acoes' }, forn, cc, obra), linhas,
        el('div', { classe: 'cs-acoes' }, el('button', { type: 'button', classe: 'cs-secundario', texto: '+ Item', onclick: novaLinha }), salvarBtn), erro,
        !produtos.length ? el('p', { classe: 'cs-aviso', texto: 'Cadastre produtos, fornecedores e centros de custo antes de criar um pedido.' }) : null));
    }
    const ordenados = pedidos.slice().sort((a, b) => Number(b.dados.numero) - Number(a.dados.numero));
    const rows = ordenados.map(p => {
      const d = p.dados, acoes = el('div', { classe: 'cs-estado' }); acoes.append(el('span', { classe: 'cs-selo cs-' + (d.estado === 'aprovado' ? 'aprovado' : d.estado === 'recebido' ? 'conciliado' : d.estado === 'cancelado' ? 'cancelado' : 'pendente_conferencia'), texto: SIT_PED[d.estado] || d.estado }));
      if (master() && ['rascunho', 'aprovado'].includes(d.estado)) {
        const motivo = el('input', { type: 'text', placeholder: 'Motivo / observação', 'aria-label': 'Motivo' }); acoes.append(motivo);
        const mudar = estado => async () => { if (!motivo.value.trim()) { motivo.focus(); mensagem('Informe o motivo.', true); return; }
          try { await W.MartinsProducaoRpc.comprasEstado({ e: empresa, r: p.id, v: Number(p.revisao), estado, motivo: motivo.value.trim(), op: crypto.randomUUID() }); await carregarCompras(); } catch (e) { mensagem(traduzir(e), true); } };
        if (d.estado === 'rascunho') acoes.append(el('button', { type: 'button', classe: 'cs-secundario', texto: 'Aprovar', disabled: !gravacao(), onclick: mudar('aprovado') }));
        acoes.append(el('button', { type: 'button', classe: 'cs-perigo', texto: 'Cancelar', disabled: !gravacao(), onclick: mudar('cancelado') }));
      }
      if (['aprovado', 'recebido_parcial'].includes(d.estado) && pode('compras', 'editar')) acoes.append(el('button', { type: 'button', classe: 'cs-primario', texto: 'Receber', onclick: () => formReceber(p) }));
      return el('tr', {}, el('td', { 'data-rotulo': 'Nº', texto: d.numero }), el('td', { 'data-rotulo': 'Fornecedor', texto: nomeF(d.fornecedor_id) }),
        el('td', { 'data-rotulo': 'Itens', texto: d.itens.map(i => nomeP(i.produto_id).split(' · ')[0] + ' ' + qtd(i.recebido_milli) + '/' + qtd(i.qtd_milli)).join(', ') }),
        el('td', { 'data-rotulo': 'Total', texto: reais(totalPed(p)) }), el('td', {}, acoes));
    });
    secoes.push(el('section', { 'data-cp': 'pedidos' }, el('h3', { texto: 'Pedidos de compra' }), el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' },
      el('thead', {}, el('tr', {}, ['Nº', 'Fornecedor', 'Recebido/Pedido', 'Total', 'Situação e ações'].map(t => el('th', { texto: t })))), el('tbody', {}, rows.length ? rows : [el('tr', {}, el('td', { colspan: 5, classe: 'cs-vazio', texto: 'Nenhum pedido.' }))])))));
    const podeDevolver = pode('compras', 'editar') && pode('estoque', 'criar');
    const devolvidoDe = r => (r.dados.itens || []).reduce((s, i) => s + Number(i.devolvido_centavos || 0), 0);
    const restaDevolver = r => (r.dados.itens || []).some(i => Number(i.qtd_milli) > Number(i.devolvido_milli || 0));
    const rr = recebs.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).map(r => el('tr', {}, el('td', { 'data-rotulo': 'Data', texto: String(r.dados.data).split('-').reverse().join('/') }),
      el('td', { 'data-rotulo': 'Nota fiscal', texto: r.dados.numero_nf || (r.dados.chave_acesso ? 'chave …' + r.dados.chave_acesso.slice(-8) : '') }), el('td', { 'data-rotulo': 'Fornecedor', texto: nomeF(r.dados.fornecedor_id) }), el('td', { 'data-rotulo': 'Total', texto: reais(r.dados.total_centavos) }),
      el('td', { 'data-rotulo': 'Devolvido', texto: devolvidoDe(r) ? reais(devolvidoDe(r)) + (Number(r.dados.credito_pendente_centavos) ? ' · crédito pendente ' + reais(r.dados.credito_pendente_centavos) : '') : '—' }),
      el('td', { 'data-rotulo': 'Ações' }, podeDevolver && restaDevolver(r) ? el('button', { type: 'button', classe: 'cs-secundario', texto: 'Devolver', onclick: () => formDevolver(r) }) : null)));
    secoes.push(el('section', {}, el('h3', { texto: 'Recebimentos' }), el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' }, el('thead', {}, el('tr', {}, ['Data', 'Nota fiscal', 'Fornecedor', 'Total', 'Devolvido', 'Ações'].map(t => el('th', { texto: t })))),
      el('tbody', {}, rr.length ? rr : [el('tr', {}, el('td', { colspan: 6, classe: 'cs-vazio', texto: 'Nenhum recebimento.' }))])))));
    corpo.replaceChildren(...secoes);
    mensagem('Compras: ' + pedidos.length + ' pedido(s) e ' + recebs.length + ' recebimento(s) da empresa ativa.');
    function formDevolver(r) {
      const campos = r.dados.itens.filter(i => Number(i.qtd_milli) > Number(i.devolvido_milli || 0)).map(i => ({ i, input: el('input', { type: 'text', inputmode: 'decimal', placeholder: '0', 'aria-label': 'Quantidade devolvida de ' + nomeP(i.produto_id) }) }));
      const motivo = el('input', { id: 'dv-motivo', type: 'text', placeholder: 'Motivo da devolução (obrigatório)', maxlength: '300' });
      const erro = el('p', { classe: 'cs-erro', role: 'alert' });
      const ok = el('button', { type: 'button', classe: 'cs-perigo', texto: 'Confirmar devolução', disabled: !gravacao(), onclick: async () => {
        ok.disabled = true; erro.textContent = '';
        try {
          if (!motivo.value.trim()) throw Error('Informe o motivo da devolução.');
          const itens = campos.filter(c => c.input.value.trim() && Number(String(c.input.value).replace(',', '.')) > 0).map(c => ({ produto_id: c.i.produto_id, qtd_milli: milli(c.input.value) }));
          if (!itens.length) throw Error('Informe a quantidade devolvida de ao menos um item.');
          const args = { e: empresa, recebimento: r.id, itens, motivo: motivo.value.trim() };
          const k = JSON.stringify(args); if (!pendenteDevolucao || pendenteDevolucao.chave !== k) pendenteDevolucao = { chave: k, op: crypto.randomUUID() };
          const res = await W.MartinsProducaoRpc.comprasDevolver({ ...args, op: pendenteDevolucao.op }); pendenteDevolucao = null;
          const aviso = { reduzida: 'A obrigação (ainda pendente de conferência) foi reduzida.', cancelada: 'Tudo foi devolvido: a obrigação pendente foi cancelada.',
            credito_pendente: 'A obrigação já estava aprovada/paga e não foi alterada: ficou um crédito pendente de ' + reais(res.credito_pendente_centavos) + ' com o fornecedor, para acertar no financeiro.', sem_alteracao: '' }[res.despesa] || '';
          mensagem('Devolução registrada: estoque baixado, ' + reais(res.valor_devolvido_centavos) + ' devolvidos. ' + aviso); await carregarCompras();
        } catch (e) { erro.textContent = traduzir(e); ok.disabled = !gravacao(); }
      } });
      corpo.replaceChildren(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Devolver ao fornecedor · ' + (r.dados.numero_nf ? 'NF ' + r.dados.numero_nf : 'recebimento') + ' · ' + nomeF(r.dados.fornecedor_id) }),
        ...campos.map(c => el('div', { classe: 'cs-acoes' }, el('span', { texto: nomeP(c.i.produto_id) + ' (pode devolver até ' + qtd(c.i.qtd_milli - Number(c.i.devolvido_milli || 0)) + ')' }), c.input)), motivo,
        el('div', { classe: 'cs-acoes' }, ok, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Cancelar', onclick: () => carregarCompras() })), erro,
        el('p', { classe: 'cs-aviso', texto: 'Ao confirmar: o material sai do depósito onde foi recebido. Se a obrigação gerada pela compra ainda estiver pendente de conferência, ela é reduzida (ou cancelada); se já foi aprovada ou paga, nada é alterado e fica um crédito pendente com o fornecedor. O pedido não reabre.' })));
    }
    function formReceber(p) {
      const dep = el('select', { id: 'rc-deposito' }); dep.add(new Option('Depósito de destino', '')); for (const x of depositos.filter(z => z.dados.ativo !== false)) dep.add(new Option(x.dados.nome, x.id));
      const campos = p.dados.itens.filter(i => i.recebido_milli < i.qtd_milli).map(i => ({ i, input: el('input', { type: 'text', inputmode: 'decimal', value: (((i.qtd_milli - i.recebido_milli)) / 1000).toString().replace('.', ','), 'aria-label': 'Quantidade recebida de ' + nomeP(i.produto_id) }) }));
      const nf = el('input', { id: 'rc-nf', type: 'text', placeholder: 'Nº da nota fiscal' }), chave = el('input', { id: 'rc-chave', type: 'text', placeholder: 'Chave de acesso (44 dígitos, opcional)', maxlength: '60' });
      const resumoXml = el('p', { classe: 'cs-aviso', 'data-rc': 'xml', texto: 'Se tiver o XML da NF-e, importe-o: o número, a chave e as quantidades são preenchidos para você conferir.' });
      const arquivo = el('input', { id: 'rc-xml', type: 'file', accept: '.xml,text/xml,application/xml', 'aria-label': 'Importar XML da NF-e' });
      arquivo.addEventListener('change', async () => {
        const f = arquivo.files?.[0]; if (!f) return; erro.textContent = '';
        try {
          const nfe = lerNFe(await f.text());
          nf.value = nfe.numero || nf.value; chave.value = nfe.chave || chave.value;
          const fornecedores = await listarTodos('fornecedores').catch(() => []);
          const forn = fornecedores.find(x => x.id === p.dados.fornecedor_id);
          const docForn = String(forn?.dados?.documento || '').replace(/\D/g, '');
          let casados = 0; const avisos = [];
          for (const c of campos) {
            const prod = produtos.find(x => x.id === c.i.produto_id);
            const cod = String(prod?.dados?.codigo || '').trim().toLowerCase();
            const linha = cod && nfe.itens.find(i => i.codigo.trim().toLowerCase() === cod);
            if (linha && Number.isFinite(linha.qtd) && linha.qtd > 0) { c.input.value = String(Math.min(linha.qtd, (c.i.qtd_milli - c.i.recebido_milli) / 1000)).replace('.', ','); casados++; }
            else c.input.value = '';
          }
          if (docForn && nfe.emitenteDoc && docForn !== nfe.emitenteDoc.replace(/\D/g, '')) avisos.push('ATENÇÃO: o CNPJ/CPF do emitente da nota (' + nfe.emitenteDoc + ') não é o do fornecedor do pedido.');
          const sobra = nfe.itens.length - casados;
          resumoXml.textContent = 'XML lido: NF ' + (nfe.numero || '—') + ' de ' + (nfe.emitenteNome || 'emitente não informado') + ', ' + nfe.itens.length + ' item(ns); ' + casados + ' casado(s) com o pedido pelo código do produto' + (sobra > 0 ? '. Itens sem correspondência ficam de fora: confira as quantidades abaixo.' : '.') + (avisos.length ? ' ' + avisos.join(' ') : '');
        } catch (e) { erro.textContent = e.message || 'Não foi possível ler o XML.'; arquivo.value = ''; }
      });
      const erro = el('p', { classe: 'cs-erro', role: 'alert' });
      const ok = el('button', { type: 'button', classe: 'cs-primario', texto: 'Confirmar recebimento', disabled: !gravacao(), onclick: async () => {
        ok.disabled = true; erro.textContent = '';
        try {
          if (!dep.value) throw Error('Escolha o depósito de destino.');
          const itens = campos.filter(c => c.input.value.trim() && Number(String(c.input.value).replace(',', '.')) > 0).map(c => ({ produto_id: c.i.produto_id, qtd_milli: milli(c.input.value) }));
          if (!itens.length) throw Error('Informe a quantidade recebida de ao menos um item.');
          const args = { e: empresa, pedido: p.id, deposito: dep.value, itens, documento: { numero: nf.value.trim() || null, chave_acesso: chave.value.trim() || null } };
          const k = JSON.stringify(args); if (!pendenteCompras || pendenteCompras.chave !== k) pendenteCompras = { chave: k, op: crypto.randomUUID() };
          const r = await W.MartinsProducaoRpc.comprasReceber({ ...args, op: pendenteCompras.op }); pendenteCompras = null;
          mensagem('Recebimento confirmado: entrada no estoque e obrigação de ' + reais(r.total_centavos) + ' gerada (pendente de conferência).'); await carregarCompras();
        } catch (e) { erro.textContent = traduzir(e); ok.disabled = !gravacao(); }
      } });
      corpo.replaceChildren(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Receber pedido nº ' + p.dados.numero + ' · ' + nomeF(p.dados.fornecedor_id) }),
        el('div', { classe: 'cs-acoes' }, dep, nf, chave), el('div', { classe: 'cs-acoes' }, arquivo), resumoXml, ...campos.map(c => el('div', { classe: 'cs-acoes' }, el('span', { texto: nomeP(c.i.produto_id) + ' (falta ' + qtd(c.i.qtd_milli - c.i.recebido_milli) + ')' }), c.input)),
        el('div', { classe: 'cs-acoes' }, ok, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Cancelar', onclick: () => carregarCompras() })), erro,
        el('p', { classe: 'cs-aviso', texto: 'Ao confirmar: o estoque recebe a entrada e é gerada a obrigação "pendente de conferência" (nada é pago automaticamente). A mesma nota não pode ser lançada duas vezes.' })));
    }
  }
  // ---------- Requisição de materiais da obra (v8): solicitar -> aprovar (Master) -> entregar ----------
  const SIT_REQ = { solicitada: 'Solicitada', aprovada: 'Aprovada', parcial: 'Entregue em parte', entregue: 'Entregue', recusada: 'Recusada', cancelada: 'Cancelada' };
  let pendenteReq = null, pendenteEntrega = null;
  async function enviarRequisicao(d) {
    const chave = JSON.stringify(d);
    if (!pendenteReq || pendenteReq.chave !== chave) { const cmd = api.prepare({ empresa, modulo: 'requisicoes_material', id: crypto.randomUUID(), revisao: 0, dados: d }); pendenteReq = { chave, op: cmd.operacao }; }
    const r = await api.send(pendenteReq.op); pendenteReq = null; return r;
  }
  async function carregarRequisicoes() {
    const [produtos, depositos, rdos, reqs] = await Promise.all([listarTodos('produtos').catch(() => []), listarTodos('depositos').catch(() => []), listarTodos('rdos').catch(() => []), listarTodos('requisicoes_material')]);
    const nomeObra = id => (catalogos.obras || []).find(x => x.id === id)?.nome || '—';
    const nomeP = id => { const p = produtos.find(x => x.id === id); return p ? [p.dados.codigo, p.dados.descricao || p.dados.nome].filter(Boolean).join(' · ') : '—'; };
    const corpo = painel.querySelector('[data-cs=corpo]'); const secoes = [];
    if (pode('requisicoes', 'criar')) {
      const obra = el('select', { id: 'rq-obra' }); obra.add(new Option('Obra', '')); for (const o of catalogos.obras || []) obra.add(new Option(o.nome, o.id));
      const rdo = el('select', { id: 'rq-rdo' });
      const preencherRdos = () => { rdo.replaceChildren(); rdo.add(new Option('Sem RDO específico', '')); for (const r of rdos.filter(x => x.dados.obra_id === obra.value)) rdo.add(new Option('RDO nº ' + (r.dados.numero ?? '') + ' · ' + String(r.dados.data || '').split('-').reverse().join('/'), r.id)); };
      const refRdo = el('p', { classe: 'cs-aviso', 'data-rq': 'ref-rdo', hidden: true });
      rdo.addEventListener('change', () => { const r = rdos.find(x => x.id === rdo.value), txt = String(r?.dados?.materiais || '').trim(); refRdo.hidden = !txt; refRdo.textContent = txt ? 'Materiais informados no RDO (texto livre, só para referência): ' + txt : ''; });
      preencherRdos(); obra.addEventListener('change', () => { preencherRdos(); refRdo.hidden = true; refRdo.textContent = ''; });
      const dep = el('select', { id: 'rq-deposito' }); dep.add(new Option('Depósito de origem', '')); for (const x of depositos.filter(z => z.dados.ativo !== false)) dep.add(new Option(x.dados.nome, x.id));
      const quando = el('input', { id: 'rq-data', type: 'date', 'aria-label': 'Necessário em' }); const obs = el('input', { id: 'rq-obs', type: 'text', placeholder: 'Observação (opcional)', maxlength: '500' });
      const linhas = el('div', {}); const erro = el('p', { classe: 'cs-erro', role: 'alert' });
      const novaLinha = () => { const p = el('select', { 'aria-label': 'Produto' }); p.add(new Option('Produto', '')); for (const x of produtos.filter(z => z.dados.ativo !== false)) p.add(new Option(nomeP(x.id), x.id));
        linhas.append(el('div', { classe: 'cs-acoes', 'data-linha': '' }, p, el('input', { type: 'text', inputmode: 'decimal', placeholder: 'Quantidade', 'aria-label': 'Quantidade' }))); };
      novaLinha();
      const enviar = el('button', { type: 'button', classe: 'cs-primario', texto: 'Enviar requisição', disabled: !gravacao(), onclick: async () => {
        enviar.disabled = true; erro.textContent = '';
        try {
          if (!obra.value) throw Error('Escolha a obra.'); if (!dep.value) throw Error('Escolha o depósito de origem.');
          const itens = [...linhas.querySelectorAll('[data-linha]')].map(l => { const [p, q] = l.querySelectorAll('select,input'); if (!p.value) throw Error('Escolha o material de cada linha.'); return { produto_id: p.value, qtd_milli: milli(q.value) }; });
          await enviarRequisicao({ obra_id: obra.value, rdo_id: rdo.value || null, deposito_id: dep.value, necessario_em: quando.value || null, observacao: obs.value.trim() || null, itens });
          mensagem('Requisição enviada e confirmada pelo servidor.'); await carregarRequisicoes();
        } catch (e) { erro.textContent = traduzir(e); enviar.disabled = !gravacao(); }
      } });
      secoes.push(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Nova requisição de material' }), el('div', { classe: 'cs-acoes' }, obra, rdo, dep, quando), refRdo, obs, linhas,
        el('div', { classe: 'cs-acoes' }, el('button', { type: 'button', classe: 'cs-secundario', texto: '+ Item', onclick: novaLinha }), enviar), erro,
        !produtos.length ? el('p', { classe: 'cs-aviso', texto: 'Cadastre produtos e depósitos antes de requisitar materiais.' }) : null));
    }
    const rows = reqs.slice().sort((a, b) => Number(b.dados.numero) - Number(a.dados.numero)).map(r => {
      const d = r.dados, acoes = el('div', { classe: 'cs-estado' });
      acoes.append(el('span', { classe: 'cs-selo cs-' + (d.estado === 'aprovada' ? 'aprovado' : d.estado === 'entregue' ? 'conciliado' : ['cancelada', 'recusada'].includes(d.estado) ? 'cancelado' : 'pendente_conferencia'), texto: SIT_REQ[d.estado] || d.estado }));
      const podeDecidir = master() && d.estado === 'solicitada', podeCancelar = pode('requisicoes', 'editar') && (d.estado === 'solicitada' || (d.estado === 'aprovada'));
      if (podeDecidir || podeCancelar) {
        const motivo = el('input', { type: 'text', placeholder: 'Motivo / observação', 'aria-label': 'Motivo' }); acoes.append(motivo);
        const mudar = estado => async () => { if (!motivo.value.trim()) { motivo.focus(); mensagem('Informe o motivo.', true); return; }
          try { await W.MartinsProducaoRpc.reqEstado({ e: empresa, r: r.id, v: Number(r.revisao), estado, motivo: motivo.value.trim(), op: crypto.randomUUID() }); await carregarRequisicoes(); } catch (e) { mensagem(traduzir(e), true); } };
        if (podeDecidir) { acoes.append(el('button', { type: 'button', classe: 'cs-secundario', texto: 'Aprovar', disabled: !gravacao(), onclick: mudar('aprovada') }), el('button', { type: 'button', classe: 'cs-perigo', texto: 'Recusar', disabled: !gravacao(), onclick: mudar('recusada') })); }
        if (podeCancelar) acoes.append(el('button', { type: 'button', classe: 'cs-perigo', texto: 'Cancelar', disabled: !gravacao(), onclick: mudar('cancelada') }));
      }
      if (['aprovada', 'parcial'].includes(d.estado) && pode('estoque', 'criar')) acoes.append(el('button', { type: 'button', classe: 'cs-primario', texto: 'Entregar', onclick: () => formEntregar(r) }));
      return el('tr', {}, el('td', { 'data-rotulo': 'Nº', texto: d.numero }), el('td', { 'data-rotulo': 'Obra', texto: nomeObra(d.obra_id) }),
        el('td', { 'data-rotulo': 'Entregue/Pedido', texto: d.itens.map(i => nomeP(i.produto_id).split(' · ')[0] + ' ' + qtd(i.entregue_milli) + '/' + qtd(i.qtd_milli)).join(', ') }), el('td', {}, acoes));
    });
    secoes.push(el('section', { 'data-rq': 'lista' }, el('h3', { texto: 'Requisições de material' }), el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' },
      el('thead', {}, el('tr', {}, ['Nº', 'Obra', 'Entregue/Pedido', 'Situação e ações'].map(x => el('th', { texto: x })))), el('tbody', {}, rows.length ? rows : [el('tr', {}, el('td', { colspan: 4, classe: 'cs-vazio', texto: 'Nenhuma requisição.' }))])))));
    corpo.replaceChildren(...secoes);
    mensagem('Requisições: ' + reqs.length + ' da empresa ativa.');
    function formEntregar(r) {
      const campos = r.dados.itens.filter(i => i.entregue_milli < i.qtd_milli).map(i => ({ i, input: el('input', { type: 'text', inputmode: 'decimal', value: ((i.qtd_milli - i.entregue_milli) / 1000).toString().replace('.', ','), 'aria-label': 'Quantidade entregue de ' + nomeP(i.produto_id) }) }));
      const erro = el('p', { classe: 'cs-erro', role: 'alert' });
      const ok = el('button', { type: 'button', classe: 'cs-primario', texto: 'Confirmar entrega', disabled: !gravacao(), onclick: async () => {
        ok.disabled = true; erro.textContent = '';
        try {
          const itens = campos.filter(c => c.input.value.trim() && Number(String(c.input.value).replace(',', '.')) > 0).map(c => ({ produto_id: c.i.produto_id, qtd_milli: milli(c.input.value) }));
          if (!itens.length) throw Error('Informe a quantidade entregue de ao menos um item.');
          const args = { e: empresa, requisicao: r.id, itens };
          const k = JSON.stringify(args); if (!pendenteEntrega || pendenteEntrega.chave !== k) pendenteEntrega = { chave: k, op: crypto.randomUUID() };
          const res = await W.MartinsProducaoRpc.reqEntregar({ ...args, op: pendenteEntrega.op }); pendenteEntrega = null;
          mensagem('Entrega confirmada: o estoque foi baixado e o consumo ficou registrado na obra (' + (SIT_REQ[res.estado] || res.estado).toLowerCase() + ').'); await carregarRequisicoes();
        } catch (e) { erro.textContent = traduzir(e); ok.disabled = !gravacao(); }
      } });
      corpo.replaceChildren(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Entregar requisição nº ' + r.dados.numero + ' · ' + nomeObra(r.dados.obra_id) }),
        ...campos.map(c => el('div', { classe: 'cs-acoes' }, el('span', { texto: nomeP(c.i.produto_id) + ' (falta ' + qtd(c.i.qtd_milli - c.i.entregue_milli) + ')' }), c.input)),
        el('div', { classe: 'cs-acoes' }, ok, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Cancelar', onclick: () => carregarRequisicoes() })), erro,
        el('p', { classe: 'cs-aviso', texto: 'Ao confirmar: o material sai do depósito da requisição e vira consumo da obra, na mesma operação. Não é possível entregar mais que o pedido nem mais que o saldo.' })));
    }
  }
  // ---------- Usuários e permissões (v9): somente Master ----------
  const ROTULO_MOD = { funcionarios: 'Funcionários (RH)', obras: 'Obras', planejamento: 'Planejamento', rdos: 'RDO (diário de obra)', frequencia: 'Frequência', orcamentos: 'Orçamentos (vendas)',
    clientes: 'Clientes', fornecedores: 'Fornecedores', vendedores: 'Vendedores', motoristas: 'Motoristas', veiculos: 'Veículos', produtos: 'Produtos e materiais', depositos: 'Depósitos',
    centros_custo: 'Centros de custo', contas_bancarias: 'Contas bancárias', despesas: 'Despesas (financeiro)', feriados: 'Feriados', precos_insumo: 'Preços de insumos', epis: 'EPIs e uniformes',
    estoque_movimentos: 'Estoque (movimentações)', pedidos_compra: 'Pedidos de compra', recebimentos_compra: 'Recebimentos de compra', frota_eventos: 'Frota (abastecimento e manutenção)',
    ausencias: 'Ausências e férias', cotacoes: 'Propostas de cotação', requisicoes_material: 'Requisições de material', contas_receber: 'Contas a receber (vendas)', pedidos_venda: 'Pedidos de venda' };
  // Modelos são só um atalho: preenchem a tela, o Master confere e salva. l = ver, c = criar, e = editar.
  const MODELOS = {
    'Almoxarife': { estoque_movimentos: 'lce', epis: 'lce', produtos: 'l', depositos: 'l', pedidos_compra: 'l', recebimentos_compra: 'l', requisicoes_material: 'l', obras: 'l', rdos: 'l' },
    'Mestre de obras (solicita material pelo celular)': { requisicoes_material: 'lc', obras: 'l', produtos: 'l', depositos: 'l', rdos: 'l' },
    'Engenharia': { obras: 'lce', planejamento: 'lce', rdos: 'lce', requisicoes_material: 'lce', frequencia: 'l', funcionarios: 'l', produtos: 'l', depositos: 'l', estoque_movimentos: 'l', orcamentos: 'l' },
    'RH / Departamento pessoal': { funcionarios: 'lce', frequencia: 'lce', ausencias: 'lce', epis: 'lce', feriados: 'lce', obras: 'l', rdos: 'l' },
    'Comercial / Vendedor': { clientes: 'lce', vendedores: 'l', orcamentos: 'lce', obras: 'l', contas_receber: 'l', pedidos_venda: 'l' },
    'Financeiro (contas a receber)': { contas_receber: 'lce', clientes: 'l', contas_bancarias: 'l', obras: 'l', orcamentos: 'l' },
    'Lançador financeiro': { despesas: 'lc', fornecedores: 'l', centros_custo: 'l', contas_bancarias: 'l', obras: 'l' },
    'Compras': { pedidos_compra: 'lce', fornecedores: 'lce', cotacoes: 'lce', produtos: 'l', precos_insumo: 'lce', centros_custo: 'l', obras: 'l' },
    'Somente leitura (sem financeiro)': Object.fromEntries(Object.keys(ROTULO_MOD).filter(m => !['despesas', 'contas_bancarias'].includes(m)).map(m => [m, 'l'])),
  };
  async function carregarUsuarios() {
    const corpo = painel.querySelector('[data-cs=corpo]');
    const lista = await W.MartinsProducaoRpc.usuariosListar(empresa);
    const erroGeral = el('p', { classe: 'cs-erro', role: 'alert' });
    const email = el('input', { id: 'us-email', type: 'email', placeholder: 'E-mail da conta já criada no Supabase Auth', autocomplete: 'off' }), nome = el('input', { id: 'us-nome', type: 'text', placeholder: 'Nome (opcional)', maxlength: '120' });
    const vincular = el('button', { type: 'button', classe: 'cs-primario', texto: 'Vincular à empresa', disabled: !gravacao(), onclick: async () => {
      vincular.disabled = true; erroGeral.textContent = '';
      try { await W.MartinsProducaoRpc.usuarioVincular({ e: empresa, op: crypto.randomUUID(), email: email.value.trim(), nome: nome.value.trim() || null }); mensagem('Conta vinculada. Ela ainda não tem acesso a nenhum módulo: defina as permissões.'); await carregarUsuarios(); }
      catch (e) { erroGeral.textContent = traduzir(e); vincular.disabled = !gravacao(); }
    } });
    const rows = lista.map(u => {
      const eu = u.usuario_id === uid, ativo = u.acesso_ativo && u.perfil_ativo, acoes = el('div', { classe: 'cs-estado' });
      acoes.append(el('span', { classe: 'cs-selo cs-' + (ativo ? 'aprovado' : 'cancelado'), texto: ativo ? 'Ativo' : 'Desativado' }));
      if (u.papel !== 'master') acoes.append(el('button', { type: 'button', classe: 'cs-secundario', texto: 'Permissões', onclick: () => editarPermissoes(u) }));
      if (!eu) acoes.append(el('button', { type: 'button', classe: ativo ? 'cs-perigo' : 'cs-secundario', texto: ativo ? 'Desativar' : 'Reativar', disabled: !gravacao(), onclick: async () => {
        try { await W.MartinsProducaoRpc.usuarioSituacao({ e: empresa, op: crypto.randomUUID(), usuario: u.usuario_id, ativo: !u.acesso_ativo }); await carregarUsuarios(); } catch (e) { mensagem(traduzir(e), true); } } }));
      const resumo = u.papel === 'master' ? 'Acesso total' : (Object.keys(u.permissoes).length ? Object.keys(u.permissoes).length + ' módulo(s)' : 'Nenhum módulo');
      return el('tr', {}, el('td', { 'data-rotulo': 'Nome', texto: u.nome || '—' }), el('td', { 'data-rotulo': 'E-mail', texto: u.email || '—' }), el('td', { 'data-rotulo': 'Papel', texto: u.papel === 'master' ? 'Master' : u.papel === 'administrador' ? 'Administrador' : 'Operacional' }),
        el('td', { 'data-rotulo': 'Acesso', texto: resumo }), el('td', {}, acoes));
    });
    corpo.replaceChildren(
      el('section', { classe: 'cs-form' }, el('h3', { texto: 'Vincular uma conta à empresa' }), el('div', { classe: 'cs-acoes' }, email, nome, vincular), erroGeral,
        el('p', { classe: 'cs-aviso', texto: 'A conta (e-mail e senha) é criada no painel do Supabase Auth; aqui você só a vincula a esta empresa. O vínculo nasce "operacional" e sem acesso a nenhum módulo. Master só é definido no banco.' })),
      el('section', {}, el('h3', { texto: 'Pessoas com acesso a esta empresa' }), el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' },
        el('thead', {}, el('tr', {}, ['Nome', 'E-mail', 'Papel', 'Acesso', 'Situação e ações'].map(x => el('th', { texto: x })))), el('tbody', {}, rows.length ? rows : [el('tr', {}, el('td', { colspan: 5, classe: 'cs-vazio', texto: 'Ninguém vinculado.' }))])))));
    mensagem('Usuários: ' + lista.length + ' vínculo(s) na empresa ativa.');
    function editarPermissoes(u) {
      const caixas = {}; const atual = u.permissoes || {};
      const marcar = (m, l, c, e) => { caixas[m].l.checked = l; caixas[m].c.checked = c; caixas[m].e.checked = e; };
      const linhas = Object.keys(ROTULO_MOD).map(m => {
        const p = atual[m] || {}; const cx = (rot, v) => el('input', { type: 'checkbox', 'aria-label': rot + ' ' + ROTULO_MOD[m], checked: v === true });
        caixas[m] = { l: cx('Ver', p.ler), c: cx('Criar', p.criar), e: cx('Editar', p.editar) };
        caixas[m].l.addEventListener('change', () => { if (!caixas[m].l.checked) { caixas[m].c.checked = false; caixas[m].e.checked = false; } });
        for (const k of ['c', 'e']) caixas[m][k].addEventListener('change', () => { if (caixas[m][k].checked) caixas[m].l.checked = true; });
        return el('tr', {}, el('td', { 'data-rotulo': 'Módulo', texto: ROTULO_MOD[m] }), el('td', { 'data-rotulo': 'Ver' }, caixas[m].l), el('td', { 'data-rotulo': 'Criar' }, caixas[m].c), el('td', { 'data-rotulo': 'Editar' }, caixas[m].e));
      });
      const modelo = el('select', { id: 'us-modelo', 'aria-label': 'Modelo de permissões' }); modelo.add(new Option('Aplicar um modelo…', '')); for (const k of Object.keys(MODELOS)) modelo.add(new Option(k, k));
      modelo.addEventListener('change', () => { const mod = MODELOS[modelo.value]; if (!mod) return; for (const m of Object.keys(ROTULO_MOD)) { const s = mod[m] || ''; marcar(m, s.includes('l'), s.includes('c'), s.includes('e')); } mensagem('Modelo aplicado na tela. Confira e clique em Salvar permissões.'); });
      const erro = el('p', { classe: 'cs-erro', role: 'alert' });
      const salvar = el('button', { type: 'button', classe: 'cs-primario', texto: 'Salvar permissões', disabled: !gravacao(), onclick: async () => {
        salvar.disabled = true; erro.textContent = '';
        try {
          const itens = Object.keys(ROTULO_MOD).map(m => ({ modulo: m, ler: caixas[m].l.checked, criar: caixas[m].c.checked, editar: caixas[m].e.checked }));
          await W.MartinsProducaoRpc.permissoesDefinir({ e: empresa, op: crypto.randomUUID(), usuario: u.usuario_id, itens });
          mensagem('Permissões salvas no servidor e valendo desde já para ' + (u.nome || u.email) + '.'); await carregarUsuarios();
        } catch (e) { erro.textContent = traduzir(e); salvar.disabled = !gravacao(); }
      } });
      corpo.replaceChildren(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Permissões de ' + (u.nome || u.email) }), el('p', { texto: u.email }), el('div', { classe: 'cs-acoes' }, modelo),
        el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' }, el('thead', {}, el('tr', {}, ['Módulo', 'Ver', 'Criar', 'Editar'].map(x => el('th', { texto: x })))), el('tbody', {}, linhas))),
        el('div', { classe: 'cs-acoes' }, salvar, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Voltar', onclick: () => carregarUsuarios() })), erro,
        el('p', { classe: 'cs-aviso', texto: 'Quem só tem "Ver" consulta, mas não grava. Despesas confidenciais continuam visíveis somente aos Masters, independentemente destas permissões.' })));
    }
  }
  // ---------- Gastos da obra (v12): custo do material consumido + despesas diretas ----------
  async function carregarGastosObra() {
    const corpo = painel.querySelector('[data-cs=corpo]');
    const produtos = await listarTodos('produtos').catch(() => []);
    const nomeP = id => { const p = produtos.find(x => x.id === id); return p ? [p.dados.codigo, p.dados.descricao || p.dados.nome].filter(Boolean).join(' · ') : '—'; };
    const obra = el('select', { id: 'go-obra', 'aria-label': 'Obra' }); obra.add(new Option('Escolha a obra…', '')); for (const o of catalogos.obras || []) obra.add(new Option([o.codigo, o.nome].filter(Boolean).join(' · '), o.id));
    const saida = el('div', { 'data-go': 'saida' }, el('p', { classe: 'cs-aviso', texto: 'Escolha uma obra para ver o custo do material consumido e as despesas diretas. Só Master e Administrador com leitura integral veem custos.' }));
    const consultar = async () => {
      if (!obra.value) { saida.replaceChildren(); return; }
      saida.replaceChildren(el('p', { texto: 'Consultando o servidor…' }));
      try {
        const g = await W.MartinsProducaoRpc.obraGastos({ e: empresa, obra: obra.value });
        const linhas = g.material.map(m => el('tr', {}, el('td', { 'data-rotulo': 'Material', texto: nomeP(m.produto_id) }), el('td', { 'data-rotulo': 'Consumo líquido', texto: qtd(m.liquido_milli) }),
          el('td', { 'data-rotulo': 'Custo médio unit.', texto: reais(m.custo_unitario_centavos) }), el('td', { 'data-rotulo': 'Custo', texto: reais(m.custo_centavos) })));
        saida.replaceChildren(
          el('section', {}, el('h3', { texto: 'Material consumido na obra' }), el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' },
            el('thead', {}, el('tr', {}, ['Material', 'Consumo líquido', 'Custo médio unit.', 'Custo'].map(x => el('th', { texto: x })))), el('tbody', {}, linhas.length ? linhas : [el('tr', {}, el('td', { colspan: 4, classe: 'cs-vazio', texto: 'Nenhum material com custo consumido nesta obra.' }))])))),
          g.sem_custo.length ? el('p', { classe: 'cs-aviso', texto: 'Sem custo (entrada manual, sem compra registrada), fora do total: ' + g.sem_custo.map(m => nomeP(m.produto_id) + ' (' + qtd(m.liquido_milli) + ')').join(', ') + '.' }) : null,
          el('section', { classe: 'cs-totais', 'data-go': 'resumo' }, el('h4', { texto: 'Resumo da obra (calculado no servidor)' }),
            el('div', { texto: 'Material consumido (valorizado): ' + reais(g.material_centavos) }), el('div', { texto: 'Despesas diretas da obra: ' + reais(g.despesas_diretas_centavos) + (g.confidenciais_incluidas_centavos ? ' (inclui ' + reais(g.confidenciais_incluidas_centavos) + ' confidenciais)' : '') }),
            el('strong', { texto: 'Total apropriado à obra: ' + reais(g.total_centavos) })),
          el('p', { classe: 'cs-aviso', texto: 'O custo do material usa o custo médio das compras recebidas (já descontadas as devoluções ao fornecedor), calculado agora: não congela o custo do dia do consumo. Compras feitas para a obra não são somadas às despesas, porque o material só vira custo da obra quando é consumido (' + reais(g.despesas_de_compras_nao_somadas_centavos) + ' de despesas de compras ficaram de fora para não contar duas vezes).' }));
      } catch (e) { saida.replaceChildren(el('p', { classe: 'cs-erro', role: 'alert', texto: traduzir(e) })); }
    };
    obra.addEventListener('change', consultar);
    corpo.replaceChildren(el('section', { classe: 'cs-form' }, el('h3', { texto: 'Gastos da obra' }), el('div', { classe: 'cs-acoes' }, obra)), saida);
    mensagem('Gastos da obra: escolha a obra.');
  }
  // ---------- Backup e restauração (v13): somente Master ----------
  async function carregarBackup() {
    const corpo = painel.querySelector('[data-cs=corpo]');
    const erroExp = el('p', { classe: 'cs-erro', role: 'alert' }), erroRes = el('p', { classe: 'cs-erro', role: 'alert' });
    const nomeArquivo = () => {
      const h = new Date(), d = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
      const emp = String(vinculo()?.nomeEmpresa || 'empresa').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      return 'backup-martins-' + emp + '-' + d + '.json';
    };
    const baixar = el('button', { type: 'button', id: 'bk-exportar', classe: 'cs-primario', texto: 'Gerar e baixar backup', disabled: !gravacao(), onclick: async () => {
      baixar.disabled = true; erroExp.textContent = '';
      try {
        const arq = await W.MartinsProducaoRpc.backupExportar(empresa);
        const blob = new Blob([JSON.stringify(arq)], { type: 'application/json' }), url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: nomeArquivo() }); D.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000);
        mensagem('Backup gerado: ' + arq.total + ' registro(s). Guarde o arquivo em local seguro.');
      } catch (e) { erroExp.textContent = traduzir(e); } finally { baixar.disabled = !gravacao(); }
    } });
    const resumo = el('div', { 'data-bk': 'resumo' });
    const arquivo = el('input', { id: 'bk-arquivo', type: 'file', accept: '.json,application/json', 'aria-label': 'Arquivo de backup' });
    const confirma = el('input', { id: 'bk-confirma', type: 'checkbox' });
    let carregado = null, opRestauro = null;
    const restaurar = el('button', { type: 'button', id: 'bk-restaurar', classe: 'cs-perigo', texto: 'Restaurar nesta empresa', disabled: true, onclick: async () => {
      erroRes.textContent = '';
      if (!carregado) return;
      if (!confirma.checked) { erroRes.textContent = 'Marque a confirmação antes de restaurar.'; return; }
      restaurar.disabled = true;
      try {
        const r = await W.MartinsProducaoRpc.backupImportar({ e: empresa, op: opRestauro, backup: carregado });
        mensagem('Restauração concluída: ' + r.total + ' registro(s) restaurado(s) nesta empresa. Recarregue as telas para vê-los.');
        carregado = null; resumo.replaceChildren(el('p', { classe: 'cs-aviso', texto: 'Restauração concluída (' + r.total + ' registros).' }));
      } catch (e) { erroRes.textContent = traduzir(e); restaurar.disabled = !gravacao(); }
    } });
    arquivo.addEventListener('change', async () => {
      erroRes.textContent = ''; carregado = null; restaurar.disabled = true; resumo.replaceChildren();
      const f = arquivo.files?.[0]; if (!f) return;
      try {
        if (f.size > 40 * 1024 * 1024) throw Error('Arquivo grande demais (limite de 40 MB).');
        const b = JSON.parse(await f.text());
        if (b?.formato !== 'martins-backup' || b?.versao_formato !== 1 || !Array.isArray(b.registros)) throw Error('Este arquivo não é um backup do Sistema Martins.');
        carregado = b; opRestauro = crypto.randomUUID();
        resumo.replaceChildren(el('p', { texto: 'Backup gerado em ' + new Date(b.gerado_em).toLocaleString('pt-BR') + ' · ' + b.total + ' registro(s) · checksum ' + String(b.checksum).slice(0, 8) + '…' }),
          el('ul', {}, Object.entries(b.por_modulo || {}).map(([m, n]) => el('li', { texto: (ROTULO_MOD[m] || m) + ': ' + n }))));
        restaurar.disabled = !gravacao();
      } catch (e) { erroRes.textContent = e instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : (e.message || 'Não foi possível ler o arquivo.'); }
    });
    corpo.replaceChildren(
      el('section', { classe: 'cs-form' }, el('h3', { texto: 'Exportar backup da empresa' }), el('div', { classe: 'cs-acoes' }, baixar), erroExp,
        el('p', { classe: 'cs-aviso', texto: 'O arquivo reúne todos os cadastros e lançamentos desta empresa (inclusive despesas confidenciais) e tem dados pessoais, como CPF e salários. Guarde em local seguro, não envie por e-mail nem publique. É uma cópia lógica extra: não substitui os backups do próprio Supabase.' })),
      el('section', { classe: 'cs-form' }, el('h3', { texto: 'Restaurar a partir de um backup' }), el('div', { classe: 'cs-acoes' }, arquivo), resumo,
        el('label', { classe: 'cs-campo cs-check' }, confirma, el('span', { texto: 'Entendo que a restauração só funciona em empresa vazia, é tudo ou nada e não pode ser desfeita por esta tela.' })),
        el('div', { classe: 'cs-acoes' }, restaurar), erroRes,
        el('p', { classe: 'cs-aviso', texto: 'A restauração confere o formato, a quantidade de registros e o checksum. Se a empresa já tiver dados, nada é alterado. Não restaura o histórico de auditoria nem as permissões dos usuários.' })));
    mensagem('Backup e restauração: somente Master.');
  }
  async function mostrarHistorico(reg) {
    const corpo = painel.querySelector('[data-cs=corpo]');
    const voltar = el('button', { type: 'button', classe: 'cs-secundario', texto: '← Voltar à lista', onclick: () => desenhar() });
    corpo.replaceChildren(el('h3', { texto: 'Histórico de alterações' }), el('p', { texto: 'Consultando o servidor…' }), voltar);
    try {
      const eventos = await W.MartinsProducaoRpc.auditoria({ e: empresa, m: aba, r: reg.id, limite: 100 });
      const ACOES = { criar: 'Criado', editar: 'Alterado' };
      const quando = v => new Date(v).toLocaleString('pt-BR');
      const linhas = eventos.map(ev => el('tr', {}, el('td', { texto: quando(ev.em) }), el('td', { texto: ev.autor }),
        el('td', { texto: ev.estado_antes && ev.estado_depois && ev.estado_antes !== ev.estado_depois ? 'Estado: ' + (ESTADOS[ev.estado_antes] || ev.estado_antes) + ' → ' + (ESTADOS[ev.estado_depois] || ev.estado_depois) : (ACOES[ev.acao] || ev.acao) }),
        el('td', { texto: ev.motivo || '' })));
      corpo.replaceChildren(el('h3', { texto: 'Histórico de alterações' }),
        eventos.length ? el('div', { classe: 'cs-rolagem' }, el('table', { classe: 'cs-tabela' }, el('thead', {}, el('tr', {}, ['Quando', 'Quem', 'O que', 'Motivo'].map(t => el('th', { texto: t })))), el('tbody', {}, linhas)))
          : el('p', { classe: 'cs-vazio', texto: 'Nenhum evento registrado para este item.' }), voltar);
    } catch (e) { corpo.replaceChildren(el('h3', { texto: 'Histórico de alterações' }), el('p', { classe: 'cs-erro', texto: traduzir(e) }), voltar); }
  }
  function acoesDespesa(reg) {
    const atual = reg.dados.estado || 'pendente_conferencia';
    const caixa = el('div', { classe: 'cs-estado', onclick: ev => ev.stopPropagation(), onkeydown: ev => ev.stopPropagation() });
    caixa.append(el('span', { classe: 'cs-selo cs-' + atual, texto: ESTADOS[atual] || atual }));
    if (reg.dados.confidencial) caixa.append(el('span', { classe: 'cs-selo cs-confidencial', texto: 'Confidencial' }));
    if (!master() || !PROXIMOS[atual]) return caixa;
    const motivo = el('input', { type: 'text', placeholder: 'Motivo / observação', 'aria-label': 'Motivo da mudança de estado' });
    caixa.append(motivo);
    for (const prox of PROXIMOS[atual]) {
      caixa.append(el('button', { type: 'button', classe: prox === 'cancelado' ? 'cs-perigo' : 'cs-secundario', texto: ACAO[prox], disabled: !gravacao(),
        onclick: async ev => {
          ev.stopPropagation();
          if (!motivo.value.trim()) { motivo.focus(); mensagem('Informe o motivo antes de mudar o estado.', true); return; }
          try { await mudarEstado(reg, prox, motivo.value.trim()); mensagem('Estado atualizado: ' + ESTADOS[prox] + '.'); await carregarAba(); }
          catch (e) { mensagem(traduzir(e), true); }
        } }));
    }
    return caixa;
  }
  // ---------- Contas a receber (v10) ----------
  // Data de HOJE no fuso do aparelho (toISOString usa UTC e, à noite no Brasil, já é "amanhã").
  const hojeLocal = () => { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0'); };
  function acoesReceber(reg) {
    const d = reg.dados, atual = d.estado || 'aberta';
    const caixa = el('div', { classe: 'cs-estado', onclick: ev => ev.stopPropagation(), onkeydown: ev => ev.stopPropagation() });
    caixa.append(el('span', { classe: 'cs-selo cs-' + (atual === 'recebida' ? 'conciliado' : atual === 'cancelada' ? 'cancelado' : 'pendente_conferencia'), texto: ESTADOS_REC[atual] || atual }));
    if (!pode('contas_receber', 'editar') && !master()) return caixa;
    const saldo = Number(d.valor_centavos || 0) - Number(d.recebido_centavos || 0);
    const rodar = async (ev, fn, ok) => { ev.stopPropagation(); try { await fn(); mensagem(ok); await carregarAba(); } catch (e) { mensagem(traduzir(e), true); } };
    const rev = Number(reg.revisao);
    if (['aberta', 'parcial'].includes(atual) && pode('contas_receber', 'editar')) {
      const valor = el('input', { type: 'text', inputmode: 'decimal', value: (saldo / 100).toFixed(2).replace('.', ','), 'aria-label': 'Valor recebido (R$)', size: '9' });
      const data = el('input', { type: 'date', value: hojeLocal(), 'aria-label': 'Data do recebimento' });
      const conta = el('select', { 'aria-label': 'Conta bancária do recebimento' }); conta.add(new Option('Conta (opcional)', '')); for (const c of catalogos.contas_bancarias || []) conta.add(new Option(c.nome, c.id));
      const motivo = el('input', { type: 'text', placeholder: 'Motivo (cancelar/estornar)', 'aria-label': 'Motivo' });
      caixa.append(valor, data, conta, motivo,
        el('button', { type: 'button', classe: 'cs-primario', texto: 'Registrar recebimento', disabled: !gravacao(), onclick: ev => rodar(ev, async () => {
          await W.MartinsProducaoRpc.receberBaixar({ e: empresa, op: crypto.randomUUID(), conta: reg.id, v: rev, valor: centavos(valor.value), data: data.value, conta_bancaria: conta.value || null, obs: null }); }, 'Recebimento registrado e confirmado pelo servidor.') }));
      if (atual === 'aberta' && !Number(d.recebido_centavos)) caixa.append(el('button', { type: 'button', classe: 'cs-perigo', texto: 'Cancelar título', disabled: !gravacao(), onclick: ev => { if (!motivo.value.trim()) { ev.stopPropagation(); motivo.focus(); mensagem('Informe o motivo do cancelamento.', true); return; }
        return rodar(ev, () => W.MartinsProducaoRpc.receberEstado({ e: empresa, op: crypto.randomUUID(), conta: reg.id, v: rev, estado: 'cancelada', motivo: motivo.value.trim() }), 'Título cancelado.'); } }));
      if (master() && atual === 'parcial') caixa.append(estornoBotao(reg, rev, motivo, rodar));
    } else if (master() && atual === 'recebida') {
      const motivo = el('input', { type: 'text', placeholder: 'Motivo do estorno', 'aria-label': 'Motivo do estorno' });
      caixa.append(motivo, estornoBotao(reg, rev, motivo, rodar));
    }
    return caixa;
  }
  function estornoBotao(reg, rev, motivo, rodar) {
    const ultima = [...(reg.dados.baixas || [])].reverse().find(b => !b.estornada);
    return el('button', { type: 'button', classe: 'cs-perigo', texto: 'Estornar último recebimento', disabled: !gravacao() || !ultima, onclick: ev => {
      if (!motivo.value.trim()) { ev.stopPropagation(); motivo.focus(); mensagem('Informe o motivo do estorno.', true); return; }
      return rodar(ev, () => W.MartinsProducaoRpc.receberEstornar({ e: empresa, op: crypto.randomUUID(), conta: reg.id, v: rev, baixa: ultima.id, motivo: motivo.value.trim() }), 'Recebimento estornado; ele continua registrado no histórico.'); } });
  }
  async function desenharTotaisReceber(alvo) {
    const caixa = el('section', { classe: 'cs-totais', 'data-rec': 'totais' }, el('h4', { texto: 'Resumo (calculado no servidor)' }));
    alvo.append(caixa);
    try {
      const t = await W.MartinsProducaoRpc.receberTotais(empresa);
      caixa.append(el('div', { texto: 'A receber: ' + reais(t.a_receber_centavos) + ' em ' + t.titulos_abertos + ' título(s)' }), el('div', { texto: 'Vencido: ' + reais(t.vencido_centavos) }), el('div', { texto: 'Recebido neste mês: ' + reais(t.recebido_mes_centavos) }));
    } catch (e) { caixa.append(el('span', { classe: 'cs-erro', texto: traduzir(e) })); }
  }
  async function desenharTotais(alvo) {
    if (!(master() || vinculo()?.papelServidor === 'administrador')) return;
    const hoje = new Date(); const de = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const ini = el('input', { type: 'date', value: iso(de), 'aria-label': 'Início do período' });
    const fim = el('input', { type: 'date', value: iso(hoje), 'aria-label': 'Fim do período' });
    const saida = el('div', { classe: 'cs-totais-saida' });
    const calcular = async () => {
      try {
        const t = await W.MartinsProducaoRpc.despesasTotais({ e: empresa, de: ini.value, ate: fim.value });
        // replaceChildren(null) escreveria o texto "null": só entram nós reais.
        saida.replaceChildren(...[el('strong', { texto: 'Total do período: ' + reais(t.total_centavos) }),
          ...t.por_centro_custo.map(c => el('div', { texto: (rotuloRef('centros_custo', c.centro_custo_id) || 'Centro inativo') + ': ' + reais(c.total_centavos) })),
          t.confidenciais_centavos !== null && Number(t.confidenciais_centavos) > 0 ? el('div', { texto: 'Despesas confidenciais (agregadas): ' + reais(t.confidenciais_centavos) }) : null].filter(Boolean));
      } catch (e) { saida.replaceChildren(el('span', { classe: 'cs-erro', texto: traduzir(e) })); }
    };
    alvo.append(el('section', { classe: 'cs-totais' }, el('h4', { texto: 'Totais por centro de custo' }),
      el('div', { classe: 'cs-acoes' }, ini, fim, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Calcular', onclick: calcular })), saida));
  }
  function desenhar() {
    const def = MODULOS[aba];
    const corpo = painel.querySelector('[data-cs=corpo]');
    const busca = el('input', { type: 'search', placeholder: 'Pesquisar…', 'aria-label': 'Pesquisar ' + def.titulo });
    const contagem = el('span', { 'aria-live': 'polite', style: 'color:#64748b;font-size:13px' });
    const topo = el('div', { classe: 'cs-acoes' }, busca, contagem,
      pode(aba, 'criar') && !def.somenteLeitura ? el('button', { type: 'button', classe: 'cs-primario', texto: '+ Novo', onclick: () => abrirFormulario(null) }) : null,
      aba === 'despesas' && W.MartinsPainelServidor ? el('button', { type: 'button', classe: 'cs-secundario', texto: 'Exportar CSV', onclick: () => W.MartinsPainelServidor.exportarDespesasCsv().catch(e => mensagem(traduzir(e), true)) }) : null);
    const tabela = el('table', { classe: 'cs-tabela' });
    tabela.append(el('thead', {}, el('tr', {}, def.colunas.map(c => el('th', { texto: (def.campos.find(x => x[0] === c)?.[1] || c).replace(/ \(.+\)$/, '') })), def.semAtivo ? null : el('th', { texto: 'Situação' }), el('th', { texto: 'Histórico' }))));
    const tbody = el('tbody');
    const linhas = [...registros.values()].sort((a, b) => String(b.dados.competencia || '').localeCompare(String(a.dados.competencia || '')) || String(a.dados.nome || a.dados.descricao || '').localeCompare(String(b.dados.nome || b.dados.descricao || '')));
    const render = () => {
      const q = busca.value.trim().toLowerCase();
      // A busca cobre o que a tabela mostra (ex.: código do centro de custo), além dos dados brutos.
      const palheiro = r => (JSON.stringify(r.dados) + ' ' + def.colunas.map(c => formatar(aba, c, r.dados)).join(' ')).toLowerCase();
      const achados = linhas.filter(r => !q || palheiro(r).includes(q));
      contagem.textContent = q ? achados.length + ' de ' + linhas.length + ' registro(s)' : linhas.length + ' registro(s)';
      tbody.replaceChildren(...achados.map(r => {
        const tr = el('tr', { tabindex: 0, onclick: () => pode(aba, 'editar') && !def.somenteLeitura && abrirFormulario(r), onkeydown: ev => ev.key === 'Enter' && pode(aba, 'editar') && !def.somenteLeitura && abrirFormulario(r) },
          def.colunas.map(c => el('td', { 'data-rotulo': (def.campos.find(x => x[0] === c)?.[1] || c), texto: c === 'estado' ? null : String(formatar(aba, c, r.dados)) }, c === 'estado' ? (aba === 'contas_receber' ? acoesReceber(r) : acoesDespesa(r)) : null)),
          def.semAtivo ? null : el('td', { 'data-rotulo': 'Situação', texto: r.dados.ativo === false ? 'Inativo' : 'Ativo' }),
          el('td', { 'data-rotulo': 'Histórico', onclick: ev => ev.stopPropagation() }, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Histórico', 'aria-label': 'Ver histórico de alterações', onclick: ev => { ev.stopPropagation(); mostrarHistorico(r); } })));
        if (r.dados.ativo === false) tr.classList.add('cs-inativo');
        return tr;
      }));
      if (!tbody.children.length) tbody.append(el('tr', {}, el('td', { colspan: 9, classe: 'cs-vazio', texto: linhas.length ? 'Nada encontrado.' : 'Nenhum cadastro nesta empresa.' })));
    };
    busca.addEventListener('input', render);
    tabela.append(tbody); render();
    corpo.replaceChildren(topo, el('div', { classe: 'cs-rolagem' }, tabela));
    if (aba === 'despesas') desenharTotais(corpo);
    if (aba === 'contas_receber') desenharTotaisReceber(corpo);
  }
  function desenharAbas() {
    const nav = painel.querySelector('[data-cs=abas]');
    const visiveis = ORDEM.filter(m => pode(m, 'ler'));
    if (!visiveis.includes(aba)) aba = visiveis[0] || null;
    nav.replaceChildren(...visiveis.map(m => el('button', { type: 'button', role: 'tab', 'aria-selected': String(m === aba), classe: 'cs-aba', texto: MODULOS[m].titulo,
      onclick: () => { aba = m; desenharAbas(); carregarAba().catch(e => mensagem(traduzir(e), true)); } })));
    if (!visiveis.length) { painel.querySelector('[data-cs=corpo]').replaceChildren(el('p', { classe: 'cs-vazio', texto: 'Seu vínculo não tem permissão de leitura em nenhum cadastro desta empresa. Peça a liberação ao Master.' })); }
  }
  async function abrir(inicial, preenchimento = null) {
    if (!painel) montar();
    painel.hidden = false; D.body.classList.add('cs-aberto');
    try { await sincronizarSessao(); painel.querySelector('[data-cs=empresa]').textContent = (vinculo()?.nomeEmpresa || '') + (master() ? ' · Master' : '') + (gravacao() ? '' : ' · somente leitura'); if (MODULOS[inicial] && pode(inicial, 'ler')) aba = inicial; desenharAbas(); if (aba) await carregarAba();
      if (preenchimento && !['estoque', 'compras', 'requisicoes', 'usuarios', 'gastos_obra', 'backup'].includes(inicial) && aba !== inicial) { mensagem('O cadastro de ' + (MODULOS[inicial]?.titulo || inicial).toLowerCase() + ' ainda não está liberado para o seu vínculo nesta empresa (ou o módulo não foi habilitado no servidor). Nada foi gravado no navegador.', true); return; }
      if (preenchimento && !['estoque', 'compras', 'requisicoes', 'usuarios', 'gastos_obra', 'backup'].includes(inicial) && aba === inicial) {
        if (!pode(aba, 'criar')) { mensagem('Seu vínculo não tem permissão para cadastrar ' + MODULOS[aba].titulo.toLowerCase() + '. Peça a liberação ao Master.', true); return; }
        abrirFormulario(null, preenchimento);
        mensagem('Este cadastro agora é gravado no servidor e compartilhado com a equipe. Confira os dados trazidos do formulário e clique em Salvar.');
      } }
    catch (e) { mensagem(traduzir(e), true); }
  }
  function fechar() { if (painel) painel.hidden = true; D.body.classList.remove('cs-aberto'); }
  let estilosInstalados = false;
  function montar() {
    estilos();
    montarPainel();
  }
  function estilos() {
    if (estilosInstalados) return; estilosInstalados = true;
    D.head.append(el('style', { texto: `
      #financeiro-servidor{font-family:Inter,system-ui,sans-serif;color:#0f172a;padding:16px;max-width:1100px}
      #financeiro-servidor h2{font-size:20px;font-weight:800;margin:0 0 4px}#financeiro-servidor>p{color:#475569;margin:0 0 16px;font-size:14px}
      .fin-resumo{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
      .fin-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px}.fin-card small{display:block;color:#64748b;font-weight:700;font-size:11px;text-transform:uppercase}
      .fin-card strong{display:block;font-size:22px;font-weight:800;margin-top:4px}
      .fin-atalhos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
      .fin-atalho{text-align:left;background:#0f172a;color:#fff;border:0;border-radius:12px;padding:16px;cursor:pointer;min-height:44px}
      .fin-atalho:hover{background:#1e293b}.fin-atalho b{display:block;color:#fbbf24;font-size:15px}.fin-atalho span{display:block;color:#cbd5e1;font-size:13px;margin-top:4px}
      #financeiro-servidor .fin-pendente{margin:16px 0 0;background:#fef3c7;color:#78350f;border-radius:10px;padding:10px 12px;font-size:13px}
      .fin-erro{color:#b91c1c;font-weight:600}
`}));
  }
  function montarPainel() {
    D.head.append(el('style', { texto: `
      #cs-painel{position:fixed;inset:0;z-index:10200;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}
      #cs-painel[hidden]{display:none}body.cs-aberto{overflow:hidden}
      #cs-painel header{background:#0f172a;color:#fff;padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between}
      #cs-painel header h2{font-size:16px;font-weight:800;margin:0}#cs-painel header small{color:#fbbf24;font-weight:600}
      #cs-painel nav{display:flex;gap:6px;overflow-x:auto;padding:10px 16px;background:#1e293b;scrollbar-width:thin}
      .cs-aba{white-space:nowrap;border:0;border-radius:999px;padding:8px 14px;background:#334155;color:#e2e8f0;font-weight:600;cursor:pointer}
      .cs-aba[aria-selected=true]{background:#f59e0b;color:#0f172a}
      [data-cs=status]{padding:8px 16px;font-size:13px;color:#334155;min-height:20px}[data-cs=status][data-erro=true]{color:#b91c1c;font-weight:600}
      [data-cs=corpo]{flex:1;overflow:auto;padding:0 16px 24px}
      .cs-acoes{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
      .cs-acoes input{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;min-width:0}
      .cs-primario,.cs-secundario,.cs-perigo{border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}
      .cs-primario{background:#f59e0b;color:#0f172a}.cs-secundario{background:#e2e8f0;color:#0f172a}.cs-perigo{background:#fee2e2;color:#991b1b}
      button:disabled{opacity:.5;cursor:not-allowed}
      .cs-rolagem{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px}
      .cs-tabela{width:100%;border-collapse:collapse;font-size:14px}.cs-tabela th{text-align:left;background:#f1f5f9;padding:10px;font-size:12px;text-transform:uppercase;color:#475569}
      .cs-tabela td{padding:10px;border-top:1px solid #f1f5f9;vertical-align:top}.cs-tabela tbody tr{cursor:pointer}.cs-tabela tbody tr:hover{background:#fffbeb}
      .cs-inativo{opacity:.55}.cs-vazio{color:#64748b;text-align:center;padding:24px}
      .cs-form{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:12px;max-width:900px}
      .cs-form h3{margin:0 0 12px;font-size:16px;font-weight:800}
      .cs-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
      .cs-campo{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;color:#334155}
      .cs-campo input,.cs-campo select,.cs-campo textarea{border:1px solid #cbd5e1;border-radius:8px;padding:9px 10px;font:inherit;font-weight:400;color:#0f172a;background:#fff}
      .cs-check{flex-direction:row;align-items:center;gap:8px;grid-column:1/-1}
      .cs-erro{color:#b91c1c;font-weight:600;min-height:1em}.cs-aviso{color:#92400e;background:#fef3c7;padding:8px 10px;border-radius:8px}
      .cs-estado{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.cs-estado input{border:1px solid #cbd5e1;border-radius:6px;padding:6px;min-width:140px}
      .cs-selo{border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;background:#e2e8f0}
      .cs-pendente_conferencia{background:#fef3c7;color:#92400e}.cs-aprovado{background:#dbeafe;color:#1e40af}.cs-pago,.cs-confirmado{background:#dcfce7;color:#166534}
      .cs-conciliado{background:#0f172a;color:#fff}.cs-cancelado{background:#fee2e2;color:#991b1b}.cs-confidencial{background:#1e293b;color:#fbbf24}
      .cs-totais{margin-top:16px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px}.cs-totais h4{margin:0 0 6px}
      @media (max-width:640px){
        .cs-tabela thead{display:none}.cs-tabela tr{display:block;border-top:1px solid #e2e8f0;padding:8px 0}
        .cs-tabela td{display:flex;justify-content:space-between;gap:12px;border:0;padding:4px 12px}
        .cs-tabela td::before{content:attr(data-rotulo);font-weight:700;color:#64748b;font-size:12px}
        .cs-grade{grid-template-columns:1fr}
      }` }));
    painel = el('div', { id: 'cs-painel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cadastros e Despesas', hidden: true },
      el('header', {}, el('div', {}, el('h2', { texto: 'Cadastros e Despesas' }), el('small', { 'data-cs': 'empresa' })),
        el('button', { type: 'button', classe: 'cs-secundario', texto: 'Fechar', onclick: fechar })),
      el('nav', { role: 'tablist', 'data-cs': 'abas' }),
      el('div', { 'data-cs': 'status', role: 'status' }),
      el('div', { 'data-cs': 'corpo' }));
    D.body.append(painel);
    D.addEventListener('keydown', ev => { if (ev.key === 'Escape' && painel && !painel.hidden) fechar(); });
  }
  function instalarBotao() {
    montarFinanceiro();
    const barra = D.getElementById('barra-producao');
    if (!barra || barra.querySelector('[data-cs=abrir]')) return;
    barra.append(el('button', { type: 'button', 'data-cs': 'abrir', texto: 'Cadastros e Despesas', onclick: () => abrir() }));
  }

  // ---------- Página do Financeiro ----------
  // O Financeiro legado grava só no navegador e fica oculto pelo index.html. Esta página é a entrada
  // do financeiro no servidor: resumo das despesas e atalhos para os cadastros financeiros.
  const ATALHOS = [['despesas', 'Despesas', 'Lançar, conferir, aprovar, pagar e conciliar'], ['centros_custo', 'Centros de custo', 'Obra ou administrativo, sem texto livre'],
    ['contas_bancarias', 'Contas bancárias', 'Contas por empresa'], ['fornecedores', 'Fornecedores e beneficiários', 'CPF/CNPJ único por empresa']];
  let resumoEmCurso = null;
  function montarFinanceiro() {
    const view = D.getElementById('view-financeiro');
    if (!view || D.getElementById('financeiro-servidor')) return;
    estilos();
    const sec = el('section', { id: 'financeiro-servidor', 'aria-labelledby': 'fin-titulo' },
      el('h2', { id: 'fin-titulo', texto: 'Financeiro' }),
      el('p', { texto: 'Dados gravados no servidor e compartilhados com a equipe autorizada da empresa ativa.' }),
      el('div', { classe: 'fin-resumo', 'data-fin': 'resumo' }),
      el('div', { classe: 'fin-atalhos', 'data-fin': 'atalhos' }),
      el('p', { classe: 'fin-pendente', texto: 'Ainda não ligados ao servidor: fluxo de caixa, DRE/DFC, contas a receber e conciliação por extrato (OFX/CSV). Esses relatórios serão liberados quando os contratos correspondentes forem concluídos.' }));
    view.prepend(sec);
    new MutationObserver(() => { if (!view.classList.contains('hidden') && view.offsetParent !== null) atualizarFinanceiro(); }).observe(view, { attributes: true, attributeFilter: ['class', 'style'] });
    if (view.offsetParent !== null) atualizarFinanceiro();
  }
  function atualizarFinanceiro() {
    if (resumoEmCurso) return resumoEmCurso;
    resumoEmCurso = (async () => {
      const sec = D.getElementById('financeiro-servidor'); if (!sec) return;
      const resumo = sec.querySelector('[data-fin=resumo]'), atalhos = sec.querySelector('[data-fin=atalhos]');
      try {
        await sincronizarSessao();
        atalhos.replaceChildren(...ATALHOS.filter(([m]) => pode(m, 'ler')).map(([m, t, d]) => el('button', { type: 'button', classe: 'fin-atalho', onclick: () => abrir(m) }, el('b', { texto: t }), el('span', { texto: d }))));
        if (!atalhos.children.length) atalhos.append(el('p', { texto: 'Seu vínculo não tem acesso ao Financeiro desta empresa. Peça a liberação ao Master.' }));
        if (!pode('despesas', 'ler')) { resumo.replaceChildren(); return; }
        const despesas = await listarTodos('despesas');
        const mes = new Date().toISOString().slice(0, 7);
        const ativas = despesas.filter(r => r.dados.estado !== 'cancelado');
        const pendentes = ativas.filter(r => (r.dados.estado || 'pendente_conferencia') === 'pendente_conferencia');
        const doMes = ativas.filter(r => String(r.dados.competencia || '').startsWith(mes));
        const soma = l => l.reduce((t, r) => t + Number(r.dados.valor_centavos || 0), 0);
        resumo.replaceChildren(
          el('div', { classe: 'fin-card' }, el('small', { texto: 'Pendentes de conferência' }), el('strong', { texto: String(pendentes.length) }), el('span', { texto: reais(soma(pendentes)) })),
          el('div', { classe: 'fin-card' }, el('small', { texto: 'Despesas do mês' }), el('strong', { texto: reais(soma(doMes)) }), el('span', { texto: doMes.length + ' lançamento(s)' })),
          el('div', { classe: 'fin-card' }, el('small', { texto: master() ? 'Visão' : 'Seus lançamentos' }), el('strong', { texto: master() ? 'Master' : String(despesas.length) }), el('span', { texto: master() ? 'Inclui despesas confidenciais' : 'Somente os lançados por você' })));
      } catch (e) { resumo.replaceChildren(el('p', { classe: 'fin-erro', texto: traduzir(e) })); }
      finally { resumoEmCurso = null; }
    })();
    return resumoEmCurso;
  }

  // ---------- Nenhum cadastro só no navegador ----------
  // Formulários legados de cadastro gravavam em localStorage (dados presos ao aparelho de quem lançou).
  // Agora o envio é interceptado antes do código legado e abre o cadastro do servidor já preenchido.
  const LEGADOS = {
    'form-principal-cadastro-cliente': ['clientes', { 'cad-cli-nome': 'nome', 'cad-cli-doc': 'documento', 'cad-cli-tel': 'telefone', 'cad-cli-email': 'email', 'cad-cli-cidade': 'cidade', 'cad-cli-obs': 'observacao' }],
    'form-novo-cliente-rapido': ['clientes', { 'cli-inp-nome': 'nome', 'cli-inp-doc': 'documento', 'cli-inp-tel': 'telefone', 'cli-inp-cidade': 'cidade', 'cli-inp-obs': 'observacao' }],
    'form-cadastro-vendedor-estab': ['vendedores', { 'vend-inp-nome': 'nome', 'vend-inp-tel': 'telefone', 'vend-inp-comissao': 'comissao_pct:numero' }],
    'form-cadastro-motorista-estab': ['motoristas', { 'mot-inp-nome': 'nome', 'mot-inp-cnh': 'cnh_numero', 'mot-inp-cat': 'cnh_categoria', 'mot-inp-validade': 'cnh_validade' }],
    'form-cadastro-veiculo-frota': ['veiculos', { 'frota-veic-placa': 'placa', 'frota-veic-modelo': 'modelo', 'frota-veic-tipo': 'tipo', 'frota-veic-combustivel': 'combustivel:minusculo' }],
    'form-cadastrar-produto-4secoes-fase22': ['produtos', { 'cp22-sku': 'codigo', 'cp22-nome': 'descricao', 'cp22-categoria': 'categoria', 'cp22-descricao': 'observacao' }],
    'form-cadastrar-produto-fator': ['produtos', { 'prod-fator-codigo': 'codigo', 'prod-fator-nome': 'descricao', 'prod-fator-un-fator': 'unidade:maiusculo', 'prod-fator-segmento': 'categoria' }],
    'form-cadastrar-deposito-v168': ['depositos', { 'dep-inp-nome': 'nome', 'dep-inp-endereco': 'localizacao' }],
    'form-cadastro-cc-lote2': ['centros_custo', { 'inp-cc-codigo-lote2': 'codigo', 'inp-cc-nome-lote2': 'nome', 'inp-cc-descricao-lote2': 'descricao', 'inp-cc-escopo-lote2': 'tipo:escopo' }],
    'form-cadastro-hierarquico-cc-fase22': ['centros_custo', { 'cc-h-codigo': 'codigo', 'cc-h-nome': 'nome' }],
    'form-cadastro-edicao-conta-bancaria-estab': ['contas_bancarias', { 'cta-inp-nome': 'nome', 'cta-inp-banco': 'banco', 'cta-inp-agencia': 'agencia', 'cta-inp-conta': 'conta' }],
    'form-editar-conta-bancaria-v171': ['contas_bancarias', { 'edit-cta-nome': 'nome', 'edit-cta-banco': 'banco', 'edit-cta-agencia': 'agencia', 'edit-cta-conta': 'conta' }],
    'form-adicionar-feriado': ['feriados', { 'inp-novo-feriado-data': 'data', 'inp-novo-feriado-nome': 'nome' }],
    'form-cadastrar-preco-insumo': ['precos_insumo', { 'preco-inp-nome': 'nome', 'preco-inp-categoria': 'categoria', 'preco-inp-unidade': 'unidade', 'preco-inp-valor': 'preco_centavos:dinheiro', 'preco-inp-data': 'data', 'preco-inp-rendimento': 'rendimento', 'preco-inp-fornecedor': 'observacao' }],
    'form-cadastrar-estoque-epi': ['epis', { 'cad-epi-nome': 'nome', 'cad-epi-codigo': 'codigo', 'cad-epi-categoria': 'categoria', 'cad-epi-tamanho': 'tamanho', 'cad-epi-preco': 'preco_centavos:dinheiro', 'cad-epi-minimo': 'estoque_minimo:numero' }],
    'form-novo-pedido-compra': ['compras', {}],
    'form-completo-pedido-compra-fase23': ['compras', {}],
    'form-movimento-estoque': ['estoque', {}],
    'form-movimentacao-entrada-saida-fase22': ['estoque', {}],
    'form-abastecimento-manutencao-frota': ['frota_eventos', { 'frota-ev-tipo': 'tipo:minusculo', 'frota-ev-km': 'km:numero', 'frota-ev-litros': 'litros:numero', 'frota-ev-valor': 'valor_centavos:dinheiro', 'frota-ev-posto': 'posto' }],
    'form-registro-ausencia-rh-estab': ['ausencias', { 'aus-inp-tipo': 'tipo:minusculo', 'aus-inp-inicio': 'inicio', 'aus-inp-fim': 'fim', 'aus-inp-motivo': 'motivo', 'aus-inp-situacao': 'situacao:situacao' }],
    'form-plano-ferias-fase22': ['ausencias', { 'pf-inp-inicio': 'inicio', 'pf-inp-fim': 'fim', 'pf-inp-situacao': 'situacao:situacao', 'pf-inp-obs': 'motivo' }],
    'form-lancar-proposta-cotacao-f29': ['cotacoes', { 'cot29-fornecedor': 'fornecedor_nome', 'cot29-subtotal': 'subtotal_centavos:dinheiro', 'cot29-frete': 'frete_centavos:dinheiro', 'cot29-desconto': 'desconto_centavos:dinheiro', 'cot29-prazo': 'prazo_dias:numero', 'cot29-condicao': 'condicao' }],
    'form-registrar-movimentacao-fin': ['despesas', { 'fin-reg-descricao': 'descricao', 'fin-reg-valor': 'valor_centavos:dinheiro', 'fin-reg-vencimento': 'vencimento' }],
  };
  // Não viram cadastro: contas de acesso nascem no Supabase Auth; empresas são provisionadas no banco.
  const BLOQUEADOS = {
    'form-novo-fiscal': 'Acesso de fiscal externo é uma conta de login: deve ser criado pelo administrador no Supabase Auth, nunca com senha guardada no navegador.',
    'form-cadastro-nfe-fiscal': 'A nota fiscal de compra agora é registrada no recebimento do pedido (Cadastros e Despesas → Compras → Receber), onde você também pode importar o XML da NF-e. O servidor evita lançar a mesma nota duas vezes.',
    'form-cadastrar-empresa': 'As empresas do grupo são cadastradas no banco pelo administrador. Peça a inclusão ou alteração ao Master responsável.',
  };
  function converter(valor, tipo) {
    if (valor === '' || valor === null || valor === undefined) return undefined;
    if (tipo === 'numero') { const n = Number(String(valor).replace(',', '.')); return Number.isFinite(n) ? n : undefined; }
    if (tipo === 'dinheiro') { try { return centavos(String(valor).includes(',') ? valor : String(valor).replace('.', ',')); } catch { return undefined; } }
    if (tipo === 'minusculo') return String(valor).toLowerCase();
    if (tipo === 'maiusculo') return String(valor).toUpperCase();
    if (tipo === 'situacao') {
      const s = String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '_');
      return { programadas: 'programado', usufruidas: 'usufruido' }[s] || s;
    }
    if (tipo === 'escopo') return /obra/i.test(valor) ? 'obra' : 'administrativo';
    return valor;
  }
  function lerLegado(form, mapa) {
    const d = {};
    for (const [campo, destino] of Object.entries(mapa)) {
      const [chave, tipo] = destino.split(':');
      const elemento = form.querySelector('#' + CSS.escape(campo)) || D.getElementById(campo);
      const v = converter(elemento?.value?.trim(), tipo);
      if (v !== undefined) d[chave] = chave === 'observacao' && d.observacao ? d.observacao + ' · ' + v : v;
    }
    return d;
  }
  function avisar(texto) { if (typeof W.showToast === 'function') W.showToast(texto, 'warning'); else mensagem(texto, true); }
  D.addEventListener('submit', ev => {
    const form = ev.target;
    const id = form?.id || '';
    const chave = LEGADOS[id] ? id : (/^form-cadastro-motorista-/.test(id) ? 'form-cadastro-motorista-estab' : null);
    if (!chave && !BLOQUEADOS[id]) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    form.closest('[id^=modal-]')?.classList.add('hidden');
    if (BLOQUEADOS[id]) { avisar(BLOQUEADOS[id]); return; }
    if (id === 'form-registrar-movimentacao-fin' && /entrada|receita|receb/i.test(form.querySelector('#fin-reg-tipo')?.value || '')) {
      abrir('contas_receber', lerLegado(form, { 'fin-reg-descricao': 'descricao', 'fin-reg-valor': 'valor_centavos:dinheiro', 'fin-reg-vencimento': 'vencimento' })); return;
    }
    const [modulo, mapa] = LEGADOS[chave];
    const preenchimento = lerLegado(form, mapa);
    if (id === 'form-plano-ferias-fase22') { preenchimento.tipo = 'ferias'; preenchimento.situacao = preenchimento.situacao || 'programado'; }
    abrir(modulo, preenchimento);
  }, true);

  // Defesa em profundidade: funções legadas que criam/alteram cadastros direto no navegador ficam
  // indisponíveis, mesmo que outro trecho do código legado tente redefini-las depois.
  const FUNCOES_LEGADAS = {
    cadastrarOuEditarVendedorComercial: 'vendedores', cadastrarOuEditarMotoristaFrota: 'motoristas', submeterNovoVeiculoFrotaUi: 'veiculos',
    cadastrarOuEditarProdutoMultimedidaFase22: 'produtos', salvarProdutoFatorForm: 'produtos', salvarProdutoComFatorConversaoValidado: 'produtos',
    salvarNovoDepositoFormUi: 'depositos', cadastrarOuEditarDepositoEstoque: 'depositos', cadastrarDepositoEstoqueRapido: 'depositos',
    salvarItemOuSubitemCentroCustoFase22: 'centros_custo', cadastrarOuEditarCentroDeCusto: 'centros_custo',
    salvarContaBancariaEstab: 'contas_bancarias', salvarEdicaoContaBancariaV171: 'contas_bancarias', cadastrarOuEditarContaCorrenteBancaria: 'contas_bancarias',
    submeterAbastecimentoFrotaUi: 'frota_eventos', salvarMovimentoEstoqueForm: 'estoque', registrarEntradaOuSaidaEstoqueFase22: 'estoque', submeterFormularioPrincipalClienteUi: 'clientes', salvarNovoClienteRapidoForm: 'clientes',
  };
  // Só reage com aviso/painel quando a chamada vem de uma ação recente da pessoa; chamadas automáticas
  // do código legado (ex.: semear dados de demonstração na carga) são recusadas em silêncio.
  let ultimaAcao = 0;
  for (const tipo of ['pointerdown', 'keydown', 'submit']) D.addEventListener(tipo, () => { ultimaAcao = Date.now(); }, true);
  for (const [nome, modulo] of Object.entries(FUNCOES_LEGADAS)) {
    const bloqueio = function () {
      const evento = arguments[0];
      if (evento && typeof evento.preventDefault === 'function') evento.preventDefault();
      if (Date.now() - ultimaAcao > 2000) return { sucesso: false, codigo: 'CADASTRO_NO_SERVIDOR', erro: 'Cadastro local desativado.' };
      avisar('Cadastro de ' + MODULOS[modulo].titulo.toLowerCase() + ' agora é feito em "Cadastros e Despesas" (gravado no servidor).');
      abrir(modulo);
      return { sucesso: false, codigo: 'CADASTRO_NO_SERVIDOR', erro: 'Use Cadastros e Despesas: o cadastro é gravado no servidor.' };
    };
    try { Object.defineProperty(W, nome, { configurable: false, enumerable: true, get: () => bloqueio, set: () => {} }); } catch (_) { /* já protegido */ }
  }

  W.MartinsCadastrosServidor = Object.freeze({ abrir, fechar, atualizarFinanceiro, modulos: ORDEM.slice() });
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', instalarBotao); else instalarBotao();
  new MutationObserver(instalarBotao).observe(D.documentElement, { childList: true, subtree: true });
})();
