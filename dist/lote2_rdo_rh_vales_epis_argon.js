// ============================================================================
// SISTEMA MARTINS — LOTE 2: RDO (2 ABAS / 4 BLOCOS), IMPORTAÇÃO DA FREQUÊNCIA,
// RH COMPLETO (CPF, PIX, SST/ASO/CNH/NRS), VALES (40% REAL) E EPIS MULTI-ITENS
// Arquivo: dist/lote2_rdo_rh_vales_epis_argon.js
// ============================================================================

(function() {
  'use strict';

  // ==========================================================================
  // 1. FUSO HORÁRIO DE BRASÍLIA E BLOQUEIO ESTRITO DE DATAS FUTURAS NO RDO
  // ==========================================================================
  window.obterDataAtualBrasiliaIso = function() {
    try {
      const partes = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const dia = partes.find(p => p.type === 'day').value;
      const mes = partes.find(p => p.type === 'month').value;
      const ano = partes.find(p => p.type === 'year').value;
      return `${ano}-${mes}-${dia}`;
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  };

  window.validarDataRdoNaoFutura = function(dataIso) {
    if (!dataIso) return { valido: false, erro: 'A data do RDO é obrigatória.' };
    const hojeBr = window.obterDataAtualBrasiliaIso();
    if (dataIso > hojeBr) {
      return {
        valido: false,
        erro: `Bloqueio de segurança: Não é permitido lançar, salvar rascunho ou aprovar RDO com data futura (${dataIso}). Hoje em Brasília: ${hojeBr}.`
      };
    }
    return { valido: true, hojeBr: hojeBr };
  };

  // Confirmação modal obrigatória antes de limpar campos do RDO
  window.confirmarLimpezaFormularioRdo = function(callbackLimpar) {
    const confirmar = confirm(
      'ATENÇÃO: Deseja realmente limpar todos os campos digitados neste RDO?\n\n' +
      'Esta ação apagará atividades, textos e seleções não salvas.'
    );
    if (confirmar && typeof callbackLimpar === 'function') {
      callbackLimpar();
    }
    return confirmar;
  };

  // ==========================================================================
  // 2. IMPORTAÇÃO EM 1 CLIQUE: "INCLUIR EQUIPE DA FREQUÊNCIA" PARA O RDO
  // ==========================================================================
  window.importarEquipeDaFrequenciaParaRdo = function(obraAlvo, dataAlvo) {
    const obra = obraAlvo || (document.getElementById('obra-select') ? document.getElementById('obra-select').value : '');
    const data = dataAlvo || (document.getElementById('input-data') ? document.getElementById('input-data').value : window.obterDataAtualBrasiliaIso());

    if (!obra) {
      if (typeof showToast === 'function') showToast('Selecione a Obra antes de importar a equipe.', 'warning');
      return { importados: 0, lista: [] };
    }

    const freqDb = (typeof getFrequenciaDiariaDb === 'function') ? getFrequenciaDiariaDb() : {};
    const folhaDia = freqDb[data] || window.estadoFrequenciaEmEdicao || {};

    const trabalhadoresObra = [];
    Object.values(folhaDia).forEach(reg => {
      if (['presente', 'meio_periodo'].includes(reg.status) && reg.obra === obra) {
        trabalhadoresObra.push({
          id: reg.colabId,
          nome: reg.colabNome,
          funcao: reg.funcao || 'Operacional',
          vinculo: reg.vinculo || 'Próprio (CLT)',
          horas: reg.horasTotais || (reg.status === 'meio_periodo' ? 4 : 8)
        });
      }
    });

    if (typeof currentTrabalhadores !== 'undefined' && Array.isArray(currentTrabalhadores)) {
      trabalhadoresObra.forEach(novoT => {
        const jaExiste = currentTrabalhadores.some(t => t.nome.trim().toLowerCase() === novoT.nome.trim().toLowerCase());
        if (!jaExiste) {
          currentTrabalhadores.push(novoT);
        }
      });
      if (typeof renderTrabalhadoresTable === 'function') {
        renderTrabalhadoresTable();
      }
    }

    if (typeof showToast === 'function') {
      showToast(`✓ ${trabalhadoresObra.length} colaborador(es) importados da Frequência para a obra ${obra}!`);
    }
    return { importados: trabalhadoresObra.length, lista: trabalhadoresObra };
  };

  // ==========================================================================
  // 3. REABERTURA AUDITADA DE RDO APROVADO (EXCLUSIVO MASTER OU RT TAIANE)
  // ==========================================================================
  window.reabrirRdoAprovadoComAuditoria = function(rdoId, usuarioAtual, justificativa) {
    const user = usuarioAtual || (typeof currentLoggedUser !== 'undefined' ? currentLoggedUser : null);
    if (!user) {
      return { permitido: false, erro: 'Usuário não autenticado.' };
    }

    const perfil = (user.perfil || '').toLowerCase();
    const nome = (user.nome || '').toLowerCase();
    const ehAutorizado = (perfil === 'master') || (perfil === 'engenharia') || nome.includes('taiane');

    if (!ehAutorizado) {
      return {
        permitido: false,
        erro: 'Acesso negado: Somente Masters ou a Responsável Técnica (Engª Taiane Furlan Palmiro - CREA-MG 405.818) podem reabrir um RDO já aprovado.'
      };
    }

    if (!justificativa || justificativa.trim().length < 5) {
      return {
        permitido: false,
        erro: 'Informe uma justificativa técnica detalhada (mínimo 5 caracteres) para registrar na trilha de auditoria.'
      };
    }

    if (typeof window.registrarAtividadeSistema === 'function') {
      window.registrarAtividadeSistema(
        `REABERTURA DE RDO APROVADO (${rdoId}) por ${user.nome}. Justificativa: ${justificativa.trim()}`,
        'Auditoria RDO'
      );
    }

    return {
      permitido: true,
      novoStatus: 'Rascunho',
      responsavelReabertura: user.nome,
      timestamp: new Date().toISOString()
    };
  };

  // ==========================================================================
  // 4. CONTROLE DE DOCUMENTOS DE SST (RG, CNH, ASO E NRS) E ALERTAS DE VENCIMENTO
  // ==========================================================================
  window.avaliarVencimentosDocumentosColaborador = function(colab, dataReferenciaIso) {
    const hojeStr = dataReferenciaIso || window.obterDataAtualBrasiliaIso();
    const hojeMs = new Date(hojeStr + 'T12:00:00').getTime();
    const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;

    const docsVerificar = [
      { tipo: 'ASO (Saúde Ocupacional)', validade: colab.validadeAso },
      { tipo: 'CNH (' + (colab.categoriaCnh || 'B') + ')', validade: colab.validadeCnh },
      { tipo: 'NR-06 (EPI)', validade: colab.validadeNr06 },
      { tipo: 'NR-10 (Elétrica)', validade: colab.validadeNr10 },
      { tipo: 'NR-18 (Construção Civil)', validade: colab.validadeNr18 },
      { tipo: 'NR-35 (Trabalho em Altura)', validade: colab.validadeNr35 }
    ];

    const vencidos = [];
    const aVencer30Dias = [];

    docsVerificar.forEach(doc => {
      if (!doc.validade || doc.validade === '-') return;
      const valMs = new Date(doc.validade + 'T12:00:00').getTime();
      if (isNaN(valMs)) return;

      const diffDias = Math.ceil((valMs - hojeMs) / (24 * 60 * 60 * 1000));
      if (diffDias < 0) {
        vencidos.push({ documento: doc.tipo, vencimento: doc.validade, diasAtraso: Math.abs(diffDias) });
      } else if (diffDias <= 30) {
        aVencer30Dias.push({ documento: doc.tipo, vencimento: doc.validade, diasRestantes: diffDias });
      }
    });

    return {
      colaborador: colab.nome,
      possuiAlerta: vencidos.length > 0 || aVencer30Dias.length > 0,
      vencidos: vencidos,
      aVencer30Dias: aVencer30Dias
    };
  };

  // Validação de Vigência Salarial >= Data de Admissão
  window.validarVigenciaSalarial = function(dataAdmissaoIso, dataVigenciaIso, novoValorSalario) {
    const valor = parseFloat(novoValorSalario);
    if (isNaN(valor) || valor <= 0) {
      return { valido: false, erro: 'O valor da remuneração/diária deve ser positivo.' };
    }
    if (dataAdmissaoIso && dataVigenciaIso && dataVigenciaIso < dataAdmissaoIso) {
      return {
        valido: false,
        erro: `A data de vigência salarial (${dataVigenciaIso}) não pode ser anterior à data de admissão (${dataAdmissaoIso}).`
      };
    }
    return { valido: true, valor: valor };
  };

  // ==========================================================================
  // 5. VALES E ADIANTAMENTOS: LIMITE ACUMULADO DE 40%, EXCEÇÃO NO SERVIDOR
  //    E BLOQUEIO DE DUPLICIDADE (MESMO VALOR / COLABORADOR / DATA)
  // ==========================================================================
  window.processarSolicitacaoVale = function(dadosVale, valesExistentes, usuarioAutorizador) {
    const colabId = dadosVale.colabId;
    const dataVale = dadosVale.data || window.obterDataAtualBrasiliaIso();
    const valorSolicitado = parseFloat(dadosVale.valor);
    const diasTrabalhados = parseFloat(dadosVale.diasTrabalhadosNoPeriodo || 0);
    const salarioMensal = parseFloat(dadosVale.salarioMensal || 0);

    if (isNaN(valorSolicitado) || valorSolicitado <= 0) {
      return { aprovado: false, codigo: 'VALOR_INVALIDO', erro: 'O valor do vale deve ser maior que zero.' };
    }

    const listaVales = Array.isArray(valesExistentes) ? valesExistentes : [];

    // 1. Bloqueio de Duplicidade (mesmo colaborador, mesma data e mesmo valor)
    const duplicado = listaVales.find(v =>
      v.colabId === colabId &&
      v.data === dataVale &&
      Math.abs(parseFloat(v.valor) - valorSolicitado) < 0.01
    );
    if (duplicado) {
      return {
        aprovado: false,
        codigo: 'VALE_DUPLICADO',
        erro: `Bloqueio de duplicidade: Já existe um vale de R$ ${valorSolicitado.toFixed(2)} lançado para este colaborador na data ${dataVale}.`
      };
    }

    // 2. Cálculo do limite acumulado de 40% sobre a remuneração bruta adquirida no período
    const valesAnterioresPeriodo = listaVales
      .filter(v => v.colabId === colabId && !v.descontadoEmFolha)
      .reduce((acc, v) => acc + (parseFloat(v.valor) || 0), 0);

    const ganhoBrutoAdquirido = parseFloat(((salarioMensal / 30.0) * diasTrabalhados).toFixed(2));
    const teto40Porcento = parseFloat((ganhoBrutoAdquirido * 0.40).toFixed(2));
    const novoAcumulado = parseFloat((valesAnterioresPeriodo + valorSolicitado).toFixed(2));

    // 3. Se ultrapassar 40%, exige validação de permissão administrativa Master + justificativa
    if (novoAcumulado > teto40Porcento) {
      const isMaster = usuarioAutorizador && (usuarioAutorizador.perfil === 'Master');
      const justificativa = (dadosVale.justificativaExcecao || '').trim();

      if (!isMaster) {
        return {
          aprovado: false,
          codigo: 'EXCEDE_40_PORCENTO_SEM_MASTER',
          erro: `Limite de 40% excedido! Teto disponível sobre dias trabalhados: R$ ${teto40Porcento.toFixed(2)} (Solicitado acumulado: R$ ${novoAcumulado.toFixed(2)}). Exige autorização de usuário Master no servidor.`
        };
      }

      if (justificativa.length < 5) {
        return {
          aprovado: false,
          codigo: 'EXCEDE_40_PORCENTO_SEM_JUSTIFICATIVA',
          erro: 'Para autorizar vale acima do limite de 40%, o administrador Master deve registrar justificativa obrigatória para auditoria.'
        };
      }

      if (typeof window.registrarAtividadeSistema === 'function') {
        window.registrarAtividadeSistema(
          `AUTORIZAÇÃO EXCEPCIONAL DE VALE (>40%) por ${usuarioAutorizador.nome}: R$ ${valorSolicitado.toFixed(2)} para ${dadosVale.colabNome || colabId}. Justificativa: ${justificativa}`,
          'Auditoria RH / Vales'
        );
      }

      return {
        aprovado: true,
        excecaoAutorizadaMaster: true,
        ganhoBrutoAdquirido: ganhoBrutoAdquirido,
        teto40Porcento: teto40Porcento,
        novoAcumulado: novoAcumulado
      };
    }

    return {
      aprovado: true,
      excecaoAutorizadaMaster: false,
      ganhoBrutoAdquirido: ganhoBrutoAdquirido,
      teto40Porcento: teto40Porcento,
      novoAcumulado: novoAcumulado
    };
  };

  // ==========================================================================
  // 6. EPIS (NR-06): CONTROLE DE VALIDADE DO C.A. E ASSINATURA DIGITAL CANVAS
  // ==========================================================================
  window.validarItemEpiObrigatorioCA = function(item) {
    const ehEpi = (item.categoria || '').toLowerCase().includes('epi') ||
                  (item.categoria || '').toLowerCase().includes('calçado') ||
                  (item.categoria || '').toLowerCase().includes('proteção') ||
                  item.exigeCa === true;

    if (!ehEpi) {
      return { valido: true, tipoClassificado: 'Uniforme / Vestuário' };
    }

    if (!item.ca || item.ca.trim().length < 2) {
      return {
        valido: false,
        erro: `O equipamento de proteção "${item.nome || item.item}" exige número de C.A. (Certificado de Aprovação MTE) obrigatório.`
      };
    }

    if (item.validadeCa) {
      const hoje = window.obterDataAtualBrasiliaIso();
      if (item.validadeCa < hoje) {
        return {
          valido: false,
          erro: `O C.A. (${item.ca}) do EPI "${item.nome || item.item}" está vencido desde ${item.validadeCa}.`
        };
      }
    }

    return { valido: true, tipoClassificado: 'EPI Regulamentar (NR-06)' };
  };

  // Inicialização no DOM
  function initLote2Argon() {
    // Configura confirmação no botão Limpar do RDO
    const btnLimparRdo = document.getElementById('btn-limpar-form');
    if (btnLimparRdo && !btnLimparRdo.dataset.argonBound) {
      btnLimparRdo.dataset.argonBound = '1';
      const origClick = btnLimparRdo.onclick;
      btnLimparRdo.onclick = function(e) {
        if (!window.confirmarLimpezaFormularioRdo()) {
          if (e) e.preventDefault();
          return false;
        }
        if (typeof origClick === 'function') origClick.call(this, e);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLote2Argon);
  } else {
    initLote2Argon();
  }
})();
