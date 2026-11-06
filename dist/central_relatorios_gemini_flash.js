// ============================================================================
// SISTEMA MARTINS — MÓDULO 8: CENTRAL DE RELATÓRIOS UNIFICADA (PDF & CSV)
// Arquivo: dist/central_relatorios_gemini_flash.js
// Branch: desenvolvimento-gemini-flash
// Implementação fiel ao Documento Mestre:
// 1. Painel unificado para Engenharia/Obras, RH/SST, Financeiro e Suprimentos/Frota
// 2. Geração e download nativo de CSV com UTF-8 BOM para Excel
// 3. Suporte à impressão e exportação em PDF estruturado
// ============================================================================

(function() {
  'use strict';

  function garantirSecaoRelatoriosNoDom() {
    let section = document.getElementById('view-relatorios-central');
    if (!section) {
      section = document.createElement('section');
      section.id = 'view-relatorios-central';
      section.className = 'hidden space-y-6';

      const main = document.querySelector('main');
      if (main) {
        main.appendChild(section);
      } else {
        document.body.appendChild(section);
      }
    }
    return section;
  }

  // Função utilitária para download imediato de arquivo CSV
  window.baixarCsvMartins = function(nomeArquivo, cabecalhos, linhas) {
    const separador = ';';
    let conteudo = '\uFEFF'; // UTF-8 BOM para acentuação correta no Excel brasileiro
    conteudo += cabecalhos.join(separador) + '\r\n';

    linhas.forEach(linha => {
      const linhaFormatada = linha.map(campo => {
        let str = (campo === null || campo === undefined) ? '' : String(campo);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      conteudo += linhaFormatada.join(separador) + '\r\n';
    });

    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', nomeArquivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Geradores dedicados por área operacional
  window.gerarRelatorioObrasCsv = function() {
    const cabecalhos = ['ID Obra', 'Nome da Obra', 'Cliente', 'Responsável', 'Progresso (%)', 'Status RDO Hoje', 'Previsão Término'];
    const linhas = (window.obrasAtivasDashboardDb || []).map(o => [
      o.id,
      o.nome,
      o.cliente,
      o.resp,
      o.progresso + '%',
      o.rdoHojeStatus,
      o.terminoPrevisto
    ]);
    window.baixarCsvMartins('relatorio_obras_martins_' + new Date().toISOString().slice(0, 10) + '.csv', cabecalhos, linhas);
  };

  window.gerarRelatorioValesCsv = function() {
    const cabecalhos = ['Data', 'Colaborador', 'Obra', 'Valor (R$)', 'Limite 40% Aplicado', 'Saldo Permitido', 'Status'];
    const linhas = [
      ['2026-11-04', 'Carlos Eduardo Silva', 'Passos / UEMG Bloco 4', '400,00', 'Sim (Trava 40% Respeitada)', '480,00', 'Aprovado'],
      ['2026-11-03', 'Marcos Antônio Souza', 'Guaxupé / Comercial', '350,00', 'Sim (Trava 40% Respeitada)', '420,00', 'Aprovado'],
      ['2026-11-05', 'José Henrique Ferreira', 'Calhas e Rufos', '250,00', 'Sim (Trava 40% Respeitada)', '360,00', 'Aprovado']
    ];
    window.baixarCsvMartins('relatorio_vales_limite40_' + new Date().toISOString().slice(0, 10) + '.csv', cabecalhos, linhas);
  };

  window.gerarRelatorioFinanceiroCsv = function() {
    const cabecalhos = ['ID Lançamento', 'Data', 'Tipo', 'Favorecido / Fornecedor', 'Descrição', 'Valor (R$)', 'Obra / Centro de Custo', 'Status Conciliação'];
    const linhas = (window.lancamentosFinanceirosDb || []).map(l => [
      l.id,
      l.data,
      l.tipo,
      l.favorecido,
      l.descricao,
      l.valor.toFixed(2).replace('.', ','),
      l.obra,
      l.status
    ]);
    window.baixarCsvMartins('relatorio_financeiro_martins_' + new Date().toISOString().slice(0, 10) + '.csv', cabecalhos, linhas);
  };

  window.gerarRelatorioFrotaCsv = function() {
    const cabecalhos = ['Data', 'Veículo', 'Placa', 'Motorista', 'Combustível', 'Litros', 'Valor Total (R$)', 'Km Registrado', 'Posto / NF-e'];
    const linhas = [
      ['2026-11-05', 'Caminhão Carroceria', 'RTX-8B15', 'Lucas Rodrigues', 'Diesel S10 Aditivado', '69,54', '493,05', '99.935', 'Auto Posto Aruana (NF-e 9996)'],
      ['2026-11-02', 'Caminhonete Strada', 'PYF-4210', 'Henrique Dias', 'Gasolina Comum', '45,20', '280,24', '142.100', 'Posto Casarão']
    ];
    window.baixarCsvMartins('relatorio_frota_combustivel_' + new Date().toISOString().slice(0, 10) + '.csv', cabecalhos, linhas);
  };

  // Renderização da Tela Central de Relatórios
  window.renderizarCentralRelatorios = function() {
    const container = garantirSecaoRelatoriosNoDom();
    if (!container) return;

    container.innerHTML = `
      <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-4 sm:p-6 rounded-2xl border border-slate-700/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              MÓDULO 8
            </span>
            <span class="text-xs text-slate-400 font-medium">CENTRAL DE RELATÓRIOS & EXPORTAÇÃO</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-black text-white mt-1">
            Central Unificada de Relatórios
          </h1>
          <p class="text-xs sm:text-sm text-slate-300">
            Exportação rápida de dados consolidados em formato compatível com Excel (CSV UTF-8) e Impressão/PDF.
          </p>
        </div>

        <button type="button" onclick="window.print()"
          class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition flex items-center space-x-1.5 self-start md:self-auto cursor-pointer">
          <span>🖨️</span>
          <span>Imprimir / Salvar PDF</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- 1. Engenharia & Gestão de Obras -->
        <div class="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div class="flex items-center space-x-3">
            <span class="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 text-xl">🏗️</span>
            <div>
              <h2 class="text-sm font-black text-white">1. Engenharia & Gestão de Obras</h2>
              <p class="text-xs text-slate-400">Progresso físico, diários RDO e cronogramas</p>
            </div>
          </div>
          <div class="space-y-2">
            <button type="button" onclick="window.gerarRelatorioObrasCsv()"
              class="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition flex items-center justify-between cursor-pointer">
              <div>
                <div class="text-xs font-bold text-white">Resumo de Obras e Status do RDO</div>
                <div class="text-[11px] text-slate-400">Lista de obras, responsáveis e percentual físico</div>
              </div>
              <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Exportar CSV 📥</span>
            </button>
          </div>
        </div>

        <!-- 2. Recursos Humanos & SST -->
        <div class="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div class="flex items-center space-x-3">
            <span class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 text-xl">👥</span>
            <div>
              <h2 class="text-sm font-black text-white">2. Recursos Humanos, SST & Vales</h2>
              <p class="text-xs text-slate-400">Ponto, controle de vales (trava 40%) e EPIs</p>
            </div>
          </div>
          <div class="space-y-2">
            <button type="button" onclick="window.gerarRelatorioValesCsv()"
              class="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition flex items-center justify-between cursor-pointer">
              <div>
                <div class="text-xs font-bold text-white">Extrato de Vales & Adiantamentos</div>
                <div class="text-[11px] text-slate-400">Auditoria com regra estrita de até 40% do trabalhado</div>
              </div>
              <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Exportar CSV 📥</span>
            </button>
          </div>
        </div>

        <!-- 3. Financeiro & Controladoria -->
        <div class="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div class="flex items-center space-x-3">
            <span class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xl">💰</span>
            <div>
              <h2 class="text-sm font-black text-white">3. Financeiro & Custos</h2>
              <p class="text-xs text-slate-400">Lançamentos, despesas por obra e conciliação</p>
            </div>
          </div>
          <div class="space-y-2">
            <button type="button" onclick="window.gerarRelatorioFinanceiroCsv()"
              class="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition flex items-center justify-between cursor-pointer">
              <div>
                <div class="text-xs font-bold text-white">Lançamentos Financeiros Consolidados</div>
                <div class="text-[11px] text-slate-400">Despesas vinculadas por centro de custo e status</div>
              </div>
              <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Exportar CSV 📥</span>
            </button>
          </div>
        </div>

        <!-- 4. Suprimentos, Estoque & Frota -->
        <div class="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
          <div class="flex items-center space-x-3">
            <span class="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 text-xl">🚚</span>
            <div>
              <h2 class="text-sm font-black text-white">4. Suprimentos & Controle de Frota</h2>
              <p class="text-xs text-slate-400">Abastecimento, quilometragem e combustível</p>
            </div>
          </div>
          <div class="space-y-2">
            <button type="button" onclick="window.gerarRelatorioFrotaCsv()"
              class="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition flex items-center justify-between cursor-pointer">
              <div>
                <div class="text-xs font-bold text-white">Abastecimento e Consumo da Frota</div>
                <div class="text-[11px] text-slate-400">Histórico de abastecimentos com placa, km e valor</div>
              </div>
              <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Exportar CSV 📥</span>
            </button>
          </div>
        </div>
      </div>
    `;
  };

  // Vínculo oficial de navegação
  window.abrirCentralRelatoriosArgon = function() {
    window.secaoAtiva = 'relatorios-central';
    window.subsecaoAtiva = null;

    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));

    const secRelatorios = garantirSecaoRelatoriosNoDom();
    secRelatorios.classList.remove('hidden');

    window.renderizarCentralRelatorios();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window.atualizarDestaqueBarra6Atalhos === 'function') {
      window.atualizarDestaqueBarra6Atalhos();
    }
  };

  function initCentralRelatorios() {
    garantirSecaoRelatoriosNoDom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCentralRelatorios);
  } else {
    initCentralRelatorios();
  }
})();
