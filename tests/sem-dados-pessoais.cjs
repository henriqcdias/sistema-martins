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
  'dist-producao-fonte/formularios.js', 'dist-producao-fonte/cliente.js',
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
