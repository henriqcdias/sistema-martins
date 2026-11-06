// ============================================================================
// SISTEMA MARTINS — RECIBOS MULTI-ITENS DE UNIFORMES E EPIS (NR-06)
// Arquivo: dist/recibo_uniformes_multi_itens_ui.js
// ============================================================================

(function() {
  'use strict';

  window.itensReciboEntregaAtual = [];

  window.adicionarItemAoReciboProgramatico = function(dadosItem, estoqueAtual) {
    const estoque = Array.isArray(estoqueAtual)
      ? estoqueAtual
      : ((typeof getEstoqueUniformesDb === 'function') ? getEstoqueUniformesDb() : []);

    const prod = estoque.find(x => x.id === dadosItem.itemId);
    if (!prod) {
      return { adicionado: false, erro: 'Produto não encontrado no almoxarifado.' };
    }

    const qtd = parseInt(dadosItem.qtd || 1, 10);
    if (isNaN(qtd) || qtd <= 0) {
      return { adicionado: false, erro: 'A quantidade deve ser maior que zero.' };
    }

    const jaAdicionado = window.itensReciboEntregaAtual
      .filter(x => x.itemId === dadosItem.itemId)
      .reduce((acc, x) => acc + x.qtd, 0);

    if ((jaAdicionado + qtd) > prod.saldo) {
      return {
        adicionado: false,
        erro: `Saldo insuficiente para ${prod.item}. Disponível: ${prod.saldo} un (já na lista: ${jaAdicionado}).`
      };
    }

    const novoItem = {
      itemId: prod.id,
      item: prod.item,
      categoria: prod.categoria || 'EPI / Uniforme',
      tamanho: dadosItem.tamanho || prod.tamanho || 'Padrão',
      qtd: qtd,
      ca: dadosItem.ca || prod.ca || (prod.categoria === 'Calçado' ? 'C.A. 43.120' : 'C.A. 38.450')
    };

    window.itensReciboEntregaAtual.push(novoItem);
    return { adicionado: true, item: novoItem, totalNaCesta: window.itensReciboEntregaAtual.length };
  };

  window.processarBaixaAtomicaRecibo = function(itensCesta, estoqueAtual) {
    if (!Array.isArray(itensCesta) || itensCesta.length === 0) {
      return { sucesso: false, erro: 'Adicione pelo menos um item ao recibo.' };
    }

    for (let i = 0; i < itensCesta.length; i++) {
      const it = itensCesta[i];
      const prod = estoqueAtual.find(x => x.id === it.itemId);
      if (!prod || prod.saldo < it.qtd) {
        return {
          sucesso: false,
          erro: `Baixa abortada: saldo insuficiente para ${it.item}. Nenhuma peça foi debitada.`
        };
      }
    }

    itensCesta.forEach(it => {
      const prod = estoqueAtual.find(x => x.id === it.itemId);
      prod.saldo -= it.qtd;
    });

    return {
      sucesso: true,
      reciboNum: 'REC-2026-' + String(Date.now()).slice(-5),
      totalPecasEntregues: itensCesta.reduce((acc, x) => acc + x.qtd, 0)
    };
  };
})();
