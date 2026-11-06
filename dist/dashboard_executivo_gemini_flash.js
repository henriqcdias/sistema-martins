// ============================================================================
// SISTEMA MARTINS — MÓDULO 1: PAINEL DE CONTROLE (DASHBOARD PRINCIPAL)
// Arquivo: dist/dashboard_executivo_gemini_flash.js
// Branch: desenvolvimento-gemini-flash
// Implementação fiel ao Documento Mestre — 4 Zonas Executivas:
// 1. 4 KPIs Executivos (Obras/Prazos, Efetivo/Frequência, Finanças RBAC, Compras)
// 2. Ações Rápidas de 1 Toque (Touch Targets >= 48px, Mobile-First)
// 3. Quadro Resumo de Obras (Progresso %, Status RDO do dia, Link Direto)
// 4. Alertas de Conformidade (RDOs Rascunho, ASO/NRs 30d, Estoque Mínimo, Sem Obra)
// ============================================================================

(function() {
  'use strict';

  // Dados operacionais de referência integrados ao ecossistema Martins
  window.obrasAtivasDashboardDb = [
    {
      id: 'obra-passos-uemg',
      nome: 'Passos / MG — UEMG Bloco 4 (Refeitório & Salas)',
      cliente: 'UEMG / Governo de Minas',
      empresaId: 'emp-1',
      progresso: 72,
      rdoHojeStatus: 'concluido', // 'concluido' | 'rascunho' | 'pendente'
      rdoHojeNum: 'RDO-2026-084',
      prazoStatus: 'No Prazo',
      terminoPrevisto: '2026-12-15',
      resp: 'Eng. Henrique Dias'
    },
    {
      id: 'obra-guaxupe-comercial',
      nome: 'Guaxupé / MG — Reforma Comercial & Fachada',
      cliente: 'Grupo São Benedito',
      empresaId: 'emp-1',
      progresso: 45,
      rdoHojeStatus: 'rascunho',
      rdoHojeNum: 'RDO-2026-085-RASC',
      prazoStatus: 'Atenção (3d atraso)',
      terminoPrevisto: '2026-11-30',
      resp: 'Robson Rodrigues'
    },
    {
      id: 'obra-pratapolis-galpao',
      nome: 'Pratápolis / MG — Galpão Industrial Pré-Moldado',
      cliente: 'Agropecuária Sul Mineira',
      empresaId: 'emp-2',
      progresso: 88,
      rdoHojeStatus: 'pendente',
      rdoHojeNum: null,
      prazoStatus: 'No Prazo',
      terminoPrevisto: '2026-11-20',
      resp: 'Camila Martins'
    },
    {
      id: 'obra-franca-residencial',
      nome: 'Franca / SP — Residência Alto Padrão (Centro)',
      cliente: 'Condomínio Quinta dos Lagos',
      empresaId: 'emp-1',
      progresso: 30,
      rdoHojeStatus: 'concluido',
      rdoHojeNum: 'RDO-2026-086',
      prazoStatus: 'No Prazo',
      terminoPrevisto: '2027-03-10',
      resp: 'Eng. Henrique Dias'
    }
  ];

  window.alertasConformidadeDashboardDb = [
    {
      tipo: 'rdo',
      severidade: 'alta',
      titulo: 'RDO em Rascunho',
      descricao: 'Obra Guaxupé — Diário de hoje ainda não foi enviado/assinado.',
      acaoTexto: 'Completar RDO',
      acao: () => window.navegarParaModuloArgon && window.navegarParaModuloArgon('novo')
    },
    {
      tipo: 'sst',
      severidade: 'media',
      titulo: 'ASO / NR Periódico Vencendo',
      descricao: 'Marcos Souza (NR-35) vence em 14 dias; José da Silva (ASO) vence em 21 dias.',
      acaoTexto: 'Ver Quadro RH',
      acao: () => window.navegarParaModuloArgon && window.navegarParaModuloArgon('colaboradores', 'quadro')
    },
    {
      tipo: 'estoque',
      severidade: 'media',
      titulo: 'Estoque Abaixo do Mínimo',
      descricao: 'Perfil Alumínio Branco SU-001 (Passos) e Luva PVC 3/4 atingiram nível crítico.',
      acaoTexto: 'Ver Estoque',
      acao: () => window.navegarParaModuloArgon && window.navegarParaModuloArgon('suprimentos', 'estoque')
    },
    {
      tipo: 'financeiro',
      severidade: 'baixa',
      titulo: 'Lançamentos sem Obra Vinculada',
      descricao: 'Existem 2 lançamentos recentes sem centro de custo ou obra cadastrada.',
      acaoTexto: 'Conciliar',
      acao: () => window.navegarParaModuloArgon && window.navegarParaModuloArgon('financeiro', 'gastos-obra')
    }
  ];

  // Injeção/Garantia do elemento <section id="view-painel">
  function garantirSecaoPainelNoDom() {
    let section = document.getElementById('view-painel');
    if (!section) {
      section = document.createElement('section');
      section.id = 'view-painel';
      section.className = 'hidden space-y-6';

      const main = document.querySelector('main');
      if (main) {
        // Insere como primeiro filho para ser a tela de entrada oficial
        main.insertBefore(section, main.firstChild);
      } else {
        document.body.appendChild(section);
      }
    }
    return section;
  }

  // Renderização Completa do Dashboard Executivo
  window.renderizarDashboardExecutivo = function() {
    const container = garantirSecaoPainelNoDom();
    if (!container) return;

    const user = (typeof currentLoggedUser !== 'undefined' && currentLoggedUser) ? currentLoggedUser : null;
    const isMaster = (user && user.perfil === 'Master');
    const nomeUsuario = user ? (user.nome || user.usuario || 'Operador') : 'Operador';

    // 1. ZONA 1: 4 KPIs Executivos
    const totalObras = window.obrasAtivasDashboardDb.length;
    const obrasNoPrazo = window.obrasAtivasDashboardDb.filter(o => o.prazoStatus.includes('No Prazo')).length;
    const taxaPrazo = Math.round((obrasNoPrazo / totalObras) * 100);

    const efetivoTotal = 18;
    const efetivoPresente = 16;
    const efetivoPercent = Math.round((efetivoPresente / efetivoTotal) * 100);

    const comprasPendentesQtd = 3;

    container.innerHTML = `
      <!-- Cabeçalho de Boas-Vindas do Painel -->
      <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-4 sm:p-6 rounded-2xl border border-slate-700/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
              PAINEL EXECUTIVO
            </span>
            <span class="text-xs text-slate-400 font-medium">MARTINS RDO MASTER</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-black text-white mt-1">
            Olá, <span class="text-amber-400">${nomeUsuario}</span> 👋
          </h1>
          <p class="text-xs sm:text-sm text-slate-300">
            Visão unificada das obras, equipes em campo, finanças e conformidade operacional.
          </p>
        </div>

        <div class="flex items-center gap-2 self-start md:self-auto">
          <button type="button" onclick="window.renderizarDashboardExecutivo()" 
            class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer">
            <span>🔄</span>
            <span>Atualizar</span>
          </button>
          <button type="button" onclick="window.navegarParaModuloArgon && window.navegarParaModuloArgon('relatorios-central')"
            class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center space-x-1.5 shadow-md cursor-pointer">
            <span>📑</span>
            <span>Relatórios</span>
          </button>
        </div>
      </div>

      <!-- ZONA 1: 4 KPIs EXECUTIVOS OFICIAIS -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <!-- KPI 1: Obras Ativas e Prazos -->
        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Obras Ativas</span>
            <span class="p-2 rounded-xl bg-amber-500/10 text-amber-400 text-base">🏗️</span>
          </div>
          <div class="mt-2">
            <div class="text-2xl sm:text-3xl font-black text-white">${totalObras} <span class="text-xs text-slate-400 font-semibold">obras</span></div>
            <div class="text-[11px] text-emerald-400 font-bold mt-1 flex items-center space-x-1">
              <span>●</span>
              <span>${taxaPrazo}% no cronograma</span>
            </div>
          </div>
        </div>

        <!-- KPI 2: Efetivo e Frequência do Dia -->
        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Efetivo de Hoje</span>
            <span class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 text-base">👥</span>
          </div>
          <div class="mt-2">
            <div class="text-2xl sm:text-3xl font-black text-white">${efetivoPresente} <span class="text-xs text-slate-400 font-semibold">/ ${efetivoTotal}</span></div>
            <div class="text-[11px] text-indigo-300 font-bold mt-1">
              ${efetivoPercent}% presença (2 faltas)
            </div>
          </div>
        </div>

        <!-- KPI 3: Resumo Financeiro (Saldos e Vencimentos — Restrito Master) -->
        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Finanças (Hoje)</span>
            <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-base">💰</span>
          </div>
          <div class="mt-2">
            ${isMaster ? `
              <div class="text-lg sm:text-xl font-black text-emerald-400">R$ 142.850<span class="text-xs text-slate-400 font-semibold">,00</span></div>
              <div class="text-[10px] text-amber-300 font-semibold mt-1">
                A Pagar Hoje: R$ 9.884,25
              </div>
            ` : `
              <div class="text-xs font-bold text-slate-400 py-1">Acesso Restrito</div>
              <div class="text-[10px] text-slate-500 font-medium">Exclusivo Masters</div>
            `}
          </div>
        </div>

        <!-- KPI 4: Suprimentos / Compras Pendentes -->
        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Suprimentos</span>
            <span class="p-2 rounded-xl bg-orange-500/10 text-orange-400 text-base">📦</span>
          </div>
          <div class="mt-2">
            <div class="text-2xl sm:text-3xl font-black text-orange-400">${comprasPendentesQtd} <span class="text-xs text-slate-400 font-semibold">pedidos</span></div>
            <div class="text-[11px] text-rose-400 font-bold mt-1">
              2 itens em estoque crítico
            </div>
          </div>
        </div>
      </div>

      <!-- ZONA 2: AÇÕES RÁPIDAS DE 1 TOQUE (TOUCH TARGETS >= 48px) -->
      <div class="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-lg">
        <h2 class="text-sm font-black text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
          <span>⚡</span>
          <span>Ações Rápidas de 1 Toque</span>
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <!-- Ação 1: + Preencher RDO -->
          <button type="button" onclick="window.navegarParaModuloArgon('novo')"
            class="min-h-[52px] p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex flex-col items-center justify-center text-center shadow-md transition transform active:scale-95 cursor-pointer">
            <span class="text-lg">📝</span>
            <span class="mt-1 leading-tight">+ Preencher RDO</span>
          </button>

          <!-- Ação 2: Apontar Frequência -->
          <button type="button" onclick="window.navegarParaModuloArgon('colaboradores', 'ponto')"
            class="min-h-[52px] p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex flex-col items-center justify-center text-center shadow transition transform active:scale-95 cursor-pointer">
            <span class="text-lg">⏱️</span>
            <span class="mt-1 leading-tight">Apontar Ponto</span>
          </button>

          <!-- Ação 3: Lançar Despesa / Vale -->
          <button type="button" onclick="window.abrirModalLancadorRapido ? window.abrirModalLancadorRapido() : window.navegarParaModuloArgon('financeiro', 'fluxo')"
            class="min-h-[52px] p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex flex-col items-center justify-center text-center shadow transition transform active:scale-95 cursor-pointer">
            <span class="text-lg">💸</span>
            <span class="mt-1 leading-tight">Lançar Despesa</span>
          </button>

          <!-- Ação 4: Solicitar Material -->
          <button type="button" onclick="window.navegarParaModuloArgon('suprimentos', 'pedidos')"
            class="min-h-[52px] p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-300 border border-orange-500/30 font-bold text-xs flex flex-col items-center justify-center text-center shadow transition transform active:scale-95 cursor-pointer">
            <span class="text-lg">📦</span>
            <span class="mt-1 leading-tight">Pedir Material</span>
          </button>

          <!-- Ação 5: Novo Orçamento -->
          <button type="button" onclick="window.navegarParaModuloArgon('comercial', 'orcamentos')"
            class="min-h-[52px] p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 font-bold text-xs flex flex-col items-center justify-center text-center shadow transition transform active:scale-95 col-span-2 sm:col-span-1 cursor-pointer">
            <span class="text-lg">📐</span>
            <span class="mt-1 leading-tight">Novo Orçamento</span>
          </button>
        </div>
      </div>

      <!-- ZONA 3 E ZONA 4 EM DUAS COLUNAS RESPONSIVAS -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- ZONA 3: QUADRO RESUMO DE OBRAS (2 Colunas no Desktop) -->
        <div class="lg:col-span-2 bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <span>🏗️</span>
                <span>Quadro Resumo de Obras</span>
              </h2>
              <p class="text-xs text-slate-400">Progresso físico e status do Diário de Obra de hoje</p>
            </div>
            <button type="button" onclick="window.navegarParaModuloArgon('gestao', 'contrato')"
              class="text-xs font-bold text-amber-400 hover:text-amber-300 transition flex items-center space-x-1 cursor-pointer">
              <span>Gestão de Obras</span>
              <span>→</span>
            </button>
          </div>

          <div class="space-y-3">
            ${window.obrasAtivasDashboardDb.map(obra => {
              let badgeRdo = '';
              if (obra.rdoHojeStatus === 'concluido') {
                badgeRdo = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">RDO Concluído ✓</span>';
              } else if (obra.rdoHojeStatus === 'rascunho') {
                badgeRdo = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">RDO Rascunho ⏳</span>';
              } else {
                badgeRdo = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">RDO Pendente ⚠️</span>';
              }

              return `
                <div class="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:border-amber-500/40 transition">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div class="text-xs font-black text-white">${obra.nome}</div>
                      <div class="text-[11px] text-slate-400">Cliente: ${obra.cliente} • Resp: ${obra.resp}</div>
                    </div>
                    <div class="flex items-center space-x-2 self-start sm:self-auto">
                      ${badgeRdo}
                    </div>
                  </div>

                  <!-- Barra de Progresso Físico -->
                  <div class="mt-3">
                    <div class="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                      <span>Progresso da Obra</span>
                      <span class="text-amber-400">${obra.progresso}%</span>
                    </div>
                    <div class="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div class="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500" style="width: ${obra.progresso}%"></div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- ZONA 4: ALERTAS DE CONFORMIDADE E AÇÕES IMEDIATAS (1 Coluna no Desktop) -->
        <div class="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-black text-rose-300 uppercase tracking-wider flex items-center space-x-2">
                <span>🛡️</span>
                <span>Conformidade & Alertas</span>
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                ${window.alertasConformidadeDashboardDb.length} ativos
              </span>
            </div>

            <div class="space-y-3">
              ${window.alertasConformidadeDashboardDb.map((alerta, idx) => {
                let icone = '⚠️';
                let borda = 'border-amber-500/30';
                if (alerta.severidade === 'alta') {
                  icone = '🚨';
                  borda = 'border-rose-500/40 bg-rose-950/20';
                } else if (alerta.severidade === 'baixa') {
                  icone = 'ℹ️';
                  borda = 'border-blue-500/30';
                }

                return `
                  <div class="p-3 rounded-xl bg-slate-800/80 border ${borda} flex flex-col justify-between space-y-2">
                    <div class="flex items-start space-x-2">
                      <span class="text-base">${icone}</span>
                      <div class="flex-1">
                        <div class="text-xs font-bold text-slate-200">${alerta.titulo}</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">${alerta.descricao}</div>
                      </div>
                    </div>
                    <div class="self-end">
                      <button type="button" onclick="window.alertasConformidadeDashboardDb[${idx}].acao()"
                        class="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition underline cursor-pointer">
                        ${alerta.acaoTexto} →
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            Todos os apontamentos são integrados à nuvem segura e protegidos por RLS.
          </div>
        </div>
      </div>
    `;
  };

  // Vínculo oficial com a máquina de navegação
  window.abrirDashboardPrincipalArgon = function() {
    window.secaoAtiva = 'painel';
    window.subsecaoAtiva = null;

    // Oculta todas as outras seções filhas de main
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));

    const secPainel = garantirSecaoPainelNoDom();
    secPainel.classList.remove('hidden');

    window.renderizarDashboardExecutivo();

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window.atualizarDestaqueBarra6Atalhos === 'function') {
      window.atualizarDestaqueBarra6Atalhos();
    }
  };

  // Inicialização inteligente após o carregamento da página
  function initDashboardGeminiFlash() {
    garantirSecaoPainelNoDom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboardGeminiFlash);
  } else {
    initDashboardGeminiFlash();
  }
})();
