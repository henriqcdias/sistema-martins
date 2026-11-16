const { test } = require('node:test');
const a = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

const raiz = path.join(__dirname, '../dist-producao-fonte');
const UID = '11111111-1111-4111-8111-111111111111';
const OUTRO = '22222222-2222-4222-8222-222222222222';
const E = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const URL_PROD = 'https://kkjwmnxgcbonbwavaaya.supabase.co';

// ---------- Ambiente da autenticação v5 (somente dados sintéticos) ----------
function montar({ expiresIn = 3600 } = {}) {
  const chamadas = [], storage = new Map(), timers = [];
  const cenario = { refresh: 'ok', contexto: 'ok', contextoEmpresas: [E], uidRefresh: UID, rede: false };
  let n = 0;
  const resposta = (status, corpo) => ({ ok: status < 400, status, text: async () => JSON.stringify(corpo) });
  const contexto = vm.createContext({
    window: {
      MARTINS_SUPABASE_ENV_CONFIG: {
        VITE_MARTINS_ENV: 'PRODUCAO', VITE_SUPABASE_PROD_URL: URL_PROD,
        VITE_SUPABASE_PROD_ANON_KEY: 'sb_publishable_synthetic'
      }
    },
    sessionStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    crypto: webcrypto, TextEncoder, TextDecoder, AbortSignal, Map, Set, Date, JSON, URL, atob,
    localStorage: { getItem: () => null },
    setTimeout: (fn, ms) => { const t = { fn, ms, ativo: true }; timers.push(t); return t; },
    clearTimeout: t => { if (t) t.ativo = false; },
    fetch: async (url, options) => {
      chamadas.push({ url, options });
      if (url.includes('grant_type=password')) {
        return resposta(200, { user: { id: UID, email: 'sintetico@example.invalid' }, access_token: 'acesso-0', refresh_token: 'refresh-0', expires_in: expiresIn });
      }
      if (url.includes('grant_type=refresh_token')) {
        if (cenario.rede) throw Object.assign(new Error('rede'), { name: 'TypeError' });
        if (cenario.refresh === 'recusado') return resposta(400, { error_code: 'refresh_token_not_found', message: 'recusado' });
        n++;
        return resposta(200, { user: { id: cenario.uidRefresh, email: 'sintetico@example.invalid' }, access_token: 'acesso-' + n, refresh_token: 'refresh-' + n, expires_in: 3600 });
      }
      if (url.endsWith('/rpc/martins_producao_contexto')) {
        if (cenario.contexto === 'erro500') return resposta(500, { message: 'falha interna' });
        if (cenario.contexto === 'ausente') return resposta(404, { code: 'PGRST202', message: 'Could not find the function public.martins_producao_contexto' });
        return resposta(200, {
          usuario_id: UID, nome: 'Usuário sintético',
          empresas: cenario.contextoEmpresas.map(id => ({ id, nome: 'Empresa sintética', papel: 'operacional', permissoes: { funcionarios: { ler: true } } }))
        });
      }
      return resposta(200, []);
    }
  });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'auth-v5.js'), 'utf8'), contexto);
  return { window: contexto.window, chamadas, storage, timers, cenario };
}
const login = f => f.window.autenticarUsuarioSistema('sintetico@example.invalid', 'senha-sintetica');
const refreshes = f => f.chamadas.filter(c => c.url.includes('grant_type=refresh_token'));

test('Token prestes a expirar é renovado antes da consulta, com o novo Bearer e vínculos revalidados', async () => {
  const f = montar({ expiresIn: 20 });
  a.equal((await login(f)).sucesso, true);
  await f.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' });
  a.equal(refreshes(f).length, 1);
  a.equal(f.chamadas.at(-1).options.headers.Authorization, 'Bearer acesso-1');
  a.equal(f.storage.get('martins.prod.auth.v1'), 'refresh-1');
  const ctxChamadas = f.chamadas.filter(c => c.url.endsWith('/rpc/martins_producao_contexto'));
  a.equal(ctxChamadas.length, 2, 'vínculos são consultados de novo após a renovação');
  a.equal(ctxChamadas[1].options.headers.Authorization, 'Bearer acesso-1');
  a.ok(f.window.obterContextoSegurancaAutenticadoWork().expiraEm > Date.now() + 3000000);
});

test('Renovação é única mesmo com várias consultas simultâneas', async () => {
  const f = montar({ expiresIn: 20 });
  await login(f);
  await Promise.all([1, 2, 3].map(() => f.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' })));
  a.equal(refreshes(f).length, 1);
});

test('Refresh recusado encerra a sessão local e bloqueia consultas', async () => {
  const f = montar({ expiresIn: 20 });
  await login(f);
  f.cenario.refresh = 'recusado';
  await a.rejects(f.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' }));
  a.equal(f.window.obterContextoSegurancaAutenticadoWork(), null);
  a.equal(f.storage.has('martins.prod.auth.v1'), false);
  await a.rejects(f.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' }), { code: '42501' });
});

test('Falha de rede na renovação NÃO derruba a sessão e reagenda nova tentativa', async () => {
  const f = montar({ expiresIn: 20 });
  await login(f);
  f.cenario.rede = true;
  await a.rejects(f.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' }), { code: 'QA_REDE' });
  a.notEqual(f.window.obterContextoSegurancaAutenticadoWork(), null);
  a.equal(f.storage.get('martins.prod.auth.v1'), 'refresh-0');
  a.ok(f.timers.some(t => t.ativo && t.ms === 30000));
});

test('Renovação para outro UID é recusada e encerra a sessão', async () => {
  const f = montar({ expiresIn: 20 });
  await login(f);
  f.cenario.uidRefresh = OUTRO;
  await a.rejects(f.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' }));
  a.equal(f.window.obterContextoSegurancaAutenticadoWork(), null);
});

test('Vínculo revogado no servidor encerra a sessão na renovação (verificação não é enfraquecida)', async () => {
  const f = montar({ expiresIn: 20 });
  await login(f);
  f.cenario.contextoEmpresas = [];
  await a.rejects(f.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' }));
  a.equal(f.window.obterContextoSegurancaAutenticadoWork(), null);
});

test('Gravações continuam bloqueadas antes da rede, também depois da renovação', async () => {
  const f = montar({ expiresIn: 20 });
  await login(f);
  await f.window.renovarSessaoWork();
  const antes = f.chamadas.length;
  await a.rejects(f.window.MartinsProducaoRpc.salvar({ e: E, m: 'funcionarios' }), { code: 'PREVIA_SOMENTE_LEITURA' });
  await a.rejects(f.window.MartinsProducaoRpc.lote({ e: E, m: 'frequencia', itens: [] }), { code: 'PREVIA_SOMENTE_LEITURA' });
  a.equal(f.chamadas.length, antes);
});

test('Renovação é agendada no login e cancelada no logout', async () => {
  const f = montar({ expiresIn: 3600 });
  await login(f);
  const agendado = f.timers.filter(t => t.ativo);
  a.equal(agendado.length, 1);
  a.ok(agendado[0].ms > 3000 * 1000 && agendado[0].ms < 3600 * 1000);
  await f.window.encerrarSessaoSupabaseWork();
  a.equal(f.timers.filter(t => t.ativo).length, 0);
});

test('Erro transitório no contexto durante o F5 não apaga o refresh token', async () => {
  const f = montar();
  await login(f);
  f.cenario.contexto = 'erro500';
  const r = await f.window.restaurarSessaoQaWork();
  a.equal(r.sucesso, false);
  a.equal(r.codigo, 'CONTEXTO_INDISPONIVEL');
  a.ok(f.storage.get('martins.prod.auth.v1'), 'refresh token preservado para nova tentativa');
});

test('Contrato ausente no projeto (PGRST202) é identificado no login, sem criar sessão', async () => {
  const f = montar();
  f.cenario.contexto = 'ausente';
  const r = await login(f);
  a.equal(r.sucesso, false);
  a.equal(r.codigo, 'CONTEXTO_CONTRATO_AUSENTE');
  a.match(r.erro, /martins_producao_contexto não existe/);
  a.equal(f.window.obterContextoSegurancaAutenticadoWork(), null);
});

// ---------- Diagnóstico da carga de Funcionários ----------
async function carregarCom({ permissoes, catalogos, load }) {
  const ctx = { uid: UID, empresas: [E], vinculos: [{ empresa_id: E, nomeEmpresa: 'Empresa sintética', permissoes }] };
  const status = { dataset: {} };
  const document = {
    readyState: 'loading', body: { dataset: {} }, addEventListener() {}, querySelectorAll() { return []; },
    getElementById(id) { return id === 'producao-status' ? status : null; }
  };
  const window = {
    empresaFrequenciaWork: E, obterContextoSegurancaAutenticadoWork: () => ctx,
    MartinsProducaoRpc: { catalogos },
    MartinsProducaoClient: { create() { return { load, reset() {} }; } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(raiz, 'formularios.js'), 'utf8'), { window, document, structuredClone, console });
  await window.MartinsProducaoOnSession(ctx);
  return { window, status, estado: document.body.dataset.cargaFuncionarios, diag: window.MartinsOperacional.diagnostico() };
}
const catalogoOk = async () => ({ empresa_id: E, obras: [], funcionarios: [] });
const lerTudo = { funcionarios: { ler: true }, frequencia: { ler: true }, orcamentos: { ler: true } };
const linha = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', empresa_id: E, revisao: 1, dados: { nome: 'Sintético' } };
const erroCom = (code, message = 'falha') => Object.assign(new Error(message), { code });

test('Diagnóstico: consulta sem erro e sem registros é "vazio", não falha', async () => {
  const r = await carregarCom({ permissoes: lerTudo, catalogos: catalogoOk, load: async () => [] });
  a.equal(r.estado, 'vazio');
  a.match(r.status.textContent, /não há funcionários cadastrados/);
  a.equal(r.status.dataset.erro, 'false');
});

test('Diagnóstico: vínculo sem permissão de leitura de Funcionários é distinguido', async () => {
  const consultados = [];
  const r = await carregarCom({
    permissoes: { frequencia: { ler: true } }, catalogos: catalogoOk,
    load: async (e, m) => { consultados.push(m); return [linha]; }
  });
  a.equal(r.estado, 'sem_permissao_leitura');
  a.deepEqual(consultados, ['frequencia']);
  a.match(r.status.textContent, /não tem permissão de leitura de Funcionários/);
  a.equal(r.status.dataset.erro, 'true');
});

test('Diagnóstico: falha de conexão é distinguida de permissão negada', async () => {
  const rede = await carregarCom({
    permissoes: lerTudo, catalogos: async () => { throw erroCom('QA_REDE'); },
    load: async (e, m) => { if (m === 'funcionarios') throw erroCom('QA_REDE'); return [linha]; }
  });
  a.equal(rede.estado, 'conexao');
  a.match(rede.status.textContent, /falha de conexão com o Supabase/);
  const negado = await carregarCom({
    permissoes: lerTudo, catalogos: catalogoOk,
    load: async (e, m) => { if (m === 'funcionarios') throw erroCom('42501'); return [linha]; }
  });
  a.equal(negado.estado, 'permissao');
  a.match(negado.status.textContent, /acesso negado pelo servidor/);
});

test('Diagnóstico: schema/função indisponível (PGRST106/PGRST202) é "contrato"', async () => {
  const r = await carregarCom({
    permissoes: lerTudo, catalogos: async () => { throw erroCom('PGRST202'); }, load: async () => [linha]
  });
  a.equal(r.estado, 'contrato');
  a.match(r.status.textContent, /função ou schema indisponível/);
});

test('Diagnóstico: carga completa é "ok" e mantém Funcionários e Orçamentos disponíveis', async () => {
  const r = await carregarCom({ permissoes: lerTudo, catalogos: catalogoOk, load: async () => [linha] });
  a.equal(r.estado, 'ok');
  a.equal(r.window.MartinsOperacional.listar('funcionarios').length, 1);
  a.equal(r.window.MartinsOperacional.listar('orcamentos').length, 1);
  a.match(r.status.textContent, /Consulta concluída/);
});
