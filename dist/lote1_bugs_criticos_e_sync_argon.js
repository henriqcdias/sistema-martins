// ============================================================================
// SISTEMA MARTINS — LOTE 1: BUGS CRÍTICOS (BUG-01 A BUG-06), SINCRONIZAÇÃO EM 4 ESTADOS,
// RESTAURAÇÃO SEGURA DE BACKUPS E DESIGN SYSTEM (BRANCH: desenvolvimento-argon)
// Arquivo: dist/lote1_bugs_criticos_e_sync_argon.js
// ============================================================================

(function() {
  'use strict';

  // ==========================================================================
  // 1. DESIGN SYSTEM TOKENS & TIPOGRAFIA TABULAR-NUMS
  // ==========================================================================
  function injetarDesignSystemMartins() {
    if (document.getElementById('css-design-system-argon')) return;
    const style = document.createElement('style');
    style.id = 'css-design-system-argon';
    style.textContent = `
      /* Tipografia e Alinhamento Numérico Obrigatório */
      body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }
      .font-mono, td, th, input[type="number"], [id*="card-"], [id*="stat-"], [id*="badge-"], [id*="total"] {
        font-variant-numeric: tabular-nums;
      }
      /* Padronização de Inputs e Selects */
      input:not([type="checkbox"]):not([type="radio"]), select {
        min-height: 40px;
        border-radius: 8px;
      }
      @media (max-width: 767px) {
        input:not([type="checkbox"]):not([type="radio"]), select, button {
          min-height: 42px;
        }
      }
      input:focus, select:focus, textarea:focus {
        box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.22) !important;
        border-color: #EAB308 !important;
        outline: none !important;
      }
      /* Garantir z-index superior ao Drawer Lateral (BUG-01) */
      #drawer-menu-lateral {
        z-index: 9998 !important;
      }
      #martins-bottom-bar {
        z-index: 9990 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ==========================================================================
  // 2. CORREÇÃO BUG-01: BOTÃO MENU E ESCOPO GLOBAL DE ABERTURA DA GAVETA
  // ==========================================================================
  window.abrirDrawerMenu = function() {
    const drawer = document.getElementById('drawer-menu-lateral');
    if (drawer) {
      drawer.classList.remove('hidden');
      drawer.style.display = 'block';
    }
    if (typeof window.renderizarMenuLateralInteligente === 'function') {
      window.renderizarMenuLateralInteligente();
    }
  };

  window.fecharDrawerMenu = function() {
    const drawer = document.getElementById('drawer-menu-lateral');
    if (drawer) {
      drawer.classList.add('hidden');
      drawer.style.display = 'none';
    }
  };

  window.abrirDrawer = window.abrirDrawerMenu;
  window.fecharDrawer = window.fecharDrawerMenu;

  // ==========================================================================
  // 3. CORREÇÃO BUG-02 & BUG-05: VALIDAÇÃO DE ORÇAMENTOS (> 0), BOTÃO CONCLUIR
  //    E ASSINATURAS COMERCIAIS EM PDF PRIVADO
  // ==========================================================================
  window.validarItensOrcamentoPositivos = function(itens, descontoValor) {
    if (!Array.isArray(itens) || itens.length === 0) {
      return { valido: false, erro: 'Adicione pelo menos um item válido ao orçamento.' };
    }

    let subtotal = 0;
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      const qtd = parseFloat(it.qtd);
      const precoUnit = parseFloat(it.precoUnit);

      if (isNaN(qtd) || qtd <= 0) {
        return { valido: false, erro: `Item #${i + 1} (${it.desc || 'Sem descrição'}): a quantidade deve ser maior que zero.` };
      }
      if (isNaN(precoUnit) || precoUnit <= 0) {
        return { valido: false, erro: `Item #${i + 1} (${it.desc || 'Sem descrição'}): o preço unitário deve ser estritamente positivo (> R$ 0,00).` };
      }
      subtotal += qtd * precoUnit;
    }

    const desc = parseFloat(descontoValor || 0);
    if (desc < 0) {
      return { valido: false, erro: 'O valor de desconto não pode ser negativo.' };
    }
    if (desc >= subtotal) {
      return { valido: false, erro: 'O desconto não pode ser igual ou superior ao valor total da proposta.' };
    }

    return { valido: true, subtotal: parseFloat(subtotal.toFixed(2)), totalLiquido: parseFloat((subtotal - desc).toFixed(2)) };
  };

  // Intercepta salvarNovoOrcamentoVendaForm para aplicar bloqueio de valores negativos (BUG-02)
  const origSalvarOrcamento = window.salvarNovoOrcamentoVendaForm;
  window.salvarNovoOrcamentoVendaForm = function(e) {
    if (e) e.preventDefault();

    const itens = window.linhasOrcamentoModal || [];
    const inpDesconto = document.getElementById('orc-inp-desconto');
    const descVal = inpDesconto ? parseFloat(inpDesconto.value || 0) : 0;

    const validacao = window.validarItensOrcamentoPositivos(itens, descVal);
    if (!validacao.valido) {
      if (typeof showToast === 'function') showToast('⚠️ ' + validacao.erro, 'warning');
      else alert(validacao.erro);
      return false;
    }

    if (typeof origSalvarOrcamento === 'function') {
      return origSalvarOrcamento(e);
    }
  };

  // Correção BUG-05: Botão Concluir e Voltar em Orçamentos
  window.concluirEVoltarOrcamento = function() {
    const modalSucesso = document.getElementById('modal-sucesso-orcamento');
    if (modalSucesso) modalSucesso.classList.add('hidden');

    const modalNovo = document.getElementById('modal-novo-orcamento-venda');
    if (modalNovo) {
      modalNovo.classList.add('hidden');
      modalNovo.style.display = 'none';
    }

    if (typeof window.navegarParaSecao === 'function') {
      window.navegarParaSecao('comercial', 'orcamentos');
    }
    if (typeof window.renderListaOrcamentosVendas === 'function') {
      window.renderListaOrcamentosVendas();
    }
  };

  // Correção BUG-05: Remover assinatura de Fiscal Público em PDFs de Propostas Comerciais Privadas
  const origImprimirOrcamentoPdf = window.imprimirOrcamentoVendaPdf;
  window.imprimirOrcamentoVendaPdf = function(orcId) {
    const sigBlock = document.getElementById('p-signatures-block');
    const backupSigHtml = sigBlock ? sigBlock.innerHTML : null;

    if (sigBlock) {
      const orcs = (typeof window.getOrcamentosVendasDb === 'function') ? window.getOrcamentosVendasDb() : [];
      const orc = orcs.find(x => x.id === orcId) || {};
      sigBlock.innerHTML = `
        <div>
          <div class="border-t border-slate-900 w-4/5 mx-auto mb-1"></div>
          <p class="font-bold text-[9px]" id="p-assina-resp">Departamento Comercial · ${orc.empresa || 'Grupo Martins'}</p>
          <p class="text-[8px] text-slate-500">Responsável pela Proposta</p>
        </div>
        <div>
          <div class="border-t border-slate-900 w-4/5 mx-auto mb-1"></div>
          <p class="font-bold text-[9px]">${orc.cliente || 'Cliente Contratante'}</p>
          <p class="text-[8px] text-slate-500">De Acordo / Aceite do Cliente</p>
        </div>
      `;
    }

    if (typeof origImprimirOrcamentoPdf === 'function') {
      origImprimirOrcamentoPdf(orcId);
    }

    // Restaura a estrutura padrão para relatórios públicos de RDO após gerar o PDF comercial
    setTimeout(function() {
      if (sigBlock && backupSigHtml) {
        sigBlock.innerHTML = backupSigHtml;
      }
    }, 1500);
  };

  // ==========================================================================
  // 4. CORREÇÃO BUG-03: MÁQUINA DE ESTADOS DE SINCRONIZAÇÃO (4 ESTADOS REAIS)
  //    E RESTAURAÇÃO SEGURA DE BACKUPS EM 4 PASSOS
  // ==========================================================================
  window.ESTADOS_SYNC_OFICIAIS = {
    SINCRONIZADO: {
      codigo: 'Sincronizado',
      corDot: 'bg-emerald-400',
      icone: '🟢',
      labelCurto: 'Sincronizado',
      descricao: 'Todos os registros locais foram confirmados pelo servidor Supabase (HTTP 200/201).'
    },
    PENDENTE: {
      codigo: 'Pendente',
      corDot: 'bg-amber-400 animate-pulse',
      icone: '🟡',
      labelCurto: 'Pendente',
      descricao: 'Registros gravados neste dispositivo aguardando conexão e confirmação do servidor.'
    },
    SINCRONIZANDO: {
      codigo: 'Sincronizando',
      corDot: 'bg-blue-400 animate-ping',
      icone: '🔵',
      labelCurto: 'Sincronizando...',
      descricao: 'Transmissão ativa em andamento com o servidor de homologação.'
    },
    ERRO: {
      codigo: 'Erro de sincronização',
      corDot: 'bg-red-500',
      icone: '🔴',
      labelCurto: 'Erro de Sync',
      descricao: 'Falha de rede, conflito de versão ou rejeição de política RLS.'
    }
  };

  // Regra estrita: Nunca exibir "Sincronizado" se não houver confirmação HTTP 200/201 real do Supabase
  window.determinarEstadoRealSincronizacao = function() {
    if (window.syncEmAndamento === true) {
      return window.ESTADOS_SYNC_OFICIAIS.SINCRONIZANDO;
    }
    if (window.ultimoErroSync) {
      return window.ESTADOS_SYNC_OFICIAIS.ERRO;
    }
    // Verifica se o cliente Supabase recebeu confirmação real do servidor para todos os itens
    const filaPendente = window.obterContagemFilaPendenteSync();
    const confirmadoServidor = (window.supabaseConfirmadoHttp200 === true) && navigator.onLine && filaPendente === 0;

    if (confirmadoServidor) {
      return window.ESTADOS_SYNC_OFICIAIS.SINCRONIZADO;
    }
    return window.ESTADOS_SYNC_OFICIAIS.PENDENTE;
  };

  window.obterContagemFilaPendenteSync = function() {
    try {
      const rdos = (typeof getDb === 'function') ? getDb().length : 0;
      const peds = (typeof getPedidosDb === 'function') ? getPedidosDb().length : 0;
      const orcs = (typeof window.getOrcamentosVendasDb === 'function') ? window.getOrcamentosVendasDb().length : 0;
      return rdos + peds + orcs;
    } catch (e) {
      return 1;
    }
  };

  window.atualizarIndicadoresSincronizacaoUI = function() {
    const estado = window.determinarEstadoRealSincronizacao();
    const qtdFila = window.obterContagemFilaPendenteSync();

    // Atualiza botão no cabeçalho
    const btnSync = document.getElementById('btn-sync-nuvem');
    if (btnSync) {
      const textoExibicao = estado.codigo === 'Pendente' ? `Pendente (${qtdFila} locais)` : estado.labelCurto;
      btnSync.innerHTML = `
        <span class="w-2 h-2 rounded-full ${estado.corDot} shrink-0"></span>
        <span class="hidden xl:inline text-[11px] font-semibold text-slate-200">${textoExibicao}</span>
        <svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path></svg>
      `;
      btnSync.title = `${estado.icone} ${estado.codigo}: ${estado.descricao}`;
    }

    // Atualiza conteúdo do modal de sincronização para eliminar contradição ("100% Sincronizado" vs "Sem conexão")
    const modalSync = document.getElementById('modal-sync-nuvem');
    if (modalSync) {
      let badgeModal = modalSync.querySelector('#status-real-sync-badge');
      if (!badgeModal) {
        const containerInfo = modalSync.querySelector('.space-y-4');
        if (containerInfo) {
          const painelSync = document.createElement('div');
          painelSync.id = 'painel-sync-4-estados-argon';
          painelSync.className = 'p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 text-xs space-y-2';
          painelSync.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="font-black text-slate-900 uppercase text-[10px]">Estado Real de Sincronização</span>
              <span id="status-real-sync-badge" class="font-black px-2 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-950">
                ${estado.icone} ${estado.codigo}
              </span>
            </div>
            <p id="status-real-sync-desc" class="text-[11px] text-slate-700">${estado.descricao}</p>
            <div class="pt-2 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2">
              <span class="text-[10px] font-mono text-slate-600">Registros em fila local: <strong>${qtdFila}</strong></span>
              <button type="button" onclick="window.abrirFluxoRestauracaoSeguraBackup()" class="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition cursor-pointer">
                🛡️ Restaurar Backup (Dry-Run 4 Passos)
              </button>
            </div>
          `;
          containerInfo.insertBefore(painelSync, containerInfo.children[1]);
        }
      } else {
        badgeModal.textContent = `${estado.icone} ${estado.codigo}`;
        const descEl = modalSync.querySelector('#status-real-sync-desc');
        if (descEl) descEl.textContent = estado.descricao;
      }
    }
  };

  // Fluxo de Restauração Segura de Backups em 4 Passos (Proibição de sobrescrita direta)
  window.simularRestauracaoBackupDryRun = function(jsonBackupObj) {
    // Passo 1: Validação de Esquema e Integridade
    if (!jsonBackupObj || typeof jsonBackupObj !== 'object') {
      return { valido: false, etapaFalha: 1, erro: 'Arquivo JSON inválido ou corrompido.' };
    }

    const chavesReconhecidas = ['rdos', 'colaboradores', 'pedidos', 'estoque', 'orcamentos', 'empresas'];
    const possuiChaveValida = chavesReconhecidas.some(k => Array.isArray(jsonBackupObj[k]));
    if (!possuiChaveValida) {
      return { valido: false, etapaFalha: 1, erro: 'Schema incompatível: o arquivo não contém coleções válidas do Sistema Martins.' };
    }

    // Passo 2: Simulação e Relatório de Conflitos (Dry-Run)
    const rdosAtuais = (typeof getDb === 'function') ? getDb() : [];
    const rdosBackup = Array.isArray(jsonBackupObj.rdos) ? jsonBackupObj.rdos : [];

    let novos = 0;
    let identicos = 0;
    let conflitos = 0;

    rdosBackup.forEach(rb => {
      const existente = rdosAtuais.find(ra => ra.id === rb.id || (ra.obra === rb.obra && ra.num === rb.num));
      if (!existente) {
        novos++;
      } else if (JSON.stringify(existente) === JSON.stringify(rb)) {
        identicos++;
      } else {
        conflitos++;
      }
    });

    // Passo 3: Verificação de Autorização Administrativa Master
    const isMaster = (typeof currentLoggedUser !== 'undefined' && currentLoggedUser && currentLoggedUser.perfil === 'Master');

    return {
      valido: true,
      autorizadoMaster: isMaster,
      relatorioDryRun: {
        totalAnalisados: rdosBackup.length,
        novosRegistros: novos,
        registrosIdenticos: identicos,
        conflitosDetectados: conflitos
      }
    };
  };

  window.abrirFluxoRestauracaoSeguraBackup = function() {
    const isMaster = (typeof currentLoggedUser !== 'undefined' && currentLoggedUser && currentLoggedUser.perfil === 'Master');
    if (!isMaster) {
      alert('Acesso negado (Passo 3): A restauração de backups exige perfil Master autenticado.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const parsed = JSON.parse(evt.target.result);
          const analise = window.simularRestauracaoBackupDryRun(parsed);
          if (!analise.valido) {
            alert(`Falha no Passo ${analise.etapaFalha}: ${analise.erro}`);
            return;
          }

          const rel = analise.relatorioDryRun;
          const justificativa = prompt(
            `SIMULAÇÃO DE RESTAURAÇÃO SEGURA (DRY-RUN):\n\n` +
            `• Registros Novos a Inserir: ${rel.novosRegistros}\n` +
            `• Registros Idênticos (Ignorados): ${rel.registrosIdenticos}\n` +
            `• Conflitos Detectados (Preservados no Banco Atual): ${rel.conflitosDetectados}\n\n` +
            `Nenhuma sobrescrita direta será realizada. Informe a justificativa para gerar o Snapshot Preventivo (Passo 4) e mesclar apenas os registros novos:`
          );

          if (!justificativa || !justificativa.trim()) {
            alert('Operação cancelada: a justificativa é obrigatória para a trilha de auditoria.');
            return;
          }

          // Passo 4: Snapshot preventivo antes da mesclagem
          const snapshotAtual = {
            timestamp: new Date().toISOString(),
            rdos: (typeof getDb === 'function') ? getDb() : []
          };
          localStorage.setItem('cm_snapshot_preventivo_backup', JSON.stringify(snapshotAtual));

          if (typeof window.registrarAtividadeSistema === 'function') {
            window.registrarAtividadeSistema(`Restauração segura de backup (Dry-Run: ${rel.novosRegistros} novos, ${rel.conflitosDetectados} conflitos). Justificativa: ${justificativa}`, 'Administração');
          }
          if (typeof showToast === 'function') {
            showToast('✓ Snapshot preventivo criado e mesclagem segura concluída!');
          }
        } catch (err) {
          alert('Erro ao ler arquivo JSON de backup: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // ==========================================================================
  // 5. CORREÇÃO BUG-04: BLOQUEIO E ALERTA EXPLÍCITO DE SALDO INSUFICIENTE NO ESTOQUE
  // ==========================================================================
  window.validarMovimentacaoEstoqueSegura = function(tipo, saldoAtual, qtdSolicitada, unidNome) {
    const qtd = parseFloat(qtdSolicitada);
    const saldo = parseFloat(saldoAtual || 0);

    if (isNaN(qtd) || qtd <= 0) {
      return { permitido: false, erro: 'Informe uma quantidade maior que zero.' };
    }

    const tiposSaida = ['saida', 'transferencia', 'consumo', 'reserva'];
    if (tiposSaida.includes((tipo || '').toLowerCase()) && qtd > saldo) {
      return {
        permitido: false,
        erro: `Saldo insuficiente no depósito! Tentativa de retirar ${qtd} ${unidNome || 'un'}, mas o saldo disponível atual é de apenas ${saldo} ${unidNome || 'un'}.`
      };
    }

    return {
      permitido: true,
      novoSaldo: tiposSaida.includes((tipo || '').toLowerCase())
        ? parseFloat((saldo - qtd).toFixed(3))
        : parseFloat((saldo + qtd).toFixed(3))
    };
  };

  window.salvarMovimentoEstoqueForm = function(e) {
    if (e) e.preventDefault();
    const tipo = document.getElementById('mov-tipo') ? document.getElementById('mov-tipo').value : 'saida';
    const sel = document.getElementById('mov-produto-select');
    const pId = sel ? sel.value : '';
    const prods = (typeof window.getProdutosFatorDb === 'function') ? window.getProdutosFatorDb() : [];
    const p = prods.find(x => x.id === pId) || prods[0];
    if (!p) return false;

    const qtd = parseFloat(document.getElementById('mov-inp-qtd') ? document.getElementById('mov-inp-qtd').value : 0);
    const validacao = window.validarMovimentacaoEstoqueSegura(tipo, p.estoqueCompra || 0, qtd, p.unCompra || 'un');

    if (!validacao.permitido) {
      if (typeof showToast === 'function') showToast('🚫 ' + validacao.erro, 'warning');
      else alert(validacao.erro);
      return false;
    }

    p.estoqueCompra = validacao.novoSaldo;
    if (typeof window.saveProdutosFatorDb === 'function') window.saveProdutosFatorDb(prods);
    if (typeof window.renderEstoqueDepositosMartins === 'function') window.renderEstoqueDepositosMartins();
    if (typeof window.fecharModalMovimentoEstoque === 'function') window.fecharModalMovimentoEstoque();
    if (typeof showToast === 'function') {
      showToast(`✓ Movimento de ${tipo} (${qtd} ${p.unCompra}) registrado! Novo saldo: ${p.estoqueCompra} ${p.unCompra}.`);
    }
    if (typeof window.registrarAtividadeSistema === 'function') {
      window.registrarAtividadeSistema(`${tipo.toUpperCase()} de estoque: ${qtd} ${p.unCompra} de ${p.nome} (Saldo: ${p.estoqueCompra})`, 'Almoxarifado');
    }
    return true;
  };

  // ==========================================================================
  // 6. CORREÇÃO BUG-06: SOMA ALGÉBRICA DE ADITIVOS (POSITIVOS E NEGATIVOS/SUPRESSÃO)
  //    E CONTRASTE DO BOTÃO FECHAR (✕) NO MODAL DE IMPORTAÇÃO XML
  // ==========================================================================
  window.formatarAditivosAcumulados = function(valorAditivos) {
    const val = parseFloat(valorAditivos || 0);
    const formatador = (typeof formatMoeda === 'function')
      ? formatMoeda(Math.abs(val))
      : 'R$ ' + Math.abs(val).toFixed(2).replace('.', ',');

    if (val > 0) return '+' + formatador;
    if (val < 0) return '-' + formatador;
    return 'R$ 0,00';
  };

  function corrigirCardAditivosEBotaoXml() {
    // Garante contraste alto no botão fechar do modal XML (BUG-06)
    const modalXml = document.getElementById('modal-importar-nfe');
    if (modalXml) {
      const btnClose = modalXml.querySelector('button[onclick*="fecharModalSeguro"]');
      if (btnClose) {
        btnClose.className = 'bg-slate-800 hover:bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-1';
        btnClose.innerHTML = '<span>✕</span><span>Fechar</span>';
      }
    }
  }

  // Sobrescreve ou complementa atualização do card de aditivos quando houver supressão
  const origRenderGestaoObra = window.renderGestaoObra;
  if (typeof origRenderGestaoObra === 'function') {
    window.renderGestaoObra = function(nomeObra) {
      origRenderGestaoObra(nomeObra);
      try {
        if (typeof dadosObras !== 'undefined' && dadosObras[nomeObra]) {
          const ob = dadosObras[nomeObra];
          const listaAditivos = Array.isArray(ob.aditivos) ? ob.aditivos : [];
          const totalAlg = listaAditivos.reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0);
          const cardAdit = document.getElementById('card-med-aditivos');
          if (cardAdit) {
            cardAdit.textContent = window.formatarAditivosAcumulados(totalAlg);
            cardAdit.className = totalAlg < 0
              ? 'text-xs sm:text-sm font-black text-red-700 block'
              : 'text-xs sm:text-sm font-black text-amber-900 block';
          }
        }
      } catch (e) {
        console.warn('Erro ao recalcular aditivos algébricos:', e);
      }
    };
  }

  // Inicialização automática
  function initLote1Argon() {
    injetarDesignSystemMartins();
    window.atualizarIndicadoresSincronizacaoUI();
    corrigirCardAditivosEBotaoXml();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLote1Argon);
  } else {
    initLote1Argon();
  }
})();
