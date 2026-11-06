// ============================================================================
// SISTEMA MARTINS — BARRA INFERIOR MOBILE & NAVEGAÇÃO DE ATALHOS (INCREMENTAL)
// Arquivo: dist/martins_barra_mobile_incremental.js
// Ambiente: Render / Netlify / Homologação (Branch: melhorias-visuais-gemini-20261106)
// Correção BUG 001 (Final): Sem Duplicação, Proteção Global de Formulários e RBAC
// ============================================================================

(function() {
  'use strict';

  function setupBarraMobileMartins() {
    const bar = document.getElementById('martins-bottom-bar') || 
                document.querySelector('nav[aria-label="Navegação Rápida"]') || 
                document.querySelector('nav[aria-label*="Navegação"]');
    if (!bar) return;

    // 1. Injeção de Estilos Seguros (CSS Mobile, Safe-Area e Teclado Aberto)
    if (!document.getElementById('css-martins-barra-mobile')) {
      const css = document.createElement('style');
      css.id = 'css-martins-barra-mobile';
      css.textContent = `
        @media (max-width: 767px) {
          #martins-bottom-bar {
            padding-bottom: max(6px, env(safe-area-inset-bottom));
          }
          #martins-bottom-bar button {
            min-width: 0;
            touch-action: manipulation;
          }
          #martins-bottom-bar button span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          body {
            padding-bottom: calc(80px + env(safe-area-inset-bottom)) !important;
          }
          body.martins-teclado-aberto #martins-bottom-bar {
            opacity: 0.15 !important;
            pointer-events: none !important;
            transform: translateY(8px);
          }
        }
        #martins-bottom-bar button[aria-current="page"] {
          color: #fbbf24 !important;
          font-weight: 900 !important;
        }
        #martins-bottom-bar button[aria-current="page"] .bnav-icon-box,
        #martins-bottom-bar button[aria-current="page"] svg {
          color: #fbbf24 !important;
          transform: scale(1.08);
          transition: transform 0.2s ease-in-out;
        }
        #martins-bottom-bar button:focus-visible {
          outline: 2px solid #fbbf24;
          outline-offset: 2px;
        }
      `;
      document.head.appendChild(css);
    }

    // 2. Tabela de Metadados Oficiais dos Atalhos
    const ATALHOS_CONFIG = {
      'bnav-btn-painel': {
        rota: 'painel',
        secaoEquiv: ['painel', 'dashboard'],
        modulo: 'painel',
        requerMaster: false
      },
      'bnav-btn-frequencia': {
        rota: 'colaboradores',
        subsecao: 'ponto',
        secaoEquiv: ['colaboradores', 'frequencia', 'ponto'],
        modulo: 'frequencia',
        requerMaster: false
      },
      'bnav-btn-inicio': {
        rota: 'novo',
        secaoEquiv: ['novo', 'rdo'],
        modulo: 'rdo',
        requerMaster: false
      },
      'bnav-btn-rdos': {
        rota: 'historico',
        secaoEquiv: ['historico', 'diarios'],
        modulo: 'rdo_historico',
        requerMaster: false
      },
      'gm-bottom-planejamento': {
        rota: 'planejamento',
        triggerId: 'ma-menu-planejamento',
        fallbackRota: 'colaboradores',
        subsecao: 'planejamento',
        secaoEquiv: ['planejamento', 'colaboradores'],
        modulo: 'planejamento',
        requerMaster: false
      },
      'bnav-btn-planejar': {
        rota: 'planejamento',
        triggerId: 'ma-menu-planejamento',
        fallbackRota: 'colaboradores',
        subsecao: 'planejamento',
        secaoEquiv: ['planejamento', 'colaboradores'],
        modulo: 'planejamento',
        requerMaster: false
      },
      'gm-bottom-conferencia': {
        rota: 'conferencia',
        triggerId: 'ma-menu-conferencia',
        secaoEquiv: ['conferencia'],
        modulo: 'conferencia',
        requerMaster: false
      },
      'bnav-btn-conferir': {
        rota: 'conferencia',
        triggerId: 'ma-menu-conferencia',
        secaoEquiv: ['conferencia'],
        modulo: 'conferencia',
        requerMaster: false
      },
      'bnav-btn-vendas': {
        rota: 'comercial',
        subsecao: 'orcamentos',
        secaoEquiv: ['comercial', 'vendas'],
        modulo: 'comercial',
        requerMaster: false
      },
      'bnav-btn-estoque': {
        rota: 'suprimentos',
        subsecao: 'estoque',
        secaoEquiv: ['suprimentos', 'estoque'],
        modulo: 'suprimentos',
        requerMaster: false
      },
      'bnav-btn-menu': {
        rota: 'menu',
        tipo: 'drawer',
        modulo: null,
        requerMaster: false
      }
    };

    // 3. Verificação Abrangente de Formulários com Alterações Não Salvas
    function verificarAlteracoesNaoSalvas() {
      const secaoAtual = window.secaoAtiva || '';
      if (['novo', 'rdo'].includes(secaoAtual)) {
        const camposTexto = [
          'textarea-equipamentos',
          'textarea-materiais',
          'textarea-ocorrencias',
          'input-novo-item-servico',
          'textarea-obs-internas',
          'obs-internas-eng'
        ];

        let temTextoDigitado = false;
        for (let i = 0; i < camposTexto.length; i++) {
          const el = document.getElementById(camposTexto[i]);
          if (el && el.value && el.value.trim().length > 0) {
            temTextoDigitado = true;
            break;
          }
        }

        const temAtividades = Array.isArray(window.currentRdoAtividades) && window.currentRdoAtividades.length > 0;
        const temFotos = (Array.isArray(window.currentRdoFotos) && window.currentRdoFotos.length > 0) ||
                         (Array.isArray(window.currentFotos) && window.currentFotos.length > 0);
        const temObsTrab = Array.isArray(window.currentObsTrabalhadores) && window.currentObsTrabalhadores.length > 0;

        const formRdo = document.getElementById('form-rdo');
        const isDirty = (formRdo && formRdo.dataset && formRdo.dataset.dirty === 'true') || (window.rdoFormModificado === true);

        if (temTextoDigitado || temAtividades || temFotos || temObsTrab || isDirty) {
          return true;
        }
      }

      if (window.frequenciaModificadaPendente === true) {
        return true;
      }

      return false;
    }

    // 4. Verificação Estrita de Permissões (RBAC)
    function verificarPermissaoAcesso(config) {
      if (!config || !config.modulo) return true;
      const user = (typeof currentLoggedUser !== 'undefined' && currentLoggedUser) ? currentLoggedUser : null;
      if (!user) return true;

      const perfil = user.perfil || '';
      const usuarioNome = (user.usuario || '').toLowerCase();

      // Regra José Henrique: Acesso exclusivo à Calhas e Rufos (emp-2)
      if (usuarioNome === 'josehenrique' || perfil === 'Acesso Restrito') {
        const empAtiva = (typeof window.getEmpresaAtivaId === 'function') ? window.getEmpresaAtivaId() : 'emp-2';
        if (empAtiva !== 'emp-2') {
          alert('Acesso restrito: seu usuário possui autorização exclusiva para a unidade Calhas e Rufos Martins.');
          return false;
        }
      }

      // Regra de módulos exclusivos Master
      if (config.requerMaster && perfil !== 'Master') {
        alert('Acesso negado: este módulo é restrito a administradores Master.');
        return false;
      }

      return true;
    }

    // 5. Roteamento Oficial Idempotente (Executa uma ÚNICA vez por clique)
    let navegacaoEmAndamento = false;

    function executarNavegacaoOficial(btn, config) {
      if (navegacaoEmAndamento) return;
      navegacaoEmAndamento = true;

      setTimeout(() => { navegacaoEmAndamento = false; }, 300);

      // 5.1. Proteção contra perda de dados em formulários
      if (verificarAlteracoesNaoSalvas()) {
        const confirmarSaida = confirm(
          'Atenção: Você possui alterações não salvas no formulário em edição.\n' +
          'Se sair agora, os dados digitados não gravados serão perdidos.\n\n' +
          'Deseja realmente sair desta tela?'
        );
        if (!confirmarSaida) {
          navegacaoEmAndamento = false;
          return;
        }
      }

      // 5.2. Verificação de permissões do usuário
      if (!verificarPermissaoAcesso(config)) {
        navegacaoEmAndamento = false;
        return;
      }

      // 5.3. Fecha o drawer se estiver aberto
      if (typeof window.fecharDrawerMenu === 'function') {
        window.fecharDrawerMenu();
      } else if (typeof window.fecharDrawer === 'function') {
        window.fecharDrawer();
      }

      // 5.4. Ação do botão Menu
      if (config.tipo === 'drawer') {
        if (typeof window.abrirDrawerMenu === 'function') {
          window.abrirDrawerMenu();
        } else if (typeof window.abrirDrawer === 'function') {
          window.abrirDrawer();
        }
        return;
      }

      // 5.5. Prioridade A: Dispara o gatilho nativo oficial se existir (Planejamento e Conferência)
      if (config.triggerId) {
        const triggerEl = document.getElementById(config.triggerId);
        if (triggerEl && typeof triggerEl.onclick === 'function') {
          try {
            triggerEl.onclick();
            window.secaoAtiva = config.rota;
            sincronizarDestaqueAtivo();
            return;
          } catch (e) {
            console.warn('[Barra Mobile] Erro no trigger oficial:', config.triggerId, e);
          }
        }
      }

      // 5.5.1 Prioridade Argon Roteador Oficial Integrado
      if (typeof window.navegarParaModuloArgon === 'function') {
        try {
          window.navegarParaModuloArgon(config.rota, config.subsecao);
          window.secaoAtiva = config.rota;
          navegouComSucesso = true;
        } catch (e) {
          console.warn('[Barra Mobile] Erro ao chamar window.navegarParaModuloArgon:', e);
        }
      }

      // 5.6. Prioridade B: Navegador Oficial via window.navegarPeloDrawer
      let navegouComSucesso = false;
      if (typeof window.navegarPeloDrawer === 'function') {
        try {
          window.navegarPeloDrawer(config.rota);
          if (config.subsecao) {
            aplicarSubsecao(config.rota, config.subsecao);
          }
          window.secaoAtiva = config.rota;
          navegouComSucesso = true;
        } catch (e) {
          console.warn('[Barra Mobile] Erro ao chamar window.navegarPeloDrawer:', e);
        }
      }

      // 5.7. Prioridade C: Navegador Oficial via window.navegarParaSecao
      if (!navegouComSucesso && typeof window.navegarParaSecao === 'function') {
        try {
          window.navegarParaSecao(config.rota, config.subsecao);
          if (config.subsecao) {
            aplicarSubsecao(config.rota, config.subsecao);
          }
          window.secaoAtiva = config.rota;
          navegouComSucesso = true;
        } catch (e) {
          console.warn('[Barra Mobile] Erro ao chamar window.navegarParaSecao:', e);
        }
      }

      // 5.8. Prioridade D: Fallback seguro via clique no link do drawer correspondente
      if (!navegouComSucesso) {
        const linkDrawer = document.querySelector(`.drawer-nav-item[data-nav="${config.rota}"]`) ||
                           document.querySelector(`[data-nav="${config.rota}"]`);
        if (linkDrawer && typeof linkDrawer.click === 'function') {
          linkDrawer.click();
          window.secaoAtiva = config.rota;
          navegouComSucesso = true;
        }
      }

      // Se houver fallback de rota (ex: planejamento -> colaboradores)
      if (!navegouComSucesso && config.fallbackRota && typeof window.navegarPeloDrawer === 'function') {
        window.navegarPeloDrawer(config.fallbackRota);
        if (config.subsecao) aplicarSubsecao(config.fallbackRota, config.subsecao);
        window.secaoAtiva = config.fallbackRota;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      sincronizarDestaqueAtivo();
    }

    function aplicarSubsecao(rota, sub) {
      if (!sub) return;
      if (rota === 'comercial' && typeof window.setSubtabComercial === 'function') window.setSubtabComercial(sub);
      else if (rota === 'suprimentos' && typeof window.setSubtabSuprimentos === 'function') window.setSubtabSuprimentos(sub);
      else if (rota === 'colaboradores' && typeof window.setSubtabColab === 'function') window.setSubtabColab(sub);
      else if (rota === 'gestao' && typeof window.setSubtabGestao === 'function') window.setSubtabGestao(sub);
    }

    // 6. Sincronização do Destaque Ativo (Visual e Acessibilidade)
    function sincronizarDestaqueAtivo() {
      const secaoAtual = window.secaoAtiva || 'novo';
      Object.keys(ATALHOS_CONFIG).forEach(id => {
        const btn = document.getElementById(id);
        if (!btn || !bar.contains(btn)) return;
        const conf = ATALHOS_CONFIG[id];
        if (conf.tipo === 'drawer') return;

        const isAtivo = (conf.secaoEquiv && conf.secaoEquiv.includes(secaoAtual)) || (conf.rota === secaoAtual);
        if (isAtivo) {
          btn.setAttribute('aria-current', 'page');
        } else {
          btn.removeAttribute('aria-current');
        }
      });
    }

    // 7. Event Delegation no Container da Barra (Garante Única Execução e Não Sobrescreve Handlers)
    if (bar.dataset.martinsBnavV4 !== '1') {
      bar.dataset.martinsBnavV4 = '1';

      bar.addEventListener('click', function(e) {
        const btn = e.target.closest('button');
        if (!btn || !bar.contains(btn)) return;

        const config = ATALHOS_CONFIG[btn.id];
        if (!config) return;

        // Se o botão for Planejar ou Conferir (que não possuem onclick inline no Render) ou se a rota nativa falhar:
        if (btn.id === 'gm-bottom-planejamento' || btn.id === 'gm-bottom-conferencia' || !btn.onclick) {
          e.preventDefault();
          executarNavegacaoOficial(btn, config);
        } else {
          // O botão já possui seu próprio onclick inline:
          // Apenas valida proteção de formulário e sincroniza após a execução nativa
          if (verificarAlteracoesNaoSalvas()) {
            const sair = confirm(
              'Atenção: Você possui alterações não salvas no formulário em edição.\n' +
              'Se sair agora, os dados não gravados serão perdidos.\n\n' +
              'Deseja realmente sair desta tela?'
            );
            if (!sair) {
              e.preventDefault();
              e.stopImmediatePropagation();
              return;
            }
          }
          queueMicrotask(sincronizarDestaqueAtivo);
        }
      });
    }

    // 8. Ocultação/Ajuste no Celular com Teclado Aberto
    document.addEventListener('focusin', function(e) {
      if (window.innerWidth < 768 && e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        document.body.classList.add('martins-teclado-aberto');
      }
    });

    document.addEventListener('focusout', function(e) {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        setTimeout(function() {
          const ativo = document.activeElement;
          if (!ativo || !['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName)) {
            document.body.classList.remove('martins-teclado-aberto');
          }
        }, 150);
      }
    });

    window.addEventListener('hashchange', sincronizarDestaqueAtivo);
    sincronizarDestaqueAtivo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBarraMobileMartins);
  } else {
    setupBarraMobileMartins();
  }
})();
