// Motor Auth v5 reaproveitado do fonte V10 integrado; adaptação de contexto para produção.
(()=>{'use strict';const SCHEMA_CONTRATO_WORK='public';let contextoOperacional=null;let geracaoAuth=0;
  let contexto = null;
  let sessao = null;
  let timerRenovacao = null;
  let renovacao = null;
  const MARGEM_RENOVACAO_MS = 120000; // renova antes de o access token expirar
  const MARGEM_RPC_MS = 30000;
  const FALHAS_TRANSITORIAS = ['QA_REDE', '429', 'over_request_rate_limit', 'CONTEXTO_INDISPONIVEL'];
  const documentos = new Map();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const dataValida = data => typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    Number.isFinite(Date.parse(data)) && new Date(data).toISOString().slice(0, 10) === data;
  const falhar = (message, code) => { throw Object.assign(new Error(message), { code }); };

  // O conteúdo só é aberto depois de autenticação e com a senha usada para cifrá-lo.
  const codificador = new TextEncoder();
  const decodificador = new TextDecoder();
  const prefixoRascunho = 'martins.freq.recovery.v1:';
  function chaveLocal(ativa, empresa, data) {
    return prefixoRascunho + [ativa.config.url, ativa.uid, empresa, data].join('|');
  }
  async function chaveCriptografica(senha, config, uid) {
    const material = await crypto.subtle.importKey('raw', codificador.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({
      name: 'PBKDF2', salt: codificador.encode(prefixoRascunho + config.url + '|' + uid),
      iterations: 600000, hash: 'SHA-256'
    }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function lerRecuperacao(ativa, empresa, data) {
    const key = chaveLocal(ativa, empresa, data);
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    if (!ativa.chaveRascunho) falhar('Desbloqueie a edição para recuperar o rascunho existente.', 'RASCUNHO_BLOQUEADO');
    try {
      const { iv, cifrado } = JSON.parse(raw);
      const bytes = await crypto.subtle.decrypt({
        name: 'AES-GCM', iv: Uint8Array.from(iv), additionalData: codificador.encode(key)
      }, ativa.chaveRascunho, Uint8Array.from(cifrado));
      return JSON.parse(decodificador.decode(bytes));
    } catch (_) {
      falhar('Rascunho protegido indisponível. A senha pode ter mudado ou o conteúdo pode estar corrompido.', 'RASCUNHO_INDISPONIVEL');
    }
  }
  async function gravarRecuperacao(ativa, empresa, data, valor) {
    const key = chaveLocal(ativa, empresa, data);
    if (!ativa.chaveRascunho) falhar('Confirme sua senha em Desbloquear edição para acessar rascunhos e gravar.', 'RASCUNHO_BLOQUEADO');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const bytes = await crypto.subtle.encrypt({
      name: 'AES-GCM', iv, additionalData: codificador.encode(key)
    }, ativa.chaveRascunho, codificador.encode(JSON.stringify(valor)));
    if (sessao !== ativa) falhar('Sessão alterada.', '42501');
    localStorage.setItem(key, JSON.stringify({ iv: [...iv], cifrado: [...new Uint8Array(bytes)] }));
  }
  // Uma aba por documento durante a atualização do rascunho e da operação.
  function serializarRecuperacao(ativa, empresa, data, executar) {
    const locks = globalThis.navigator?.locks;
    if (!locks) falhar('Este navegador não oferece bloqueio seguro entre abas. Use um navegador compatível.', 'NAVEGADOR_INCOMPATIVEL');
    return locks.request(chaveLocal(ativa, empresa, data), executar);
  }

  function gravacaoHabilitadaWork() {
    return (window.MARTINS_SUPABASE_ENV_CONFIG || {}).VITE_MARTINS_GRAVACAO === 'HABILITADA';
  }
  window.gravacaoHabilitadaWork = gravacaoHabilitadaWork;

  function configuracaoWork() {
    const env = window.MARTINS_SUPABASE_ENV_CONFIG || {};
    const cfg = {ambienteAtivo:env.VITE_MARTINS_ENV,supabaseUrl:env.VITE_SUPABASE_PROD_URL,credenciaisValidas:env.VITE_MARTINS_ENV==='PRODUCAO'};
    const key = env.VITE_SUPABASE_PROD_ANON_KEY;
    const url = cfg?.supabaseUrl;
    let chavePublica = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '');
    if (!chavePublica) {
      try {
        const payload = key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
        chavePublica = JSON.parse(atob(payload)).role === 'anon';
      } catch (_) {}
    }
    if (!chavePublica || !cfg?.credenciaisValidas || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || '') || !key) {
      falhar('A chave pública do Supabase de produção ainda não foi configurada na publicação.', 'CONFIGURACAO');
    }
    if (url !== 'https://kkjwmnxgcbonbwavaaya.supabase.co') falhar('Projeto de produção divergente.', 'CONFIGURACAO');
    return { url, key };
  }

  async function requisicaoWork(config, path, { token, body, schema = SCHEMA_CONTRATO_WORK, method = body ? 'POST' : 'GET' } = {}) {
    const leitura = schema === 'public' && method === 'POST' && [
      '/rest/v1/rpc/martins_producao_contexto',
      '/rest/v1/rpc/martins_producao_catalogos',
      '/rest/v1/rpc/martins_producao_consultar',
      '/rest/v1/rpc/martins_producao_despesas_totais',
      '/rest/v1/rpc/martins_producao_auditoria',
      '/rest/v1/rpc/martins_producao_estoque_saldos',
      '/rest/v1/rpc/martins_producao_obra_materiais',
      '/rest/v1/rpc/martins_producao_usuarios_listar',
      '/rest/v1/rpc/martins_producao_receber_totais',
      '/rest/v1/rpc/martins_producao_obra_gastos',
      '/rest/v1/rpc/martins_producao_financeiro_relatorios',
      '/rest/v1/rpc/martins_producao_nomes'
    ].includes(path);
    // Gravação só quando o build a habilita explicitamente (homologação); a produção permanece somente leitura.
    const escrita = gravacaoHabilitadaWork() && schema === 'public' && method === 'POST' && [
      '/rest/v1/rpc/martins_producao_salvar',
      '/rest/v1/rpc/martins_producao_salvar_lote',
      '/rest/v1/rpc/martins_producao_despesa_estado',
      '/rest/v1/rpc/martins_producao_estoque_mover',
      '/rest/v1/rpc/martins_producao_obra_consumir',
      '/rest/v1/rpc/martins_producao_obra_devolver',
      '/rest/v1/rpc/martins_producao_compras_estado',
      '/rest/v1/rpc/martins_producao_compras_receber',
      '/rest/v1/rpc/martins_producao_req_estado',
      '/rest/v1/rpc/martins_producao_req_entregar',
      '/rest/v1/rpc/martins_producao_permissoes_definir',
      '/rest/v1/rpc/martins_producao_usuario_situacao',
      '/rest/v1/rpc/martins_producao_usuario_vincular',
      '/rest/v1/rpc/martins_producao_receber_baixar',
      '/rest/v1/rpc/martins_producao_receber_estado',
      '/rest/v1/rpc/martins_producao_receber_estornar',
      '/rest/v1/rpc/martins_producao_compras_devolver',
      '/rest/v1/rpc/martins_producao_backup_exportar',
      '/rest/v1/rpc/martins_producao_backup_importar',
      '/rest/v1/rpc/martins_producao_orcamento_estado',
      '/rest/v1/rpc/martins_producao_orcamento_converter',
      '/rest/v1/rpc/martins_producao_rdo_estado',
      '/rest/v1/rpc/martins_producao_extrato_importar',
      '/rest/v1/rpc/martins_producao_extrato_conciliar',
      '/rest/v1/rpc/martins_producao_extrato_desconciliar'
    ].includes(path);
    const sessaoPermitida = (method === 'POST' && [
      '/auth/v1/token?grant_type=password',
      '/auth/v1/token?grant_type=refresh_token',
      '/auth/v1/logout?scope=local'
    ].includes(path)) || (method === 'GET' && path === '/auth/v1/user');
    if (!leitura && !escrita && !sessaoPermitida) falhar('Operação indisponível na prévia somente leitura.', 'PREVIA_SOMENTE_LEITURA');
    const headers = { apikey: config.key, Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (path.startsWith('/rest/')) {
      headers['Accept-Profile'] = schema;
      if (body) headers['Content-Profile'] = schema;
    }
    if (body) headers['Content-Type'] = 'application/json';
    let resposta;
    try {
      resposta = await fetch(config.url + path, {
        method, headers, body: body && JSON.stringify(body),
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(12000)
      });
    } catch (erro) {
      falhar(erro.name === 'TimeoutError' ? 'O Supabase de produção demorou a responder. Tente novamente.' :
        'Não foi possível alcançar o Supabase de produção. Confira a conexão.', 'QA_REDE');
    }
    const texto = await resposta.text();
    let dados = null;
    if (texto) { try { dados = JSON.parse(texto); } catch (_) {} }
    if (!resposta.ok && dados?.code === 'PGRST106' && path.startsWith('/rest/') && schema === SCHEMA_CONTRATO_WORK) {
      falhar('A API do Supabase de produção não expõe o schema public. O contrato de produção está indisponível.', 'PGRST106');
    }
    if (!resposta.ok && path === '/auth/v1/token?grant_type=password') {
      const codigo = dados?.error_code || dados?.code;
      if (codigo === 'email_not_confirmed') {
        falhar('O e-mail da conta ainda não foi confirmado no Supabase de produção.', codigo);
      }
      if (codigo === 'invalid_credentials') {
        falhar('O Supabase Auth de produção recusou a combinação de e-mail e senha.', codigo);
      }
    }
    if (!resposta.ok) falhar(dados?.message || dados?.msg || 'Requisição Supabase recusada.', dados?.error_code || dados?.code || String(resposta.status));
    return dados;
  }

  function limparSessaoWork() {
    geracaoAuth++;
    if (timerRenovacao && typeof clearTimeout === 'function') clearTimeout(timerRenovacao);
    timerRenovacao = null;
    contexto = null;
    sessao = null;
    window.empresaFrequenciaWork = null;
    contextoOperacional = null; window.MartinsProducaoOnSession?.(null);
    if (typeof document !== 'undefined') document.getElementById?.('barra-contexto-global-empresa-obra-fase26')?.replaceChildren();
    if (typeof document !== 'undefined') document.querySelectorAll('[data-frequencia-work], [data-quadro-rh-work]').forEach(el => el.remove());
    documentos.clear();
    window.estadoFrequenciaEmEdicao = {};
    window.currentLoggedUser = null;
    sessionStorage.removeItem('cm_active_user');
    sessionStorage.removeItem(chaveSessaoQa);
  }

  async function vinculosWork(ativa) {
    let result;
    try {
      result = await requisicaoWork(ativa.config, '/rest/v1/rpc/martins_producao_contexto',
        { token: ativa.token, body: {}, schema: 'public' });
    } catch (erro) {
      if (erro.code === '42501') {
        falhar('Login aceito pelo Supabase Auth. O contexto empresarial recusou o acesso.', 'CONTEXTO_NEGADO');
      }
      if (['QA_REDE', '429', 'over_request_rate_limit'].includes(erro.code)) throw erro;
      if (['PGRST202', 'PGRST106', '404', '42883'].includes(erro.code)) {
        falhar('Login aceito pelo Supabase Auth. A função martins_producao_contexto não existe ou o schema public não está exposto neste projeto Supabase.', 'CONTEXTO_CONTRATO_AUSENTE');
      }
      falhar('Login aceito pelo Supabase Auth. Não foi possível carregar o contexto empresarial.', 'CONTEXTO_INDISPONIVEL');
    }
    if (result?.usuario_id !== ativa.uid || !Array.isArray(result.empresas) || result.empresas.some(e=>!UUID.test(e.id)||!['master','administrador','operacional'].includes(e.papel)||!e.permissoes) || new Set(result.empresas.map(e=>e.id)).size!==result.empresas.length) {
      falhar('Contexto empresarial inválido.', 'VINCULOS_INVALIDOS');
    }
    ativa.nome=result.nome;
    return result.empresas.map(e=>({empresa_id:e.id,usuario_id:ativa.uid,ativo:true,papel:e.papel==='master'?'administrador':'leitor',papelServidor:e.papel,nomeEmpresa:e.nome,permissoes:e.permissoes}));
  }

  window.obterContextoSegurancaAutenticadoWork = () =>
    contexto && contexto.expiraEm > Date.now() ? contexto : null;

  window.verificarAcessoEmpresaAutenticadoWork = function (empresaId) {
    const ctx = window.obterContextoSegurancaAutenticadoWork();
    return { permitido: UUID.test(empresaId || '') && !!ctx?.empresas.includes(empresaId), empresaId };
  };

  window.verificarPermissaoMasterAutenticadaWork = function (usuario) {
    const ctx = window.obterContextoSegurancaAutenticadoWork();
    if (!ctx || (usuario && usuario.uid !== ctx.uid && usuario.id !== ctx.uid)) return false;
    const empresa = window.empresaFrequenciaWork || (ctx.empresas.length === 1 ? ctx.empresas[0] : null);
    return ctx.vinculos.some(v => v.empresa_id === empresa && v.papel === 'administrador');
  };
  window.verificarSeUsuarioEhMaster = window.verificarPermissaoMasterAutenticadaWork;

  window.filtrarRegistrosPorEmpresaAutenticadaWork = function (registros, campo = 'empresaId') {
    return (Array.isArray(registros) ? registros : []).filter(item =>
      window.verificarAcessoEmpresaAutenticadoWork(item?.[campo] || item?.empresa_id).permitido);
  };

  const chaveSessaoQa = 'martins.prod.auth.v1';

  async function estabelecerSessaoWork(res, config, senha, esperada=geracaoAuth) {
    if(esperada!==geracaoAuth)falhar("Sessão alterada.","42501");
    if (!UUID.test(res.user?.id || '') || !res.access_token || !res.refresh_token || !(res.expires_in > 0)) {
      falhar('Sessão Supabase inválida.', 'SESSAO');
    }
    const ativa = { uid: res.user.id, token: res.access_token, config };
    const rows = await vinculosWork(ativa);
    if(esperada!==geracaoAuth)falhar("Sessão alterada.","42501");
    if (!rows.length) falhar('Login aceito pelo Supabase Auth, mas a conta não tem vínculo ativo em produção.', 'SEM_VINCULO');
    if (senha) ativa.chaveRascunho = await chaveCriptografica(senha, config, ativa.uid);
    if(esperada!==geracaoAuth)falhar("Sessão alterada.","42501");
    contexto = Object.freeze({
      id: ativa.uid, uid: ativa.uid, usuario: res.user.email, nome: ativa.nome||res.user.email,
      email: res.user.email, perfil: 'Operacional',
      empresas: Object.freeze(rows.map(r => r.empresa_id)),
      vinculos: Object.freeze(rows.map(r => Object.freeze(r))),
      autenticadoViaSupabaseAuth: true, expiraEm: Date.now() + res.expires_in * 1000
    });
    sessionStorage.setItem(chaveSessaoQa, res.refresh_token);
    sessao = ativa;
    agendarRenovacaoWork();
    const ultima = sessionStorage.getItem('martins.prod.empresa');
    window.empresaFrequenciaWork = contexto.empresas.includes(ultima) ? ultima :
      (contexto.empresas.length === 1 ? contexto.empresas[0] : null);
    window.currentLoggedUser = contexto;
    try {
      await window.MartinsProducaoOnSession?.(contexto);
      if(esperada!==geracaoAuth)falhar('Sessão alterada.','42501');
      if (typeof document !== 'undefined' && document.querySelector?.('main')) {
        window.renderizarBarraContextoGlobalEmpresaObraFase26?.();
      }
    } catch(error) {
      if(esperada!==geracaoAuth)throw error;
      // A identidade e os vínculos já foram validados. A apresentação é recuperável.
      const status=typeof document!=='undefined'&&document.getElementById?.('producao-status');
      if(status)status.textContent='Sessão autenticada. Não foi possível atualizar a tela. Use Atualizar dados.';
    }
    return { sucesso: true, usuario: contexto, empresasAutorizadas: contexto.empresas };
  }

  // Renovação silenciosa do access token (somente o refresh token da própria sessão v5).
  // Mantém todas as verificações: mesmo UID, vínculos revalidados no servidor e descarte por geração.
  function agendarRenovacaoWork(espera) {
    if (typeof setTimeout !== 'function') return;
    if (timerRenovacao && typeof clearTimeout === 'function') clearTimeout(timerRenovacao);
    timerRenovacao = null;
    if (!contexto) return;
    const ms = espera ?? Math.max(5000, contexto.expiraEm - Date.now() - MARGEM_RENOVACAO_MS);
    timerRenovacao = setTimeout(() => { window.renovarSessaoWork().catch(() => {}); }, Math.min(ms, 2147483647));
  }

  window.renovarSessaoWork = function () {
    if (renovacao) return renovacao;
    const ativa = sessao, esperada = geracaoAuth;
    if (!ativa || !contexto) return Promise.resolve(false);
    const promessa = (async () => {
      try {
        const token = sessionStorage.getItem(chaveSessaoQa);
        if (!token) falhar('Sessão expirada. Entre novamente.', '42501');
        const res = await requisicaoWork(ativa.config, '/auth/v1/token?grant_type=refresh_token', {
          body: { refresh_token: token }
        });
        if (esperada !== geracaoAuth || sessao !== ativa) falhar('Sessão alterada.', '42501');
        if (res?.user?.id !== ativa.uid || !res.access_token || !res.refresh_token || !(res.expires_in > 0)) {
          falhar('Sessão Supabase inválida.', 'SESSAO');
        }
        sessionStorage.setItem(chaveSessaoQa, res.refresh_token);
        const provisoria = { uid: ativa.uid, token: res.access_token, config: ativa.config };
        const rows = await vinculosWork(provisoria);
        if (esperada !== geracaoAuth || sessao !== ativa) falhar('Sessão alterada.', '42501');
        if (!rows.length) falhar('A conta não tem mais vínculo ativo em produção.', 'SEM_VINCULO');
        const empresaAtual = window.empresaFrequenciaWork;
        if (empresaAtual && !rows.some(r => r.empresa_id === empresaAtual)) {
          falhar('A empresa selecionada não está mais autorizada.', '42501');
        }
        ativa.token = res.access_token;
        ativa.nome = provisoria.nome || ativa.nome;
        contexto = Object.freeze({
          ...contexto, nome: ativa.nome || contexto.nome,
          empresas: Object.freeze(rows.map(r => r.empresa_id)),
          vinculos: Object.freeze(rows.map(r => Object.freeze(r))),
          expiraEm: Date.now() + res.expires_in * 1000
        });
        agendarRenovacaoWork();
        return true;
      } catch (erro) {
        if (esperada === geracaoAuth && sessao === ativa) {
          if (FALHAS_TRANSITORIAS.includes(erro.code)) agendarRenovacaoWork(30000);
          else limparSessaoWork();
        }
        throw erro;
      }
    })();
    renovacao = promessa;
    const liberar = () => { if (renovacao === promessa) renovacao = null; };
    promessa.then(liberar, liberar);
    return promessa;
  };

  window.autenticarUsuarioSistema = window.autenticarUsuarioSupabaseWork = async function (email, senha) {
    limparSessaoWork();
    const esperada=geracaoAuth;
    try {
      const config = configuracaoWork();
      if (!String(email).includes('@') || !senha) falhar('Informe e-mail e senha do Supabase Auth.', 'CREDENCIAIS');
      const res = await requisicaoWork(config, '/auth/v1/token?grant_type=password', {
        body: { email: String(email).trim(), password: senha }
      });
      return await estabelecerSessaoWork(res, config, senha, esperada);
    } catch (error) {
      return { sucesso: false, erro: error.message, codigo: error.code };
    }
  };

  window.restaurarSessaoQaWork = async function () {
    const esperada=geracaoAuth;
    const token = sessionStorage.getItem(chaveSessaoQa);
    if (!token) return null;
    try {
      const config = configuracaoWork();
      const res = await requisicaoWork(config, '/auth/v1/token?grant_type=refresh_token', {
        body: { refresh_token: token }
      });
      if(esperada!==geracaoAuth)falhar('Sessão alterada.','42501');
      if (res?.refresh_token) sessionStorage.setItem(chaveSessaoQa, res.refresh_token);
      return await estabelecerSessaoWork(res, config, undefined, esperada);
    } catch (error) {
      if (!['QA_REDE','QA_VINCULOS_API','PGRST106','429','over_request_rate_limit','CONTEXTO_INDISPONIVEL'].includes(error.code)) limparSessaoWork();
      return { sucesso: false, erro: error.message, codigo: error.code };
    }
  };

  window.desbloquearRascunhosQaWork = async function (senha) {
    const ativa = sessao;
    if (!ativa || !contexto) falhar('Entre novamente para editar.', 'SESSAO');
    const res = await requisicaoWork(ativa.config, '/auth/v1/token?grant_type=password', {
      body: { email: contexto.email, password: senha }
    });
    if (sessao !== ativa || res.user?.id !== ativa.uid) falhar('Identidade da sessão alterada.', '42501');
    return estabelecerSessaoWork(res, ativa.config, senha);
  };

  window.solicitarRecuperacaoQaWork = function (email) {
    if (!String(email).includes('@')) falhar('Informe seu e-mail do Supabase de produção.', 'CREDENCIAIS');
    return requisicaoWork(configuracaoWork(), '/auth/v1/recover?redirect_to=' +
      encodeURIComponent(location.origin + '/?recuperar=1'), { body: { email: email.trim() } });
  };

  window.verificarRecuperacaoQaWork = async function (retorno) {
    const config = configuracaoWork();
    let token = retorno.token;
    if (retorno.hash) {
      const res = await requisicaoWork(config, '/auth/v1/verify', {
        body: { type: 'recovery', token_hash: retorno.hash }
      });
      token = res.access_token;
    }
    if (!token) falhar('Link inválido ou expirado.', 'RECUPERACAO');
    const user = await requisicaoWork(config, '/auth/v1/user', { token });
    if (!UUID.test(user.id || '')) falhar('Sessão de recuperação inválida.', 'RECUPERACAO');
    return token;
  };

  window.redefinirSenhaQaWork = async function (token, password) {
    const config = configuracaoWork();
    await requisicaoWork(config, '/auth/v1/user', { token, method:'PUT', body:{ password } });
    limparSessaoWork();
    // Revoga a sessão de recuperação no Auth. A atualização da senha já foi confirmada.
    try {
      await requisicaoWork(config, '/auth/v1/logout?scope=local', { token, body:{} });
    } catch (_) {}
  };

  window.encerrarSessaoSupabaseWork = async function () {
    const anterior = sessao;
    limparSessaoWork();
    try {
      if (anterior) await requisicaoWork(anterior.config, '/auth/v1/logout?scope=local', {
        token: anterior.token, body: {}
      });
    } finally {
      window.encerrarSessaoSistema?.('LOGOUT_SUPABASE_AUTH');
    }
  };


  // Usa exclusivamente o transporte e a sessão da autenticação v5 acima.
  // Adaptador para chamadas legadas. Sem senha (ex.: inicializarIntegracaoDefinitivaSupabaseV16
  // "autentica sessão padrão" na carga da página), NUNCA inicia login: iniciar login limpa a
  // sessão v5 em curso, o que derrubava a sessão restaurada no F5 e causava "Sessão alterada".
  window.autenticarUsuarioSupabaseAuth = credentials => {
    const senha = credentials?.senha || credentials?.password;
    if (!senha) {
      const atual = window.obterContextoSegurancaAutenticadoWork();
      return Promise.resolve(atual
        ? { sucesso: true, usuario: atual, reutilizada: true }
        : { sucesso: false, codigo: 'CREDENCIAIS', erro: 'Informe e-mail e senha do Supabase Auth.' });
    }
    return window.autenticarUsuarioSupabaseWork(credentials.email || credentials.login || credentials.usuario, senha);
  };
  window.selecionarEmpresaFrequenciaWork = empresa => {
    if (!contexto?.empresas.includes(empresa)) falhar('Empresa não autorizada.','42501');
    window.empresaFrequenciaWork=empresa;sessionStorage.setItem('martins.prod.empresa',empresa);
    window.MartinsProducaoOnEmpresa?.(empresa);
  };
  async function rpcProducao(nome,args){
    if(sessao&&contexto&&contexto.expiraEm-Date.now()<MARGEM_RPC_MS)await window.renovarSessaoWork();
    const ativa=sessao;
    if(!ativa||!window.obterContextoSegurancaAutenticadoWork())falhar('Sessão expirada. Entre novamente.','42501');
    const resultado=await requisicaoWork(ativa.config,'/rest/v1/rpc/'+nome,{token:ativa.token,body:args,schema:'public'});
    if(sessao!==ativa)falhar('Sessão alterada; resposta descartada.','42501');
    return resultado;
  }
  if(typeof document!=='undefined'&&typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&sessao&&contexto&&contexto.expiraEm-Date.now()<MARGEM_RENOVACAO_MS)window.renovarSessaoWork().catch(()=>{});
  });
  window.MartinsProducaoRpc=Object.freeze({
    contexto:()=>rpcProducao('martins_producao_contexto',{}),
    consultar:args=>rpcProducao('martins_producao_consultar',args),
    salvar:args=>rpcProducao('martins_producao_salvar',args),
    catalogos:e=>rpcProducao('martins_producao_catalogos',{e}),
    lote:args=>rpcProducao('martins_producao_salvar_lote',args),
    obraConsumir:args=>rpcProducao('martins_producao_obra_consumir',args),
    obraDevolver:args=>rpcProducao('martins_producao_obra_devolver',args),
    obraMateriais:args=>rpcProducao('martins_producao_obra_materiais',args),
    comprasEstado:args=>rpcProducao('martins_producao_compras_estado',args),
    comprasReceber:args=>rpcProducao('martins_producao_compras_receber',args),
    reqEstado:args=>rpcProducao('martins_producao_req_estado',args),
    reqEntregar:args=>rpcProducao('martins_producao_req_entregar',args),
    orcamentoEstado:args=>rpcProducao('martins_producao_orcamento_estado',args),
    orcamentoConverter:args=>rpcProducao('martins_producao_orcamento_converter',args),
    extratoImportar:args=>rpcProducao('martins_producao_extrato_importar',args),
    extratoConciliar:args=>rpcProducao('martins_producao_extrato_conciliar',args),
    extratoDesconciliar:args=>rpcProducao('martins_producao_extrato_desconciliar',args),
    backupExportar:e=>rpcProducao('martins_producao_backup_exportar',{e}),
    backupImportar:args=>rpcProducao('martins_producao_backup_importar',args),
    comprasDevolver:args=>rpcProducao('martins_producao_compras_devolver',args),
    obraGastos:args=>rpcProducao('martins_producao_obra_gastos',args),
    financeiroRelatorios:args=>rpcProducao('martins_producao_financeiro_relatorios',args),
    nomes:args=>rpcProducao('martins_producao_nomes',args),
    rdoEstado:args=>rpcProducao('martins_producao_rdo_estado',args),
    receberTotais:e=>rpcProducao('martins_producao_receber_totais',{e}),
    receberBaixar:args=>rpcProducao('martins_producao_receber_baixar',args),
    receberEstado:args=>rpcProducao('martins_producao_receber_estado',args),
    receberEstornar:args=>rpcProducao('martins_producao_receber_estornar',args),
    usuariosListar:e=>rpcProducao('martins_producao_usuarios_listar',{e}),
    permissoesDefinir:args=>rpcProducao('martins_producao_permissoes_definir',args),
    usuarioSituacao:args=>rpcProducao('martins_producao_usuario_situacao',args),
    usuarioVincular:args=>rpcProducao('martins_producao_usuario_vincular',args),
    estoqueSaldos:e=>rpcProducao('martins_producao_estoque_saldos',{e}),
    estoqueMover:args=>rpcProducao('martins_producao_estoque_mover',args),
    auditoria:args=>rpcProducao('martins_producao_auditoria',args),
    despesaEstado:args=>rpcProducao('martins_producao_despesa_estado',args),
    despesasTotais:args=>rpcProducao('martins_producao_despesas_totais',args),
    comRascunho:async(e,executar)=>{
      const ativa=sessao;
      if(!ativa||!contexto?.empresas.includes(e))falhar('Sessão ou empresa inválida.','42501');
      if(!ativa.chaveRascunho)falhar('Use Desbloquear edição para proteger e recuperar operações pendentes.','RASCUNHO_BLOQUEADO');
      return serializarRecuperacao(ativa,e,'operacoes-producao',async()=>{
        const estado=await lerRecuperacao(ativa,e,'operacoes-producao');
        const persistir=()=>gravarRecuperacao(ativa,e,'operacoes-producao',estado);
        return executar(estado,persistir);
      });
    }

  });

})();
