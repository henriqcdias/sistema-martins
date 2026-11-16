// A gravação só existe quando o build a habilita explicitamente (homologação).
// A produção continua somente leitura e o build de produção recusa a opção.
const { test } = require('node:test');
const a = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { webcrypto } = require('node:crypto');

const raiz = path.join(__dirname, '..');
const UID = '11111111-1111-4111-8111-111111111111', E = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROD = 'https://kkjwmnxgcbonbwavaaya.supabase.co';

function setup(config) {
  const calls = [], storage = new Map();
  const ctx = vm.createContext({
    window: { MARTINS_SUPABASE_ENV_CONFIG: { VITE_MARTINS_ENV: 'PRODUCAO', VITE_SUPABASE_PROD_URL: PROD, VITE_SUPABASE_PROD_ANON_KEY: 'sb_publishable_synthetic', ...config } },
    sessionStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    crypto: webcrypto, TextEncoder, TextDecoder, AbortSignal, Map, Set, Date, JSON, URL, atob, localStorage: { getItem: () => null },
    fetch: async (url, options) => {
      calls.push({ url, options }); let body = [];
      if (url.includes('/auth/v1/token')) body = { user: { id: UID, email: 'synthetic@example.invalid' }, access_token: 'a', refresh_token: 'r', expires_in: 3600 };
      else if (url.endsWith('/rpc/martins_producao_contexto')) body = { usuario_id: UID, nome: 'Sintético', empresas: [{ id: E, nome: 'Empresa', papel: 'master', permissoes: {} }] };
      else if (url.endsWith('/rpc/martins_producao_salvar')) body = { empresa_id: E, modulo: 'clientes', id: E, revisao: 1, repetida: false };
      return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'dist-producao-fonte/auth-v5.js'), 'utf8'), ctx);
  return { window: ctx.window, calls };
}

test('Sem a opção de build, salvar, lote e mudança de estado continuam bloqueados antes da rede', async () => {
  const f = setup({});
  await f.window.autenticarUsuarioSistema('synthetic@example.invalid', 'synthetic-password');
  const antes = f.calls.length;
  for (const chamada of [() => f.window.MartinsProducaoRpc.salvar({ e: E }), () => f.window.MartinsProducaoRpc.lote({ e: E }), () => f.window.MartinsProducaoRpc.despesaEstado({ e: E })])
    await a.rejects(chamada(), { code: 'PREVIA_SOMENTE_LEITURA' });
  a.equal(f.calls.length, antes);
  a.equal(f.window.gravacaoHabilitadaWork(), false);
});

test('Com VITE_MARTINS_GRAVACAO=HABILITADA, só as três RPCs de gravação passam; totais são leitura', async () => {
  const f = setup({ VITE_MARTINS_GRAVACAO: 'HABILITADA' });
  await f.window.autenticarUsuarioSistema('synthetic@example.invalid', 'synthetic-password');
  a.equal(f.window.gravacaoHabilitadaWork(), true);
  const r = await f.window.MartinsProducaoRpc.salvar({ e: E, m: 'clientes' });
  a.equal(r.revisao, 1);
  await f.window.MartinsProducaoRpc.lote({ e: E, m: 'frequencia', itens: [] });
  await f.window.MartinsProducaoRpc.despesaEstado({ e: E });
  await f.window.MartinsProducaoRpc.despesasTotais({ e: E });
  const rpcs = f.calls.map(c => new URL(c.url).pathname).filter(p => p.includes('/rpc/'));
  a.deepEqual(rpcs.slice(1), ['/rest/v1/rpc/martins_producao_salvar', '/rest/v1/rpc/martins_producao_salvar_lote',
    '/rest/v1/rpc/martins_producao_despesa_estado', '/rest/v1/rpc/martins_producao_despesas_totais']);
});

test('Valor diferente de HABILITADA não libera gravação', async () => {
  const f = setup({ VITE_MARTINS_GRAVACAO: 'sim' });
  await f.window.autenticarUsuarioSistema('synthetic@example.invalid', 'synthetic-password');
  await a.rejects(f.window.MartinsProducaoRpc.salvar({ e: E }), { code: 'PREVIA_SOMENTE_LEITURA' });
});

function copia() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'martins-grav-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  fs.cpSync(path.join(raiz, 'dist-producao-fonte'), path.join(tmp, 'dist-producao-fonte'), { recursive: true });
  return tmp;
}
const rodar = (tmp, script, env) => spawnSync(process.execPath, [path.join(tmp, 'scripts', script)], { cwd: tmp, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
const CHAVE = 'sb_publishable_CHAVE_SINTETICA_SOMENTE_PARA_TESTE';

test('Build QA só habilita gravação com o opt-in explícito no terminal', () => {
  const tmp = copia();
  try {
    a.equal(rodar(tmp, 'preparar-build-qa.cjs', { VITE_SUPABASE_QA_ANON_KEY: CHAVE }).status, 0);
    a.equal(fs.readFileSync(path.join(tmp, 'dist-qa/producao-config.js'), 'utf8').includes('VITE_MARTINS_GRAVACAO'), false);
    fs.rmSync(path.join(tmp, 'dist-qa'), { recursive: true });
    a.equal(rodar(tmp, 'preparar-build-qa.cjs', { VITE_SUPABASE_QA_ANON_KEY: CHAVE, VITE_MARTINS_QA_GRAVACAO: 'HABILITADA' }).status, 0);
    a.match(fs.readFileSync(path.join(tmp, 'dist-qa/producao-config.js'), 'utf8'), /"VITE_MARTINS_GRAVACAO":"HABILITADA"/);
    a.ok(fs.existsSync(path.join(tmp, 'dist-qa/cadastros-servidor.js')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('Build de produção nunca habilita gravação e a verificação recusa um artefato com a opção', () => {
  const tmp = copia();
  const env = { VITE_MARTINS_ENV: 'PRODUCAO', VITE_SUPABASE_PROD_URL: PROD, VITE_SUPABASE_PROD_ANON_KEY: CHAVE, VITE_MARTINS_QA_GRAVACAO: 'HABILITADA', VITE_MARTINS_GRAVACAO: 'HABILITADA' };
  try {
    a.equal(rodar(tmp, 'preparar-build-producao.cjs', env).status, 0);
    const cfg = path.join(tmp, 'dist-producao/producao-config.js');
    a.equal(fs.readFileSync(cfg, 'utf8').includes('VITE_MARTINS_GRAVACAO'), false);
    fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('Object.freeze({', 'Object.freeze({"VITE_MARTINS_GRAVACAO":"HABILITADA",'));
    const v = spawnSync(process.execPath, [path.join(tmp, 'scripts/verificar-build-producao.cjs'), path.join(tmp, 'dist-producao')], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
    a.equal(v.status, 1);
    a.match(v.stderr, /gravação habilitada/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
