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
  for (const d of ['supabase/producao/migrations', 'supabase/v2/migrations', 'supabase/v3/migrations', 'supabase/v4/migrations', 'supabase/v5/migrations', 'supabase/v6/migrations', 'supabase/v7/migrations', 'supabase/v8/migrations', 'supabase/v9/migrations', 'supabase/v10/migrations', 'supabase/v11/migrations', 'supabase/v12/migrations', 'supabase/v13/migrations'])
    for (const f of fs.readdirSync(path.join(raiz, d)).sort()) await db.exec(sql(d + '/' + f));
  const [M, L] = Object.values(USUARIOS);
  await db.exec(`INSERT INTO auth.users VALUES ('${M}','master@teste.invalid'),('${L}','lancador@teste.invalid');
    INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${M}','${E}','Master Teste'),('${L}','${E}','Lançador Teste');
    INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${M}','master',true),('${E}','${L}','operacional',true);
    INSERT INTO martins_producao_v1.permissoes(usuario_id, empresa_id, modulo, ler, criar, editar) VALUES ('${L}','${E}','despesas',true,true,true);`);
  return db;
}

const TIPOS = { e: 'uuid', r: 'uuid', apos: 'uuid', op: 'uuid', v: 'bigint', limite: 'integer', d: 'jsonb', itens: 'jsonb', de: 'date', ate: 'date', m: 'text', estado: 'text', motivo: 'text', tipo: 'text', produto: 'uuid', origem: 'uuid', requisicao: 'uuid', recebimento: 'uuid', backup: 'jsonb', usuario: 'uuid', ativo: 'boolean', email: 'text', nome: 'text', conta: 'uuid', valor: 'bigint', data: 'date', conta_bancaria: 'uuid', obs: 'text', baixa: 'uuid', destino: 'uuid', qtd: 'bigint', ref: 'uuid', pedido: 'uuid', deposito: 'uuid', documento: 'jsonb', obra: 'uuid', rdo: 'uuid', consumo: 'uuid' };
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
  const chaves = Object.keys(args).filter(k => args[k] !== undefined); // null é enviado, como no PostgREST
  const valores = chaves.map(k => args[k] === null ? null : TIPOS[k] === 'jsonb' ? JSON.stringify(args[k]) : args[k]);
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
  page.rotuloAntesDoLogin = await page.evaluate(() => { const b = document.getElementById('barra-sessao-auditoria'); return b && getComputedStyle(b).display !== 'none' ? document.getElementById('audit-session-text').textContent : ''; });
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

    console.log('Obra pelo cadastro completo da Engenharia');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('clientes'));
    await pm2.waitForFunction(() => /Clientes:/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    await novo(pm2, { nome: 'Cliente A', documento: '11.222.333/0001-81' });
    await pm2.waitForSelector('#cs-painel td:text-is("Cliente A")');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pm2.waitForTimeout(1500);
    await pm2.evaluate(() => window.abrirModalCadastroObraCompleto());
    await pm2.waitForSelector('#modal-cadastro-obra-completo:not(.hidden) #obra-inp-nome', { timeout: 10000 });
    const opcoesCliente = await pm2.$$eval('#obra-inp-cliente-select option', os => os.map(o => o.textContent.trim()));
    check(opcoesCliente.some(t => t === 'Cliente A'), 'cliente da obra é escolhido entre os clientes do servidor');
    await pm2.fill('#obra-inp-nome', 'QA Obra Engenharia');
    await pm2.selectOption('#obra-inp-status', 'Em andamento');
    await pm2.selectOption('#obra-inp-cliente-select', { label: 'Cliente A' });
    await pm2.$eval('#obra-inp-data-inicio', n => { n.value = '2026-11-01'; }); await pm2.$eval('#obra-inp-data-fim', n => { n.value = '2027-05-31'; });
    await pm2.$eval('#obra-inp-valor', n => { n.value = '250000'; });
    await pm2.$eval('#form-cadastro-obra-completo', f => f.requestSubmit());
    await pm2.waitForFunction(() => /Salvamento confirmado/.test(document.getElementById('producao-status')?.textContent || ''), null, { timeout: 15000 })
      .catch(async e => { console.log('    status:', await pm2.$eval('#producao-status', n => n.textContent)); throw e; });
    const obraDb = (await db.query(`SELECT id, dados FROM martins_producao_v1.registros WHERE modulo='obras' AND dados->>'nome'='QA Obra Engenharia'`)).rows;
    check(/^OBR-[0-9A-F]{8}$/.test(obraDb[0]?.dados.codigo || ''), 'obra nova recebe código único (OBR-…), não o contador local "1"');
    check(obraDb.length === 1 && Number(obraDb[0].dados.valorContratado) === 250000 && obraDb[0].dados.clienteResponsavel === 'Cliente A' && obraDb[0].dados.cliente_id,
      'obra da Engenharia é gravada no servidor com cliente e valor (antes ficava só no navegador)');
    await pm2.reload({ waitUntil: 'networkidle' });
    await pm2.waitForFunction(() => document.body.dataset.sessaoProducao === 'ativa' && document.body.dataset.empresaProducao === 'ativa', null, { timeout: 20000 });
    await pm2.waitForFunction(id => [...document.querySelectorAll('#obra-select option')].some(o => o.value === id), obraDb[0].id, { timeout: 15000 })
      .catch(() => {});
    const seletores = await pm2.evaluate(id => ({
      rdo: [...document.querySelectorAll('#obra-select option')].some(o => o.value === id),
      lista: window.obterCatalogoUnificadoObrasErp().some(o => o.nome === 'QA Obra Engenharia'),
    }), obraDb[0].id);
    check(seletores.lista, 'depois de recarregar, a obra continua na lista de obras (não some)');
    check(seletores.rdo, 'a obra aparece no seletor obrigatório do RDO');
    await pm2.evaluate(() => window.navegarParaSecao('frequencia'));
    await pm2.waitForTimeout(1500);
    const freq = await pm2.evaluate(() => { const sels = [...document.querySelectorAll('.sel-destino-ponto')]; return { linhas: sels.length, comObra: sels.length > 0 && sels.every(s => [...s.options].some(o => o.textContent.includes('QA Obra Engenharia'))), outras: [...new Set(sels.flatMap(s => [...s.options].map(o => o.value)).filter(v => v.startsWith('OBRA:')))].length }; });
    check(freq.linhas > 0 && freq.comObra, 'Frequência: a obra aparece como destino em todas as linhas de funcionário (' + freq.linhas + ' linha(s))');
    check(freq.outras === 1, 'Frequência: só lista obras do servidor (sem obras locais/fictícias): ' + freq.outras + ' obra(s)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('despesas'));
    await pm2.waitForFunction(() => /Despesas:/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    await pm2.click('#cs-painel button:text-is("+ Novo")');
    check((await pm2.$$eval('#cs-obra_id option', os => os.map(o => o.textContent))).some(t => t.includes('QA Obra Engenharia')), 'a obra aparece para vincular em Despesa de obra');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Nenhum cadastro só no navegador (formulários legados)');
    const semRastroLocal = async (pg, texto) => pg.evaluate(t => Object.keys(localStorage).filter(k => (localStorage.getItem(k) || '').includes(t)), texto);
    const abrirLegado = async (pg, formId) => pg.evaluate(f => { const form = document.getElementById(f); const modal = form.closest('[id^=modal-]'); if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; } return !!form; }, formId);
    check(await abrirLegado(pm2, 'form-novo-cliente-rapido'), 'formulário legado de cliente rápido existe na tela');
    await pm2.fill('#cli-inp-nome', 'Cliente Legado'); await pm2.fill('#cli-inp-doc', '111.444.777-35'); await pm2.fill('#cli-inp-tel', '(35) 0000-0000');
    await pm2.$eval('#form-novo-cliente-rapido', f => f.requestSubmit());
    await pm2.waitForSelector('#cs-painel .cs-form #cs-nome', { timeout: 10000 });
    check(await pm2.$eval('#cs-nome', n => n.value === 'Cliente Legado') && await pm2.$eval('#cs-documento', n => n.value === '111.444.777-35'),
      'o envio do formulário legado abre o cadastro do servidor já preenchido');
    await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForSelector('#cs-painel td:text-is("Cliente Legado")');
    check((await db.query(`SELECT 1 FROM martins_producao_v1.registros WHERE modulo='clientes' AND dados->>'nome'='Cliente Legado'`)).rows.length === 1, 'o cliente é gravado no servidor');
    check((await semRastroLocal(pm2, 'Cliente Legado')).length === 0, 'nada do cliente fica gravado no navegador (localStorage)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    await abrirLegado(pm2, 'form-adicionar-feriado');
    await pm2.$eval('#inp-novo-feriado-data', n => { n.value = '2026-12-25'; }); await pm2.fill('#inp-novo-feriado-nome', 'Natal');
    await pm2.$eval('#form-adicionar-feriado', f => f.requestSubmit());
    await pm2.waitForSelector('#cs-painel .cs-form #cs-data', { timeout: 10000 });
    await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForSelector('#cs-painel td:text-is("Natal")');
    check((await db.query(`SELECT 1 FROM martins_producao_v1.registros WHERE modulo='feriados' AND dados->>'data'='2026-12-25'`)).rows.length === 1, 'feriado do formulário legado vai para o servidor (módulo v3)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    await abrirLegado(pm2, 'form-novo-fiscal');
    await pm2.fill('#nf-nome', 'Fiscal Teste'); await pm2.fill('#nf-usuario', 'fiscal.teste.e2e'); await pm2.fill('#nf-orgao', 'Prefeitura'); await pm2.fill('#nf-senha', 'senha-provisoria-e2e');
    await pm2.$eval('#form-novo-fiscal', f => f.requestSubmit());
    await pm2.waitForFunction(() => /Supabase Auth/.test(document.getElementById('toast-msg')?.textContent || ''), null, { timeout: 8000 });
    check((await semRastroLocal(pm2, 'senha-provisoria-e2e')).length === 0 && (await semRastroLocal(pm2, 'fiscal.teste.e2e')).length === 0,
      'cadastro de fiscal (login com senha) é bloqueado e nada fica no navegador');

    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar()); await pm2.waitForTimeout(2600);
    const bloqueio = await pm2.evaluate(() => {
      const antes = window.cadastrarOuEditarVendedorComercial({ nome: 'Vendedor Local' });
      window.cadastrarOuEditarVendedorComercial = () => ({ sucesso: true });
      const depois = window.cadastrarOuEditarVendedorComercial({ nome: 'Vendedor Local' });
      return { antes: antes.codigo, depois: depois.codigo, painel: !document.getElementById('cs-painel').hidden };
    });
    check(bloqueio.antes === 'CADASTRO_NO_SERVIDOR' && bloqueio.depois === 'CADASTRO_NO_SERVIDOR', 'função legada de cadastro continua bloqueada mesmo se o código tentar redefini-la');
    check(!bloqueio.painel, 'chamada automática (sem ação da pessoa) é recusada em silêncio, sem abrir o painel');
    check((await semRastroLocal(pm2, 'Vendedor Local')).length === 0, 'nenhum vendedor local é gravado');

    console.log('Relatório de homologação — rodada 2');
    check(pm2.rotuloAntesDoLogin === '', '03: tela de login não mostra identidade de sessão antes da confirmação');
    check(await pm2.$eval('#audit-session-text', n => n.textContent.startsWith('master@teste.invalid')), '03: após o login, o rótulo mostra a identidade real da sessão');
    await pm2.evaluate(() => window.navegarParaSecao?.('painel'));
    await pm2.evaluate(() => window.renderizarDashboardExecutivo());
    await pm2.waitForFunction(() => document.querySelectorAll('#dash-servidor .ds-card').length >= 4 && !/Carregando/.test(document.getElementById('dash-servidor').textContent), null, { timeout: 15000 });
    if (process.env.E2E_PRINTS) await pm2.screenshot({ path: path.join(process.env.E2E_PRINTS, 'painel.png') });
    const dash = await pm2.evaluate(() => { const t = document.getElementById('view-painel').textContent; const card = [...document.querySelectorAll('#dash-servidor .ds-card')].find(c => /Obras em andamento/.test(c.textContent)); return { t, obras: card?.querySelector('strong')?.textContent }; });
    const obrasServidor = (await db.query(`SELECT count(DISTINCT id)::int n FROM martins_producao_v1.registros WHERE modulo='obras'`)).rows[0].n;
    check(dash.obras === String(obrasServidor), '39: painel conta as obras do servidor por id (' + dash.obras + ' = ' + obrasServidor + ')');
    check(await pm2.evaluate(() => /Perfil: Master/.test(document.body.innerText)), 'barra de contexto mostra o perfil real (Master)');
    check(!/30 Obras|Henrique Camilo|142\.850|184\.500|152\.770|Média física: 59%/.test(dash.t) && /Olá, Master Teste/.test(dash.t), '39: painel sem números de demonstração e com o nome real do usuário');
    const textoPagina = await pm2.evaluate(() => document.body.innerText);
    check(!/100% Sincronizado|Local \(Aguardando Servidor\)/.test(textoPagina) && await pm2.$eval('#btn-sync-nuvem', n => /Servidor/.test(n.textContent)), '04: um único indicador de sincronização, coerente ("Servidor")');
    const baixar = async pg => { const [d] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.gerarRelatorioFinanceiroCsv())]); return fs.readFileSync(await d.path(), 'utf8'); };
    const csvM = await baixar(pm2);
    const linhasM = csvM.replace(/^\ufeff/, '').split('\r\n'); const corpoM = linhasM.slice(linhasM.findIndex(l => l.startsWith('Competência')) + 1);
    const despServ = (await db.query(`SELECT count(*)::int n, sum((dados->>'valor_centavos')::bigint)::bigint t FROM martins_producao_v1.registros WHERE modulo='despesas'`)).rows[0];
    check(corpoM.length === despServ.n && csvM.includes('Linhas;' + despServ.n) && corpoM.some(l => l.includes('sigilosos')), '40: CSV do Master tem todas as despesas do servidor (' + corpoM.length + ' linhas), inclusive a confidencial');
    const csvL = await baixar(pl);
    check(!csvL.includes('sigilosos') && !csvL.includes('Confidencial') && csvL.includes('Material de escritório'), '40: CSV do lançador traz só as próprias despesas, sem a confidencial e sem a coluna');

    console.log('Financeiro');
    await pm2.evaluate(() => window.navegarParaSecao('financeiro'));
    await pm2.waitForFunction(() => { const sec = document.getElementById('financeiro-servidor'); return sec && sec.offsetParent !== null && sec.querySelectorAll('.fin-card').length === 3; }, null, { timeout: 15000 });
    if (process.env.E2E_PRINTS) await pm2.screenshot({ path: path.join(process.env.E2E_PRINTS, 'financeiro.png') });
    const fin = await pm2.evaluate(() => ({ atalhos: [...document.querySelectorAll('#financeiro-servidor .fin-atalho b')].map(n => n.textContent), pend: document.querySelector('#financeiro-servidor .fin-card strong').textContent, vazio: getComputedStyle(document.getElementById('financeiro-servidor')).display }));
    check(fin.vazio !== 'none' && fin.atalhos.length === 4, 'Financeiro abre (não fica vazio) e mostra os 4 atalhos para o Master');
    check(fin.pend === '1', 'resumo do Financeiro conta a despesa pendente de conferência (vinda do servidor)');
    await pm2.click('#financeiro-servidor .fin-atalho:has-text("Despesas")');
    await pm2.waitForFunction(() => document.querySelector('#cs-painel .cs-aba[aria-selected=true]')?.textContent === 'Despesas' && /Despesas:/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    check(true, 'atalho Despesas abre o painel já na aba Despesas');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pl.evaluate(() => window.navegarParaSecao('financeiro'));
    await pl.waitForFunction(() => document.querySelectorAll('#financeiro-servidor .fin-card').length === 3, null, { timeout: 15000 });
    const finL = await pl.evaluate(() => ({ atalhos: [...document.querySelectorAll('#financeiro-servidor .fin-atalho b')].map(n => n.textContent), texto: document.getElementById('financeiro-servidor').textContent }));
    check(finL.atalhos.join() === 'Despesas' && finL.texto.includes('Somente os lançados por você') && !finL.texto.includes('1.500'), 'lançador (celular) vê só o atalho de Despesas e apenas os próprios valores');
    check(await pl.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Financeiro sem rolagem horizontal no celular');

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

    console.log('Estoque (v4): cenário A=10 / B=20');
    const PA = '00000000-0000-4000-8000-0000000000a1', PB = '00000000-0000-4000-8000-0000000000b1', DA = '00000000-0000-4000-8000-0000000000d1', DB = '00000000-0000-4000-8000-0000000000d2', M = USUARIOS['master@teste.invalid'];
    for (const [mod, rid, dd] of [['produtos', PA, { codigo: 'A', descricao: 'Produto A', ativo: true }], ['produtos', PB, { codigo: 'B', descricao: 'Produto B', ativo: true }], ['depositos', DA, { nome: 'Almoxarifado', principal: true, ativo: true }], ['depositos', DB, { nome: 'Pátio', ativo: true }]])
      await db.query(`INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por) VALUES ($1,$2,$3,1,$4::jsonb,$5,$5)`, [E, mod, rid, JSON.stringify(dd), M]);
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('estoque'));
    await pm2.waitForSelector('#est-tipo', { timeout: 15000 });
    const mover = async (tipo, prod, orig, dest, q) => {
      await pm2.selectOption('#est-tipo', tipo); await pm2.selectOption('#est-produto', prod);
      if (orig) await pm2.selectOption('#est-origem', orig); if (dest) await pm2.selectOption('#est-destino', dest);
      await pm2.fill('#est-qtd', q); await pm2.evaluate(() => { document.querySelector('[data-cs=status]').textContent = ''; }); await pm2.click('#cs-painel button:text-is("Registrar movimento")');
      await pm2.waitForFunction(() => /Estoque: \d+ saldo/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    };
    const saldoTela = async () => pm2.$$eval('#cs-painel section:has(h3:text-is("Saldos (calculados pelo servidor)")) tbody tr', t => Object.fromEntries(t.map(r => [r.children[0].textContent.split(' · ')[0] + '|' + r.children[1].textContent, r.children[2].textContent])));
    await mover('entrada', PA, null, DA, '10'); await mover('entrada', PB, null, DA, '20');
    let st = await saldoTela();
    check(st['A|Almoxarifado'] === '10' && st['B|Almoxarifado'] === '20', 'entradas pela tela: A=10 e B=20 (saldo calculado pelo servidor)');
    await mover('saida', PA, DA, null, '3');
    st = await saldoTela();
    check(st['A|Almoxarifado'] === '7' && st['B|Almoxarifado'] === '20', 'baixar 3 de A: A=7 e B continua 20');
    await pm2.fill('#est-qtd', '99'); await pm2.selectOption('#est-tipo', 'saida'); await pm2.selectOption('#est-produto', PA); await pm2.selectOption('#est-origem', DA);
    await pm2.click('#cs-painel button:text-is("Registrar movimento")');
    await pm2.waitForFunction(() => /Saldo insuficiente/.test(document.querySelector('#cs-painel .cs-erro')?.textContent || ''));
    check((await saldoTela())['A|Almoxarifado'] === '7', 'baixa maior que o saldo é recusada com mensagem clara e o saldo não muda');
    await pm2.fill('#cs-painel tbody tr:has-text("Saída") input', 'baixa lançada por engano');
    await pm2.click('#cs-painel tbody tr:has-text("Saída") button:text-is("Estornar")');
    await pm2.waitForFunction(() => [...document.querySelectorAll('#cs-painel tbody tr')].some(r => /Estorno/.test(r.textContent)));
    st = await saldoTela();
    check(st['A|Almoxarifado'] === '10' && st['B|Almoxarifado'] === '20', 'estornar pela tela volta a A=10 e B=20');
    check(await pm2.$$eval('#cs-painel tbody tr', t => t.filter(r => /Saída/.test(r.textContent) && /estornado/.test(r.textContent) && !r.querySelector('button')).length === 1), 'a saída estornada não oferece novo estorno (sem efeito duplicado)');
    await mover('transferencia', PB, DA, DB, '5');
    st = await saldoTela();
    check(st['B|Almoxarifado'] === '15' && st['B|Pátio'] === '5', 'transferência entre depósitos: 15 + 5 = 20 (total preservado)');
    check((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos'`)).rows[0].n === 5, 'no banco: uma movimentação por evento (5; a baixa recusada não grava nada)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pm2.evaluate(() => { const f = document.getElementById('form-movimento-estoque'); const m = f.closest('[id^=modal-]'); if (m) { m.classList.remove('hidden'); m.style.display = 'flex'; } f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
    await pm2.waitForSelector('#est-tipo', { timeout: 10000 });
    check((await semRastroLocal(pm2, 'estoque_movimentos')).length === 0, 'o formulário antigo de movimentação abre o estoque do servidor (nada local)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Compras (v5): pedido -> aprovação -> recebimento');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('compras'));
    await pm2.waitForSelector('#cp-fornecedor', { timeout: 15000 });
    await pm2.selectOption('#cp-fornecedor', { label: 'Fornecedor Teste' }); await pm2.selectOption('#cp-centro', { label: 'ADM-01 · Administrativo Sede' });
    const linhas0 = await pm2.$$('[data-linha]'); const [p0, q0, pr0] = await linhas0[0].$$('select,input');
    await p0.selectOption(PA); await q0.fill('10'); await pr0.fill('5,00');
    await pm2.click('#cs-painel button:text-is("+ Item")');
    const linhas1 = await pm2.$$('[data-linha]'); const [p1, q1, pr1] = await linhas1[1].$$('select,input');
    await p1.selectOption(PB); await q1.fill('4'); await pr1.fill('20,00');
    await pm2.click('#cs-painel button:text-is("Salvar pedido (rascunho)")');
    await pm2.waitForSelector('[data-cp=pedidos] tbody tr:has-text("Rascunho")');
    check(true, 'pedido de compra criado pela tela e relido do servidor (rascunho)');
    check(await pm2.$eval('[data-cp=pedidos] tbody', n => /130,00/.test(n.textContent)), 'total do pedido calculado: 10×5 + 4×20 = R$ 130,00');
    await pm2.fill('[data-cp=pedidos] tbody tr input', 'Conferido com a cotação');
    await pm2.click('[data-cp=pedidos] button:text-is("Aprovar")');
    await pm2.waitForSelector('[data-cp=pedidos] tbody tr:has-text("Aprovado")');
    check(true, 'Master aprova o pedido');
    await pm2.click('[data-cp=pedidos] button:text-is("Receber")');
    await pm2.waitForSelector('#rc-deposito');
    await pm2.selectOption('#rc-deposito', DA); await pm2.fill('#rc-nf', '5501');
    const campos = await pm2.$$('#cs-painel .cs-form input[aria-label^="Quantidade recebida"]'); await campos[0].fill('10'); await campos[1].fill('');
    await pm2.click('#cs-painel button:text-is("Confirmar recebimento")');
    await pm2.waitForSelector('[data-cp=pedidos] tbody tr:has-text("Recebido em parte")');
    const sA = (await db.query(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, PA, DA])).rows[0].s;
    check(Number(sA) === 20000, 'recebimento deu entrada no estoque: A passou de 10 para 20');
    const desp = (await db.query(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='despesas' AND dados->>'documento_numero'='5501'`)).rows;
    check(desp.length === 1 && desp[0].dados.estado === 'pendente_conferencia' && desp[0].dados.valor_centavos === 5000, 'gerou 1 obrigação pendente de conferência de R$ 50,00 vinculada à NF 5501');
    await pm2.click('[data-cp=pedidos] button:text-is("Receber")'); await pm2.waitForSelector('#rc-deposito');
    await pm2.selectOption('#rc-deposito', DA); await pm2.fill('#rc-nf', '5501');
    const campos2 = await pm2.$$('#cs-painel .cs-form input[aria-label^="Quantidade recebida"]'); await campos2[0].fill('4');
    await pm2.click('#cs-painel button:text-is("Confirmar recebimento")');
    await pm2.waitForFunction(() => /nota fiscal já foi recebida/.test(document.querySelector('#cs-painel .cs-erro')?.textContent || ''));
    check((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='despesas' AND dados->>'documento_numero'='5501'`)).rows[0].n === 1, 'a mesma NF não entra duas vezes: mensagem clara e nada duplicado');
    // importação do XML da NF-e no recebimento (o XML só preenche; o servidor decide e grava)
    const CHAVE = '31261112345678000190550010000055021000055021';
    const nfeXml = (nNF, chave, itens) => `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}" versao="4.00"><ide><nNF>${nNF}</nNF></ide><emit><CNPJ>12345678000190</CNPJ><xNome>Fornecedor Teste Ltda</xNome></emit>${itens.map(i => `<det><prod><cProd>${i[0]}</cProd><xProd>${i[0]} item</xProd><qCom>${i[1]}</qCom></prod></det>`).join('')}</infNFe></NFe></nfeProc>`;
    await pm2.setInputFiles('#rc-xml', { name: 'doctype.xml', mimeType: 'text/xml', buffer: Buffer.from('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><x/>') });
    await pm2.waitForFunction(() => /recusado por segurança/.test(document.querySelector('#cs-painel .cs-erro')?.textContent || ''));
    check(true, 'XML com DOCTYPE/ENTITY é recusado por segurança');
    await pm2.setInputFiles('#rc-xml', { name: 'invalido.xml', mimeType: 'text/xml', buffer: Buffer.from('isto não é xml') });
    await pm2.waitForFunction(() => /não é um XML válido/.test(document.querySelector('#cs-painel .cs-erro')?.textContent || ''));
    check(true, 'arquivo que não é XML é recusado com mensagem clara');
    await pm2.setInputFiles('#rc-xml', { name: 'nfe.xml', mimeType: 'text/xml', buffer: Buffer.from(nfeXml('0005502', CHAVE, [['B', '4'], ['ZZZ', '9']])) });
    await pm2.waitForFunction(() => /XML lido: NF 5502/.test(document.querySelector('[data-rc=xml]')?.textContent || ''));
    check(await pm2.$eval('#rc-nf', n => n.value) === '5502' && await pm2.$eval('#rc-chave', n => n.value) === '31261112345678000190550010000055021000055021', 'o XML preenche o número (sem zeros à esquerda) e a chave de acesso');
    check(await pm2.$eval('#cs-painel .cs-form input[aria-label^="Quantidade recebida"]', n => n.value) === '4' && /2 item\(ns\); 1 casado/.test(await pm2.$eval('[data-rc=xml]', n => n.textContent)), 'a quantidade do item casado pelo código (B = 4) é preenchida; o item sem correspondência fica de fora e é avisado');
    await pm2.click('#cs-painel button:text-is("Confirmar recebimento")');
    await pm2.waitForSelector('[data-cp=pedidos] tbody tr:has-text("Recebido"):not(:has-text("em parte"))');
    const rec2 = (await db.query(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='recebimentos_compra' AND dados->>'numero_nf'='5502'`)).rows;
    check(rec2.length === 1 && rec2[0].dados.chave_acesso === CHAVE, 'recebimento gravado no servidor com o número e a chave vindos do XML; pedido concluído');
    // devolução ao fornecedor (v11)
    const saldoB = async () => Number((await db.query(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, PB, DA])).rows[0].s);
    const despNf = () => db.query(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='despesas' AND dados->>'documento_numero'='5502'`).then(r => r.rows[0].dados);
    const antesDev = await saldoB(); const valorAntes = (await despNf()).valor_centavos;
    await pm2.click('#cs-painel tr:has-text("5502") button:text-is("Devolver")');
    await pm2.waitForSelector('#dv-motivo');
    await pm2.click('#cs-painel button:text-is("Confirmar devolução")');
    await pm2.waitForFunction(() => /Informe o motivo da devolução/.test(document.querySelector('#cs-painel .cs-erro')?.textContent || ''));
    await pm2.fill('#dv-motivo', 'Material com defeito'); await pm2.fill('#cs-painel input[aria-label^="Quantidade devolvida de"]', '99');
    await pm2.click('#cs-painel button:text-is("Confirmar devolução")');
    await pm2.waitForFunction(() => [...document.querySelectorAll('#cs-painel .cs-erro')].some(n => /Devolução maior que o recebido/.test(n.textContent)));
    check(await saldoB() === antesDev, 'devolver mais que o recebido é recusado com mensagem clara e nada é baixado');
    await pm2.fill('#cs-painel input[aria-label^="Quantidade devolvida de"]', '1'); await pm2.click('#cs-painel button:text-is("Confirmar devolução")');
    await pm2.waitForSelector('#cs-painel tr:has-text("5502"):has-text("20,00")');
    const dv = (await db.query(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='recebimentos_compra' AND dados->>'numero_nf'='5502'`)).rows[0].dados;
    check(await saldoB() === antesDev - 1000 && dv.itens[0].devolvido_milli === 1000 && dv.devolucoes[0].motivo === 'Material com defeito', 'devolução de 1 un: estoque baixado e devolução registrada com motivo');
    check((await despNf()).valor_centavos === valorAntes - 2000 && (await despNf()).estado === 'pendente_conferencia', 'a obrigação pendente caiu em R$ 20,00 (1 un × R$ 20,00)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pm2.evaluate(() => { const f = document.getElementById('form-novo-pedido-compra'); const m = f.closest('[id^=modal-]'); if (m) { m.classList.remove('hidden'); m.style.display = 'flex'; } f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
    await pm2.waitForSelector('#cp-fornecedor', { timeout: 10000 });
    check(true, 'o formulário antigo de pedido de compra abre o módulo de compras do servidor');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Consumo de material na obra (v6)');
    const obraQa = (await db.query(`SELECT id FROM martins_producao_v1.registros WHERE modulo='obras' AND dados->>'nome'='QA Obra Engenharia'`)).rows[0].id;
    const RDOID = '00000000-0000-4000-8000-0000000000e1';
    await db.query(`INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por) VALUES ($1,'rdos',$2,1,$3::jsonb,$4,$4)`, [E, RDOID, JSON.stringify({ obra_id: obraQa, numero: 1, data: '2026-11-16', status: 'rascunho', trabalhadores: [] }), M]);
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('estoque'));
    await pm2.waitForSelector('#co-obra', { timeout: 15000 });
    const consumir = async (qtdTxt) => {
      await pm2.selectOption('#co-obra', obraQa); await pm2.selectOption('#co-rdo', RDOID); await pm2.selectOption('#co-deposito', DA); await pm2.selectOption('#co-produto', PA);
      await pm2.fill('#co-qtd', qtdTxt); await pm2.evaluate(() => { document.querySelector('[data-cs=status]').textContent = ''; }); await pm2.click('#cs-painel button:text-is("Registrar consumo")');
    };
    await consumir('2');
    await pm2.waitForFunction(() => /Estoque: \d+ saldo/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    check(Number((await db.query(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, PA, DA])).rows[0].s) === 18000, 'consumo de 2 de A no RDO baixou o estoque: 20 → 18');
    await consumir('1');
    await pm2.waitForFunction(() => [...document.querySelectorAll('#cs-painel .cs-erro')].some(n => /já foi baixado neste RDO/.test(n.textContent)));
    check(Number((await db.query(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, PA, DA])).rows[0].s) === 18000, 'o mesmo material no mesmo RDO é recusado com mensagem clara (baixa única)');
    await pm2.fill('#cs-painel tbody tr:has-text("Consumo na obra") input[aria-label="Quantidade a devolver"]', '0,5');
    await pm2.fill('#cs-painel tbody tr:has-text("Consumo na obra") input[aria-label="Motivo da devolução"]', 'sobrou na obra');
    await pm2.click('#cs-painel tbody tr:has-text("Consumo na obra") button:text-is("Devolver ao estoque")');
    await pm2.waitForSelector('#cs-painel tbody tr:has-text("Devolução da obra")');
    check(Number((await db.query(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, PA, DA])).rows[0].s) === 18500, 'devolver 0,5 volta ao depósito: 18 → 18,5');
    check(await pm2.$$eval('#cs-painel tbody tr', t => t.filter(r => /Consumo na obra|Devolução da obra/.test(r.textContent) && [...r.querySelectorAll('button')].some(b => b.textContent === 'Estornar')).length === 0), 'consumo e devolução da obra não oferecem "Estornar" (a correção é a devolução)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Frota, ausências e cotações (v7)');
    const VEIC = '00000000-0000-4000-8000-0000000000f1';
    await db.query(`INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por) VALUES ($1,'veiculos',$2,1,$3::jsonb,$4,$4)`, [E, VEIC, JSON.stringify({ placa: 'E2E1A11', modelo: 'Caminhonete QA', ativo: true }), (await db.query(`SELECT id FROM auth.users LIMIT 1`)).rows[0].id]);
    const funcQa = (await db.query(`SELECT id FROM martins_producao_v1.registros WHERE modulo='funcionarios' ORDER BY criado_em LIMIT 1`)).rows[0].id;
    const preencherData = (id, v) => pm2.$eval(id, (n, valor) => { n.value = valor; }, v);
    const erroVisivel = (re) => pm2.waitForFunction(r => [...document.querySelectorAll('#cs-painel .cs-erro')].some(n => new RegExp(r).test(n.textContent)), re.source);
    // legado: o formulário antigo de abastecimento abre o cadastro do servidor
    await pm2.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<form id="form-abastecimento-manutencao-frota"><select id="frota-ev-tipo"><option value="ABASTECIMENTO" selected>A</option></select><input id="frota-ev-km" value="15000"><input id="frota-ev-litros" value="40"><input id="frota-ev-valor" value="280"><input id="frota-ev-posto" value="Posto QA"></form>'); document.getElementById('form-abastecimento-manutencao-frota').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
    await pm2.waitForSelector('#cs-painel .cs-form #cs-veiculo_id', { timeout: 15000 });
    check(await pm2.$eval('#cs-tipo', n => n.value) === 'abastecimento' && await pm2.$eval('#cs-km', n => n.value) === '15000' && await pm2.$eval('#cs-posto', n => n.value) === 'Posto QA', 'o formulário antigo de abastecimento abre o cadastro de frota do servidor já preenchido');
    await pm2.selectOption('#cs-veiculo_id', VEIC); await preencherData('#cs-data', '2026-11-10');
    await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForSelector('#cs-painel td:has-text("E2E1A11")');
    const ab = (await db.query(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='frota_eventos'`)).rows;
    check(ab.length === 1 && ab[0].dados.litros_milli === 40000 && ab[0].dados.valor_centavos === 28000, 'abastecimento gravado no servidor: 40 L (40000 milésimos) e R$ 280,00 (28000 centavos)');
    check(await pm2.$eval('#cs-painel tbody', n => /40 L/.test(n.innerText) && /R\$\s*280,00/.test(n.innerText) && /Abastecimento/.test(n.innerText)), 'a tabela mostra litros, valor e tipo legíveis');
    await pm2.click('#cs-painel button:text-is("+ Novo")');
    await pm2.selectOption('#cs-tipo', 'abastecimento'); await pm2.selectOption('#cs-veiculo_id', VEIC); await preencherData('#cs-data', '2026-11-10');
    await pm2.fill('#cs-km', '15000'); await pm2.fill('#cs-litros', '30'); await pm2.fill('#cs-valor_centavos', '210,00');
    await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await erroVisivel(/Já existe/);
    check((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='frota_eventos'`)).rows[0].n === 1, 'o mesmo abastecimento (veículo, data e km) não é gravado duas vezes');
    check(await semRastroLocal(pm2, 'Posto QA').then(x => x.length === 0), 'nada do abastecimento fica no navegador');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('ausencias'));
    await pm2.waitForFunction(() => /Ausências e férias:/.test(document.querySelector('[data-cs=status]')?.textContent || ''), null, { timeout: 15000 });
    const novaAusencia = async (ini, fim) => {
      await pm2.click('#cs-painel button:text-is("+ Novo")');
      await pm2.selectOption('#cs-funcionario_id', funcQa); await pm2.selectOption('#cs-tipo', 'falta'); await preencherData('#cs-inicio', ini); await preencherData('#cs-fim', fim);
      await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    };
    await novaAusencia('2026-11-02', '2026-11-03');
    await pm2.waitForSelector('#cs-painel td:has-text("2 dias")');
    check((await db.query(`SELECT (dados->>'dias')::int d FROM martins_producao_v1.registros WHERE modulo='ausencias'`)).rows[0].d === 2, 'ausência gravada; os dias (2) são calculados pelo servidor');
    await novaAusencia('2026-11-03', '2026-11-05');
    await erroVisivel(/coincide com o período/);
    check((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='ausencias'`)).rows[0].n === 1, 'período sobreposto para o mesmo funcionário é recusado com mensagem clara');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pm2.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<form id="form-plano-ferias-fase22"><input id="pf-inp-inicio" value="2026-12-01"><input id="pf-inp-fim" value="2026-12-30"><select id="pf-inp-situacao"><option selected>Programadas</option></select><input id="pf-inp-obs" value="Férias coletivas"></form>'); document.getElementById('form-plano-ferias-fase22').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
    await pm2.waitForFunction(() => document.querySelector('#cs-painel .cs-form #cs-tipo')?.value === 'ferias', null, { timeout: 15000 });
    check(await pm2.$eval('#cs-tipo', n => n.value) === 'ferias' && await pm2.$eval('#cs-situacao', n => n.value) === 'programado', 'o plano de férias antigo abre o cadastro do servidor como férias programadas');
    await pm2.selectOption('#cs-funcionario_id', funcQa); await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForSelector('#cs-painel td:has-text("30 dias")');
    check((await db.query(`SELECT 1 FROM martins_producao_v1.registros WHERE modulo='ausencias' AND dados->>'tipo'='ferias' AND dados->>'situacao'='programado'`)).rows.length === 1, 'férias programadas gravadas no servidor');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    await pm2.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<form id="form-lancar-proposta-cotacao-f29"><input id="cot29-fornecedor" value="Distribuidora QA"><input id="cot29-subtotal" value="1000"><input id="cot29-frete" value="50"><input id="cot29-desconto" value="20"><input id="cot29-prazo" value="7"><input id="cot29-condicao" value="28 dias"></form>'); document.getElementById('form-lancar-proposta-cotacao-f29').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
    await pm2.waitForSelector('#cs-painel .cs-form #cs-referencia', { timeout: 15000 });
    check(await pm2.$eval('#cs-fornecedor_nome', n => n.value) === 'Distribuidora QA' && await pm2.$eval('#cs-subtotal_centavos', n => n.value) === '1000,00', 'a proposta antiga de cotação abre o cadastro do servidor preenchido');
    await pm2.fill('#cs-referencia', 'Cimento CP-II 50 kg'); await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForSelector('#cs-painel td:has-text("Distribuidora QA")');
    check((await db.query(`SELECT (dados->>'total_centavos')::bigint t FROM martins_producao_v1.registros WHERE modulo='cotacoes'`)).rows[0].t === 103000, 'proposta gravada; o total (R$ 1.030,00) é calculado pelo servidor');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    check(await semRastroLocal(pm2, 'Distribuidora QA').then(x => x.length === 0) && await semRastroLocal(pm2, 'Férias coletivas').then(x => x.length === 0), 'nada de cotação ou férias fica no navegador');

    console.log('Requisição de materiais da obra (v8)');
    const saldoA = async () => Number((await db.query(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, PA, DA])).rows[0].s);
    const antesReq = await saldoA();
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('requisicoes'));
    await pm2.waitForSelector('#rq-obra', { timeout: 15000 });
    await pm2.selectOption('#rq-obra', obraQa); await pm2.selectOption('#rq-deposito', DA);
    await pm2.selectOption('#cs-painel [data-linha] select', PA); await pm2.fill('#cs-painel [data-linha] input', '3');
    await pm2.click('#cs-painel button:text-is("Enviar requisição")');
    await pm2.waitForSelector('[data-rq=lista] tbody tr:has-text("Solicitada")');
    const rqs = (await db.query(`SELECT id, dados FROM martins_producao_v1.registros WHERE modulo='requisicoes_material'`)).rows;
    check(rqs.length === 1 && rqs[0].dados.estado === 'solicitada' && rqs[0].dados.itens[0].qtd_milli === 3000 && rqs[0].dados.numero === 1, 'requisição enviada e gravada no servidor (nº 1, 3 un, estado solicitada)');
    check(await saldoA() === antesReq, 'solicitar não mexe no estoque');
    await pm2.click('[data-rq=lista] tbody tr:has-text("Solicitada") button:text-is("Entregar")', { timeout: 1500 }).then(() => check(false, 'requisição não aprovada não oferece entrega'), () => check(true, 'requisição não aprovada não oferece "Entregar"'));
    await pm2.fill('[data-rq=lista] tbody tr input[aria-label="Motivo"]', 'Liberado QA-REQ-8');
    await pm2.click('[data-rq=lista] tbody tr button:text-is("Aprovar")');
    await pm2.waitForSelector('[data-rq=lista] tbody tr:has-text("Aprovada")');
    check((await db.query(`SELECT dados->>'estado' e FROM martins_producao_v1.registros WHERE modulo='requisicoes_material'`)).rows[0].e === 'aprovada', 'o Master aprova pela tela e o servidor registra');
    const entregaUi = async (q) => { await pm2.click('[data-rq=lista] tbody tr button:text-is("Entregar")'); await pm2.waitForSelector('#cs-painel input[aria-label^="Quantidade entregue de"]'); await pm2.fill('#cs-painel input[aria-label^="Quantidade entregue de"]', q); await pm2.click('#cs-painel button:text-is("Confirmar entrega")'); };
    await entregaUi('2');
    await pm2.waitForSelector('[data-rq=lista] tbody tr:has-text("Entregue em parte")');
    check(await saldoA() === antesReq - 2000, 'entrega parcial de 2 baixou o estoque (consumo da obra)');
    await entregaUi('5');
    await pm2.waitForFunction(() => [...document.querySelectorAll('#cs-painel .cs-erro')].some(n => /maior que o pendente/.test(n.textContent)));
    check(await saldoA() === antesReq - 2000, 'entregar mais que o pendente é recusado com mensagem clara e nada é baixado');
    await pm2.fill('#cs-painel input[aria-label^="Quantidade entregue de"]', '1'); await pm2.click('#cs-painel button:text-is("Confirmar entrega")');
    await pm2.waitForSelector('[data-rq=lista] tbody tr:has-text("Entregue")');
    check(await saldoA() === antesReq - 3000 && (await db.query(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos' AND dados->>'requisicao_id'=$1`, [rqs[0].id])).rows[0].n === 2, 'entrega do restante conclui: 3 baixados em 2 consumos ligados à requisição');
    check(await semRastroLocal(pm2, 'Liberado QA-REQ-8').then(x => x.length === 0), 'nada da requisição fica no navegador');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Usuários e permissões (v9)');
    const NOVO_UID = '00000000-0000-4000-8000-0000000000a9';
    await db.query(`INSERT INTO auth.users VALUES ($1,'almox.e2e@teste.invalid')`, [NOVO_UID]);
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('usuarios'));
    await pm2.waitForSelector('#us-email', { timeout: 15000 });
    check(await pm2.$$eval('#cs-painel tbody tr', t => t.some(r => /master@teste\.invalid/.test(r.textContent))), 'o Master vê as pessoas vinculadas à empresa, com e-mail');
    await pm2.fill('#us-email', 'ninguem@teste.invalid'); await pm2.click('#cs-painel button:text-is("Vincular à empresa")');
    await erroVisivel(/Conta não encontrada no Supabase Auth/);
    check(true, 'e-mail que não existe no Auth é recusado com orientação clara');
    await pm2.fill('#us-email', 'ALMOX.e2e@teste.invalid'); await pm2.fill('#us-nome', 'Almoxarife QA'); await pm2.click('#cs-painel button:text-is("Vincular à empresa")');
    await pm2.waitForSelector('#cs-painel tbody tr:has-text("Almoxarife QA")');
    check((await db.query(`SELECT papel, ativo FROM public.martins_online_acessos WHERE usuario_id=$1`, [NOVO_UID])).rows[0].papel === 'operacional', 'a conta é vinculada como operacional (nunca Master)');
    check(await pm2.$eval('#cs-painel tbody tr:has-text("Almoxarife QA")', r => /Nenhum módulo/.test(r.textContent)), 'o vínculo novo aparece sem acesso a nenhum módulo');
    await pm2.click('#cs-painel tbody tr:has-text("Almoxarife QA") button:text-is("Permissões")');
    await pm2.waitForSelector('#us-modelo');
    await pm2.selectOption('#us-modelo', 'Almoxarife');
    check(await pm2.$eval('input[aria-label="Criar Estoque (movimentações)"]', n => n.checked) && !(await pm2.$eval('input[aria-label="Ver Despesas (financeiro)"]', n => n.checked)), 'o modelo "Almoxarife" preenche a tela (estoque sim, financeiro não)');
    await pm2.click('input[aria-label="Criar Estoque (movimentações)"]'); await pm2.click('input[aria-label="Criar Estoque (movimentações)"]');
    await pm2.uncheck('input[aria-label="Ver Obras"]');
    check(!(await pm2.$eval('input[aria-label="Editar Obras"]', n => n.checked)), 'tirar "Ver" também tira criar e editar');
    await pm2.click('#cs-painel button:text-is("Salvar permissões")');
    await pm2.waitForSelector('#cs-painel tbody tr:has-text("Almoxarife QA"):has-text("módulo(s)")');
    const pp = Object.fromEntries((await db.query(`SELECT modulo, ler, criar, editar FROM martins_producao_v1.permissoes WHERE usuario_id=$1`, [NOVO_UID])).rows.map(r => [r.modulo, r]));
    check(pp.estoque_movimentos?.criar === true && pp.estoque_movimentos?.editar === true && !pp.despesas && !pp.obras && pp.rdos?.ler === true, 'permissões gravadas no servidor conforme a tela (estoque sim; despesas e obras não)');
    check((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='permissoes' AND registro_id=$1`, [NOVO_UID])).rows[0].n === 2, 'vínculo e permissões deixaram trilha de auditoria');
    await pm2.click('#cs-painel tbody tr:has-text("Almoxarife QA") button:text-is("Desativar")');
    await pm2.waitForSelector('#cs-painel tbody tr:has-text("Almoxarife QA"):has-text("Desativado")');
    check((await db.query(`SELECT ativo FROM public.martins_online_acessos WHERE usuario_id=$1`, [NOVO_UID])).rows[0].ativo === false, 'o Master desativa o acesso e o servidor registra');
    check(await pm2.$$eval('#cs-painel tbody tr', t => !/Desativar|Reativar/.test((t.find(r => /master@teste\.invalid/.test(r.textContent)) || { textContent: '' }).textContent)), 'o Master não vê botão para desativar o próprio acesso');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Contas a receber (v10)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('contas_receber'));
    await pm2.waitForFunction(() => /Contas a receber:/.test(document.querySelector('[data-cs=status]')?.textContent || ''), null, { timeout: 15000 });
    await pm2.click('#cs-painel button:text-is("+ Novo")');
    await pm2.selectOption('#cs-cliente_id', { label: 'Cliente Legado' }); await pm2.fill('#cs-descricao', 'Medição 1 QA'); await pm2.fill('#cs-valor_centavos', '1200,00'); await preencherData('#cs-vencimento', '2026-12-10');
    await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForSelector('#cs-painel td:has-text("Medição 1 QA")');
    const cr = () => db.query(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND dados->>'descricao'='Medição 1 QA'`).then(r => r.rows[0].dados);
    check((await cr()).estado === 'aberta' && (await cr()).valor_centavos === 120000, 'título criado pela tela: aberto, R$ 1.200,00 (120000 centavos)');
    await pm2.waitForSelector('[data-rec=totais]:has-text("1.200,00")');
    check(true, 'o resumo (calculado no servidor) mostra o valor a receber');
    const linhaCr = '#cs-painel tbody tr:has-text("Medição 1 QA")';
    await pm2.fill(linhaCr + ' input[aria-label="Valor recebido (R$)"]', '400,00'); await pm2.click(linhaCr + ' button:text-is("Registrar recebimento")');
    await pm2.waitForSelector(linhaCr + ':has-text("Recebida em parte")');
    check((await cr()).recebido_centavos === 40000, 'recebimento parcial de R$ 400,00 registrado: "Recebida em parte"');
    await pm2.fill(linhaCr + ' input[aria-label="Valor recebido (R$)"]', '9.999,00'); await pm2.click(linhaCr + ' button:text-is("Registrar recebimento")');
    await pm2.waitForFunction(() => /maior que o saldo/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    check((await cr()).recebido_centavos === 40000, 'receber mais que o saldo é recusado com mensagem clara');
    await pm2.click(linhaCr + ' button:text-is("Estornar último recebimento")');
    await pm2.waitForFunction(() => /Informe o motivo do estorno/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    await pm2.fill(linhaCr + ' input[aria-label="Motivo"]', 'Lançado no título errado'); await pm2.click(linhaCr + ' button:text-is("Estornar último recebimento")');
    await pm2.waitForSelector(linhaCr + ':has-text("Aberta")');
    const crE = await cr();
    check(crE.recebido_centavos === 0 && crE.baixas.length === 1 && crE.baixas[0].estornada === true, 'o Master estorna: título volta a "Aberta" e a baixa continua registrada como estornada');
    await pm2.fill(linhaCr + ' input[aria-label="Motivo"]', 'Cliente desistiu'); await pm2.click(linhaCr + ' button:text-is("Cancelar título")');
    await pm2.waitForSelector(linhaCr + ':has-text("Cancelada")');
    check((await cr()).estado === 'cancelada', 'título sem recebimento é cancelado com motivo');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());
    await pm2.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<form id="form-registrar-movimentacao-fin"><select id="fin-reg-tipo"><option value="ENTRADA" selected>Entrada</option></select><input id="fin-reg-descricao" value="Sinal da obra QA"><input id="fin-reg-valor" value="350"><input id="fin-reg-vencimento" value="2026-12-20"></form>'); [...document.querySelectorAll('#form-registrar-movimentacao-fin')].pop().dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
    await pm2.waitForFunction(() => document.querySelector('#cs-painel .cs-form #cs-descricao')?.value === 'Sinal da obra QA', null, { timeout: 15000 });
    check(await pm2.$eval('#cs-valor_centavos', n => n.value) === '350,00' && await pm2.$eval('#cs-vencimento', n => n.value) === '2026-12-20', 'lançar uma ENTRADA no formulário antigo do financeiro abre o cadastro de contas a receber do servidor');
    check(await semRastroLocal(pm2, 'Medição 1 QA').then(x => x.length === 0) && await semRastroLocal(pm2, 'Sinal da obra QA').then(x => x.length === 0), 'nada de contas a receber fica no navegador');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Gastos da obra (v12)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('gastos_obra'));
    await pm2.waitForSelector('#go-obra', { timeout: 15000 });
    await pm2.selectOption('#go-obra', obraQa);
    await pm2.waitForSelector('[data-go=resumo]');
    // A: consumo líquido 4,5 un (2 − 0,5 do RDO + 3 da requisição) × custo médio R$ 5,00 (compra de 10 a R$ 5,00)
    check(await pm2.$eval('[data-go=saida]', n => /4,5/.test(n.textContent) && /5,00/.test(n.textContent) && /22,50/.test(n.textContent)), 'a tela mostra o consumo líquido de A (4,5 un), o custo médio (R$ 5,00) e o custo (R$ 22,50)');
    check(await pm2.$eval('[data-go=resumo]', n => /Total apropriado à obra/.test(n.textContent)), 'o resumo traz o total apropriado à obra, calculado no servidor');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Backup e restauração (v13)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('backup'));
    await pm2.waitForSelector('#bk-exportar', { timeout: 15000 });
    const [dl] = await Promise.all([pm2.waitForEvent('download'), pm2.click('#bk-exportar')]);
    const arqPath = await dl.path(); const bkp = JSON.parse(fs.readFileSync(arqPath, 'utf8'));
    const totalReg = Number((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE empresa_id=$1`, [E])).rows[0].n);
    check(/^backup-martins-.*\.json$/.test(dl.suggestedFilename()) && bkp.formato === 'martins-backup' && bkp.total === totalReg && bkp.registros.length === totalReg, 'o Master baixa um arquivo de backup com todos os registros da empresa (' + totalReg + ')');
    check(bkp.registros.some(r => r.modulo === 'estoque_movimentos') && bkp.registros.some(r => r.modulo === 'contas_receber'), 'o backup inclui os módulos novos (estoque, contas a receber…)');
    check((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='backup' AND depois->>'acao'='exportar'`)).rows[0].n === 1, 'a exportação ficou na auditoria');
    await pm2.setInputFiles('#bk-arquivo', arqPath);
    await pm2.waitForSelector('[data-bk=resumo] li');
    check(await pm2.$eval('[data-bk=resumo]', n => /registro\(s\)/.test(n.textContent) && /Clientes: /.test(n.textContent)), 'ao escolher o arquivo, a tela mostra o resumo por módulo antes de restaurar');
    await pm2.click('#bk-restaurar');
    await pm2.waitForFunction(() => /Marque a confirmação/.test(document.querySelector('#cs-painel .cs-erro:not(:empty)')?.textContent || ''));
    await pm2.check('#bk-confirma'); await pm2.click('#bk-restaurar');
    await pm2.waitForFunction(() => [...document.querySelectorAll('#cs-painel .cs-erro')].some(n => /já tem dados/.test(n.textContent)));
    check((await db.query(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE empresa_id=$1`, [E])).rows[0].n === totalReg, 'restaurar numa empresa que já tem dados é recusado com mensagem clara e nada muda');
    const adulterado = { ...bkp, registros: bkp.registros.slice(1) };
    await pm2.setInputFiles('#bk-arquivo', { name: 'adulterado.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(adulterado)) });
    await pm2.waitForSelector('[data-bk=resumo] li'); await pm2.click('#bk-restaurar');
    await pm2.waitForFunction(() => [...document.querySelectorAll('#cs-painel .cs-erro')].some(n => /Backup incompleto|já tem dados/.test(n.textContent)));
    check(true, 'backup com registro faltando não é aceito');
    await pm2.setInputFiles('#bk-arquivo', { name: 'lixo.json', mimeType: 'application/json', buffer: Buffer.from('isto não é json') });
    await pm2.waitForFunction(() => /não é um JSON válido/.test(document.querySelector('#cs-painel .cs-erro:not(:empty)')?.textContent || ''));
    check(true, 'arquivo que não é JSON é recusado antes de qualquer envio');
    check(await semRastroLocal(pm2, 'martins-backup').then(x => x.length === 0), 'o backup não fica guardado no navegador (localStorage)');
    await pm2.evaluate(() => window.MartinsCadastrosServidor.fechar());

    console.log('Rodada 4: ficha, histórico, busca e mensagens');
    await pm2.evaluate(() => { document.getElementById('modal-editar-colaborador').classList.add('hidden'); });
    await pm2.evaluate(id => window.abrirFichaColaborador(id), criados[0].id);
    await pm2.waitForSelector('#modal-ficha-individual-funcionario-estab:not(.hidden)', { timeout: 10000 });
    const ficha = await pm2.evaluate(() => document.getElementById('modal-ficha-individual-funcionario-estab').innerText);
    check(/Beltrano SST/.test(ficha) && /Eletricista/.test(ficha), 'H01: a ficha individual abre com os dados do funcionário do servidor');
    check(/ASO:\s*31\/01\/2027/.test(ficha) && /NR-10[^\n]*15\/12\/2026/.test(ficha), 'H01: ASO e NR-10 mostrados são os informados no cadastro');
    check(!/Bota 41|Unif\. G|Capacete, Luva|2027-04-15|Regular/.test(ficha) && /nenhuma entrega registrada/.test(ficha), 'H01: sem ASO, NR ou EPI inventados na ficha');
    await pm2.evaluate(() => { const f = document.getElementById('modal-ficha-individual-funcionario-estab'); f.classList.add('hidden'); f.style.display = 'none'; });

    await pm2.evaluate(() => window.MartinsCadastrosServidor.abrir('despesas'));
    await pm2.waitForFunction(() => /Despesas:/.test(document.querySelector('[data-cs=status]')?.textContent || ''));
    await pm2.fill('#cs-painel input[type=search]', 'ADM-01');
    check(await pm2.$$eval('#cs-painel tbody tr', t => t.length > 0 && !/Nada encontrado/.test(t[0].textContent)), '48: a busca encontra pelo código do centro de custo exibido na tabela');
    check(/\d+ de \d+ registro/.test(await pm2.$eval('#cs-painel .cs-acoes span', n => n.textContent)), '48: o contador mostra resultados sobre o total');
    await pm2.fill('#cs-painel input[type=search]', '');
    await pm2.click('#cs-painel tbody tr:has-text("Honorários") button:text-is("Histórico")');
    await pm2.waitForSelector('#cs-painel h3:text-is("Histórico de alterações")');
    await pm2.waitForSelector('#cs-painel tbody tr');
    const hist = await pm2.$eval('#cs-painel tbody', n => n.innerText);
    check(/Master Teste/.test(hist) && /Criado|Estado:/.test(hist), '60: o histórico mostra quem criou/alterou, quando e o estado');
    await pm2.click('#cs-painel button:text-is("← Voltar à lista")');
    await pm2.click('#cs-painel button:text-is("+ Novo")');
    await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForFunction(() => /Preencha o campo "Descrição"/.test(document.querySelector('.cs-erro')?.textContent || ''));
    check(true, '97: campo obrigatório vazio usa o rótulo da tela ("Descrição"), não o nome interno');
    await pm2.fill('#cs-descricao', 'Teste'); await pm2.fill('#cs-valor_centavos', '-5,00'); await pm2.$eval('#cs-competencia', n => { n.value = '2026-11-10'; }); await pm2.selectOption('#cs-classificacao', 'administrativa');
    await pm2.click('#cs-painel button:text-is("Salvar no servidor")');
    await pm2.waitForFunction(() => /não pode ser negativo/.test(document.querySelector('.cs-erro')?.textContent || ''));
    check(true, '97: valor negativo explica a regra (maior que zero)');
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
