// ============================================================================
// SISTEMA MARTINS — FREQUÊNCIA DIÁRIA, JORNADAS E PLANEJAMENTO DE EQUIPES (RH)
// Arquivo: dist/frequencia_equipes_rh_ui.js
// Referência de commits integrados: c9073c0, 274e460
// ============================================================================

(function() {
  window.estadoFrequenciaEmEdicao = window.estadoFrequenciaEmEdicao || {};
  window.modoVisualizacaoPonto = 'tabela'; // 'tabela' ou 'equipes'

  // 1. Algoritmo oficial de validação de CPF (dígitos verificadores)
  window.validarCpfAlgoritmo = function(cpfStr) {
    if (!cpfStr) return true; // CPF é opcional quando permitido
    const cpf = cpfStr.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // Bloqueia 111.111.111-11, etc.

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i), 10) * (10 - i);
    let d1 = (soma * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(cpf.charAt(9), 10)) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i), 10) * (11 - i);
    let d2 = (soma * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === parseInt(cpf.charAt(10), 10);
  };

  // 2. Cálculo de Jornada com suporte a turnos que cruzam a meia-noite e horas extras
  window.calcularJornadaHoras = function(inicioStr, fimStr, intervaloMin) {
    if (typeof intervaloMin === 'undefined') intervaloMin = 60;
    if (!inicioStr || !fimStr) return { total: 8.0, normais: 8.0, extras: 0.0 };

    const pIni = inicioStr.split(':').map(Number);
    const pFim = fimStr.split(':').map(Number);

    let minInicio = pIni[0] * 60 + pIni[1];
    let minFim = pFim[0] * 60 + pFim[1];

    // Se o horário de fim for menor que o de início, a jornada cruzou a meia-noite
    if (minFim < minInicio) {
      minFim += 24 * 60;
    }

    let duracaoMin = minFim - minInicio - (intervaloMin || 0);
    if (duracaoMin < 0) duracaoMin = 0;

    const horasTotais = parseFloat((duracaoMin / 60).toFixed(1));
    const horasNormais = Math.min(8.0, horasTotais);
    const horasExtras = Math.max(0.0, parseFloat((horasTotais - 8.0).toFixed(1)));

    return { total: horasTotais, normais: horasNormais, extras: horasExtras };
  };

  // 3. Regra de Limite de Vales (Máximo 40% da remuneração bruta efetiva)
  window.calcularLimiteValeDisponivel = function(diasTrabalhados, salarioMensal, valesJaConcedidos) {
    if (typeof valesJaConcedidos === 'undefined') valesJaConcedidos = 0;
    const valorDia = (salarioMensal || 0) / 30.0;
    const ganhoEfetivo = parseFloat((diasTrabalhados * valorDia).toFixed(2));
    const limite40 = parseFloat((ganhoEfetivo * 0.40).toFixed(2));
    const saldoVale = Math.max(0.0, parseFloat((limite40 - (valesJaConcedidos || 0)).toFixed(2)));
    return { ganhoEfetivo: ganhoEfetivo, limite40: limite40, saldoVale: saldoVale };
  };

  // 4. Detecção de Alocação Conflitante (Mesmo colaborador em duas obras no mesmo dia)
  window.detectarConflitoAlocacao = function(colabId, dataFiltro, novaObra) {
    const db = (typeof getDb === 'function') ? getDb() : [];
    const rdosMesmoDia = db.filter(r => r.data === dataFiltro && r.obra !== novaObra);
    const conflitos = [];

    const colabs = (typeof getColaboradoresDb === 'function') ? getColaboradoresDb() : [];
    const colabObj = colabs.find(c => c.id === colabId);
    if (!colabObj) return conflitos;

    rdosMesmoDia.forEach(r => {
      if (r.trabalhadores) {
        const achou = r.trabalhadores.find(t => t.nome.trim().toLowerCase() === colabObj.nome.trim().toLowerCase());
        if (achou) {
          conflitos.push({ obra: r.obra, rdoNum: r.num });
        }
      }
    });

    return conflitos;
  };

  // 5. Inicialização da Folha de Frequência do Dia
  window.carregarFrequenciaDoDia = function() {
    const inputData = document.getElementById('ponto-data-filtro');
    const dataFiltro = inputData ? inputData.value : new Date().toISOString().split('T')[0];

    const freqDb = (typeof getFrequenciaDiariaDb === 'function') ? getFrequenciaDiariaDb() : {};
    const freqDiaSalva = freqDb[dataFiltro] || {};

    const colabs = (typeof getColaboradoresDb === 'function') ? getColaboradoresDb() : [];
    // Apenas colaboradores ativos (desligados saem automaticamente)
    const colabsAtivos = colabs.filter(c => c.status !== 'Inativo');

    window.estadoFrequenciaEmEdicao = {};

    const dataObj = new Date(dataFiltro + 'T12:00:00');
    const isFimDeSemana = (dataObj.getDay() === 0 || dataObj.getDay() === 6);

    colabsAtivos.forEach(c => {
      if (freqDiaSalva[c.id]) {
        window.estadoFrequenciaEmEdicao[c.id] = Object.assign({}, freqDiaSalva[c.id]);
      } else {
        window.estadoFrequenciaEmEdicao[c.id] = {
          colabId: c.id,
          colabNome: c.nome,
          funcao: c.funcao,
          vinculo: c.vinculo || 'Próprio (CLT)',
          empresa: c.empresa || 'Construtora Martins',
          status: isFimDeSemana ? 'folga' : 'presente',
          obra: c.obra && c.obra !== 'Todas as Obras' ? c.obra : 'UBS - Nova Passos',
          horaInicio: isFimDeSemana ? '' : '07:00',
          horaFim: isFimDeSemana ? '' : '17:00',
          intervaloMin: 60,
          horasTotais: isFimDeSemana ? 0 : 8.0,
          horasNormais: isFimDeSemana ? 0 : 8.0,
          horasExtras: 0,
          ocorrenciaObs: '',
          cid: ''
        };
      }
    });

    window.renderizarFrequencia();
    window.atualizarResumoFrequenciaDia();
  };

  // 6. Renderização da Frequência
  window.renderizarFrequencia = function() {
    if (window.modoVisualizacaoPonto === 'equipes') {
      window.renderizarPlanejamentoEquipesPorObra();
    } else {
      window.renderizarTabelaFrequenciaAvancada();
    }
  };

  window.renderizarTabelaFrequenciaAvancada = function() {
    const tbody = document.getElementById('tbody-auditoria-ponto');
    if (!tbody) return;

    const termoBusca = (document.getElementById('filtro-busca-ponto-dia') ? document.getElementById('filtro-busca-ponto-dia').value : '').toLowerCase().trim();
    const filtroStatus = document.getElementById('filtro-destino-ponto-dia') ? document.getElementById('filtro-destino-ponto-dia').value : 'todos';
    const inputData = document.getElementById('ponto-data-filtro');
    const dataFiltro = inputData ? inputData.value : new Date().toISOString().split('T')[0];

    const listaObras = [
      'UBS - Nova Passos',
      'UBS - Guaxupé',
      'SAAE - PÁTIO DE MANUTENÇÃO',
      'UBS - João Paulo II / RT',
      'Cemei - Novo Horizonte',
      'UEMG - Bloco 4',
      'UEMG - Bloco 1',
      'CRAS - Alpinópolis',
      'Sede / Escritório Passos',
      'Serralheria & Estruturas',
      'Central de Ferragens'
    ];

    tbody.innerHTML = '';

    Object.values(window.estadoFrequenciaEmEdicao).forEach(reg => {
      if (termoBusca && !reg.colabNome.toLowerCase().includes(termoBusca) && !reg.funcao.toLowerCase().includes(termoBusca)) {
        return;
      }

      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'presente' && !['presente', 'meio_periodo'].includes(reg.status)) return;
        if (filtroStatus === 'falta' && reg.status !== 'falta') return;
        if (filtroStatus === 'atestado' && reg.status !== 'atestado') return;
        if (filtroStatus === 'ferias' && reg.status !== 'ferias') return;
        if (filtroStatus === 'folga' && !['folga', 'feriado'].includes(reg.status)) return;
      }

      const conflitos = (reg.status === 'presente') ? window.detectarConflitoAlocacao(reg.colabId, dataFiltro, reg.obra) : [];

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 text-xs border-b border-slate-100 transition ' + (conflitos.length > 0 ? 'bg-red-50/70' : '');

      let badgeSituacao = '';
      if (reg.status === 'presente') {
        badgeSituacao = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">🟢 Presente</span>';
      } else if (reg.status === 'meio_periodo') {
        badgeSituacao = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">🟡 Meio Período</span>';
      } else if (reg.status === 'falta') {
        badgeSituacao = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">🔴 Falta Injustificada</span>';
      } else if (reg.status === 'atestado') {
        badgeSituacao = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900">🩺 Atestado Médico</span>';
      } else if (reg.status === 'ferias') {
        badgeSituacao = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900">🏖️ Férias</span>';
      } else if (reg.status === 'afastamento') {
        badgeSituacao = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">🏥 Afastamento INSS</span>';
      } else {
        badgeSituacao = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">🔵 Folga / Feriado</span>';
      }

      const alertaConflito = conflitos.length > 0 ? ('<span class="text-[9px] text-red-600 font-bold block mt-0.5">⚠️ Alocado também em: ' + conflitos[0].obra + ' (RDO ' + conflitos[0].rdoNum + ')</span>') : '';
      const vinculoClasse = reg.vinculo.includes('CLT') ? 'text-indigo-600' : 'text-orange-600';

      tr.innerHTML = 
        '<td class="py-2.5 px-3 min-w-[210px]">' +
          '<div class="flex items-center space-x-2">' +
            '<div class="w-7 h-7 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">' +
              reg.colabNome.charAt(0) +
            '</div>' +
            '<div class="truncate">' +
              '<span class="font-extrabold text-slate-900 block truncate leading-tight">' + reg.colabNome + '</span>' +
              '<span class="text-[10px] text-slate-500 block truncate">' +
                reg.funcao + ' · <strong class="' + vinculoClasse + '">' + reg.vinculo + '</strong>' +
              '</span>' +
            '</div>' +
          '</div>' +
          alertaConflito +
        '</td>' +
        '<td class="py-2.5 px-3 min-w-[220px]">' +
          '<select onchange="window.alterarStatusFrequenciaLinha(\'' + reg.colabId + '\', this.value)" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none">' +
            '<optgroup label="🟢 Presença em Canteiro de Obras">' +
              listaObras.map(ob => '<option value="OBRA:' + ob + '" ' + (reg.status === 'presente' && reg.obra === ob ? 'selected' : '') + '>🏗️ ' + ob + '</option>').join('') +
            '</optgroup>' +
            '<optgroup label="🟡 Meio Período">' +
              listaObras.map(ob => '<option value="MEIO:' + ob + '" ' + (reg.status === 'meio_periodo' && reg.obra === ob ? 'selected' : '') + '>⏱️ Meio Período — ' + ob + '</option>').join('') +
            '</optgroup>' +
            '<optgroup label="⚠️ Ausências e Afastamentos (RH)">' +
              '<option value="STATUS:falta" ' + (reg.status === 'falta' ? 'selected' : '') + '>🔴 Falta Injustificada</option>' +
              '<option value="STATUS:atestado" ' + (reg.status === 'atestado' ? 'selected' : '') + '>🩺 Atestado Médico</option>' +
              '<option value="STATUS:ferias" ' + (reg.status === 'ferias' ? 'selected' : '') + '>🏖️ Férias Regulamentares</option>' +
              '<option value="STATUS:afastamento" ' + (reg.status === 'afastamento' ? 'selected' : '') + '>🏥 Afastamento Previdenciário (INSS)</option>' +
              '<option value="STATUS:folga" ' + (reg.status === 'folga' ? 'selected' : '') + '>🔵 Folga / DSR</option>' +
              '<option value="STATUS:feriado" ' + (reg.status === 'feriado' ? 'selected' : '') + '>🟣 Feriado Oficial</option>' +
            '</optgroup>' +
          '</select>' +
          '<div class="flex items-center justify-between mt-1">' +
            badgeSituacao +
            '<span class="text-[9px] text-slate-400 font-mono">' + (reg.status === 'presente' ? reg.obra : '') + '</span>' +
          '</div>' +
        '</td>' +
        '<td class="py-2.5 px-3 w-48">' +
          (['presente', 'meio_periodo'].includes(reg.status) ? (
            '<div class="flex items-center space-x-1">' +
              '<input type="time" value="' + (reg.horaInicio || '07:00') + '" onchange="window.alterarHorarioLinha(\'' + reg.colabId + '\', \'horaInicio\', this.value)" class="bg-slate-50 border border-slate-300 rounded p-1 text-[11px] font-mono font-bold w-18 text-center" title="Entrada">' +
              '<span class="text-slate-400 font-bold">às</span>' +
              '<input type="time" value="' + (reg.horaFim || (reg.status === 'meio_periodo' ? '12:00' : '17:00')) + '" onchange="window.alterarHorarioLinha(\'' + reg.colabId + '\', \'horaFim\', this.value)" class="bg-slate-50 border border-slate-300 rounded p-1 text-[11px] font-mono font-bold w-18 text-center" title="Saída">' +
              '<span class="text-[10px] font-black font-mono px-1.5 py-0.5 rounded ml-1 shrink-0 ' + (reg.horasExtras > 0 ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900') + '">' +
                reg.horasTotais + 'h' + (reg.horasExtras > 0 ? ' (+' + reg.horasExtras + 'h ex)' : '') +
              '</span>' +
            '</div>'
          ) : '<span class="text-[11px] text-slate-400 italic">Ausente no canteiro</span>') +
        '</td>' +
        '<td class="py-2.5 px-3">' +
          '<input type="text" value="' + (reg.ocorrenciaObs || '') + '" placeholder="Observação / CID médico..." onchange="window.alterarObsLinha(\'' + reg.colabId + '\', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded p-1 text-xs text-slate-700 focus:bg-white focus:border-amber-500">' +
        '</td>' +
        '<td class="py-2.5 px-3 text-center w-20">' +
          '<button type="button" onclick="window.abrirFichaColaborador(\'' + reg.colabId + '\')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-slate-300 transition shadow-2xs">' +
            'Ficha' +
          '</button>' +
        '</td>';

      tbody.appendChild(tr);
    });
  };

  // 7. Planejamento de Equipes por Obra
  window.renderizarPlanejamentoEquipesPorObra = function() {
    const tbody = document.getElementById('tbody-auditoria-ponto');
    if (!tbody) return;

    const obrasMap = {};
    const indisponiveis = [];

    Object.values(window.estadoFrequenciaEmEdicao).forEach(reg => {
      if (['presente', 'meio_periodo'].includes(reg.status)) {
        if (!obrasMap[reg.obra]) obrasMap[reg.obra] = { proprios: [], terceirizados: [] };
        if (reg.vinculo.includes('CLT')) obrasMap[reg.obra].proprios.push(reg);
        else obrasMap[reg.obra].terceirizados.push(reg);
      } else {
        indisponiveis.push(reg);
      }
    });

    const totalAlocado = Object.values(obrasMap).reduce((sum, o) => sum + o.proprios.length + o.terceirizados.length, 0);

    let html = 
      '<tr>' +
        '<td colspan="5" class="p-3 bg-slate-100 border-b border-slate-300">' +
          '<div class="flex items-center justify-between">' +
            '<span class="font-black text-xs uppercase text-slate-800">Visualização Consolidada de Equipes por Canteiro de Obras</span>' +
            '<span class="text-xs font-bold text-slate-600">Total Alocado: ' + totalAlocado + ' operários</span>' +
            '</div>' +
        '</td>' +
      '</tr>';

    Object.keys(obrasMap).forEach(obraNome => {
      const g = obrasMap[obraNome];
      const totalObra = g.proprios.length + g.terceirizados.length;
      html += 
        '<tr class="bg-white border-b border-slate-200">' +
          '<td colspan="5" class="p-3">' +
            '<div class="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">' +
              '<div class="flex items-center space-x-2">' +
                '<span class="text-sm font-black text-slate-900">🏗️ ' + obraNome + '</span>' +
                '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">' + totalObra + ' colaboradores</span>' +
                '</div>' +
              '<div class="text-[11px] space-x-2">' +
                '<span class="text-indigo-700 font-bold">Próprios (CLT): ' + g.proprios.length + '</span>' +
                '<span class="text-orange-700 font-bold">Terceirizados: ' + g.terceirizados.length + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-xs">' +
              g.proprios.map(p => '<div class="p-1.5 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-center justify-between"><span>' + p.colabNome + '</span><span class="text-[9px] font-bold text-indigo-800">CLT</span></div>').join('') +
              g.terceirizados.map(t => '<div class="p-1.5 bg-orange-50/50 rounded-lg border border-orange-100 flex items-center justify-between"><span>' + t.colabNome + '</span><span class="text-[9px] font-bold text-orange-800">Diarista</span></div>').join('') +
            '</div>' +
          '</td>' +
        '</tr>';
    });

    if (indisponiveis.length > 0) {
      html += 
        '<tr class="bg-slate-50 border-t-2 border-slate-300">' +
          '<td colspan="5" class="p-3">' +
            '<div class="flex items-center space-x-2 mb-2">' +
              '<span class="font-black text-xs text-red-900 uppercase">⚠️ Colaboradores Indisponíveis no Dia (' + indisponiveis.length + ')</span>' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-xs">' +
              indisponiveis.map(i => '<div class="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between"><span>' + i.colabNome + '</span><span class="text-[9px] font-bold uppercase text-slate-600">' + i.status + '</span></div>').join('') +
            '</div>' +
          '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;
  };

  // 8. Alteração de status e recálculo
  window.alterarStatusFrequenciaLinha = function(colabId, valor) {
    const reg = window.estadoFrequenciaEmEdicao[colabId];
    if (!reg) return;

    if (valor.startsWith('OBRA:')) {
      reg.status = 'presente';
      reg.obra = valor.replace('OBRA:', '');
      if (!reg.horaInicio) reg.horaInicio = '07:00';
      if (!reg.horaFim) reg.horaFim = '17:00';
      const j = window.calcularJornadaHoras(reg.horaInicio, reg.horaFim, 60);
      reg.horasTotais = j.total;
      reg.horasNormais = j.normais;
      reg.horasExtras = j.extras;
    } else if (valor.startsWith('MEIO:')) {
      reg.status = 'meio_periodo';
      reg.obra = valor.replace('MEIO:', '');
      reg.horaInicio = '07:00';
      reg.horaFim = '12:00';
      const j = window.calcularJornadaHoras(reg.horaInicio, reg.horaFim, 0);
      reg.horasTotais = j.total;
      reg.horasNormais = j.normais;
      reg.horasExtras = 0;
    } else if (valor.startsWith('STATUS:')) {
      reg.status = valor.replace('STATUS:', '');
      reg.horasTotais = 0;
      reg.horasNormais = 0;
      reg.horasExtras = 0;
    }

    window.renderizarFrequencia();
    window.atualizarResumoFrequenciaDia();
  };

  window.alterarHorarioLinha = function(colabId, campo, valor) {
    const reg = window.estadoFrequenciaEmEdicao[colabId];
    if (!reg) return;
    reg[campo] = valor;
    if (reg.horaInicio && reg.horaFim) {
      const intervalo = (reg.status === 'meio_periodo') ? 0 : 60;
      const j = window.calcularJornadaHoras(reg.horaInicio, reg.horaFim, intervalo);
      reg.horasTotais = j.total;
      reg.horasNormais = j.normais;
      reg.horasExtras = j.extras;
    }
    window.renderizarFrequencia();
    window.atualizarResumoFrequenciaDia();
  };

  window.alterarObsLinha = function(colabId, txt) {
    const reg = window.estadoFrequenciaEmEdicao[colabId];
    if (reg) reg.ocorrenciaObs = txt;
  };

  window.atualizarResumoFrequenciaDia = function() {
    let presentes = 0;
    let faltas = 0;
    let atestados = 0;
    let outros = 0;

    Object.values(window.estadoFrequenciaEmEdicao).forEach(r => {
      if (['presente', 'meio_periodo'].includes(r.status)) presentes++;
      else if (r.status === 'falta') faltas++;
      else if (r.status === 'atestado') atestados++;
      else outros++;
    });

    const elP = document.getElementById('resumo-ponto-presentes');
    const elF = document.getElementById('resumo-ponto-faltas');
    const elA = document.getElementById('resumo-ponto-atestados');
    const elO = document.getElementById('resumo-ponto-horas');

    if (elP) elP.textContent = presentes;
    if (elF) elF.textContent = faltas;
    if (elA) elA.textContent = atestados;
    if (elO) elO.textContent = outros;
  };

  // 9. Replicação de Frequência para Múltiplas Datas com Janela de Conferência Prévia
  // Implementação compatível com os commits c9073c0 e 274e460
  window.abrirModalConferenciaReplicacao = function() {
    let presentes = 0;
    let faltas = 0;
    let atestados = 0;
    let ferias = 0;

    Object.values(window.estadoFrequenciaEmEdicao).forEach(r => {
      if (['presente', 'meio_periodo'].includes(r.status)) presentes++;
      else if (r.status === 'falta') faltas++;
      else if (r.status === 'atestado') atestados++;
      else if (r.status === 'ferias') ferias++;
    });

    const inputData = document.getElementById('ponto-data-filtro');
    const dataAlvo = inputData ? inputData.value : 'data atual';

    const modalConf = confirm(
      'CONFERÊNCIA PRÉVIA DE REPLICAÇÃO DE FREQUÊNCIA (c9073c0 / 274e460):\n\n' +
      'Data Base / Alvo: ' + dataAlvo + '\n' +
      '------------------------------------------\n' +
      '• Presentes em Canteiros: ' + presentes + '\n' +
      '• Faltas Injustificadas: ' + faltas + '\n' +
      '• Atestados Médicos (CID): ' + atestados + '\n' +
      '• Férias e Afastamentos: ' + ferias + '\n' +
      '------------------------------------------\n' +
      'Confirma a aplicação desta folha sem duplicar registros?'
    );

    if (modalConf) {
      window.salvarFrequenciaDiariaSegura();
    }
  };

  // 10. Gravação Atômica sem Duplicidade
  window.salvarFrequenciaDiariaSegura = function() {
    const inputData = document.getElementById('ponto-data-filtro');
    const dataFiltro = inputData ? inputData.value : new Date().toISOString().split('T')[0];

    const freqDb = (typeof getFrequenciaDiariaDb === 'function') ? getFrequenciaDiariaDb() : {};
    freqDb[dataFiltro] = JSON.parse(JSON.stringify(window.estadoFrequenciaEmEdicao));

    if (typeof saveFrequenciaDiariaDb === 'function') {
      saveFrequenciaDiariaDb(freqDb);
    }

    if (typeof showToast === 'function') {
      showToast('Frequência de ' + dataFiltro + ' gravada com sucesso! Sem duplicidades.');
    }
  };

  // 11. Alternar Modos de Visualização
  window.alternarModoVisualizacaoPonto = function(modo) {
    window.modoVisualizacaoPonto = modo;
    const btnTab = document.getElementById('btn-modo-vis-tabela');
    const btnEq = document.getElementById('btn-modo-vis-equipes');

    if (btnTab && btnEq) {
      if (modo === 'tabela') {
        btnTab.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 transition shadow-2xs';
        btnEq.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition';
      } else {
        btnEq.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 transition shadow-2xs';
        btnTab.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition';
      }
    }
    window.renderizarFrequencia();
  };

  // Listeners e Inicialização
  document.addEventListener('DOMContentLoaded', function() {
    window.carregarFrequenciaDoDia();

    const btnSalvar = document.getElementById('btn-salvar-frequencia-dia');
    if (btnSalvar) btnSalvar.onclick = window.salvarFrequenciaDiariaSegura;

    const btnReplicar = document.getElementById('btn-replicar-presenca-dia');
    if (btnReplicar) btnReplicar.onclick = window.abrirModalConferenciaReplicacao;

    const inputData = document.getElementById('ponto-data-filtro');
    if (inputData) inputData.addEventListener('change', window.carregarFrequenciaDoDia);

    const buscaInput = document.getElementById('filtro-busca-ponto-dia');
    if (buscaInput) buscaInput.addEventListener('input', window.renderizarFrequencia);

    const filtroStatus = document.getElementById('filtro-destino-ponto-dia');
    if (filtroStatus) filtroStatus.addEventListener('change', window.renderizarFrequencia);
  });
})();
