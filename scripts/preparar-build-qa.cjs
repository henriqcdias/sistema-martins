// Build isolado para homologacao QA. Nao altera os scripts de producao.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'dist-producao-fonte');
const output = path.join(root, 'dist-qa');
const QA_URL = 'https://oczxyiakpmgnrpoyhwov.supabase.co';
const PROD_URL = 'https://kkjwmnxgcbonbwavaaya.supabase.co';
const key = process.env.VITE_SUPABASE_QA_ANON_KEY || '';
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
  console.error('Build QA bloqueado: informe VITE_SUPABASE_QA_ANON_KEY (chave publica sb_publishable_... do projeto QA).');
  process.exit(1);
}
if (fs.existsSync(output)) { console.error('Apague dist-qa anterior antes de compilar.'); process.exit(1); }
const tmp = fs.mkdtempSync(path.join(root, '.build-qa-'));
function change(file, before, after) {
  const f = path.join(tmp, file);
  const original = fs.readFileSync(f, 'utf8');
  if (!original.includes(before)) throw new Error('Contrato inesperado em ' + file + ': ' + before.slice(0, 60));
  fs.writeFileSync(f, original.replace(before, after));
}
function changeAll(file, before, after) {
  const f = path.join(tmp, file);
  const original = fs.readFileSync(f, 'utf8');
  if (!original.includes(before)) throw new Error('Contrato inesperado em ' + file + ': ' + before.slice(0, 60));
  fs.writeFileSync(f, original.split(before).join(after));
}
function walk(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
try {
  fs.cpSync(source, tmp, {recursive:true});
  // O cliente v5 usa nomes historicos de configuracao; apenas o build QA muda os valores.
  change('auth-v5.js', "if (url !== '" + PROD_URL + "')", "if (url !== '" + QA_URL + "')");
  change('index.html', PROD_URL, QA_URL); // CSP connect-src
  // Diferencia o QA da producao para evitar confusao na interface.
  change('auth-v5.js', 'Projeto de produção divergente.', 'Projeto de homologação QA divergente.');
  change('auth-v5.js', 'A chave pública do Supabase de produção ainda não foi configurada na publicação.', 'A chave pública do Supabase QA ainda não foi configurada na publicação.');
  // Tela de login e mensagens: "Supabase de produção" vira "Supabase de homologação".
  for (const file of ['index.html', 'auth-v5.js', 'auth-ui-v5.js']) changeAll(file, 'Supabase de produção', 'Supabase de homologação');
  // Configuracao no navegador: chave publicavel e URL nao sao segredos; nunca incluir service_role.
  fs.writeFileSync(path.join(tmp,'producao-config.js'),
    'window.MARTINS_SUPABASE_ENV_CONFIG = Object.freeze(' + JSON.stringify({
      VITE_MARTINS_ENV:'PRODUCAO', // contrato de compatibilidade da v5; nao significa projeto produtivo
      VITE_SUPABASE_PROD_URL: QA_URL,
      VITE_SUPABASE_PROD_ANON_KEY: key,
      // Opt-in explícito no terminal: VITE_MARTINS_QA_GRAVACAO=HABILITADA. Sem ele, o QA segue somente leitura.
      ...(process.env.VITE_MARTINS_QA_GRAVACAO === 'HABILITADA' ? { VITE_MARTINS_GRAVACAO: 'HABILITADA' } : {})
    }) + ');\n', {flag:'wx'});
  const swTemplate = fs.readFileSync(path.join(__dirname, 'sw-producao.js'), 'utf8');
  const hash = crypto.createHash('sha256');
  for (const f of ['index.html','dist/app-martins.min.js','producao-config.js','auth-v5.js','auth-ui-v5.js','cliente.js','formularios.js', 'cadastros-servidor.js', 'painel-servidor.js']) {
    hash.update(f); hash.update(fs.readFileSync(path.join(tmp,f)));
  }
  fs.writeFileSync(path.join(tmp,'sw.js'), swTemplate.replace('__REVISAO__', hash.digest('hex').slice(0,16)).replace('martins-erp-prod-', 'martins-erp-qa-'));
  const forbidden = [];
  for (const f of walk(tmp)) {
    if (fs.lstatSync(f).isSymbolicLink()) throw new Error('Link simbolico nao permitido');
    if (/\.(?:html?|js|json|txt|css|toml|map)$/.test(f)) {
      const t = fs.readFileSync(f,'utf8');
      if (t.includes(PROD_URL) || /sb_secret_[A-Za-z0-9_-]+/i.test(t)) forbidden.push(path.relative(tmp,f));
    }
  }
  if (forbidden.length) throw new Error('Artefato QA contem referencia proibida: ' + forbidden.join(', '));
  if (!fs.readFileSync(path.join(tmp,'auth-v5.js'),'utf8').includes('PREVIA_SOMENTE_LEITURA')) throw new Error('Trava de escrita nao encontrada.');
  fs.renameSync(tmp, output);
  console.log('Build QA gerado em dist-qa/. Ambiente isolado; ' + (process.env.VITE_MARTINS_QA_GRAVACAO === 'HABILITADA' ? 'GRAVACAO HABILITADA (homologacao).' : 'gravacoes bloqueadas (somente leitura).'));
} catch (e) { console.error('Build QA bloqueado: ' + e.message); process.exitCode=1; }
finally { fs.rmSync(tmp, {recursive:true, force:true}); }
