const fs = require('node:fs');
const path = require('node:path');

const producao = 'https://kkjwmnxgcbonbwavaaya.supabase.co';
const artefato = path.resolve(process.argv[2] || 'dist');

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const arquivo = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw new Error('Link simbólico no artefato.');
    return item.isDirectory() ? arquivos(arquivo) : [arquivo];
  });
}

try {
  if (process.env.VITE_MARTINS_ENV !== 'PRODUCAO' ||
      process.env.VITE_SUPABASE_PROD_URL !== producao ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.VITE_SUPABASE_PROD_ANON_KEY || '')) {
    throw new Error('Configure o ambiente PRODUCAO, a URL oficial e a chave publicável de produção.');
  }

  const problemas = [];
  let temProjetoProducao = false;
  for (const arquivo of arquivos(artefato)) {
    if (!/\.(?:html?|[cm]?js|css|json|webmanifest|map|toml|txt)$/.test(arquivo) &&
        !/^_(headers|redirects)$/.test(path.basename(arquivo))) continue;
    const conteudo = fs.readFileSync(arquivo, 'utf8');
    const origens = Array.from(conteudo.matchAll(/https?:\/\/[a-z0-9.-]+\.supabase\.co\b/gi), item => item[0]);
    temProjetoProducao ||= origens.includes(producao);
    if (/^qa-(?:config|public-settings|auth-ui)\.js$/.test(path.basename(arquivo)) ||
        /\b(?:oczxyiakpmgnrpoyhwov|martins_hml_v1|VITE_SUPABASE_HOMOLOG_URL|VITE_SUPABASE_HOMOLOG_ANON_KEY)\b/.test(conteudo) ||
        /\bsb_secret_[A-Za-z0-9_-]+/.test(conteudo) ||
        origens.some(origem => origem !== producao)) {
      problemas.push(path.relative(artefato, arquivo));
    }
  }

  if (problemas.length) throw new Error('Configuração incompatível no artefato: ' + problemas.join(', '));
  if (!temProjetoProducao) throw new Error('URL de produção ausente no artefato.');
  console.log('Verificação estática de ambiente aprovada.');
} catch (error) {
  console.error('Build de produção bloqueado. ' + error.message);
  process.exitCode = 1;
}
