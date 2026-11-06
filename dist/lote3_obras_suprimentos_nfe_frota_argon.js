// ============================================================================
// SISTEMA MARTINS — LOTE 3: GESTÃO DE OBRAS (5 ABAS OFICIAIS), SUPRIMENTOS
// (5 MOVIMENTAÇÕES CONTÁBEIS), COMPRAS (5 ESTÁGIOS + NF-E 44 DÍGITOS) E FROTA
// Arquivo: dist/lote3_obras_suprimentos_nfe_frota_argon.js
// ============================================================================

(function() {
  'use strict';

  // ==========================================================================
  // 1. GESTÃO DE OBRAS: PADRONIZAÇÃO NAS 5 ABAS OFICIAIS (MÓDULO 2)
  // ==========================================================================
  window.ABAS_OFICIAIS_GESTAO_OBRA = [
    { id: 'contrato', ordem: 1, titulo: '1. Dados do Contrato', icone: '📄' },
    { id: 'medicao', ordem: 2, titulo: '2. Medições e Aditivos', icone: '📊' },
    { id: 'custos', ordem: 3, titulo: '3. Planilha e Custos (Orçado vs. Realizado)', icone: '💰' },
    { id: 'cronograma', ordem: 4, titulo: '4. Cronograma e Curva S', icone: '📈' },
    { id: 'materiais', ordem: 5, titulo: '5. Materiais da Obra', icone: '📦' }
  ];

  window.calcularComparativoOrcadoVsRealizado = function(valorOrcadoContrato, custosMateriaisApropriados, custosMaoDeObra) {
    const orcado = parseFloat(valorOrcadoContrato || 0);
    const mat = parseFloat(custosMateriaisApropriados || 0);
    const mo = parseFloat(custosMaoDeObra || 0);
    const totalRealizado = parseFloat((mat + mo).toFixed(2));
    const desvioValor = parseFloat((orcado - totalRealizado).toFixed(2));
    const percentualConsumido = orcado > 0 ? parseFloat(((totalRealizado / orcado) * 100).toFixed(2)) : 0;

    return {
      orcado: orcado,
      realizadoMateriais: mat,
      realizadoMaoDeObra: mo,
      totalRealizado: totalRealizado,
      saldoOrcamentario: desvioValor,
      percentualConsumido: percentualConsumido,
      estourouOrcamento: totalRealizado > orcado
    };
  };

  // ==========================================================================
  // 2. SUPRIMENTOS: OS 5 TIPOS CONTÁBEIS DE MOVIMENTAÇÃO DE ESTOQUE (MÓDULO 6)
  // ==========================================================================
  window.TIPOS_MOVIMENTACAO_ESTOQUE = {
    TRANSFERENCIA: 'Transferência entre Depósitos',
    RESERVA: 'Reserva de Material',
    CONSUMO: 'Consumo Efetivo (Saída para Obra/OP)',
    DEVOLUCAO: 'Devolução ao Estoque',
    INVENTARIO: 'Ajuste de Inventário'
  };

  window.custosApropriadosPorObra = window.custosApropriadosPorObra || {};
  window.historicoMovimentacoesContabeis = window.historicoMovimentacoesContabeis || [];

  window.executarMovimentacaoContabilEstoque = function(params, usuarioAtual) {
    const tipo = params.tipo; // 'TRANSFERENCIA', 'RESERVA', 'CONSUMO', 'DEVOLUCAO', 'INVENTARIO'
    const produto = params.produto; // { id, nome, saldoFisico, saldoReservado, custoMedio, unid }
    const qtd = parseFloat(params.quantidade);
    const obraDestino = params.obra || 'Almoxarifado Central';

    if (!produto || isNaN(qtd) || qtd <= 0) {
      return { sucesso: false, erro: 'Produto e quantidade positiva são obrigatórios.' };
    }

    const saldoFisico = parseFloat(produto.saldoFisico || 0);
    const saldoReservado = parseFloat(produto.saldoReservado || 0);
    const saldoDisponivel = parseFloat((saldoFisico - saldoReservado).toFixed(3));
    const custoUnit = parseFloat(produto.custoMedio || 0);
    const valorFinanceiroMov = parseFloat((qtd * custoUnit).toFixed(2));

    let novoSaldoFisico = saldoFisico;
    let novoSaldoReservado = saldoReservado;
    let custoApropriadoObraDelta = 0;
    let geraDespesaFluxoCaixa = false; // NENHUMA movimentação interna de estoque gera nova despesa bancária

    if (tipo === 'TRANSFERENCIA') {
      if (qtd > saldoDisponivel) {
        return {
          sucesso: false,
          erro: `Saldo disponível insuficiente no depósito de origem (${saldoDisponivel} ${produto.unid || 'un'}) para transferir ${qtd}.`
        };
      }
      // Move entre depósitos: não reduz o estoque global da empresa nem apropria custo definitivo
      custoApropriadoObraDelta = 0;
    } else if (tipo === 'RESERVA') {
      if (qtd > saldoDisponivel) {
        return {
          sucesso: false,
          erro: `Saldo disponível insuficiente (${saldoDisponivel}) para reservar ${qtd}.`
        };
      }
      // Bloqueia quantidade para a obra/OP sem dar baixa física contábil
      novoSaldoReservado = parseFloat((saldoReservado + qtd).toFixed(3));
    } else if (tipo === 'CONSUMO') {
      if (qtd > saldoFisico) {
        return {
          sucesso: false,
          erro: `Saldo físico insuficiente (${saldoFisico}) para consumo efetivo de ${qtd}.`
        };
      }
      // Baixa definitiva do saldo físico e apropriação automática pelo Custo Médio Ponderado na Obra
      novoSaldoFisico = parseFloat((saldoFisico - qtd).toFixed(3));
      if (saldoReservado > 0) {
        novoSaldoReservado = Math.max(0, parseFloat((saldoReservado - qtd).toFixed(3)));
      }
      custoApropriadoObraDelta = valorFinanceiroMov;
      window.custosApropriadosPorObra[obraDestino] = parseFloat(((window.custosApropriadosPorObra[obraDestino] || 0) + custoApropriadoObraDelta).toFixed(2));
    } else if (tipo === 'DEVOLUCAO') {
      // Retorno de material não utilizado da obra para o depósito: estorna custo da obra e recompõe saldo
      novoSaldoFisico = parseFloat((saldoFisico + qtd).toFixed(3));
      custoApropriadoObraDelta = -valorFinanceiroMov;
      window.custosApropriadosPorObra[obraDestino] = Math.max(0, parseFloat(((window.custosApropriadosPorObra[obraDestino] || 0) - valorFinanceiroMov).toFixed(2)));
    } else if (tipo === 'INVENTARIO') {
      // Exige justificativa obrigatória e permissão administrativa
      const user = usuarioAtual || (typeof currentLoggedUser !== 'undefined' ? currentLoggedUser : null);
      const isAdmin = user && (user.perfil === 'Master' || user.perfil === 'Administrativo Amplo');
      if (!isAdmin) {
        return { sucesso: false, erro: 'Acesso negado: Ajustes de inventário exigem permissão administrativa.' };
      }
      if (!params.justificativa || params.justificativa.trim().length < 5) {
        return { sucesso: false, erro: 'Ajuste de inventário exige justificativa obrigatória para auditoria.' };
      }
      novoSaldoFisico = parseFloat(params.novoSaldoContado !== undefined ? params.novoSaldoContado : qtd);
    } else {
      return { sucesso: false, erro: 'Tipo de movimentação contábil inválido.' };
    }

    produto.saldoFisico = novoSaldoFisico;
    produto.saldoReservado = novoSaldoReservado;
    produto.saldoDisponivel = parseFloat((novoSaldoFisico - novoSaldoReservado).toFixed(3));

    const registroMov = {
      id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      tipo: tipo,
      produtoId: produto.id,
      produtoNome: produto.nome,
      quantidade: qtd,
      obra: obraDestino,
      custoUnitarioAplicado: custoUnit,
      custoApropriadoObraDelta: custoApropriadoObraDelta,
      geraDespesaFluxoCaixa: geraDespesaFluxoCaixa,
      saldoFisicoFinal: novoSaldoFisico,
      saldoReservadoFinal: novoSaldoReservado,
      saldoDisponivelFinal: produto.saldoDisponivel,
      timestamp: new Date().toISOString()
    };

    window.historicoMovimentacoesContabeis.unshift(registroMov);
    return { sucesso: true, movimento: registroMov };
  };

  // ==========================================================================
  // 3. COMPRAS EM 5 ESTÁGIOS E IMPORTAÇÃO DE NF-E (CHAVE DE 44 DÍGITOS)
  // ==========================================================================
  window.ESTAGIOS_PEDIDO_COMPRA = [
    '1. Solicitado',
    '2. Em Cotação',
    '3. Aprovado',
    '4. Comprado',
    '5. Recebido / Conferido'
  ];

  window.chavesNfeImportadasSet = window.chavesNfeImportadasSet || new Set();

  // Regra de Segregação: Aprovar pedido ou marcá-lo como comprado NÃO dá entrada no estoque nem gera baixa bancária
  window.atualizarEstagioPedidoCompra = function(pedido, novoEstagio) {
    if (!window.ESTAGIOS_PEDIDO_COMPRA.includes(novoEstagio)) {
      return { valido: false, erro: 'Estágio de compra inválido.' };
    }
    pedido.status = novoEstagio;
    const alteraEstoque = (novoEstagio === '5. Recebido / Conferido' && pedido.conferenciaConfirmada === true);
    return {
      valido: true,
      novoStatus: pedido.status,
      alterouEstoqueAutomaticamente: alteraEstoque,
      gerouBaixaBancariaAutomatica: false
    };
  };

  window.validarEProcessarImportacaoXmlNfe = function(dadosNfe) {
    const chave = (dadosNfe.chaveAcesso || '').replace(/\D/g, '');
    if (chave.length !== 44) {
      return {
        sucesso: false,
        codigo: 'CHAVE_INVALIDA',
        erro: `A chave de acesso da NF-e deve conter exatamente 44 dígitos numéricos (informados: ${chave.length}).`
      };
    }

    if (window.chavesNfeImportadasSet.has(chave)) {
      return {
        sucesso: false,
        codigo: 'NFE_DUPLICADA',
        erro: `Bloqueio de duplicidade: A NF-e de chave ${chave} já foi importada anteriormente no sistema.`
      };
    }

    if (!dadosNfe.confirmacaoConferencia) {
      return {
        sucesso: false,
        codigo: 'AGUARDANDO_CONFERENCIA',
        erro: 'A importação exige a confirmação da conferência física de quantidades, fatores de conversão e parcelas antes de alimentar o estoque e o Contas a Pagar.'
      };
    }

    window.chavesNfeImportadasSet.add(chave);

    // Gera títulos em Contas a Pagar vinculados à NF-e
    const parcelas = Array.isArray(dadosNfe.parcelas) && dadosNfe.parcelas.length > 0
      ? dadosNfe.parcelas
      : [{ numero: 1, vencimento: dadosNfe.dataVencimento || '2026-12-05', valor: parseFloat(dadosNfe.valorTotal || 0) }];

    const titulosGerados = parcelas.map(p => ({
      id: `TIT-NFE-${chave.slice(-6)}-P${p.numero}`,
      chaveNfe: chave,
      fornecedor: dadosNfe.fornecedor || 'Fornecedor NF-e',
      vencimento: p.vencimento,
      valor: p.valor,
      obra: dadosNfe.obra || 'Almoxarifado Central',
      status: 'Pendente de Conferência'
    }));

    return {
      sucesso: true,
      chaveRegistrada: chave,
      entradaEstoqueEfetivada: true,
      titulosContasAPagar: titulosGerados
    };
  };

  // ==========================================================================
  // 4. FROTA E VEÍCULOS: CONSUMO MÉDIO (km/L), CUSTO/KM (R$/km) E INTEGRAÇÃO
  // ==========================================================================
  window.transacoesFrotaIdsSet = window.transacoesFrotaIdsSet || new Set();
  window.registrosAbastecimentoFrota = window.registrosAbastecimentoFrota || [];

  window.registrarAbastecimentoFrota = function(dadosAbast) {
    const idUnico = dadosAbast.idTransacao || `${dadosAbast.placa}_${dadosAbast.data}_${dadosAbast.kmAtual}_${dadosAbast.valorTotal}`;
    if (window.transacoesFrotaIdsSet.has(idUnico)) {
      return {
        sucesso: false,
        codigo: 'ABASTECIMENTO_DUPLICADO',
        erro: 'Este abastecimento já foi registrado e integrado ao financeiro (prevenção de duplicidade ativa).'
      };
    }

    const kmAnterior = parseFloat(dadosAbast.kmAnterior || 0);
    const kmAtual = parseFloat(dadosAbast.kmAtual || 0);
    const litros = parseFloat(dadosAbast.litros || 0);
    const valorTotal = parseFloat(dadosAbast.valorTotal || 0);

    if (kmAtual <= kmAnterior || litros <= 0 || valorTotal <= 0) {
      return {
        sucesso: false,
        erro: 'Odômetro atual deve ser superior ao anterior, e litros/valor devem ser positivos.'
      };
    }

    const distanciaRodada = parseFloat((kmAtual - kmAnterior).toFixed(1));
    const consumoMedioKmL = parseFloat((distanciaRodada / litros).toFixed(2));
    const custoPorKm = parseFloat((valorTotal / distanciaRodada).toFixed(2));

    window.transacoesFrotaIdsSet.add(idUnico);

    const registro = {
      idTransacao: idUnico,
      placa: dadosAbast.placa,
      veiculo: dadosAbast.veiculo || 'Caminhão Carroceria',
      motorista: dadosAbast.motorista || 'Motorista Operacional',
      posto: dadosAbast.posto || 'Auto Posto Aruana Ltda',
      data: dadosAbast.data || '2026-11-05',
      kmAnterior: kmAnterior,
      kmAtual: kmAtual,
      distanciaRodada: distanciaRodada,
      litros: litros,
      valorTotal: valorTotal,
      consumoMedioKmL: consumoMedioKmL,
      custoPorKm: custoPorKm,
      obraVinculada: dadosAbast.obra || 'Frota Geral'
    };

    window.registrosAbastecimentoFrota.unshift(registro);
    return { sucesso: true, abastecimento: registro };
  };
})();
