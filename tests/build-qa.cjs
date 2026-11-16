const { test } = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { webcrypto } = require('node:crypto');

const raiz = path.join(__dirname, '..');
const QA = 'https://oczxyiakpmgnrpoyhwov.supabase.co';
const PROD = 'https://kkjwmnxgcbonbwavaaya.supabase.co';
const CHAVE_FALSA = 'sb_publishable_CHAVE_SINTETICA_SOMENTE_PARA_TESTE';
const UID = '11111111-1111-4111-8111-111111111111';
const E = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function copiaTemporaria() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'martins-qa-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  fs.cpSync(path.join(raiz, 'dist-producao-fonte'), path.join(tmp, 'dist-producao-fonte'), { recursive: true });
  return tmp;
}
function compilar(tmp, env) {
  const ambiente = { PATH: process.env.PATH };
  return spawnSync(process.execPath, [path.join(tmp, 'scripts', 'preparar-build-qa.cjs')], { cwd: tmp, env: { ...ambiente, ...env }, encoding: 'utf8' });
}
function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(i => i.isDirectory() ? arquivos(path.join(dir, i.name)) : [path.join(dir, i.name)]);
}

test('Build QA é bloqueado sem chave, com chave inválida e com chave privada', () => {
  const tmp = copiaTemporaria();
  try {
    for (const env of [{}, { VITE_SUPABASE_QA_ANON_KEY: 'qualquer-coisa' }, { VITE_SUPABASE_QA_ANON_KEY: 'sb_secret_nao_pode' }]) {
      const r = compilar(tmp, env);
      a.equal(r.status, 1);
      a.equal(fs.existsSync(path.join(tmp, 'dist-qa')), false);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('Artefato QA aponta só para o projeto QA, sem produção e sem segredos', () => {
  const tmp = copiaTemporaria();
  try {
    const r = compilar(tmp, { VITE_SUPABASE_QA_ANON_KEY: CHAVE_FALSA });
    a.equal(r.status, 0, r.stderr);
    const saida = path.join(tmp, 'dist-qa');
    for (const f of arquivos(saida)) {
      if (!/\.(?:html?|js|json|css|toml|txt)$|_headers$|_redirects$/.test(f)) continue;
      const t = fs.readFileSync(f, 'utf8');
      a.equal(t.includes(PROD), false, 'URL de produção em ' + path.relative(saida, f));
      a.equal(/sb_secret_[A-Za-z0-9_-]+/i.test(t), false, 'chave privada em ' + path.relative(saida, f));
    }
    const html = fs.readFileSync(path.join(saida, 'index.html'), 'utf8');
    a.match(html, new RegExp("connect-src 'self' " + QA.replace(/\./g, '\\.')));
    const cfg = fs.readFileSync(path.join(saida, 'producao-config.js'), 'utf8');
    a.ok(cfg.includes(QA) && cfg.includes(CHAVE_FALSA));
    for (const f of ['index.html', 'auth-v5.js', 'auth-ui-v5.js']) {
      const t = fs.readFileSync(path.join(saida, f), 'utf8');
      a.equal(t.includes('Supabase de produção'), false, 'texto de produção na tela QA: ' + f);
    }
    a.match(html, /E-mail do Supabase de homologação/);
    a.match(fs.readFileSync(path.join(saida, 'sw.js'), 'utf8'), /martins-erp-qa-[0-9a-f]{16}/);
    for (const proibido of ['qa-config.js', 'qa-public-settings.js', 'qa-auth-ui.js']) a.equal(fs.existsSync(path.join(saida, proibido)), false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('Artefato QA: toda requisição vai ao QA, gravações seguem bloqueadas e produção é recusada', async () => {
  const tmp = copiaTemporaria();
  try {
    a.equal(compilar(tmp, { VITE_SUPABASE_QA_ANON_KEY: CHAVE_FALSA }).status, 0);
    const saida = path.join(tmp, 'dist-qa');
    function ambiente(url) {
      const chamadas = [], storage = new Map();
      const resposta = corpo => ({ ok: true, status: 200, text: async () => JSON.stringify(corpo) });
      const ctx = vm.createContext({
        window: { MARTINS_SUPABASE_ENV_CONFIG: { VITE_MARTINS_ENV: 'PRODUCAO', VITE_SUPABASE_PROD_URL: url, VITE_SUPABASE_PROD_ANON_KEY: CHAVE_FALSA } },
        sessionStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
        crypto: webcrypto, TextEncoder, TextDecoder, AbortSignal, Map, Set, Date, JSON, URL, atob, localStorage: { getItem: () => null },
        fetch: async (u, options) => {
          chamadas.push({ u, options });
          if (u.includes('grant_type=password')) return resposta({ user: { id: UID, email: 'sintetico@example.invalid' }, access_token: 'a', refresh_token: 'r', expires_in: 3600 });
          if (u.endsWith('/rpc/martins_producao_contexto')) return resposta({ usuario_id: UID, nome: 'Sintético', empresas: [{ id: E, nome: 'Empresa', papel: 'operacional', permissoes: { funcionarios: { ler: true } } }] });
          return resposta([]);
        }
      });
      vm.runInContext(fs.readFileSync(path.join(saida, 'producao-config.js'), 'utf8').replace(/"VITE_SUPABASE_PROD_URL":"[^"]+"/, '"VITE_SUPABASE_PROD_URL":"' + url + '"'), ctx);
      vm.runInContext(fs.readFileSync(path.join(saida, 'auth-v5.js'), 'utf8'), ctx);
      return { window: ctx.window, chamadas };
    }
    const qa = ambiente(QA);
    a.equal((await qa.window.autenticarUsuarioSistema('sintetico@example.invalid', 'senha')).sucesso, true);
    await qa.window.MartinsProducaoRpc.consultar({ e: E, m: 'funcionarios' });
    a.ok(qa.chamadas.length >= 3 && qa.chamadas.every(c => c.u.startsWith(QA + '/')));
    const antes = qa.chamadas.length;
    await a.rejects(qa.window.MartinsProducaoRpc.salvar({ e: E, m: 'funcionarios' }), { code: 'PREVIA_SOMENTE_LEITURA' });
    await a.rejects(qa.window.MartinsProducaoRpc.lote({ e: E, m: 'frequencia', itens: [] }), { code: 'PREVIA_SOMENTE_LEITURA' });
    a.equal(qa.chamadas.length, antes);
    const prod = ambiente(PROD);
    const r = await prod.window.autenticarUsuarioSistema('sintetico@example.invalid', 'senha');
    a.equal(r.sucesso, false);
    a.equal(prod.chamadas.length, 0, 'nenhuma credencial é enviada ao projeto de produção');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
