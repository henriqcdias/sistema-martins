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
  };
  const ORDEM = Object.keys(MODULOS);
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
  const pode = (m, a) => vinculo()?.permissoes?.[m]?.[a] === true;
  const master = () => vinculo()?.papelServidor === 'master';
  const gravacao = () => W.gravacaoHabilitadaWork?.() === true;
  const reais = c => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const centavos = texto => {
    const limpo = String(texto || '').trim().replace(/[R$\s]/g, '');
    if (!limpo) return null;
    const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
    if (!/^\d+(\.\d{1,2})?$/.test(normal)) throw Error('Valor inválido. Use o formato 1.234,56.');
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
  function traduzir(e) { return ERROS[e?.code] || e?.message || 'Falha inesperada.'; }

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
    for (const [nome, , tipo, opc = {}] of def.campos) {
      const input = form.querySelector('#cs-' + nome);
      if (!input) continue;
      if (tipo === 'sim') { d[nome] = input.checked; continue; }
      const v = input.value.trim();
      if (!v && opc.obrigatorio) throw Error('Preencha: ' + nome.replace(/_/g, ' '));
      // Campo opcional vazio vai como null: na edição, isso limpa o valor anterior.
      if (!v) { d[nome] = null; continue; }
      if (tipo === 'dinheiro') { d[nome] = centavos(v); continue; }
      if (tipo === 'numero') { const n = Number(v.replace(',', '.')); if (!Number.isFinite(n)) throw Error('Número inválido em ' + nome); d[nome] = n; continue; }
      d[nome] = v;
    }
    return d;
  }
  function abrirFormulario(reg) {
    const def = MODULOS[aba];
    const dados = reg?.dados || {};
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
  function formatar(m, coluna, d) {
    const v = d[coluna];
    if (coluna === 'valor_centavos') return reais(v || 0);
    if (coluna === 'estado') return ESTADOS[v] || v || '';
    if (coluna === 'principal') return v ? 'Principal' : '';
    if (coluna === 'funcionario_id') return rotuloRef('funcionarios', v) || 'Externo';
    if (coluna === 'centro_custo_id') return rotuloRef('centros_custo', v) || (v ? 'Inativo' : '');
    if (coluna === 'obra_id') return rotuloRef('obras', v);
    if (coluna === 'cnh_validade' || coluna === 'competencia') return v ? v.split('-').reverse().join('/') : '';
    if (coluna === 'nome' && !v && d.funcionario_id) return rotuloRef('funcionarios', d.funcionario_id);
    return v ?? '';
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
  async function desenharTotais(alvo) {
    if (!(master() || vinculo()?.papelServidor === 'administrador')) return;
    const hoje = new Date(); const de = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const iso = d => d.toISOString().slice(0, 10);
    const ini = el('input', { type: 'date', value: iso(de), 'aria-label': 'Início do período' });
    const fim = el('input', { type: 'date', value: iso(hoje), 'aria-label': 'Fim do período' });
    const saida = el('div', { classe: 'cs-totais-saida' });
    const calcular = async () => {
      try {
        const t = await W.MartinsProducaoRpc.despesasTotais({ e: empresa, de: ini.value, ate: fim.value });
        saida.replaceChildren(el('strong', { texto: 'Total do período: ' + reais(t.total_centavos) }),
          ...t.por_centro_custo.map(c => el('div', { texto: (rotuloRef('centros_custo', c.centro_custo_id) || 'Centro inativo') + ': ' + reais(c.total_centavos) })),
          t.confidenciais_centavos !== null && Number(t.confidenciais_centavos) > 0 ? el('div', { texto: 'Despesas confidenciais (agregadas): ' + reais(t.confidenciais_centavos) }) : null);
      } catch (e) { saida.replaceChildren(el('span', { classe: 'cs-erro', texto: traduzir(e) })); }
    };
    alvo.append(el('section', { classe: 'cs-totais' }, el('h4', { texto: 'Totais por centro de custo' }),
      el('div', { classe: 'cs-acoes' }, ini, fim, el('button', { type: 'button', classe: 'cs-secundario', texto: 'Calcular', onclick: calcular })), saida));
  }
  function desenhar() {
    const def = MODULOS[aba];
    const corpo = painel.querySelector('[data-cs=corpo]');
    const busca = el('input', { type: 'search', placeholder: 'Pesquisar…', 'aria-label': 'Pesquisar ' + def.titulo });
    const topo = el('div', { classe: 'cs-acoes' }, busca,
      pode(aba, 'criar') ? el('button', { type: 'button', classe: 'cs-primario', texto: '+ Novo', onclick: () => abrirFormulario(null) }) : null);
    const tabela = el('table', { classe: 'cs-tabela' });
    tabela.append(el('thead', {}, el('tr', {}, def.colunas.map(c => el('th', { texto: (def.campos.find(x => x[0] === c)?.[1] || c).replace(/ \(.+\)$/, '') })), aba === 'despesas' ? null : el('th', { texto: 'Situação' }))));
    const tbody = el('tbody');
    const linhas = [...registros.values()].sort((a, b) => String(b.dados.competencia || '').localeCompare(String(a.dados.competencia || '')) || String(a.dados.nome || a.dados.descricao || '').localeCompare(String(b.dados.nome || b.dados.descricao || '')));
    const render = () => {
      const q = busca.value.trim().toLowerCase();
      tbody.replaceChildren(...linhas.filter(r => !q || JSON.stringify(r.dados).toLowerCase().includes(q)).map(r => {
        const tr = el('tr', { tabindex: 0, onclick: () => pode(aba, 'editar') && abrirFormulario(r), onkeydown: ev => ev.key === 'Enter' && pode(aba, 'editar') && abrirFormulario(r) },
          def.colunas.map(c => el('td', { 'data-rotulo': (def.campos.find(x => x[0] === c)?.[1] || c), texto: c === 'estado' ? null : String(formatar(aba, c, r.dados)) }, c === 'estado' ? acoesDespesa(r) : null)),
          aba === 'despesas' ? null : el('td', { 'data-rotulo': 'Situação', texto: r.dados.ativo === false ? 'Inativo' : 'Ativo' }));
        if (r.dados.ativo === false) tr.classList.add('cs-inativo');
        return tr;
      }));
      if (!tbody.children.length) tbody.append(el('tr', {}, el('td', { colspan: 9, classe: 'cs-vazio', texto: linhas.length ? 'Nada encontrado.' : 'Nenhum cadastro nesta empresa.' })));
    };
    busca.addEventListener('input', render);
    tabela.append(tbody); render();
    corpo.replaceChildren(topo, el('div', { classe: 'cs-rolagem' }, tabela));
    if (aba === 'despesas') desenharTotais(corpo);
  }
  function desenharAbas() {
    const nav = painel.querySelector('[data-cs=abas]');
    const visiveis = ORDEM.filter(m => pode(m, 'ler'));
    if (!visiveis.includes(aba)) aba = visiveis[0] || null;
    nav.replaceChildren(...visiveis.map(m => el('button', { type: 'button', role: 'tab', 'aria-selected': String(m === aba), classe: 'cs-aba', texto: MODULOS[m].titulo,
      onclick: () => { aba = m; desenharAbas(); carregarAba().catch(e => mensagem(traduzir(e), true)); } })));
    if (!visiveis.length) { painel.querySelector('[data-cs=corpo]').replaceChildren(el('p', { classe: 'cs-vazio', texto: 'Seu vínculo não tem permissão de leitura em nenhum cadastro desta empresa. Peça a liberação ao Master.' })); }
  }
  async function abrir(inicial) {
    if (!painel) montar();
    painel.hidden = false; D.body.classList.add('cs-aberto');
    try { await sincronizarSessao(); painel.querySelector('[data-cs=empresa]').textContent = (vinculo()?.nomeEmpresa || '') + (master() ? ' · Master' : '') + (gravacao() ? '' : ' · somente leitura'); if (MODULOS[inicial] && pode(inicial, 'ler')) aba = inicial; desenharAbas(); if (aba) await carregarAba(); }
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

  W.MartinsCadastrosServidor = Object.freeze({ abrir, fechar, atualizarFinanceiro, modulos: ORDEM.slice() });
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', instalarBotao); else instalarBotao();
  new MutationObserver(instalarBotao).observe(D.documentElement, { childList: true, subtree: true });
})();
