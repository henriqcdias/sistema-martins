// ============================================================================
// SISTEMA MARTINS — LOTE 4: FINANCEIRO (7 ABAS OFICIAIS), PERFIL LANÇADOR
// FINANCEIRO, VISIBILIDADE GRANULAR (4 PERMISSÕES BANCÁRIAS + LOTE),
// PORTAL FISCAL FIEL, AUDITORIA IMUTÁVEL E DASHBOARD PRINCIPAL (4 ZONAS)
// Arquivo: dist/lote4_financeiro_permissoes_relatorios_argon.js
// ============================================================================

(function() {
  'use strict';

  // ==========================================================================
  // 1. ESTRUTURA EM 7 ABAS DO MÓDULO FINANCEIRO (MÓDULO 5)
  // ==========================================================================
  window.ABAS_OFICIAIS_FINANCEIRO = [
    { id: 'fluxo', ordem: 1, titulo: '1. Fluxo de Caixa', restritoMaster: false },
    { id: 'pagar', ordem: 2, titulo: '2. Contas a Pagar', restritoMaster: false },
    { id: 'receber', ordem: 3, titulo: '3. Contas a Receber', restritoMaster: false },
    { id: 'bancos', ordem: 4, titulo: '4. Contas Bancárias', restritoMaster: false },
    { id: 'gastos-obra', ordem: 5, titulo: '5. Gastos por Obra', restritoMaster: false },
    { id: 'conciliacao', ordem: 6, titulo: '6. Conciliação e Relatórios', restritoMaster: true },
    { id: 'permissoes', ordem: 7, titulo: '7. Permissões Financeiras (Visibilidade)', restritoMaster: true }
  ];

  // ==========================================================================
  // 2. REGRAS DE VISIBILIDADE E PERMISSÕES FINANCEIRAS POR USUÁRIO (SEÇÃO 5.1)
  // ==========================================================================
  window.lancamentosFinanceirosDb = window.lancamentosFinanceirosDb || [
    {
      id: 'FIN-2026-001',
      data: '2026-11-04',
      favorecido: 'Viagem Minas / Distribuidora de Alumínio',
      descricao: 'Perfis de Alumínio Branco (218,4 kg) - Pedido 018950(M)',
      valor: 9391.20,
      tipo: 'DESPESA',
      empresaId: 'emp-1',
      obra: 'UEMG - Bloco 4',
      contaBancariaId: 'CTA-BB-MOV',
      status: 'Conciliado',
      created_by: 'admin',
      compartilhadoCom: []
    },
    {
      id: 'FIN-2026-002',
      data: '2026-11-05',
      favorecido: 'Auto Posto Aruana Ltda',
      descricao: 'Diesel S10 Aditivado (69,54 L) - NF-e 9996 - Placa RTX-8B15',
      valor: 493.05,
      tipo: 'DESPESA',
      empresaId: 'emp-1',
      obra: 'Frota / Caminhão Carroceria',
      contaBancariaId: 'CTA-BB-MOV',
      status: 'Pendente de Conferência',
      created_by: 'gabriel',
      compartilhadoCom: [{ usuario: 'leonardo', nivel: 'edicao' }]
    },
    {
      id: 'FIN-2026-003',
      data: '2026-11-04',
      favorecido: 'Casa do Encanador',
      descricao: 'Caixa D\'Água 1000L Fortlev c/ Tampa - DAV 90179022',
      valor: 488.32,
      tipo: 'DESPESA',
      empresaId: 'emp-1',
      obra: 'UBS - Guaxupé',
      contaBancariaId: 'CTA-NUBANK-PJ',
      status: 'Pendente de Conferência',
      created_by: 'leticia',
      compartilhadoCom: []
    },
    {
      id: 'FIN-2026-004',
      data: '2026-11-05',
      vencimento: '2026-12-05',
      favorecido: 'Casa do Parafuso e Ferramentas',
      descricao: '50m Manta Vedatudo 10cmx10m Vedacit - DAV 90800487',
      valor: 135.00,
      tipo: 'DESPESA',
      empresaId: 'emp-1',
      obra: 'Pratópolis',
      contaBancariaId: 'CTA-BB-MOV',
      status: 'Pendente de Conferência',
      created_by: 'gabriel',
      compartilhadoCom: []
    }
  ];

  // Matriz de Contas Bancárias e os 4 Níveis Independentes de Autorização por Usuário
  window.contasBancariasGrupoDb = window.contasBancariasGrupoDb || [
    { id: 'CTA-BB-MOV', nome: 'Banco do Brasil (Movimento)', banco: '001 - BB', agenciaConta: '0122-8 / 45890-1', empresaId: 'emp-1', saldoAtual: 148520.40 },
    { id: 'CTA-CAIXA-OBRA', nome: 'Caixa Canteiro (Espécie)', banco: 'Caixa Físico', agenciaConta: 'Interno UEMG', empresaId: 'emp-1', saldoAtual: 4250.00 },
    { id: 'CTA-SANT-CALHAS', nome: 'Santander (Conta Principal)', banco: '033 - Santander', agenciaConta: '3411 / 130045-9', empresaId: 'emp-2', saldoAtual: 62310.15 },
    { id: 'CTA-NUBANK-ACOS', nome: 'Nubank PJ (Aços RR)', banco: '260 - Nu Pagamentos', agenciaConta: '0001 / 994812-3', empresaId: 'emp-3', saldoAtual: 89140.00 }
  ];

  // Permissões por usuário x conta bancária: { usarEmLancamentos, visualizarMovimentos, consultarExtratos, visualizarSaldos }
  window.matrizPermissoesContasBancarias = window.matrizPermissoesContasBancarias || {
    'gabriel': {
      'CTA-BB-MOV': { usarEmLancamentos: true, visualizarMovimentos: true, consultarExtratos: false, visualizarSaldos: false },
      'CTA-CAIXA-OBRA': { usarEmLancamentos: true, visualizarMovimentos: true, consultarExtratos: true, visualizarSaldos: true },
      'CTA-SANT-CALHAS': { usarEmLancamentos: false, visualizarMovimentos: false, consultarExtratos: false, visualizarSaldos: false }
    },
    'josehenrique': {
      'CTA-SANT-CALHAS': { usarEmLancamentos: true, visualizarMovimentos: false, consultarExtratos: false, visualizarSaldos: false }
    }
  };

  // Regra 1 & 2: Cadastrar Lançamento pelo Lançador Financeiro (entra sempre como "Pendente de Conferência", sem baixa bancária)
  window.criarLancamentoFinanceiroSeguro = function(dados, usuarioCriador) {
    if (!usuarioCriador || !usuarioCriador.usuario) {
      return { sucesso: false, erro: 'Usuário autenticado obrigatório.' };
    }

    const valor = parseFloat(dados.valor);
    if (isNaN(valor) || valor <= 0) {
      return { sucesso: false, erro: 'O valor do lançamento financeiro deve ser estritamente positivo (> R$ 0,00).' };
    }

    const isMaster = (usuarioCriador.perfil === 'Master');
    const login = usuarioCriador.usuario.toLowerCase();

    // Verifica isolamento multiempresa (José Henrique só acessa emp-2)
    if ((login === 'josehenrique' || usuarioCriador.perfil === 'Acesso Restrito') && dados.empresaId !== 'emp-2') {
      return {
        sucesso: false,
        codigo: 'EMPRESA_NAO_AUTORIZADA',
        erro: 'Acesso negado: Seu usuário possui permissão exclusiva para a unidade Calhas e Rufos Martins (emp-2).'
      };
    }

    // Verifica se o usuário tem permissão "usarEmLancamentos" na conta bancária informada
    if (!isMaster && dados.contaBancariaId) {
      const permConta = window.obterPermissoesContaParaUsuario(login, dados.contaBancariaId, usuarioCriador.perfil);
      if (!permConta.usarEmLancamentos) {
        return {
          sucesso: false,
          codigo: 'CONTA_NAO_AUTORIZADA',
          erro: 'Você não possui autorização para utilizar esta conta bancária em lançamentos.'
        };
      }
    }

    // Todo lançamento de Lançador Financeiro entra como "Pendente de Conferência", sem debitar saldo bancário
    const statusInicial = isMaster && dados.statusDesejado ? dados.statusDesejado : 'Pendente de Conferência';

    const novoLanc = {
      id: 'FIN-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      data: dados.data || '2026-11-06',
      favorecido: dados.favorecido || 'Fornecedor',
      descricao: dados.descricao || 'Despesa Operacional',
      valor: parseFloat(valor.toFixed(2)),
      tipo: dados.tipo || 'DESPESA',
      empresaId: dados.empresaId || 'emp-1',
      obra: dados.obra || '', // Permite identificar lançamentos sem obra no Card de Alerta
      contaBancariaId: dados.contaBancariaId || 'CTA-BB-MOV',
      status: statusInicial,
      representaPagamentoBancarioReal: statusInicial === 'Conciliado',
      created_by: login,
      compartilhadoCom: []
    };

    window.lancamentosFinanceirosDb.unshift(novoLanc);
    return { sucesso: true, lancamento: novoLanc };
  };

  // Regra 3: Filtro de Visibilidade por Usuário (Criador + Compartilhados pelo Master + Isolamento de Empresa)
  window.listarLancamentosVisiveisParaUsuario = function(usuarioObj) {
    if (!usuarioObj) return [];
    const isMaster = (usuarioObj.perfil === 'Master');
    const login = (usuarioObj.usuario || '').toLowerCase();
    const empresasAutorizadas = Array.isArray(usuarioObj.empresas) ? usuarioObj.empresas : ['emp-1'];

    if (isMaster) {
      return window.lancamentosFinanceirosDb;
    }

    return window.lancamentosFinanceirosDb.filter(lanc => {
      // Respeita isolamento de empresa
      if (!empresasAutorizadas.includes(lanc.empresaId)) return false;

      // É o próprio criador do lançamento?
      if (lanc.created_by === login) return true;

      // Foi expressamente compartilhado com este usuário pelo Master?
      if (Array.isArray(lanc.compartilhadoCom)) {
        return lanc.compartilhadoCom.some(c => c.usuario.toLowerCase() === login);
      }
      return false;
    });
  };

  // Regra 4: Edição Restrita à Situação Editável ("Pendente de Conferência")
  window.editarLancamentoFinanceiroSeguro = function(lancamentoId, novosDados, usuarioEditor) {
    const lanc = window.lancamentosFinanceirosDb.find(l => l.id === lancamentoId);
    if (!lanc) return { sucesso: false, erro: 'Lançamento não encontrado.' };

    const isMaster = (usuarioEditor && usuarioEditor.perfil === 'Master');
    const login = (usuarioEditor?.usuario || '').toLowerCase();

    if (!isMaster) {
      // Verifica se está em situação editável
      if (lanc.status !== 'Pendente de Conferência') {
        return {
          sucesso: false,
          codigo: 'BLOQUEADO_JA_CONFERIDO',
          erro: `Edição bloqueada: Este lançamento já se encontra com status "${lanc.status}" e não pode ser alterado pelo lançador.`
        };
      }

      // Verifica se é o criador ou possui compartilhamento com permissão de edição
      const ehCriador = (lanc.created_by === login);
      const temCompartilhamentoEdicao = Array.isArray(lanc.compartilhadoCom) &&
        lanc.compartilhadoCom.some(c => c.usuario.toLowerCase() === login && c.nivel === 'edicao');

      if (!ehCriador && !temCompartilhamentoEdicao) {
        return {
          sucesso: false,
          codigo: 'SEM_PERMISSAO_EDICAO',
          erro: 'Acesso negado: Você possui apenas permissão de visualização ou não é o autor deste lançamento.'
        };
      }
    }

    if (novosDados.descricao) lanc.descricao = novosDados.descricao;
    if (novosDados.obra !== undefined) lanc.obra = novosDados.obra;
    if (novosDados.valor && parseFloat(novosDados.valor) > 0) lanc.valor = parseFloat(novosDados.valor);

    return { sucesso: true, lancamento: lanc };
  };

  // Regra 5: Compartilhamento Individual ou em Lote pelo Master (Visualização ou Edição)
  window.compartilharLancamentosEmLoteMaster = function(idsLancamentos, usuarioAlvoLogin, nivelAcesso, usuarioExecutor) {
    if (!usuarioExecutor || usuarioExecutor.perfil !== 'Master') {
      return {
        sucesso: false,
        codigo: 'APENAS_MASTER',
        erro: 'Acesso negado: O compartilhamento de lançamentos financeiros é exclusivo dos Masters.'
      };
    }

    if (!['visualizacao', 'edicao'].includes(nivelAcesso)) {
      return { sucesso: false, erro: 'Nível de compartilhamento deve ser "visualizacao" ou "edicao".' };
    }

    const loginAlvo = (usuarioAlvoLogin || '').toLowerCase().trim();
    let totalCompartilhados = 0;

    idsLancamentos.forEach(id => {
      const lanc = window.lancamentosFinanceirosDb.find(l => l.id === id);
      if (lanc) {
        if (!Array.isArray(lanc.compartilhadoCom)) lanc.compartilhadoCom = [];
        const idxExistente = lanc.compartilhadoCom.findIndex(c => c.usuario.toLowerCase() === loginAlvo);
        if (idxExistente >= 0) {
          lanc.compartilhadoCom[idxExistente].nivel = nivelAcesso;
        } else {
          lanc.compartilhadoCom.push({
            usuario: loginAlvo,
            nivel: nivelAcesso,
            concedidoPor: usuarioExecutor.nome,
            dataHora: new Date().toISOString()
          });
        }
        totalCompartilhados++;
      }
    });

    window.gravarLogAuditoriaImutavel({
      usuario_id: usuarioExecutor.usuario,
      perfil: usuarioExecutor.perfil,
      modulo: 'Financeiro / Permissões',
      acao: 'COMPARTILHAMENTO_LOTE',
      entidade_id: idsLancamentos.join(','),
      valor_novo_json: { usuarioAlvo: loginAlvo, nivel: nivelAcesso, qtd: totalCompartilhados },
      justificativa: `Compartilhamento de ${totalCompartilhados} lançamento(s) com ${loginAlvo} (${nivelAcesso})`
    });

    return { sucesso: true, totalCompartilhados: totalCompartilhados };
  };

  // Regra 6: Matriz de 4 Permissões por Conta Bancária
  window.obterPermissoesContaParaUsuario = function(loginUsuario, contaId, perfilUsuario) {
    if (perfilUsuario === 'Master') {
      return { usarEmLancamentos: true, visualizarMovimentos: true, consultarExtratos: true, visualizarSaldos: true };
    }
    const mapaUser = window.matrizPermissoesContasBancarias[(loginUsuario || '').toLowerCase()] || {};
    return mapaUser[contaId] || { usarEmLancamentos: false, visualizarMovimentos: false, consultarExtratos: false, visualizarSaldos: false };
  };

  window.definirPermissaoContaBancariaMaster = function(loginAlvo, contaId, novasPermissoes, usuarioExecutor) {
    if (!usuarioExecutor || usuarioExecutor.perfil !== 'Master') {
      return { sucesso: false, erro: 'Exclusivo para perfil Master.' };
    }
    const chaveUser = loginAlvo.toLowerCase();
    if (!window.matrizPermissoesContasBancarias[chaveUser]) {
      window.matrizPermissoesContasBancarias[chaveUser] = {};
    }
    const anterior = window.matrizPermissoesContasBancarias[chaveUser][contaId] || {};
    window.matrizPermissoesContasBancarias[chaveUser][contaId] = {
      usarEmLancamentos: !!novasPermissoes.usarEmLancamentos,
      visualizarMovimentos: !!novasPermissoes.visualizarMovimentos,
      consultarExtratos: !!novasPermissoes.consultarExtratos,
      visualizarSaldos: !!novasPermissoes.visualizarSaldos
    };

    window.gravarLogAuditoriaImutavel({
      usuario_id: usuarioExecutor.usuario,
      perfil: 'Master',
      modulo: 'Financeiro / Contas Bancárias',
      acao: 'ALTERACAO_PERMISSAO_CONTA',
      entidade_id: `${chaveUser}:${contaId}`,
      valor_anterior_json: anterior,
      valor_novo_json: window.matrizPermissoesContasBancarias[chaveUser][contaId],
      justificativa: 'Atualização na matriz de contas bancárias autorizadas'
    });

    return { sucesso: true, permissoes: window.matrizPermissoesContasBancarias[chaveUser][contaId] };
  };

  // Regra 7: Conciliação Bancária Exclusiva do Master
  window.executarConciliacaoBancariaMaster = function(lancamentoId, usuarioExecutor) {
    if (!usuarioExecutor || usuarioExecutor.perfil !== 'Master') {
      return {
        sucesso: false,
        codigo: 'CONCILIACAO_EXCLUSIVA_MASTER',
        erro: 'Acesso negado: A conciliação bancária e baixa contábil definitiva são exclusivas dos Masters (Henrique, Camila e Robson).'
      };
    }
    const lanc = window.lancamentosFinanceirosDb.find(l => l.id === lancamentoId);
    if (!lanc) return { sucesso: false, erro: 'Lançamento não encontrado.' };

    lanc.status = 'Conciliado';
    lanc.representaPagamentoBancarioReal = true;
    lanc.conciliadoPor = usuarioExecutor.nome;
    lanc.dataHoraConciliacao = new Date().toISOString();

    return { sucesso: true, lancamento: lanc };
  };

  // Card de Alerta de Auditoria: Lançamentos sem Obra / Centro de Custo vinculado
  window.listarLancamentosSemObraVinculada = function() {
    return window.lancamentosFinanceirosDb.filter(l => !l.obra || l.obra.trim() === '' || l.obra === 'Sem Obra');
  };

  // ==========================================================================
  // 3. TRILHA DE AUDITORIA IMUTÁVEL (INSERT-ONLY — SEÇÃO 2.1.4)
  // ==========================================================================
  const trilhaAuditoriaImutavelPrivada = [];

  window.gravarLogAuditoriaImutavel = function(dadosLog) {
    const registroCongelado = Object.freeze({
      id: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      timestamp_utc: new Date().toISOString(),
      usuario_id: dadosLog.usuario_id || 'sistema',
      perfil: dadosLog.perfil || 'Desconhecido',
      modulo: dadosLog.modulo || 'Geral',
      acao: dadosLog.acao || 'REGISTRO',
      entidade_id: dadosLog.entidade_id || '-',
      valor_anterior_json: JSON.stringify(dadosLog.valor_anterior_json || {}),
      valor_novo_json: JSON.stringify(dadosLog.valor_novo_json || {}),
      justificativa: dadosLog.justificativa || ''
    });

    trilhaAuditoriaImutavelPrivada.unshift(registroCongelado);
    return registroCongelado;
  };

  window.consultarTrilhaAuditoriaImutavel = function() {
    // Retorna cópia somente leitura (impede UPDATE ou DELETE nos registros gravados)
    return trilhaAuditoriaImutavelPrivada.slice();
  };

  // ==========================================================================
  // 4. PRÉ-VISUALIZAÇÃO FIEL DO PORTAL FISCAL (FILTRO DE SERVIDOR ROLE='fiscal')
  // ==========================================================================
  window.sanitizarRdoParaPortalFiscal = function(rdoCompleto) {
    if (!rdoCompleto) return null;
    // Remove rigorosamente campos confidenciais: custos internos, margens, salários, vales e observações internas da engenharia
    const copiaSegura = {
      id: rdoCompleto.id,
      num: rdoCompleto.num,
      obra: rdoCompleto.obra,
      cliente: rdoCompleto.cliente,
      data: rdoCompleto.data,
      resp: rdoCompleto.resp,
      status: rdoCompleto.status,
      climaManha: rdoCompleto.climaManha,
      pratManha: rdoCompleto.pratManha,
      climaTarde: rdoCompleto.climaTarde,
      pratTarde: rdoCompleto.pratTarde,
      servicos: rdoCompleto.servicos,
      equipamentos: rdoCompleto.equipamentos,
      materiais: rdoCompleto.materiais,
      ocorrencias: rdoCompleto.ocorrencias,
      fotos: Array.isArray(rdoCompleto.fotos) ? rdoCompleto.fotos : [],
      efetivoQuantidade: Array.isArray(rdoCompleto.trabalhadores) ? rdoCompleto.trabalhadores.length : 0
      // OMITIDOS INTENCIONALMENTE: observacoesInternasEngenharia, custosMaoDeObra, salarios, vales, margens
    };
    return Object.freeze(copiaSegura);
  };

  // ==========================================================================
  // 5. VALIDAÇÃO ALGORÍTMICA DE CNPJ (CARTEIRA DE CLIENTES — MÓDULO 7)
  // ==========================================================================
  window.validarCnpjAlgoritmo = function(cnpjStr) {
    if (!cnpjStr) return true;
    const cnpj = cnpjStr.replace(/\D/g, '');
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let soma = 0;
    for (let i = 0; i < 12; i++) soma += parseInt(cnpj.charAt(i), 10) * pesos1[i];
    let resto = soma % 11;
    let d1 = resto < 2 ? 0 : 11 - resto;
    if (d1 !== parseInt(cnpj.charAt(12), 10)) return false;

    soma = 0;
    for (let i = 0; i < 13; i++) soma += parseInt(cnpj.charAt(i), 10) * pesos2[i];
    resto = soma % 11;
    let d2 = resto < 2 ? 0 : 11 - resto;
    return d2 === parseInt(cnpj.charAt(13), 10);
  };
})();
