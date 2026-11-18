// Painel inicial, indicador de sincronização e exportação financeira a partir do SERVIDOR.
// Substitui renderizadores legados que misturavam dados locais com valores fixos de demonstração
// (ex.: "30 obras", contas a receber de R$ 184.500,00, "100% Sincronizado" ao lado de "Local").
// As funções legadas são travadas (defineProperty) para que outro trecho não as reescreva.
// Nenhum texto do servidor é inserido como HTML.
(function () {
  'use strict';
  const W = window, D = document;
  const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
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
  const empresaAtiva = () => { const c = contexto(); return W.empresaFrequenciaWork || (c?.empresas?.length === 1 ? c.empresas[0] : null); };
  const vinculo = () => contexto()?.vinculos?.find(v => v.empresa_id === empresaAtiva()) || null;
  const pode = m => vinculo()?.permissoes?.[m]?.ler === true;
  const master = () => vinculo()?.papelServidor === 'master';
  const reais = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hojeIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  let api = null, apiUid = null;
  function cliente() {
    const c = contexto();
    if (!c || !W.MartinsProducaoClient || !W.MartinsProducaoRpc) return null;
    if (!api || apiUid !== c.uid) { api = W.MartinsProducaoClient.create({ rpc: W.MartinsProducaoRpc, context: contexto }); apiUid = c.uid; }
    return api;
  }
  async function listar(m) {
    const a = cliente(), e = empresaAtiva();
    if (!a || !UUID.test(e || '') || !pode(m)) return null;
    const linhas = []; let apos = null;
    for (let i = 0; i < 100; i++) {
      const pagina = await a.load(e, m, null, { after: apos, limit: 200 });
      linhas.push(...pagina);
      if (pagina.length < 200) return linhas;
      apos = pagina.at(-1).id;
    }
    throw Error('Consulta exige paginação adicional.');
  }
  function travar(nome, funcao) {
    try { Object.defineProperty(W, nome, { configurable: false, enumerable: true, get: () => funcao, set: () => {} }); } catch (_) { /* já travada */ }
  }
  function estilos() {
    if (D.getElementById('estilos-painel-servidor')) return;
    D.head.append(el('style', { id: 'estilos-painel-servidor', texto: `
      #dash-servidor{font-family:Inter,system-ui,sans-serif;color:#0f172a;display:flex;flex-direction:column;gap:16px}
      #dash-servidor .ds-topo{background:#0f172a;color:#fff;border-radius:16px;padding:16px 18px}
      #dash-servidor .ds-topo h2{margin:0;font-size:20px;font-weight:800}#dash-servidor .ds-topo p{margin:4px 0 0;color:#cbd5e1;font-size:13px}
      #dash-servidor .ds-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
      #dash-servidor .ds-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
      #dash-servidor .ds-card small{display:block;color:#64748b;font-weight:700;font-size:11px;text-transform:uppercase}
      #dash-servidor .ds-card strong{display:block;font-size:24px;font-weight:800;margin-top:4px}#dash-servidor .ds-card span{color:#475569;font-size:12px}
      #dash-servidor .ds-bloco{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
      #dash-servidor .ds-bloco h3{margin:0 0 8px;font-size:14px;font-weight:800}
      #dash-servidor table{width:100%;border-collapse:collapse;font-size:13px}#dash-servidor th{text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;padding:6px}
      #dash-servidor td{padding:6px;border-top:1px solid #f1f5f9}
      #dash-servidor .ds-aviso{background:#fef3c7;color:#78350f;border-radius:10px;padding:10px 12px;font-size:12px}
      #dash-servidor .ds-erro{color:#b91c1c;font-weight:600}
      #btn-sync-nuvem .ds-ponto{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
    ` }));
  }

  // ---------- Painel inicial ----------
  const ENCERRADAS = /finaliz|conclu|encerr|cancel|paralis/i;
  let geracaoPainel = 0;
  async function renderizarPainel() {
    if (typeof D === 'undefined') return;
    let sec = D.getElementById('view-painel');
    if (!sec) { const main = D.querySelector('main'); if (!main) return; sec = el('section', { id: 'view-painel', classe: 'space-y-5' }); main.prepend(sec); }
    estilos();
    const c = contexto(), v = vinculo();
    const raiz = el('div', { id: 'dash-servidor' });
    sec.replaceChildren(raiz);
    if (!c) { raiz.append(el('p', { texto: 'Entre com sua conta para ver o painel.' })); return; }
    const perfil = v?.papelServidor === 'master' ? 'Master' : v?.papelServidor === 'administrador' ? 'Administrador' : 'Operacional';
    raiz.append(el('div', { classe: 'ds-topo' }, el('h2', { texto: 'Olá, ' + (c.nome || c.email || 'usuário') }),
      el('p', { texto: (v?.nomeEmpresa || 'Selecione a empresa no cabeçalho') + ' · ' + perfil + ' · dados do servidor da empresa ativa' })));
    if (!v) return;
    const cards = el('div', { classe: 'ds-cards' }, el('div', { classe: 'ds-card' }, el('small', { texto: 'Carregando' }), el('strong', { texto: '…' })));
    raiz.append(cards);
    const geracao = ++geracaoPainel; const e0 = empresaAtiva();
    try {
      const [obras, funcionarios, rdos, orcamentos, despesas] = await Promise.all(['obras', 'funcionarios', 'rdos', 'orcamentos', 'despesas'].map(m => listar(m).catch(() => null)));
      if (geracao !== geracaoPainel) return;
      const mes = hojeIso().slice(0, 7);
      const lista = [];
      const card = (titulo, valor, detalhe) => lista.push(el('div', { classe: 'ds-card' }, el('small', { texto: titulo }), el('strong', { texto: String(valor) }), detalhe ? el('span', { texto: detalhe }) : null));
      // Obras contadas por id (sem duplicidade) e por situação, só da empresa ativa.
      const obrasUnicas = obras ? [...new Map(obras.map(o => [o.id, o])).values()] : null;
      if (obrasUnicas) {
        const ativas = obrasUnicas.filter(o => !ENCERRADAS.test(String(o.dados.situacaoAtual || o.dados.status || '')));
        card('Obras em andamento', ativas.length, obrasUnicas.length + ' cadastrada(s) no total');
      }
      if (funcionarios) card('Funcionários ativos', funcionarios.filter(f => !/inativ|deslig|encerr/i.test(String(f.dados.status || ''))).length, funcionarios.length + ' cadastrado(s)');
      if (rdos) card('RDOs no mês', rdos.filter(r => String(r.dados.data || '').startsWith(mes)).length, rdos.length + ' no total');
      if (orcamentos) card('Orçamentos', orcamentos.length, 'cadastrados nesta empresa');
      if (despesas) {
        const vivas = despesas.filter(d => d.dados.estado !== 'cancelado');
        const pend = vivas.filter(d => (d.dados.estado || 'pendente_conferencia') === 'pendente_conferencia');
        const soma = l => l.reduce((t, d) => t + Number(d.dados.valor_centavos || 0), 0);
        card('Despesas pendentes de conferência', pend.length, reais(soma(pend)));
        card('Despesas do mês', reais(soma(vivas.filter(d => String(d.dados.competencia || '').startsWith(mes)))), master() ? 'inclui confidenciais' : 'somente as visíveis para você');
      }
      if (pode('estoque_movimentos')) {
        try {
          const s = await W.MartinsProducaoRpc.estoqueSaldos(e0);
          const por = new Map(); for (const x of s || []) por.set(x.produto_id, (por.get(x.produto_id) || 0) + Number(x.saldo_milli || 0));
          card('Estoque', [...por.values()].filter(q => q > 0).length, 'produto(s) com saldo positivo');
        } catch (_) { card('Estoque', '—', 'não foi possível consultar agora'); }
      }
      if (pode('contas_receber')) {
        try {
          const t = await W.MartinsProducaoRpc.receberTotais(e0);
          card('A receber', reais(t.a_receber_centavos), t.titulos_abertos + ' título(s) em aberto · vencido ' + reais(t.vencido_centavos));
          card('Recebido no mês', reais(t.recebido_mes_centavos), 'baixas registradas neste mês');
        } catch (_) { card('A receber', '—', 'não foi possível consultar agora'); }
      }
      if (geracao !== geracaoPainel) return;
      cards.replaceChildren(...lista);
      if (!lista.length) cards.replaceChildren(el('p', { texto: 'Seu vínculo não tem permissão de leitura nos módulos do painel.' }));
      if (obrasUnicas && obrasUnicas.length) {
        const ordenadas = obrasUnicas.slice().sort((a, b) => String(a.dados.nome || '').localeCompare(String(b.dados.nome || ''), 'pt-BR'));
        raiz.append(el('section', { classe: 'ds-bloco' }, el('h3', { texto: 'Obras da empresa' }),
          el('table', {}, el('thead', {}, el('tr', {}, ['Obra', 'Código', 'Situação', 'Cliente'].map(t => el('th', { texto: t })))),
            el('tbody', {}, ordenadas.map(o => el('tr', {}, el('td', { texto: o.dados.nome || '' }), el('td', { texto: o.dados.codigo || '' }),
              el('td', { texto: o.dados.situacaoAtual || o.dados.status || '' }), el('td', { texto: o.dados.clienteResponsavel || '' })))))));
      }
      raiz.append(el('p', { classe: 'ds-aviso', texto: 'Saldos bancários, vales e EPIs aparecerão aqui quando esses módulos estiverem gravando no servidor. Nenhum valor de demonstração é exibido.' }));
    } catch (e) { if (geracao === geracaoPainel) cards.replaceChildren(el('p', { classe: 'ds-erro', texto: 'Não foi possível carregar o painel: ' + (e?.message || 'falha') })); }
  }
  travar('renderizarDashboardExecutivo', () => { renderizarPainel(); });

  // ---------- Indicador de sincronização único ----------
  function renderizarIndicador() {
    const btn = D.getElementById('btn-sync-nuvem');
    D.getElementById('badge-sync-supabase-header')?.remove();
    D.getElementById('popover-situacao-sincronizacao-nuvem-fase24')?.remove();
    const ativo = !!contexto();
    const info = { codigo: ativo ? 'SERVIDOR' : 'SEM_SESSAO', confirmadoPeloServidorRemoto: ativo,
      descricao: ativo ? 'Cada gravação é confirmada e relida no servidor.' : 'Entre para gravar no servidor.' };
    if (btn) {
      estilos();
      btn.replaceChildren(el('span', { classe: 'ds-ponto', style: 'background:' + (ativo ? '#34d399' : '#94a3b8') }), el('span', { texto: ativo ? 'Servidor' : 'Sem sessão' }));
      btn.title = info.descricao;
      btn.setAttribute('aria-label', 'Situação da gravação: ' + info.descricao);
    }
    const selo = D.getElementById('status-servidor-modal');
    if (selo) selo.textContent = ativo ? 'Servidor confirma cada gravação' : 'Sem sessão';
    return info;
  }
  for (const nome of ['renderizarIndicadorNuvemCompactoSemSobreposicaoFase24', 'atualizarBadgeFilaSincronizacaoSupabaseDomV166', 'atualizarIndicadoresSincronizacaoUI'])
    travar(nome, renderizarIndicador);
  travar('obterEstadoIndicadorNuvemCompactoFase24', () => ({ codigo: contexto() ? 'SERVIDOR' : 'SEM_SESSAO', confirmadoPeloServidorRemoto: !!contexto() }));

  // ---------- Exportação financeira (CSV) ----------
  const csvCampo = v => { const t = String(v ?? ''); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  async function exportarDespesasCsv() {
    const aviso = (t, tipo) => (typeof W.showToast === 'function' ? W.showToast(t, tipo) : console.warn(t));
    if (!contexto()) { aviso('Entre com sua conta para exportar.', 'warning'); return { sucesso: false }; }
    if (!pode('despesas')) { aviso('Seu vínculo não tem permissão de leitura de despesas nesta empresa.', 'warning'); return { sucesso: false }; }
    const [despesas, cat] = await Promise.all([listar('despesas'), W.MartinsProducaoRpc.catalogos(empresaAtiva()).catch(() => ({}))]);
    const nomeDe = (lista, id) => { const x = (lista || []).find(i => i.id === id); return x ? [x.codigo, x.nome].filter(Boolean).join(' - ') : ''; };
    const linhas = despesas.slice().sort((a, b) => String(a.dados.competencia).localeCompare(String(b.dados.competencia)));
    // Só o que o servidor entregou ao usuário: confidenciais só existem aqui para o Master.
    const cabecalho = ['Competência', 'Vencimento', 'Descrição', 'Centro de custo', 'Classificação', 'Obra', 'Fornecedor', 'Valor (R$)', 'Situação', ...(master() ? ['Confidencial'] : [])];
    const corpo = linhas.map(r => { const d = r.dados; return [d.competencia, d.vencimento || '', d.descricao, nomeDe(cat.centros_custo, d.centro_custo_id), d.classificacao,
      nomeDe(cat.obras, d.obra_id), nomeDe(cat.fornecedores, d.fornecedor_id), (Number(d.valor_centavos) / 100).toFixed(2).replace('.', ','), d.estado,
      ...(master() ? [d.confidencial ? 'sim' : 'não'] : [])]; });
    const total = linhas.reduce((t, r) => t + Number(r.dados.valor_centavos || 0), 0);
    const meta = [['Empresa', vinculo()?.nomeEmpresa || ''], ['Gerado em', new Date().toLocaleString('pt-BR')], ['Linhas', String(linhas.length)], ['Total', reais(total)], []];
    const texto = '﻿' + [...meta, cabecalho, ...corpo].map(l => l.map(csvCampo).join(';')).join('\r\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' })), download: 'despesas-' + hojeIso() + '.csv' });
    D.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    aviso(linhas.length + ' despesa(s) exportada(s) · total ' + reais(total), 'success');
    return { sucesso: true, linhas: linhas.length, totalCentavos: total };
  }
  travar('gerarRelatorioFinanceiroCsv', () => exportarDespesasCsv().catch(e => (W.showToast?.('Falha ao exportar: ' + e.message, 'error'), { sucesso: false })));

  W.MartinsPainelServidor = Object.freeze({ renderizarPainel, renderizarIndicador, exportarDespesasCsv });
  // Mantém o indicador coerente com a sessão.
  setInterval(renderizarIndicador, 4000);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', renderizarIndicador); else renderizarIndicador();
})();
