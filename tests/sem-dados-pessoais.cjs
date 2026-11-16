// Impede que e-mails pessoais e senhas padrão voltem ao código publicado.
// Identidade e senha vêm só do Supabase Auth; o código só pode ter endereços
// fictícios (@usuarios.invalid, example.*) ou caixas institucionais das empresas.
const { test } = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ARQUIVOS = [
  'dist-producao-fonte/index.html', 'dist-producao-fonte/dist/app-martins.min.js',
  'dist-producao-fonte/auth-v5.js', 'dist-producao-fonte/auth-ui-v5.js',
  'dist-producao-fonte/formularios.js', 'dist-producao-fonte/cliente.js', 'dist-producao-fonte/cadastros-servidor.js', 'dist-producao-fonte/painel-servidor.js',
  'dist/index.html', 'dist/dist/app-martins.min.js',
];
const PROVEDORES_PESSOAIS = /@(?:gmail|googlemail|hotmail|outlook|live|yahoo|icloud|uol|bol|terra|ig)\.[a-z.]+\b/i;
const DOMINIOS_EMPRESA = /@(?:construtoramartins\.com\.br|calhasmartins\.com\.br|acosrr\.com\.br|passos\.mg\.gov\.br)\b/i;
// Caixas de setor (não identificam uma pessoa).
const CAIXAS_SETOR = /^(?:vendas|pix|usuario|contato|financeiro|compras|fiscal|rh|suporte|nfe|engenharia|comercial|obras|calhaserufos|acos\.telhas|acos\.serralheria)@/i;

test('Código publicado não contém e-mails pessoais', () => {
  for (const arquivo of ARQUIVOS) {
    const texto = fs.readFileSync(path.join(raiz, arquivo), 'utf8');
    const emails = texto.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || [];
    const pessoais = emails.filter(e => PROVEDORES_PESSOAIS.test(e) || (DOMINIOS_EMPRESA.test(e) && !CAIXAS_SETOR.test(e)));
    a.deepEqual([...new Set(pessoais)], [], arquivo + ' contém e-mail pessoal');
  }
});

test('Código publicado não define senhas padrão nem grava senha local', () => {
  for (const arquivo of ARQUIVOS) {
    const texto = fs.readFileSync(path.join(raiz, arquivo), 'utf8');
    a.equal(/senha\s*:\s*[^,\n]*\|\|\s*['"][^'"]{4,}['"]/.test(texto), false, arquivo + ' define senha padrão');
    a.equal(/\balvo\.senha\s*=/.test(texto), false, arquivo + ' grava senha no cadastro local');
  }
});

test('Tela de cadastros não insere HTML vindo do servidor (sem innerHTML/insertAdjacentHTML)', () => {
  for (const f of ['cadastros-servidor.js', 'painel-servidor.js']) {
    const t = fs.readFileSync(path.join(raiz, 'dist-producao-fonte', f), 'utf8');
    a.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\balert\(/.test(t), false, f);
  }
});

test('Auditoria não traz ações fictícias atribuídas a pessoas reais', () => {
  for (const arquivo of ['dist-producao-fonte/dist/app-martins.min.js', 'dist/dist/app-martins.min.js']) {
    const t = fs.readFileSync(path.join(raiz, arquivo), 'utf8');
    a.equal(/Conferiu entrega de 50 sacos|Registrou anotação confidencial no RDO sobre alinhamento/.test(t), false, arquivo);
  }
});
