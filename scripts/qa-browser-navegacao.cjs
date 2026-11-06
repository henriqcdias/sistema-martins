// Integração isolada com dados sintéticos. Requer Playwright e Chromium; não acessa serviços externos.
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const root=process.cwd()+'/dist',server=http.createServer((req,res)=>{const p=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!p.startsWith(root)||!fs.existsSync(p)){res.statusCode=404;res.end('');return;}res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'image/png');res.end(fs.readFileSync(p));});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{b=await chromium.launch({...(process.env.MARTINS_CHROMIUM_EXECUTABLE?{executablePath:process.env.MARTINS_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox'],headless:true});for(const entry of ['index.html','rdo_digital_martins.html'])for(const width of [360,390,1280]){
const p=await b.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
await p.goto('http://127.0.0.1:'+server.address().port+'/'+entry);
// Sessão fictícia local: não representa login nem autorização no servidor.
await p.evaluate(()=>{currentLoggedUser={id:'QA',usuario:'qa',nome:'QA',perfil:'Master',status:'Ativo'};sessionStorage.setItem('cm_active_user',JSON.stringify(currentLoggedUser));document.getElementById('tela-login-gate').classList.add('hidden');});
assert.equal(await p.evaluate(()=>{const buttons=[...document.querySelectorAll('#martins-bottom-bar button')].filter(b=>b.getClientRects().length);return buttons.length===7&&Math.max(...buttons.map(b=>b.getBoundingClientRect().top))-Math.min(...buttons.map(b=>b.getBoundingClientRect().top))<2;}),true,'Atalhos inferiores em uma linha, sem controles ocultos ocupando espaço');
assert.equal(await p.locator('#drawer-menu-lateral').evaluate(e=>e.parentElement.tagName),'BODY');
await p.locator('#btn-abrir-drawer-header').click();await p.locator('#drawer-menu-lateral summary').first().waitFor({state:'visible'});
assert.equal(await p.locator('#btn-abrir-drawer-header').getAttribute('aria-expanded'),'true');
await p.keyboard.press('Escape');assert.equal(await p.locator('#drawer-menu-lateral').isVisible(),false);
assert.equal(await p.evaluate(()=>document.activeElement.id),'btn-abrir-drawer-header');
await p.locator('#bnav-btn-menu').click();await p.locator('#drawer-menu-lateral [data-nav="gestao"]').click();assert.equal(await p.locator('#drawer-menu-lateral').isVisible(),false);assert.equal(await p.locator('#view-gestao').isVisible(),true);
await p.evaluate(()=>{const banner=document.getElementById('banner-modo-offline');banner.textContent='Aviso offline sintético com texto longo para conferir múltiplas linhas e o cabeçalho no celular.';banner.classList.remove('hidden');window.scrollTo(0,500);});
await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>{const a=document.getElementById('banner-modo-offline').getBoundingClientRect(),h=document.querySelector('body>header').getBoundingClientRect();return h.top>=a.bottom-1;}),true);
await p.evaluate(()=>{document.getElementById('banner-modo-offline').classList.add('hidden');window.scrollTo(0,0);window.abrirModalNovoOrcamentoVenda();});
assert.equal(await p.locator('#modal-novo-orcamento-venda').isVisible(),true);assert.equal(await p.locator('#form-novo-orcamento-venda').isVisible(),true);
assert.equal(await p.locator('#modal-novo-orcamento-venda').evaluate(e=>e.getBoundingClientRect().width<=innerWidth),true);
assert.deepEqual(errors,[]);console.log(JSON.stringify({entry,width,menu:true,navigation:true,offlineHeader:true,quoteVisible:true,errors}));await p.close();
}}finally{await b?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
