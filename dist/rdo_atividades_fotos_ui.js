// ============================================================================
// SISTEMA MARTINS — MÓDULO RDO: ATIVIDADES POR ITEM, FOTOS VINCULADAS E JORNADAS
// Arquivo: dist/rdo_atividades_fotos_ui.js
// ============================================================================

(function() {
  'use strict';

  window.currentRdoAtividades = window.currentRdoAtividades || [];
  window.currentRdoFotos = window.currentRdoFotos || [];

  window.bloquearDatasFuturasRdo = function() {
    const inputData = document.getElementById('input-data');
    if (inputData) {
      const hoje = (typeof window.obterDataAtualBrasiliaIso === 'function')
        ? window.obterDataAtualBrasiliaIso()
        : new Date().toISOString().split('T')[0];
      inputData.max = hoje;
      if (!inputData.value) inputData.value = hoje;
    }
  };

  window.calcularHorasTrabalhadas = function(inicioStr, fimStr, intervaloMinutos) {
    if (typeof intervaloMinutos === 'undefined') intervaloMinutos = 60;
    if (!inicioStr || !fimStr) return 8.0;

    const pIni = inicioStr.split(':').map(Number);
    const pFim = fimStr.split(':').map(Number);

    let minInicio = pIni[0] * 60 + pIni[1];
    let minFim = pFim[0] * 60 + pFim[1];

    if (minFim < minInicio) {
      minFim += 24 * 60;
    }

    let duracaoMinutos = minFim - minInicio - (intervaloMinutos || 0);
    if (duracaoMinutos < 0) duracaoMinutos = 0;

    return parseFloat((duracaoMinutos / 60).toFixed(1));
  };

  window.adicionarAtividadeRdo = function(etapaParam, descParam) {
    const selectEtapa = document.getElementById('select-etapa-item-servico');
    const inputDesc = document.getElementById('input-novo-item-servico');

    const etapa = etapaParam || (selectEtapa ? selectEtapa.value : 'Geral');
    const descricao = descParam || (inputDesc ? inputDesc.value.trim() : '');

    if (!descricao) {
      if (typeof showToast === 'function') showToast('Informe a descrição da atividade executada.');
      return null;
    }

    const novaAtividade = {
      id: 'ATIV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      etapa: etapa,
      descricao: descricao,
      avancoPercentual: 100
    };

    window.currentRdoAtividades.push(novaAtividade);
    if (inputDesc) inputDesc.value = '';

    window.renderizarListaAtividadesRdo();
    window.atualizarSelectAtividadesFotos();
    window.sincronizarTextareaServicos();
    return novaAtividade;
  };

  window.excluirAtividadeRdo = function(idAtividade) {
    window.currentRdoAtividades = window.currentRdoAtividades.filter(a => a.id !== idAtividade);
    window.currentRdoFotos.forEach(f => {
      if (f.atividadeId === idAtividade) f.atividadeId = '';
    });
    window.renderizarListaAtividadesRdo();
    window.atualizarSelectAtividadesFotos();
    window.renderizarGridFotosRdo();
    window.sincronizarTextareaServicos();
  };

  window.renderizarListaAtividadesRdo = function() {
    const container = document.getElementById('lista-itens-servicos-rdo');
    const badge = document.getElementById('badge-count-itens-servico');
    if (badge) badge.textContent = window.currentRdoAtividades.length;
    if (!container) return;

    container.innerHTML = '';
    if (window.currentRdoAtividades.length === 0) {
      container.innerHTML = '<div class="p-3 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300 text-xs">Nenhuma atividade adicionada.</div>';
      return;
    }

    window.currentRdoAtividades.forEach((item, idx) => {
      const fotosCount = window.currentRdoFotos.filter(f => f.atividadeId === item.id).length;
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs';
      row.innerHTML = `
        <div class="flex items-center space-x-2.5 min-w-0">
          <span class="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-900 font-black text-xs flex items-center justify-center shrink-0">${idx + 1}</span>
          <div class="min-w-0">
            <span class="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">${item.etapa}</span>
            ${fotosCount > 0 ? `<span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded ml-1">📷 ${fotosCount}</span>` : ''}
            <p class="text-xs font-bold text-slate-900 truncate mt-0.5">${item.descricao}</p>
          </div>
        </div>
        <button type="button" onclick="window.excluirAtividadeRdo('${item.id}')" class="p-1 text-slate-400 hover:text-red-600">🗑️</button>
      `;
      container.appendChild(row);
    });
  };

  window.sincronizarTextareaServicos = function() {
    const txtArea = document.getElementById('textarea-servicos');
    if (txtArea) {
      txtArea.value = window.currentRdoAtividades.map(a => `• [${a.etapa}] ${a.descricao}`).join('\n');
    }
  };

  window.atualizarSelectAtividadesFotos = function() {
    const select = document.getElementById('select-atividade-foto-vinculo');
    if (!select) return;
    select.innerHTML = '<option value="">(Geral / Sem vínculo específico)</option>';
    window.currentRdoAtividades.forEach((item, idx) => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${idx + 1}. [${item.etapa}] ${item.descricao.substring(0, 45)}`;
      select.appendChild(opt);
    });
  };

  window.renderizarGridFotosRdo = function() {
    const grid = document.getElementById('grid-fotos-rdo');
    const badge = document.getElementById('badge-total-fotos');
    if (badge) badge.textContent = window.currentRdoFotos.length;
    if (!grid) return;
    grid.innerHTML = '';
  };

  window.gerarCaminhoStorageDocumento = function(foto, obraParam, rdoNumParam, dataParam, empParam) {
    const obraNome = obraParam || document.getElementById('obra-select')?.value || 'obra-geral';
    const rdoNum = rdoNumParam || document.getElementById('input-rdo-num')?.value || '001';
    const dataRdo = dataParam || document.getElementById('input-data')?.value || '2026-11-06';
    const empId = empParam || (window.getEmpresaAtivaId ? window.getEmpresaAtivaId() : 'emp-1');

    const slug = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${slug(empId)}/${slug(obraNome)}/rdo-${slug(rdoNum)}_${dataRdo}/${slug(foto.etapa || 'geral')}/${foto.nomeArquivo || (foto.id + '.jpg')}`;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.bloquearDatasFuturasRdo);
  } else {
    window.bloquearDatasFuturasRdo();
  }
})();
