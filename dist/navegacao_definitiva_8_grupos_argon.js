// ============================================================================
// SISTEMA MARTINS — NAVEGAÇÃO DEFINITIVA: CABEÇALHO COM ENGRENAGEM (⚙️),
// MENU LATERAL EM SANFONA (8 GRUPOS OFICIAIS) E BARRA INFERIOR DE 6 ATALHOS
// Arquivo: dist/navegacao_definitiva_8_grupos_argon.js
// ============================================================================

(function() {
  'use strict';

  const normalizar = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // 1. OS 8 GRUPOS OFICIAIS DO DOCUMENTO MESTRE (SEÇÃO 4.2)
  window.GRUPOS_SANFONA_OFICIAIS = [
    {
      id: 'grp-1-painel-obras',
      ordem: 1,
      titulo: '📊 PAINEL & OBRAS',
      subtitulo: 'Dashboard, Gestão de Obras e Conferência',
      abertoInicial: true,
      itens: [
        {
          id: 'nav-painel-controle',
          titulo: 'Painel de Controle (Dashboard)',
          icone: '📊',
          badge: 'KPIs',
          badgeCor: 'bg-amber-100 text-amber-900',
          secao: 'painel',
          acao: () => window.navegarParaModuloArgon('painel')
        },
        {
          id: 'nav-gestao-obras',
          titulo: 'Gestão de Obras',
          icone: '🏗️',
          badge: '5 Abas',
          badgeCor: 'bg-blue-100 text-blue-900',
          secao: 'gestao',
          subsecao: 'contrato',
          acao: () => window.navegarParaModuloArgon('gestao', 'contrato')
        },
        {
          id: 'nav-conferencia-divergencias',
          titulo: 'Conferência de Divergências',
          icone: '🔍',
          badge: 'Auditoria',
          badgeCor: 'bg-purple-100 text-purple-900',
          secao: 'conferencia',
          acao: () => window.navegarParaModuloArgon('conferencia')
        }
      ]
    },
    {
      id: 'grp-2-rdo-frequencia',
      ordem: 2,
      titulo: '📋 RDO & FREQUÊNCIA',
      subtitulo: 'Diário de Obra e Apontamento Diário',
      abertoInicial: true,
      itens: [
        {
          id: 'nav-rdo-hoje',
          titulo: 'Registro Diário de Obra (RDO)',
          icone: '📝',
          badge: '4 Blocos',
          badgeCor: 'bg-amber-100 text-amber-950 font-bold',
          secao: 'novo',
          acao: () => window.navegarParaModuloArgon('novo')
        },
        {
          id: 'nav-rdo-historico',
          titulo: 'Histórico de RDOs',
          icone: '📑',
          badge: 'PDF/WhatsApp',
          badgeCor: 'bg-slate-100 text-slate-700',
          secao: 'historico',
          acao: () => window.navegarParaModuloArgon('historico')
        },
        {
          id: 'nav-frequencia-diaria',
          titulo: 'Frequência',
          icone: '⏱️',
          badge: 'Chamada',
          badgeCor: 'bg-indigo-100 text-indigo-900',
          secao: 'colaboradores',
          subsecao: 'ponto',
          acao: () => window.navegarParaModuloArgon('colaboradores', 'ponto')
        }
      ]
    },
    {
      id: 'grp-3-rh',
      ordem: 3,
      titulo: '👷 RECURSOS HUMANOS',
      subtitulo: 'Colaboradores, Vales (40%) e EPIs NR-06',
      abertoInicial: false,
      itens: [
        {
          id: 'nav-rh-colaboradores',
          titulo: 'Colaboradores e Documentos',
          icone: '🪪',
          badge: 'SST / ASO',
          badgeCor: 'bg-sky-100 text-sky-900',
          secao: 'colaboradores',
          subsecao: 'quadro',
          acao: () => window.navegarParaModuloArgon('colaboradores', 'quadro')
        },
        {
          id: 'nav-rh-vales',
          titulo: 'Remuneração, Diárias e Vales',
          icone: '💵',
          badge: 'Teto 40%',
          badgeCor: 'bg-emerald-100 text-emerald-900',
          secao: 'colaboradores',
          subsecao: 'vales',
          acao: () => window.navegarParaModuloArgon('colaboradores', 'vales')
        },
        {
          id: 'nav-rh-epis',
          titulo: 'EPI e Uniformes',
          icone: '🦺',
          badge: 'NR-06',
          badgeCor: 'bg-teal-100 text-teal-900',
          secao: 'colaboradores',
          subsecao: 'uniformes',
          acao: () => window.navegarParaModuloArgon('colaboradores', 'uniformes')
        },
        {
          id: 'nav-rh-relatorios',
          titulo: 'Relatórios de RH e Cesta Básica',
          icone: '🏆',
          badge: 'Extratos',
          badgeCor: 'bg-amber-100 text-amber-900',
          secao: 'colaboradores',
          subsecao: 'relatorios',
          acao: () => window.navegarParaModuloArgon('colaboradores', 'relatorios')
        }
      ]
    },
    {
      id: 'grp-4-financeiro',
      ordem: 4,
      titulo: '💰 FINANCEIRO',
      subtitulo: 'Caixa, Contas Bancárias e Visibilidade',
      abertoInicial: false,
      itens: [
        {
          id: 'nav-fin-fluxo',
          titulo: 'Fluxo de Caixa',
          icone: '📈',
          badge: 'Movimentos',
          badgeCor: 'bg-emerald-100 text-emerald-900',
          secao: 'financeiro',
          subsecao: 'fluxo',
          acao: () => window.navegarParaModuloArgon('financeiro', 'fluxo')
        },
        {
          id: 'nav-fin-pagar',
          titulo: 'Contas a Pagar',
          icone: '💸',
          badge: 'Obrigações',
          badgeCor: 'bg-red-100 text-red-900',
          secao: 'financeiro',
          subsecao: 'pagar',
          acao: () => window.navegarParaModuloArgon('financeiro', 'pagar')
        },
        {
          id: 'nav-fin-receber',
          titulo: 'Contas a Receber',
          icone: '💰',
          badge: 'Medições',
          badgeCor: 'bg-blue-100 text-blue-900',
          secao: 'financeiro',
          subsecao: 'receber',
          acao: () => window.navegarParaModuloArgon('financeiro', 'receber')
        },
        {
          id: 'nav-fin-bancos',
          titulo: 'Contas Bancárias',
          icone: '🏦',
          badge: 'Saldos',
          badgeCor: 'bg-indigo-100 text-indigo-900',
          secao: 'financeiro',
          subsecao: 'bancos',
          acao: () => window.navegarParaModuloArgon('financeiro', 'bancos')
        },
        {
          id: 'nav-fin-gastos-obra',
          titulo: 'Gastos por Obra',
          icone: '🏗️',
          badge: 'Rateio',
          badgeCor: 'bg-amber-100 text-amber-900',
          secao: 'financeiro',
          subsecao: 'gastos-obra',
          acao: () => window.navegarParaModuloArgon('financeiro', 'gastos-obra')
        },
        {
          id: 'nav-fin-conciliacao',
          titulo: 'Conciliação e Relatórios',
          icone: '🔄',
          badge: 'Master / OFX',
          badgeCor: 'bg-purple-100 text-purple-900',
          secao: 'financeiro',
          subsecao: 'conciliacao',
          apenasMaster: true,
          acao: () => window.navegarParaModuloArgon('financeiro', 'conciliacao')
        },
        {
          id: 'nav-fin-permissoes',
          titulo: 'Permissões Financeiras (Visibilidade)',
          icone: '🔐',
          badge: 'Master',
          badgeCor: 'bg-amber-200 text-amber-950 font-black',
          secao: 'financeiro',
          subsecao: 'permissoes',
          apenasMaster: true,
          acao: () => window.navegarParaModuloArgon('financeiro', 'permissoes')
        }
      ]
    },
    {
      id: 'grp-5-suprimentos',
      ordem: 5,
      titulo: '📦 SUPRIMENTOS E ESTOQUE',
      subtitulo: 'Catálogo, 5 Movimentações, NF-e e Frota',
      abertoInicial: false,
      itens: [
        {
          id: 'nav-sup-catalogo',
          titulo: 'Catálogo e Estoque',
          icone: '🏷️',
          badge: 'SKUs/Fator',
          badgeCor: 'bg-emerald-100 text-emerald-900',
          secao: 'suprimentos',
          subsecao: 'estoque',
          acao: () => window.navegarParaModuloArgon('suprimentos', 'estoque')
        },
        {
          id: 'nav-sup-depositos',
          titulo: 'Depósitos e Movimentações',
          icone: '🏢',
          badge: '5 Tipos',
          badgeCor: 'bg-blue-100 text-blue-900',
          secao: 'suprimentos',
          subsecao: 'depositos',
          acao: () => window.navegarParaModuloArgon('suprimentos', 'depositos')
        },
        {
          id: 'nav-sup-compras',
          titulo: 'Compras e Cotações',
          icone: '🛒',
          badge: '5 Estágios/XML',
          badgeCor: 'bg-orange-100 text-orange-900',
          secao: 'suprimentos',
          subsecao: 'pedidos',
          acao: () => window.navegarParaModuloArgon('suprimentos', 'pedidos')
        },
        {
          id: 'nav-sup-frota',
          titulo: 'Frota e Veículos',
          icone: '🚛',
          badge: 'km/L e R$/km',
          badgeCor: 'bg-slate-200 text-slate-900',
          secao: 'suprimentos',
          subsecao: 'frota',
          acao: () => window.navegarParaModuloArgon('suprimentos', 'frota')
        }
      ]
    },
    {
      id: 'grp-6-comercial',
      ordem: 6,
      titulo: '💼 COMERCIAL E VENDAS',
      subtitulo: 'Propostas, Carteira de Clientes e Vendas',
      abertoInicial: false,
      itens: [
        {
          id: 'nav-com-orcamentos',
          titulo: 'Orçamentos e Propostas',
          icone: '📄',
          badge: 'Propostas',
          badgeCor: 'bg-emerald-100 text-emerald-900',
          secao: 'comercial',
          subsecao: 'orcamentos',
          acao: () => window.navegarParaModuloArgon('comercial', 'orcamentos')
        },
        {
          id: 'nav-com-clientes',
          titulo: 'Carteira de Clientes',
          icone: '👥',
          badge: 'CPF/CNPJ',
          badgeCor: 'bg-sky-100 text-sky-900',
          secao: 'comercial',
          subsecao: 'clientes',
          acao: () => window.navegarParaModuloArgon('comercial', 'clientes')
        },
        {
          id: 'nav-com-historico',
          titulo: 'Histórico de Vendas',
          icone: '🤝',
          badge: 'Contratos',
          badgeCor: 'bg-amber-100 text-amber-900',
          secao: 'comercial',
          subsecao: 'historico-vendas',
          acao: () => window.navegarParaModuloArgon('comercial', 'historico-vendas')
        },
        {
          id: 'nav-com-esquadrias-calc',
          titulo: 'Calculadora de Esquadrias (Aços RR)',
          icone: '🚪',
          badge: 'Serralheria',
          badgeCor: 'bg-blue-100 text-blue-900',
          secao: 'comercial',
          subsecao: 'esquadrias',
          acao: () => window.navegarParaModuloArgon('comercial', 'esquadrias')
        }
      ]
    },
    {
      id: 'grp-7-esquadrias-futuro',
      ordem: 7,
      titulo: '🏗️ ESQUADRIAS E SERRALHERIA',
      subtitulo: 'Módulo Industrial em 6 Abas (Prioridade 6)',
      abertoInicial: false,
      itens: [
        {
          id: 'nav-esq-calc-atual',
          titulo: 'Calculadora de Esquadrias Ativa',
          icone: '📐',
          badge: 'Operacional',
          badgeCor: 'bg-emerald-100 text-emerald-900',
          secao: 'comercial',
          subsecao: 'esquadrias',
          acao: () => window.navegarParaModuloArgon('comercial', 'esquadrias')
        },
        {
          id: 'nav-esq-roadmap',
          titulo: 'Plano de Corte & Retalhos (Aguardando Aut.)',
          icone: '🔒',
          badge: 'Prioridade 6',
          badgeCor: 'bg-slate-200 text-slate-600',
          secao: 'esquadrias-info',
          acao: () => {
            if (typeof showToast === 'function') {
              showToast('ℹ️ Especificação de 6 abas pronta e preservada para ativação na Prioridade 6.');
            }
          }
        }
      ]
    },
    {
      id: 'grp-8-relatorios-admin',
      ordem: 8,
      titulo: '📈 CENTRAL DE RELATÓRIOS & ADMIN',
      subtitulo: 'Relatórios PDF/CSV, Portal Fiscal e Auditoria',
      abertoInicial: false,
      itens: [
        {
          id: 'nav-adm-relatorios',
          titulo: 'Central de Relatórios',
          icone: '📊',
          badge: 'PDF / CSV',
          badgeCor: 'bg-indigo-100 text-indigo-900',
          secao: 'relatorios-central',
          acao: () => window.navegarParaModuloArgon('relatorios-central')
        },
        {
          id: 'nav-adm-portal-fiscal',
          titulo: 'Portal Fiscal (Pré-visualização Fiel)',
          icone: '🏛️',
          badge: 'Fiscal/Cliente',
          badgeCor: 'bg-emerald-100 text-emerald-900',
          secao: 'portal',
          acao: () => window.navegarParaModuloArgon('portal')
        },
        {
          id: 'nav-adm-usuarios',
          titulo: 'Administração, Permissões e Auditoria',
          icone: '🛡️',
          badge: 'INSERT-ONLY',
          badgeCor: 'bg-purple-100 text-purple-900',
          secao: 'usuarios',
          apenasMaster: true,
          acao: () => window.navegarParaModuloArgon('usuarios')
        }
      ]
    }
  ];

  const estadoSanfona = {};
  window.GRUPOS_SANFONA_OFICIAIS.forEach(g => {
    estadoSanfona[g.id] = g.abertoInicial;
  });

  // 2. ROTEADOR INTEGRADO ARGON
  window.navegarParaModuloArgon = function(secao, subsecao) {
    window.secaoAtiva = secao;
    window.subsecaoAtiva = subsecao || null;

    if (window.innerWidth < 1024 && typeof window.fecharDrawerMenu === 'function') {
      window.fecharDrawerMenu();
    }

    // Mapeia seções novas ou consolidadas para as views e abas reais
    if (secao === 'painel') {
      if (typeof window.abrirDashboardPrincipalArgon === 'function') {
        window.abrirDashboardPrincipalArgon();
      } else if (typeof window.navegarParaSecao === 'function') {
        window.navegarParaSecao('novo');
      }
    } else if (secao === 'financeiro') {
      if (typeof window.abrirModuloFinanceiro7Abas === 'function') {
        window.abrirModuloFinanceiro7Abas(subsecao || 'fluxo');
      } else if (typeof window.navegarParaSecao === 'function') {
        window.navegarParaSecao('gestao', 'custos');
      }
    } else if (secao === 'relatorios-central') {
      if (typeof window.abrirCentralRelatoriosArgon === 'function') {
        window.abrirCentralRelatoriosArgon();
      } else if (typeof window.navegarParaSecao === 'function') {
        window.navegarParaSecao('colaboradores', 'relatorios');
      }
    } else if (typeof window.navegarParaSecao === 'function') {
      window.navegarParaSecao(secao, subsecao);
    }

    window.renderizarMenuLateralInteligente();
    if (typeof window.atualizarDestaqueBarra6Atalhos === 'function') {
      window.atualizarDestaqueBarra6Atalhos();
    }
  };

  // 3. RENDERIZAÇÃO DO MENU SANFONA DE 8 GRUPOS
  window.renderizarMenuLateralInteligente = function() {
    const container = document.getElementById('drawer-lista-modulos');
    if (!container) return;

    const termo = normalizar(document.getElementById('menu-search-input')?.value);
    const isMaster = (typeof currentLoggedUser !== 'undefined' && currentLoggedUser && currentLoggedUser.perfil === 'Master');

    container.innerHTML = '';

    window.GRUPOS_SANFONA_OFICIAIS.forEach(grupo => {
      const itensVisiveis = grupo.itens.filter(it => {
        if (it.apenasMaster && !isMaster) return false;
        if (!termo) return true;
        return normalizar(it.titulo).includes(termo) ||
               normalizar(it.badge).includes(termo) ||
               normalizar(grupo.titulo).includes(termo);
      });

      if (termo && itensVisiveis.length === 0) return;

      const aberto = termo ? true : !!estadoSanfona[grupo.id];
      const box = document.createElement('div');
      box.className = 'rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden mb-2';

      const hdr = document.createElement('button');
      hdr.type = 'button';
      hdr.className = 'w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-left transition cursor-pointer';
      hdr.onclick = function() {
        estadoSanfona[grupo.id] = !estadoSanfona[grupo.id];
        window.renderizarMenuLateralInteligente();
      };

      hdr.innerHTML = `
        <div class="min-w-0 pr-2">
          <span class="text-[11px] font-black text-slate-900 block truncate">${grupo.titulo}</span>
          <span class="text-[9px] text-slate-500 font-medium block truncate">${grupo.subtitulo}</span>
        </div>
        <div class="flex items-center space-x-1.5 shrink-0">
          <span class="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">${itensVisiveis.length}</span>
          <span class="text-xs text-slate-400 transform transition-transform ${aberto ? 'rotate-180 text-amber-600 font-bold' : ''}">▾</span>
        </div>
      `;
      box.appendChild(hdr);

      if (aberto) {
        const list = document.createElement('div');
        list.className = 'p-1.5 space-y-1 bg-white border-t border-slate-100';

        itensVisiveis.forEach(item => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.id = item.id;

          const ativo = (window.secaoAtiva === item.secao) && (!item.subsecao || !window.subsecaoAtiva || window.subsecaoAtiva === item.subsecao);
          btn.className = `w-full flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
            ativo
              ? 'bg-amber-500/15 border border-amber-500/60 text-amber-950 font-black'
              : 'hover:bg-slate-50 text-slate-700 font-semibold border border-transparent'
          }`;

          btn.onclick = function() {
            item.acao();
          };

          btn.innerHTML = `
            <div class="flex items-center space-x-2 min-w-0">
              <span class="text-sm p-1 rounded-lg ${ativo ? 'bg-amber-400 text-slate-950' : 'bg-slate-100'} shrink-0">${item.icone}</span>
              <span class="text-xs truncate">${item.titulo}</span>
            </div>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1 ${item.badgeCor}">${item.badge}</span>
          `;
          list.appendChild(btn);
        });
        box.appendChild(list);
      }

      container.appendChild(box);
    });
  };

  // 4. ENGRENAGEM DE CONFIGURAÇÕES RÁPIDAS NO CABEÇALHO (SEÇÃO 4.1)
  function instalarMenuEngrenagemHeader() {
    const syncBtn = document.getElementById('btn-sync-nuvem');
    if (!syncBtn || document.getElementById('header-gear-container')) return;

    const gearWrapper = document.createElement('div');
    gearWrapper.id = 'header-gear-container';
    gearWrapper.className = 'relative shrink-0';
    gearWrapper.innerHTML = `
      <button id="btn-header-gear" type="button" onclick="window.toggleDropdownEngrenagemHeader()"
        class="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-amber-500/50 p-2 rounded-xl text-xs font-bold transition flex items-center justify-center shadow-2xs cursor-pointer"
        title="Configurações, Permissões e Backups">
        <span>⚙️</span>
      </button>
      <div id="dropdown-header-gear" class="hidden absolute right-0 mt-1.5 w-64 bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1">
        <div class="px-2.5 py-1 border-b border-slate-800 text-[10px] font-black uppercase text-amber-400">
          Configurações & Segurança
        </div>
        <button type="button" onclick="window.navegarParaModuloArgon('usuarios'); window.toggleDropdownEngrenagemHeader();" class="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-800 text-slate-200 font-semibold flex items-center space-x-2">
          <span>👥</span><span>Usuários e Perfis</span>
        </button>
        <button type="button" onclick="window.navegarParaModuloArgon('financeiro', 'permissoes'); window.toggleDropdownEngrenagemHeader();" class="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-800 text-amber-300 font-bold flex items-center space-x-2">
          <span>🔐</span><span>Permissões Financeiras por Usuário</span>
        </button>
        <button type="button" onclick="document.getElementById('modal-sync-nuvem')?.classList.remove('hidden'); window.toggleDropdownEngrenagemHeader();" class="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-800 text-slate-200 font-semibold flex items-center space-x-2">
          <span>💾</span><span>Dados Locais e Backup (Dry-Run)</span>
        </button>
        <button type="button" onclick="window.navegarParaModuloArgon('cadastros'); window.toggleDropdownEngrenagemHeader();" class="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-800 text-slate-200 font-semibold flex items-center space-x-2">
          <span>🏢</span><span>Parâmetros & Empresas do Grupo</span>
        </button>
        <button type="button" onclick="window.navegarParaModuloArgon('portal'); window.toggleDropdownEngrenagemHeader();" class="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-800 text-emerald-400 font-bold flex items-center space-x-2">
          <span>🏛️</span><span>Pré-visualizar Portal Fiscal</span>
        </button>
      </div>
    `;
    syncBtn.parentNode.insertBefore(gearWrapper, syncBtn.nextSibling);
  }

  window.toggleDropdownEngrenagemHeader = function() {
    const d = document.getElementById('dropdown-header-gear');
    if (d) d.classList.toggle('hidden');
  };

  // 5. PADRONIZAÇÃO DA BARRA INFERIOR COM EXATAMENTE OS 6 ATALHOS APROVADOS (SEÇÃO 4.3)
  // Atalhos: Painel | RDO | Frequência | Vendas | Estoque | Menu
  function padronizarBarraInferior6Atalhos() {
    const bar = document.getElementById('martins-bottom-bar');
    if (!bar) return;

    bar.innerHTML = `
      <div class="max-w-lg mx-auto flex items-center justify-around gap-1">
        <button id="bnav-btn-painel" type="button" onclick="window.navegarParaModuloArgon('painel')"
          class="bnav-6-item flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-slate-400 hover:text-amber-300 font-bold transition cursor-pointer"
          data-secao-alvo="painel" title="Painel de Controle (Dashboard)">
          <span class="text-base leading-none">📊</span>
          <span class="text-[9px] font-bold mt-1">Painel</span>
        </button>

        <button id="bnav-btn-inicio" type="button" onclick="window.navegarParaModuloArgon('novo')"
          class="bnav-6-item flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-amber-400 font-black transition cursor-pointer"
          data-secao-alvo="novo" title="Registro Diário de Obra (RDO)">
          <span class="text-base leading-none">📝</span>
          <span class="text-[9px] font-black mt-1">RDO</span>
        </button>

        <button id="bnav-btn-frequencia" type="button" onclick="window.navegarParaModuloArgon('colaboradores', 'ponto')"
          class="bnav-6-item flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-slate-400 hover:text-amber-300 font-bold transition cursor-pointer"
          data-secao-alvo="colaboradores" title="Frequência Diária">
          <span class="text-base leading-none">⏱️</span>
          <span class="text-[9px] font-bold mt-1">Frequência</span>
        </button>

        <button id="bnav-btn-vendas" type="button" onclick="window.navegarParaModuloArgon('comercial', 'orcamentos')"
          class="bnav-6-item flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-slate-400 hover:text-amber-300 font-bold transition cursor-pointer"
          data-secao-alvo="comercial" title="Comercial e Vendas">
          <span class="text-base leading-none">💼</span>
          <span class="text-[9px] font-bold mt-1">Vendas</span>
        </button>

        <button id="bnav-btn-estoque" type="button" onclick="window.navegarParaModuloArgon('suprimentos', 'estoque')"
          class="bnav-6-item flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-slate-400 hover:text-amber-300 font-bold transition cursor-pointer"
          data-secao-alvo="suprimentos" title="Suprimentos e Estoque">
          <span class="text-base leading-none">📦</span>
          <span class="text-[9px] font-bold mt-1">Estoque</span>
        </button>

        <button id="bnav-btn-menu" type="button" onclick="window.abrirDrawerMenu()"
          class="flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-amber-400 hover:text-amber-300 font-black transition cursor-pointer"
          title="Abrir Menu Completo">
          <span class="text-base leading-none bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-md font-black">☰</span>
          <span class="text-[9px] font-black mt-0.5 text-amber-400">Menu</span>
        </button>
      </div>
    `;
  }

  window.atualizarDestaqueBarra6Atalhos = function() {
    const secao = window.secaoAtiva || 'novo';
    document.querySelectorAll('.bnav-6-item').forEach(btn => {
      const alvo = btn.dataset.secaoAlvo;
      const isAtivo = (alvo === secao) || (secao === 'historico' && alvo === 'novo');
      if (isAtivo) {
        btn.setAttribute('aria-current', 'page');
        btn.className = 'bnav-6-item flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-amber-400 font-black bg-amber-500/15 transition cursor-pointer';
      } else {
        btn.removeAttribute('aria-current');
        btn.className = 'bnav-6-item flex-1 flex flex-col items-center justify-center p-1 rounded-xl text-slate-400 hover:text-amber-300 font-bold transition cursor-pointer';
      }
    });
  };

  function initNavegacao8Grupos() {
    instalarMenuEngrenagemHeader();
    padronizarBarraInferior6Atalhos();
    window.renderizarMenuLateralInteligente();
    window.atualizarDestaqueBarra6Atalhos();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavegacao8Grupos);
  } else {
    initNavegacao8Grupos();
  }
})();
