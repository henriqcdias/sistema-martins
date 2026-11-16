const fs = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');
const entrada = path.join(raiz, 'dist-producao-fonte');
const saida = path.join(raiz, 'dist-producao');

try {
  const { VITE_MARTINS_ENV, VITE_SUPABASE_PROD_URL, VITE_SUPABASE_PROD_ANON_KEY } = process.env;
  if (VITE_MARTINS_ENV !== 'PRODUCAO' ||
      VITE_SUPABASE_PROD_URL !== 'https://kkjwmnxgcbonbwavaaya.supabase.co' ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(VITE_SUPABASE_PROD_ANON_KEY || '')) {
    throw new Error('Informe a URL de produção e a chave publicável desse projeto.');
  }
  const html = fs.readFileSync(path.join(entrada, 'index.html'), 'utf8');
  if (!/<script\s+src=["'](?:\.\/)?producao-config\.js["']\s*><\/script>/i.test(html)) {
    throw new Error('O HTML de produção deve carregar producao-config.js.');
  }
  if (fs.existsSync(saida)) throw new Error('Use um checkout limpo, sem artefato produtivo anterior.');

  const temporario = fs.mkdtempSync(path.join(raiz, '.build-producao-'));
  try {
    fs.cpSync(entrada, temporario, { recursive: true, verbatimSymlinks: true });
    const config = { VITE_MARTINS_ENV, VITE_SUPABASE_PROD_URL, VITE_SUPABASE_PROD_ANON_KEY };
    const arquivoConfig = path.join(temporario, 'producao-config.js');
    if (fs.existsSync(arquivoConfig)) throw new Error('Remova a configuração estática do candidato.');
    fs.writeFileSync(arquivoConfig,
      'window.MARTINS_SUPABASE_ENV_CONFIG = Object.freeze(' + JSON.stringify(config) + ');\n',
      { flag: 'wx' });
    const revisao = createHash('sha256');
    const modeloWorker = fs.readFileSync(path.join(__dirname, 'sw-producao.js'), 'utf8');
    revisao.update(modeloWorker);
    for (const recurso of ['index.html', 'dist/app-martins.min.js', 'producao-config.js',
      'auth-v5.js', 'auth-ui-v5.js', 'cliente.js', 'formularios.js', 'cadastros-servidor.js']) {
      revisao.update(recurso);
      revisao.update(fs.readFileSync(path.join(temporario, recurso)));
    }
    const worker = modeloWorker
      .replace('__REVISAO__', revisao.digest('hex').slice(0, 16));
    fs.writeFileSync(path.join(temporario, 'sw.js'), worker);
    const verificacao = spawnSync(process.execPath,
      [path.join(__dirname, 'verificar-build-producao.cjs'), temporario], { stdio: 'inherit' });
    if (verificacao.status !== 0) throw new Error('A verificação do artefato falhou.');
    fs.renameSync(temporario, saida);
  } finally {
    fs.rmSync(temporario, { recursive: true, force: true });
  }
} catch (error) {
  console.error('Build de produção bloqueado. ' + (error.code === 'ENOENT'
    ? 'Candidato de produção separado indisponível em dist-producao-fonte.'
    : error.message));
  process.exitCode = 1;
}
