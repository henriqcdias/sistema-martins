// Teste de ponta a ponta da tela "Cadastros e Despesas" num navegador real (Chromium).
// O Supabase é simulado: cada chamada /auth e /rpc é atendida pelo SQL REAL (base + produção + v2)
// rodando num Postgres descartável (PGlite). Nenhuma credencial ou banco real é usado.
//
// Uso (na raiz):
//   npm install --no-save @electric-sql/pglite@0.2.17 playwright-core@1.56.1
//   PLAYWRIGHT_BROWSERS_PATH=<pasta com chromium-1194> node tests-e2e/cadastros-servidor.e2e.cjs
const { chromium } = require('playwright-core');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');
const QA = 'https://oczxyiakpmgnrpoyhwov.supabase.co';
const APP = 'http://localhost:4173';
const E = '4d9b925e-732f-4055-8f52-c40373425dd5';
const USUARIOS = { 'master@teste.invalid': '11111111-1111-4111-8111-111111111111', 'lancador@teste.invalid': '22222222-2222-4222-8222-222222222222' };
let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };

async function banco() {
  const db = new PGlite();
  const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['supabase/producao/migrations', 'supabase/v2/migrations'])
    for (const f of fs.readdirSync(path.join(raiz, d)).sort()) await db.exec(sql(d + '/' + f));
  const [M, L] = Object.values(USUARIOS);
  await db.exec(`INSERT INTO auth.users VALUES ('${M}','master@teste.invalid'),('${L}','lancador@teste.invalid');
    INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${M}','${E}','Master Teste'),('${L}','${E}','Lançador Teste');
    INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${M}','master',true),('${E}','${L}','operacional',true);
    INSERT INTO martins_producao_v1.permissoes(usuario_id, empresa_id, modulo, ler, criar, editar) VALUES ('${L}','${E}','despesas',true,true,true);`);
  return db;
}

const TIPOS = { e: 'uuid', r: 'uuid', apos: 'uuid', op: 'uuid', v: 'bigint', limite: 'integer', d: 'jsonb', itens: 'jsonb', de: 'date', ate: 'date', m: 'text', estado: 'text', motivo: 'text' };
async function supabase(db, route) {
  const req = route.request(), url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const uid = (req.headers().authorization || '').replace('Bearer ', '');
  if (url.pathname === '/auth/v1/token') {
    const corpo = JSON.parse(req.postData() || '{}');
    const id = url.searchParams.get('grant_type') === 'password' ? USUARIOS[corpo.email] : corpo.refresh_token;
    if (!id) return json(400, { error_code: 'invalid_credentials' });
    const email = Object.keys(USUARIOS).find(k => USUARIOS[k] === id);
    return json(200, { user: { id, email }, access_token: id, refresh_token: id, expires_in: 3600 });
  }
  if (url.pathname === '/auth/v1/user') return json(200, { id: uid });
  if (url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204 });
  const m = url.pathname.match(/^\/rest\/v1\/rpc\/(martins_producao_[a-z_]+)$/);
  if (!m) return json(404, { code: '404', message: 'rota não simulada' });
  const args = JSON.parse(req.postData() || '{}');
  const chaves = Object.keys(args).filter(k => args[k] !== null && args[k] !== undefined);
  const valores = chaves.map(k => TIPOS[k] === 'jsonb' ? JSON.stringify(args[k]) : args[k]);
  try {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid.replace(/[^0-9a-f-]/g, '')}', false);`);
    const r = await db.query(`SELECT public.${m[1]}(${chaves.map((k, i) => `${k} => $${i + 1}::${TIPOS[k]}`).join(', ')}) AS x`, valores);
    return json(200, r.rows[0].x);
  } catch (e) { return json(400, { code: e.code, message: e.message }); }
  finally { await db.exec('RESET ROLE'); }
}

function servir(dir, route) {
  const url = new URL(route.request().url());
  const arquivo = path.join(dir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!arquivo.startsWith(dir) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) return route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(dir, 'index.html')) });
  const tipo = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' }[path.extname(arquivo)] || 'application/octet-stream';
  return route.fulfill({ status: 200, contentType: tipo, body: fs.readFileSync(arquivo) });
}

async function entrar(browser, dir, db, email, viewport = { width: 1366, height: 820 }, { rapido = false } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.erros = [];
  page.on('pageerror', e => page.erros.push(e.message));
  await page.route(APP + '/**', r => servir(dir, r));
  await page.route(QA + '/**', r => supabase(db, r));
  await page.goto(APP + '/', { waitUntil: 'networkidle' });
  // Espera a restauração de sessão do carregamento terminar, como acontece com um usuário real.
  if (!rapido) await page.waitForTimeout(1500);
  await page.fill('#gate-usuario-input', email);
  await page.fill('#gate-senha-input', 'senha-sintetica');
  await page.click('#btn-entrar-gate');
  await page.waitForSelector('#barra-producao [data-cs=abrir]', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => document.body.dataset.sessaoProducao === 'ativa', null, { timeout: 20000 });
  await page.evaluate(() => window.MartinsCadastrosServidor.abrir());
  await page.waitForSelector('#cs-painel .cs-aba');
  return page;
}
async function aba(page, titulo) {
  await page.click(`#cs-painel .cs-aba:text-is("${titulo}")`);
  await page.waitForFunction(t => document.querySelector('[data-cs=status]')?.textContent.startsWith(t + ':'), titulo);
}
async function novo(page, campos) {
  await page.click('#cs-painel button:text-is("+ Novo")');
  for (const [id, valor] of Object.entries(campos)) {
    const tag = await page.$eval('#cs-' + id, n => n.tagName + (n.type === 'checkbox' ? ':cb' : ''));
    if (tag === 'SELECT') await page.selectOption('#cs-' + id, valor.startsWith('label:') ? { label: valor.slice(6) } : valor);
    else if (tag.endsWith(':cb')) { if (valor) await page.check('#cs-' + id); }
    else await page.fill('#cs-' + id, valor);
  }
  await page.click('#cs-painel button:text-is("Salvar no servidor")');
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'martins-e2e-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  fs.cpSync(path.join(raiz, 'dist-producao-fonte'), path.join(tmp, 'dist-producao-fonte'), { recursive: true });
  const b = spawnSync(process.execPath, [path.join(tmp, 'scripts/preparar-build-qa.cjs')], { cwd: tmp, encoding: 'utf8',
    env: { PATH: process.env.PATH, VITE_SUPABASE_QA_ANON_KEY: 'sb_publishable_CHAVE_SINTETICA_E2E', VITE_MARTINS_QA_GRAVACAO: 'HABILITADA' } });
  if (b.status !== 0) throw Error('build QA falhou: ' + b.stderr);
  const dir = path.join(tmp, 'dist-qa');
  const db = await banco();
  const browser = await chromium.launch();
  try {
    console.log('Master');
    const pm = await entrar(browser, dir, db, 'master@teste.invalid');
    check(await pm.$eval('[data-cs=empresa]', n => n.textContent.includes('Master') && !n.textContent.includes('somente leitura')), 'painel abre como Master, com gravação habilitada');
    await aba(pm, 'Centros de custo');
    await novo(pm, { codigo: 'ADM-01', nome: 'Administrativo Sede', tipo: 'administrativo' });
    await pm.waitForSelector('#cs-painel td:text-is("ADM-01")');
    check(true, 'cria centro de custo e ele aparece na lista (relido do servidor)');
    await aba(pm, 'Fornecedores');
    await novo(pm, { nome: 'Fornecedor Teste', documento: '11.222.333/0001-81' });
    await pm.waitForSelector('#cs-painel td:text-is("11222333000181")');
    check(true, 'cria fornecedor com CNPJ normalizado pelo servidor');
    await novo(pm, { nome: 'Duplicado', documento: '11222333000181' });
    await pm.waitForFunction(() => /Já existe um cadastro/.test(document.querySelector('.cs-erro')?.textContent || ''));
    check(true, 'CNPJ duplicado mostra mensagem clara e não grava');
    await pm.click('#cs-painel button:text-is("Cancelar")');

    await aba(pm, 'Despesas');
    await novo(pm, { descricao: 'Honorários sigilosos', valor_centavos: '1.500,00', competencia: '2026-11-10', classificacao: 'administrativa',
      centro_custo_id: 'label:ADM-01 · Administrativo Sede', fornecedor_id: 'label:Fornecedor Teste', confidencial: true });
    await pm.waitForSelector('#cs-painel .cs-confidencial');
    check(await pm.$eval('#cs-painel tbody', n => n.textContent.includes('R$') && n.textContent.includes('1.500,00')), 'despesa confidencial criada e exibida com valor em reais');
    const linha = (await db.query(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='despesas'`)).rows[0].dados;
    check(linha.confidencial === true && linha.estado === 'pendente_conferencia' && linha.valor_centavos === 150000, 'no banco: confidencial, pendente de conferência, 150000 centavos');
    await pm.fill('#cs-painel .cs-estado input', 'Conferido com contrato');
    await pm.click('#cs-painel .cs-estado button:text-is("Aprovar")');
    await pm.waitForSelector('#cs-painel .cs-aprovado');
    check(true, 'Master aprova pela tela e o selo muda para Aprovado');
    await pm.click('#cs-painel button:text-is("Calcular")');
    await pm.waitForFunction(() => /Total do período: R\$\s?1\.500,00/.test(document.querySelector('.cs-totais-saida')?.textContent || ''));
    check(true, 'totais do período mostram a despesa no centro de custo para o Master');
    check(pm.erros.length === 0, 'nenhuma exceção JavaScript na sessão do Master' + (pm.erros.length ? ': ' + pm.erros.join(' | ') : ''));

    console.log('Lançador Financeiro (celular)');
    const pl = await entrar(browser, dir, db, 'lancador@teste.invalid', { width: 390, height: 844 });
    const abas = await pl.$$eval('#cs-painel .cs-aba', ns => ns.map(n => n.textContent));
    check(abas.length === 1 && abas[0] === 'Despesas', 'lançador vê só a aba Despesas (permissão do servidor)');
    await aba(pl, 'Despesas');
    check(await pl.$eval('#cs-painel tbody', n => !n.textContent.includes('sigilosos') && !n.textContent.includes('1.500')), 'lançador NÃO vê a despesa confidencial');
    await pl.click('#cs-painel button:text-is("+ Novo")');
    check(await pl.$('#cs-confidencial') === null, 'formulário do lançador não oferece a opção confidencial');
    check((await pl.$$eval('#cs-centro_custo_id option', os => os.map(o => o.textContent))).includes('ADM-01 · Administrativo Sede'), 'centro de custo é escolhido de lista');
    await pl.click('#cs-painel button:text-is("Cancelar")');
    await novo(pl, { descricao: 'Material de escritório', valor_centavos: '89,90', competencia: '2026-11-12', classificacao: 'administrativa', centro_custo_id: 'label:ADM-01 · Administrativo Sede' });
    await pl.waitForFunction(() => /Material de escritório/.test(document.querySelector('#cs-painel tbody')?.textContent || ''));
    check(await pl.$eval('#cs-painel tbody', n => n.textContent.includes('Pendente de conferência') && !n.textContent.includes('Aprovar')), 'despesa do lançador fica pendente e ele não tem botão de aprovar');
    check(await pl.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sem rolagem horizontal no celular (390 px)');
    check(pl.erros.length === 0, 'nenhuma exceção JavaScript na sessão do lançador' + (pl.erros.length ? ': ' + pl.erros.join(' | ') : ''));

    console.log('Persistência após recarregar');
    const pm2 = await entrar(browser, dir, db, 'master@teste.invalid', undefined, { rapido: true });
    check(true, 'login logo após abrir a página não sofre "Sessão alterada" (rotina legada não derruba a sessão)');
    await aba(pm2, 'Despesas');
    check(await pm2.$eval('#cs-painel tbody', n => n.textContent.includes('sigilosos') && n.textContent.includes('Material de escritório')), 'nova sessão do Master vê as duas despesas (dados vêm do servidor)');

    console.log('Toast de erro sobre o modal');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pm2.evaluate(() => { document.getElementById('form-novo-colaborador').reset(); document.getElementById('modal-novo-colaborador').classList.remove('hidden'); });
    await pm2.fill('#nc-nome', 'CPF Errado'); await pm2.fill('#nc-funcao', 'Servente'); await pm2.fill('#nc-cpf', '123');
    await pm2.click('#btn-salvar-colaborador');
    await pm2.waitForFunction(() => /CPF inválido/.test(document.getElementById('toast-msg')?.textContent || '') && getComputedStyle(document.getElementById('toast')).opacity === '1', null, { timeout: 8000 });
    // O toast não captura cliques (pointer-events: none); para medir a ordem de camadas, habilita só durante a medição.
    const topo = await pm2.evaluate(() => { const el = document.getElementById('toast'); el.style.setProperty('pointer-events', 'auto', 'important'); const t = el.getBoundingClientRect(); const n = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); el.style.removeProperty('pointer-events'); return !!n?.closest('#toast'); });
    if (process.env.E2E_PRINTS) await pm2.screenshot({ path: path.join(process.env.E2E_PRINTS, 'toast-sobre-modal.png') });
    check(topo, 'com o modal aberto, o toast de erro fica na frente do desfoque (legível)');
    check(await pm2.$eval('#toast', n => n.getAttribute('role') === 'alert' && n.style.borderColor !== ''), 'toast de erro é anunciado (role=alert) e destacado');
    await pm2.fill('#nc-cpf', '111.444.777-35');
    await pm2.click('#btn-salvar-colaborador');
    await pm2.waitForFunction(() => /Salvamento confirmado/.test(document.getElementById('producao-status')?.textContent || ''), null, { timeout: 15000 });
    check((await db.query(`SELECT 1 FROM martins_producao_v1.registros WHERE modulo='funcionarios' AND dados->>'nome'='CPF Errado'`)).rows.length === 1,
      'depois de um erro do servidor, corrigir e salvar funciona (a operação recusada não fica travando o módulo)');

    console.log('Botão MENU livre de sobreposição');
    const menuLivre = async pg => pg.evaluate(() => {
      const b = document.getElementById('btn-abrir-drawer-header'); const R = b.getBoundingClientRect(); const ruins = [];
      for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.15, 0.5, 0.85]) { const n = document.elementFromPoint(R.left + R.width * fx, R.top + R.height * fy); if (!(n === b || b.contains(n))) ruins.push(n?.id || n?.tagName); }
      return ruins;
    });
    check((await menuLivre(pm2)).length === 0, 'computador: os 9 pontos do botão MENU respondem ao clique (toast oculto não bloqueia)');
    await pm2.evaluate(() => window.showToast('Teste de aviso', 'error'));
    await pm2.waitForTimeout(400);
    check((await menuLivre(pm2)).length === 0, 'computador: MENU continua clicável com um toast visível');
    check(await pm2.evaluate(() => document.getElementById('toast').getBoundingClientRect().top > document.getElementById('main-app-header').getBoundingClientRect().bottom), 'toast aparece embaixo, longe do cabeçalho');
    await pl.evaluate(() => window.MartinsCadastrosServidor.fechar()); await pl.waitForTimeout(300);
    check((await menuLivre(pl)).length === 0, 'celular (390 px): os 9 pontos do botão MENU respondem ao clique');
    await pm2.click('#btn-abrir-drawer-header');
    await pm2.waitForTimeout(500);
    check(await pm2.evaluate(() => { const d = document.querySelector('#drawer-menu, #menu-drawer, [id*=drawer]:not(#btn-abrir-drawer-header):not(#btn-fechar-drawer)'); return !!d && getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().width > 0; }), 'clicar em MENU abre o menu lateral');
    await pm2.keyboard.press('Escape'); await pm2.evaluate(() => document.getElementById('btn-fechar-drawer')?.click());

    console.log('F5 e cadastro de funcionário pelo RH (módulo v1)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pm2.reload({ waitUntil: 'networkidle' });
    await pm2.waitForFunction(() => document.body.dataset.sessaoProducao === 'ativa' && !!window.obterContextoSegurancaAutenticadoWork?.(), null, { timeout: 20000 });
    await pm2.waitForTimeout(2500);
    check(await pm2.evaluate(() => !!window.obterContextoSegurancaAutenticadoWork?.() && getComputedStyle(document.getElementById('tela-login-gate')).display === 'none'), 'depois do F5 a sessão continua ativa (não volta para o login)');
    await pm2.evaluate(() => { document.getElementById('form-novo-colaborador').reset(); document.getElementById('modal-novo-colaborador').classList.remove('hidden'); });
    await pm2.fill('#nc-nome', 'Fulano de Teste'); await pm2.fill('#nc-funcao', 'Pedreiro'); await pm2.fill('#nc-cpf', '529.982.247-25');
    await pm2.click('#btn-salvar-colaborador');
    await pm2.waitForSelector('dialog[open] input[type=password]', { timeout: 10000 });
    check(true, 'salvar com edição bloqueada abre a confirmação de senha (não falha em silêncio)');
    await pm2.fill('dialog[open] input[type=password]', 'senha-sintetica');
    await pm2.click('dialog[open] button[type=submit]');
    await pm2.waitForFunction(() => /Salvamento confirmado/.test(document.getElementById('producao-status')?.textContent || ''), null, { timeout: 15000 });
    const func = (await db.query(`SELECT dados->>'nome' nome FROM martins_producao_v1.registros WHERE modulo='funcionarios' AND dados->>'nome'='Fulano de Teste'`)).rows;
    check(func.length === 1, 'após a senha, o funcionário é gravado no servidor e confirmado na tela');
    check(await pm2.evaluate(() => window.getColaboradoresDb().some(c => c.nome === 'Fulano de Teste')), 'a lista de funcionários do sistema passa a trazer o novo funcionário');
    check(await pm2.evaluate(() => [...document.querySelectorAll('#view-colaboradores table, #view-colaboradores [id*=quadro], #view-colaboradores tbody')].some(n => n.textContent.includes('Fulano de Teste'))), 'o nome aparece na tela de RH (tabela de funcionários)');
    check(pm2.erros.length === 0, 'nenhuma exceção JavaScript no fluxo F5 + RH' + (pm2.erros.length ? ': ' + pm2.erros.join(' | ') : ''));

    console.log('Modal "Cadastrar Novo Colaborador" (RH/SST)');
    await pm2.evaluate(() => { window.aprimorarInterfaceRhColaboradoresESst?.(); window.abrirModalEditarColaborador('NOVO'); });
    await pm2.waitForSelector('#modal-editar-colaborador:not(.hidden) #edit-colab-salario');
    const padroes = await pm2.evaluate(() => ['edit-colab-salario', 'edit-colab-admissao', 'edit-colab-aso-venc', 'edit-colab-cnh-validade', 'edit-colab-nr10-venc', 'edit-colab-nr18-venc', 'edit-colab-nr35-venc'].filter(id => document.getElementById(id)?.value));
    check(padroes.length === 0, 'colaborador novo não vem com salário, admissão ou validades de ASO/CNH/NR inventados' + (padroes.length ? ': ' + padroes.join(', ') : ''));
    const sobreposicoes = await pm2.evaluate(() => {
      const campos = [...document.querySelectorAll('#modal-editar-colaborador input:not([type=hidden]), #modal-editar-colaborador select, #modal-editar-colaborador textarea')].filter(n => n.offsetParent);
      const r = campos.map(n => [n.id, n.getBoundingClientRect()]);
      const ruins = [];
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
        const [a, A] = r[i], [b, B] = r[j];
        if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) ruins.push(a + '×' + b);
      }
      const estreitos = r.filter(([id, R]) => /nr\d+-venc|aso|cnh/.test(id) && R.width < 120).map(([id]) => id);
      return { ruins, estreitos };
    });
    if (process.env.E2E_PRINTS) await pm2.screenshot({ path: path.join(process.env.E2E_PRINTS, 'modal-novo-colaborador.png') });
    check(sobreposicoes.ruins.length === 0, 'nenhum campo do modal invade outro' + (sobreposicoes.ruins.length ? ': ' + sobreposicoes.ruins.join(', ') : ''));
    check(sobreposicoes.estreitos.length === 0, 'campos de data de ASO/CNH/NR têm largura legível' + (sobreposicoes.estreitos.length ? ': ' + sobreposicoes.estreitos.join(', ') : ''));
    await pm2.fill('#edit-colab-nome', 'Beltrano SST'); await pm2.fill('#edit-colab-funcao', 'Eletricista');
    await pm2.fill('#edit-colab-salario', '3100.50'); await pm2.fill('#edit-colab-pix', 'beltrano@exemplo.invalid'); await pm2.selectOption('#edit-colab-tipo-pix', 'Email');
    await pm2.fill('#edit-colab-aso-venc', '2027-01-31'); await pm2.fill('#edit-colab-nr10-venc', '2026-12-15');
    await pm2.$eval('#form-editar-colaborador', f => f.requestSubmit());
    await pm2.waitForFunction(() => /Salvamento confirmado/.test(document.getElementById('producao-status')?.textContent || ''), null, { timeout: 15000 })
      .catch(async e => { console.log('    status:', await pm2.$eval('#producao-status', n => n.textContent), '| toast:', await pm2.$eval('#toast-msg', n => n.textContent)); throw e; });
    const criados = (await db.query(`SELECT id, dados FROM martins_producao_v1.registros WHERE modulo='funcionarios' AND dados->>'nome'='Beltrano SST'`)).rows;
    check(criados.length === 1, 'cadastro pelo modal "Cadastrar Novo Colaborador" cria o funcionário (antes falhava com "Registro não encontrado")');
    const d = criados[0]?.dados || {};
    check(Number(d.salarioBase) === 3100.5 && d.chavePix === 'beltrano@exemplo.invalid' && d.tipoChavePix === 'Email' && d.asoValidade === '2027-01-31' && d.nr10Validade === '2026-12-15' && d.cnhValidade === null,
      'salário, PIX, ASO e NR-10 são gravados no servidor; campo vazio fica vazio');
    await pm2.evaluate(id => window.abrirModalEditarColaborador(id), criados[0].id);
    await pm2.waitForTimeout(300);
    check(await pm2.evaluate(() => document.getElementById('edit-colab-salario').value === '3100.5' || document.getElementById('edit-colab-salario').value === '3100.50') &&
      await pm2.$eval('#edit-colab-aso-venc', n => n.value === '2027-01-31'), 'ao reabrir, os dados de RH/SST voltam do servidor');
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
