// Garante que o firebase.json reproduz as regras do Netlify (_headers/_redirects)
// e que cada destino publica a pasta gerada pelo build correto.
const { test } = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(raiz, 'firebase.json'), 'utf8'));
const sites = Object.fromEntries(config.hosting.map(site => [site.target, site]));

function regrasNetlify() {
  const linhas = fs.readFileSync(path.join(raiz, 'dist-producao-fonte', '_headers'), 'utf8').split('\n');
  const regras = {};
  let atual = null;
  for (const linha of linhas) {
    if (!linha.trim()) continue;
    if (!/^\s/.test(linha)) { atual = linha.trim(); regras[atual] = {}; continue; }
    const [chave, ...valor] = linha.trim().split(':');
    regras[atual][chave.trim()] = valor.join(':').trim();
  }
  return regras;
}

function cabecalho(site, origem, chave) {
  const regra = site.headers.find(r => r.source === origem);
  const item = regra && regra.headers.find(h => h.key === chave);
  return item && item.value;
}

test('Firebase tem destinos separados de homologação e produção, cada um com a pasta do seu build', () => {
  a.deepEqual(Object.keys(sites).sort(), ['homologacao', 'producao']);
  a.equal(sites.homologacao.public, 'dist-qa');
  a.equal(sites.producao.public, 'dist-producao');
  a.match(fs.readFileSync(path.join(raiz, 'scripts', 'preparar-build-qa.cjs'), 'utf8'), /path\.join\(root, 'dist-qa'\)/);
  a.match(fs.readFileSync(path.join(raiz, 'scripts', 'preparar-build-producao.cjs'), 'utf8'), /path\.join\(raiz, 'dist-producao'\)/);
});

test('Rotas da SPA seguem o _redirects do Netlify', () => {
  a.equal(fs.readFileSync(path.join(raiz, 'dist-producao-fonte', '_redirects'), 'utf8').trim().split(/\s+/).join(' '), '/* /index.html 200');
  for (const site of Object.values(sites)) a.deepEqual(site.rewrites, [{ source: '**', destination: '/index.html' }]);
});

test('Cabeçalhos de segurança e cache seguem o _headers do Netlify nos dois destinos', () => {
  const netlify = regrasNetlify();
  for (const site of Object.values(sites)) {
    for (const [chave, valor] of Object.entries(netlify['/*'])) a.equal(cabecalho(site, '**', chave), valor, site.target + ' ' + chave);
    a.equal(cabecalho(site, '/sw.js', 'Cache-Control'), netlify['/sw.js']['Cache-Control']);
    a.equal(cabecalho(site, '/@(favicon.png|icon-*.png)', 'Cache-Control'), netlify['/favicon.png']['Cache-Control']);
    a.equal(netlify['/icon-*.png']['Cache-Control'], netlify['/favicon.png']['Cache-Control']);
    // A regra mais específica precisa vir depois da geral para prevalecer.
    a.equal(site.headers[0].source, '**');
    for (const proibido of ['_headers', '_redirects', '**/.*']) a.ok(site.ignore.includes(proibido), site.target + ' publica ' + proibido);
  }
});

test('Só a homologação pede para não ser indexada', () => {
  a.equal(cabecalho(sites.homologacao, '**', 'X-Robots-Tag'), 'noindex, nofollow');
  a.equal(cabecalho(sites.producao, '**', 'X-Robots-Tag'), undefined);
});
