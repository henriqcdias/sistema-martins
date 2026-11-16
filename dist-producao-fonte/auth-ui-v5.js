(() => {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const tipoQuery = url.searchParams.get('type');
  const tipoFragmento = fragment.get('type');
  const marcador = url.searchParams.get('recuperar') === '1';
  const tipos = [tipoQuery, tipoFragmento].filter(Boolean);
  const fluxo = (marcador || tipos.includes('recovery')) && tipos.every(tipo => tipo === 'recovery');
  const camposAuth = ['access_token','refresh_token','token_hash','code','type','recuperar',
    'error','error_code','error_description','expires_at','expires_in','token_type'];
  const retorno = fluxo ? {
    token: fragment.get('access_token'),
    hash: url.searchParams.get('token_hash') || fragment.get('token_hash'),
    erro: fragment.get('error_code') || url.searchParams.get('error_code') ||
      fragment.get('error') || url.searchParams.get('error'),
    code: url.searchParams.get('code') || fragment.get('code')
  } : null;
  if (marcador || camposAuth.some(campo => campo !== 'type' &&
      (url.searchParams.has(campo) || fragment.has(campo)))) {
    for (const key of camposAuth) url.searchParams.delete(key);
    url.hash = '';
    history.replaceState(null, '', url.pathname + url.search);
  }

  // A seleção usa apenas empresas retornadas pela consulta de vínculos da sessão.
  window.renderizarEmpresaSessaoQaWork = () => {
    document.getElementById('empresa-sessao-qa')?.remove();
    const ctx = window.obterContextoSegurancaAutenticadoWork?.();
    const logout = document.getElementById('btn-logout-header');
    if (!ctx || !logout) return;
    const painel = document.createElement('label');
    painel.id = 'empresa-sessao-qa';
    painel.className = 'flex flex-col text-xs text-slate-300 min-w-0';
    painel.textContent = 'Empresa';
    const select = document.createElement('select');
    select.className = 'max-w-[9rem] rounded bg-slate-900 text-white p-1';
    select.setAttribute('aria-label', 'Empresa de operação');
    select.add(new Option('Selecione a empresa', ''));
    select.options[0].disabled = true;
    for (const vinculo of ctx.vinculos) {
      const nome = vinculo.nomeEmpresa || window.MARTINS_MAPA_IDS_FREQUENCIA?.[vinculo.empresa_id]?.nome ||
        ('Empresa ' + vinculo.empresa_id.slice(0, 8));
      select.add(new Option(nome + (vinculo.papel === 'administrador' ? ' · Master' : ''), vinculo.empresa_id));
    }
    select.value = window.empresaFrequenciaWork || '';
    select.onchange = () => {
      window.selecionarEmpresaFrequenciaWork(select.value);
      location.reload();
    };
    painel.append(select);
    logout.before(painel);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const login = document.getElementById('form-login-gate');
    const solicitar = document.getElementById('btn-recuperar-senha-gate');
    if (!login || !solicitar) return;
    const msg = document.createElement('p');
    msg.className = 'mb-2 text-sm';
    msg.setAttribute('role','status');
    login.before(msg);
    const informar = texto => { msg.textContent = texto; };
    let cooldown = 0;
    solicitar.addEventListener('click', async event => {
      event.preventDefault();event.stopImmediatePropagation();
      if (Date.now() < cooldown) {
        informar('Aguarde antes de solicitar outro link de recuperação.');
        return;
      }
      solicitar.disabled = true;
      try {
        await window.solicitarRecuperacaoQaWork(document.getElementById('gate-usuario-input').value);
        cooldown = Date.now() + 60000;
        informar('Se o e-mail estiver cadastrado, o Supabase enviará o link de recuperação.');
      } catch (error) {
        if (error.code === '429' || String(error.code).includes('rate_limit') || /rate limit/i.test(error.message)) {
          cooldown = Date.now() + 60000;
          informar('Limite de e-mails do Supabase atingido. Aguarde a janela de envio ou use um link de recuperação ainda válido.');
        } else if (['CONFIGURACAO','CREDENCIAIS'].includes(error.code)) informar(error.message);
        else informar('Não foi possível solicitar a recuperação. Confira a conexão e tente novamente.');
      } finally { solicitar.disabled = false; }
    });

    const unlock = document.createElement('button');
    unlock.type = 'button';
    unlock.className = 'fixed bottom-20 right-3 z-50 rounded bg-slate-900 text-white px-3 py-2';
    unlock.textContent = 'Desbloquear edição';
    unlock.hidden = true;
    document.body.append(unlock);
    unlock.onclick = () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'p-5 rounded';
      dialog.innerHTML = '<form><label>Confirme sua senha <input type="password" autocomplete="current-password" required></label>' +
        '<button type="submit">Desbloquear</button> <button type="button">Cancelar</button><p role="status"></p></form>';
      document.body.append(dialog);
      dialog.addEventListener('close', () => dialog.remove(), {once:true});
      dialog.querySelector('button[type=button]').onclick = () => dialog.close();
      dialog.querySelector('form').onsubmit = async event => {
        event.preventDefault();
        const field = dialog.querySelector('input');
        const submit = dialog.querySelector('button[type=submit]');
        submit.disabled = true;
        try {
          await window.desbloquearRascunhosQaWork(field.value);
          unlock.hidden = true;
          dialog.close();
        } catch (_) { dialog.querySelector('[role=status]').textContent = 'Não foi possível desbloquear. Confira sua senha e sua sessão.'; }
        finally { field.value = ''; submit.disabled = false; }
      };
      dialog.showModal();
    };
    document.getElementById('btn-logout-header')?.addEventListener('click', () => { unlock.hidden = true; document.getElementById('empresa-sessao-qa')?.remove(); });
    if (!retorno) {
      login.inert = true;
      try {
        const res = await window.restaurarSessaoQaWork();
        if (res?.sucesso) {
          window.exibirSessaoQaWork();
          unlock.hidden = false;
        } else if (res) informar('Sessão indisponível. Entre novamente. ' + res.erro);
      } finally { login.inert = false; }
      return;
    }

    login.hidden = true;
    informar('Redefina a senha do Supabase de produção e entre novamente.');
    const form = document.createElement('form');
    form.className = 'space-y-3';
    form.innerHTML = '<h2 class="font-bold">Cadastrar nova senha</h2>' +
      '<label>Nova senha <input class="w-full border rounded p-2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label>Confirme a nova senha <input class="w-full border rounded p-2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<button type="submit" class="border rounded p-2">Salvar nova senha</button> ' +
      '<button type="button" class="border rounded p-2">Voltar ao login</button>';
    login.before(form);
    const [senha, confirmar] = form.querySelectorAll('input');
    const salvar = form.querySelector('[type=submit]');
    const voltar = () => { form.remove(); login.hidden = false; retorno.token = retorno.hash = null; };
    form.querySelector('[type=button]').onclick = voltar;
    if (retorno.erro || (!retorno.token && !retorno.hash)) {
      salvar.disabled = true;
      informar(retorno.code ? 'Este link usa troca de código. Solicite outro link pela tela de login de produção.' :
        'Link inválido ou expirado. Solicite outro link pela tela de login.');
      return;
    }
    form.onsubmit = async event => {
      event.preventDefault();
      if (salvar.disabled) return;
      if (senha.value !== confirmar.value) { informar('As senhas precisam coincidir.'); return; }
      salvar.disabled = true;
      try {
        retorno.token = await window.verificarRecuperacaoQaWork(retorno);
        retorno.hash = null;
        await window.redefinirSenhaQaWork(retorno.token, senha.value);
        voltar();
        informar('Senha atualizada. Entre com a nova senha.');
      } catch (error) {
        informar(error.code === 'CONFIGURACAO' ? 'Configure a chave pública de produção acima e tente salvar novamente nesta aba.' :
          'A redefinição não foi concluída. Confira os requisitos de senha ou solicite um novo link se este tiver expirado.');
      } finally { senha.value = confirmar.value = ''; salvar.disabled = false; }
    };
  });
})();
