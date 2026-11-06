(()=>{'use strict';const $=id=>document.getElementById(id);
const css=document.createElement('style');css.textContent='#drawer-menu-lateral .sm-group{border-top:1px solid #e2e8f0;padding:8px 0}#drawer-menu-lateral .sm-group>summary{font-size:12px;font-weight:800;padding:11px 8px;cursor:pointer;color:#0f172a}#drawer-menu-lateral button{min-height:44px;max-width:100%;white-space:normal;overflow-wrap:anywhere;text-align:left}#drawer-menu-lateral .sm-group button{width:100%;padding:9px 10px}#sm-planning{padding-left:12px;border-left:2px solid #d6b458;margin-left:10px}#sm-planning>summary{font-weight:700;padding:10px;cursor:pointer}main,section,form,.mf-grid>*{min-width:0}.mf-grid label,.ep-grid label{min-width:0}dialog{box-sizing:border-box;max-width:calc(100vw - 20px);max-height:90dvh;overflow:auto}dialog input:not([type=checkbox]):not([type=radio]),dialog select,dialog textarea{max-width:100%;box-sizing:border-box}#form-rdo textarea,#form-rdo input,#form-rdo select{max-width:100%;box-sizing:border-box}.mf-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain}.mf-grid input,.mf-grid select,.mf-grid textarea{min-width:0;max-width:100%;box-sizing:border-box}#martins-bottom-bar button.hidden,#martins-bottom-bar button[hidden]{display:none!important}#martins-bottom-bar{padding-bottom:env(safe-area-inset-bottom)}body{padding-bottom:calc(78px + env(safe-area-inset-bottom))}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #d97706;outline-offset:2px}@media(max-width:600px){.mf-grid{grid-template-columns:minmax(0,1fr)!important}#modal-novo-colaborador>div,#modal-editar-colaborador>div,#modal-novo-orcamento-venda>div{max-height:90dvh;overflow-y:auto;width:100%;padding:14px}#martins-bottom-bar button>span{white-space:normal!important;overflow-wrap:anywhere;font-size:9px!important}#martins-bottom-bar>div{grid-template-columns:repeat(7,minmax(0,1fr))}#form-rdo .flex.justify-between{flex-wrap:wrap;gap:8px}#subview-quadro-colab .flex.items-center.space-x-2{flex-wrap:wrap;gap:8px}}';document.head.append(css);
function install(){const list=$('drawer-menu-lateral')?.querySelector('.overflow-y-auto');if(!list)return;function group(id,title){let box=$(id);if(!box){box=document.createElement('details');box.id=id;box.className='sm-group';box.open=true;const h=document.createElement('summary');h.textContent=title;box.append(h);list.append(box);}return box;}
const works=group('sm-works','Obras'),rhSource=list.querySelector('[data-nav="colaboradores-quadro"]')?.parentElement,rh=group('sm-rh','Recursos Humanos'),finance=$('fin-drawer');if(rhSource&&rhSource!==rh&&!rh.contains(rhSource)){for(const node of [...rhSource.children])if(node.tagName!=='SPAN')rh.append(node);rhSource.remove();}
for(const b of [...list.querySelectorAll('[data-nav]')])if(b.dataset.nav==='gestao'||b.dataset.nav.startsWith('gestao-'))works.append(b);
let planning=$('sm-planning');if(!planning){planning=document.createElement('details');planning.id='sm-planning';const title=document.createElement('summary');title.textContent='Planejamento e Equipes';planning.append(title);works.append(planning);}for(const id of ['ma-menu-planejamento','ma-menu-conferencia'])if($(id))planning.append($(id));
for(const id of ['ma-menu-rdo','ma-menu-frequencia'])$(id)?.remove();if($('ma-drawer-access')&&!$('ma-drawer-access').querySelector('button'))$('ma-drawer-access').remove();
if($('pay-drawer'))rh.append($('pay-drawer'));const finGroup=group('sm-finance','Financeiro');if(finance){finance.querySelector('h4')?.setAttribute('hidden','');finGroup.append(finance);}list.insertBefore(works,list.firstElementChild);const rdo=list.querySelector('[data-nav="historico"]')?.parentElement;if(rdo&&rdo!==works){works.after(rdo);rdo.after(rh);}else works.after(rh);rh.after(finGroup);
for(const section of [...list.children])if(section!==works&&section!==planning&&section.tagName==='DIV'&&!section.querySelector('button,a,input,details')&&section.id!=='sm-works')section.remove();
for(const id of ['btn-colab-trocar-senha','btn-menu-trocar-senha'])$(id)?.setAttribute('hidden','');
const novo=list.querySelector('[data-nav="novo"] span:last-child');if(novo&&novo.textContent.trim()==='Apontar')novo.textContent='RDO';
for(const b of list.querySelectorAll('[data-nav="novo"] span'))if(b.textContent.includes('Preencher Novo'))b.textContent='Preencher RDO';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(install));else install();let returnFocus=null;
const old=window.abrirDrawerMenu,close=window.fecharDrawerMenu;
// Instala os wrappers depois que as funções originais estiverem disponíveis.
// Evita perder a integração quando este arquivo é carregado antes do script principal.
function vincularDrawer(){
 const abrir=window.abrirDrawerMenu,fechar=window.fecharDrawerMenu;
 if(typeof abrir==='function'&&!abrir.__martinsLayoutWrapped){
   const wrapped=function(...args){
     install();const drawer=$('drawer-menu-lateral');
     if(drawer?.classList.contains('hidden'))returnFocus=document.activeElement;
     const result=abrir.apply(this,args);
     drawer?.setAttribute('role','dialog');drawer?.setAttribute('aria-label','Menu do sistema');drawer?.setAttribute('aria-modal','true');
     for(const id of ['btn-abrir-drawer-header','bnav-btn-menu'])$(id)?.setAttribute('aria-expanded','true');
     drawer?.querySelector('button')?.focus();return result;
   };
   wrapped.__martinsLayoutWrapped=true;window.abrirDrawerMenu=wrapped;
 }
 if(typeof fechar==='function'&&!fechar.__martinsLayoutWrapped){
   const wrapped=function(...args){const result=fechar.apply(this,args);
     for(const id of ['btn-abrir-drawer-header','bnav-btn-menu'])$(id)?.setAttribute('aria-expanded','false');
     if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;return result;};
   wrapped.__martinsLayoutWrapped=true;window.fecharDrawerMenu=wrapped;
 }
}
vincularDrawer();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',vincularDrawer,{once:true});
window.addEventListener('load',vincularDrawer,{once:true});
document.addEventListener('keydown',e=>{const drawer=$('drawer-menu-lateral');if(!drawer||drawer.classList.contains('hidden'))return;if(e.key==='Escape'){e.preventDefault();window.fecharDrawerMenu();}else if(e.key==='Tab'){const items=[...drawer.querySelectorAll('button,a,summary,input,select')].filter(x=>!x.disabled&&x.getClientRects().length);const first=items[0],last=items.at(-1);if(first&&(e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last)){e.preventDefault();(e.shiftKey?last:first).focus();}}});
// O aviso offline pode ocupar várias linhas no celular; o cabeçalho acompanha sua altura.
const banner=$('banner-modo-offline'),header=document.querySelector('body>header');
function headerOffset(){if(header)header.style.top=(banner&&!banner.classList.contains('hidden')?banner.getBoundingClientRect().height:0)+'px';}
if(banner){new MutationObserver(headerOffset).observe(banner,{attributes:true,attributeFilter:['class','style']});if(typeof ResizeObserver!=='undefined')new ResizeObserver(headerOffset).observe(banner);}window.addEventListener('resize',headerOffset);headerOffset();
})();


/* Carrega o cabeçalho incremental sem substituir o HTML atual. */
(()=>{const script=document.createElement('script');script.src=new URL('martins_header_compacto.js',document.currentScript?.src||document.baseURI).href;script.defer=true;document.head.append(script);})();

/* Melhoria 2: extensão progressiva sem substituir o drawer. */
(()=>{const s=document.createElement('script');s.src=new URL('martins_menu_inteligente_incremental.js',document.currentScript?.src||document.baseURI).href;s.defer=true;document.head.append(s);})();

/* Melhoria 3: ajustes não destrutivos na barra mobile existente. */
(()=>{const s=document.createElement('script');s.src=new URL('martins_barra_mobile_incremental.js',document.currentScript?.src||document.baseURI).href;s.defer=true;document.head.append(s);})();

/* MARTINS_HML_VISUAL_MENU_V1 */
(()=>{'use strict';
const css=document.createElement('style');
css.setAttribute('data-martins-hml-menu-visual','v1');
css.textContent=`
#drawer-menu-lateral{--sm-ink:#24344b;--sm-muted:#61728a;--sm-line:#e4eaf2;--sm-surface:#f6f8fb;--sm-accent:#1e568e}
#drawer-menu-lateral .overflow-y-auto{padding:10px 12px 22px!important;scrollbar-width:thin}
#drawer-menu-lateral .sm-group{border:1px solid var(--sm-line)!important;border-radius:12px;margin:0 0 10px;padding:0!important;background:#fff;overflow:visible}
#drawer-menu-lateral .sm-group>summary{display:list-item;list-style-position:inside;padding:14px 14px!important;font-size:12px!important;letter-spacing:.035em;line-height:1.5;color:var(--sm-ink)!important;background:var(--sm-surface);border-radius:11px;cursor:pointer}
#drawer-menu-lateral .sm-group[open]>summary{border-bottom:1px solid var(--sm-line);border-radius:11px 11px 0 0}
#drawer-menu-lateral .sm-group button,#drawer-menu-lateral .sm-group a[data-nav]{display:flex;align-items:center;gap:10px;min-height:44px;width:100%;padding:10px 12px!important;border-radius:8px;font-size:13px;line-height:1.45;color:var(--sm-ink);text-align:left;box-sizing:border-box}
#drawer-menu-lateral .sm-group button:hover,#drawer-menu-lateral .sm-group a[data-nav]:hover{background:#edf3fa}
#drawer-menu-lateral .sm-group button:focus-visible,#drawer-menu-lateral .sm-group summary:focus-visible{outline:2px solid var(--sm-accent);outline-offset:1px}
#drawer-menu-lateral .sm-group button>span,#drawer-menu-lateral .sm-group a>span{min-width:0}
#drawer-menu-lateral .sm-group button>span:last-child{overflow-wrap:anywhere}
#drawer-menu-lateral #sm-finance #fin-drawer{padding:6px 8px 10px}
#drawer-menu-lateral #sm-finance #fin-drawer button{margin:2px 0}
#drawer-menu-lateral #sm-planning{margin:8px 10px!important;padding:0 0 0 8px!important;border-left:2px solid #b7cadf!important}
#drawer-menu-lateral .sm-menu-toolbar{padding:12px!important;background:#fff!important;border-bottom:1px solid var(--sm-line)!important}
#drawer-menu-lateral .sm-menu-toolbar input{min-height:42px;border-radius:10px!important}
@media(max-width:600px){#drawer-menu-lateral .overflow-y-auto{padding:8px 10px 24px!important}#drawer-menu-lateral .sm-group>summary{padding:13px 12px!important}#drawer-menu-lateral .sm-group button{font-size:13px!important}}
`;
document.head.appendChild(css);
})();

/* MARTINS_HML_CORRIGE_MAIS_DUPLICADO_V1 */
(()=>{'use strict';
// Corrige somente prefixos + repetidos; não altera ações, IDs nem permissões.
function corrigir(){
 const root=document.getElementById('drawer-menu-lateral');if(!root)return;
 for(const el of root.querySelectorAll('button,a')){
  if(!/cadastrar\s+nova\s+obra/i.test(el.textContent||''))continue;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  const significant=nodes.filter(n=>n.nodeValue.trim());
  const text=significant.map(n=>n.nodeValue).join(' ').replace(/\s+/g,' ').trim();
  if(!/^(?:\+\s*){2,}cadastrar\s+nova\s+obra/i.test(text))continue;
  let remaining=2;
  for(const node of significant){
   if(remaining===0)break;
   const original=node.nodeValue;
   node.nodeValue=original.replace(/^(\s*)(?:\+\s*)+/,(full,space)=>{
    const count=(full.match(/\+/g)||[]).length;
    if(!count)return full;
    if(remaining===2){remaining=1;return space+'+ ';}
    remaining=0;return space;
   });
  }
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',corrigir,{once:true});else corrigir();
const observer=new MutationObserver(()=>{observer.disconnect();corrigir();const root=document.getElementById('drawer-menu-lateral');if(root)observer.observe(root,{childList:true,subtree:true});});
const start=()=>{const root=document.getElementById('drawer-menu-lateral');if(root)observer.observe(root,{childList:true,subtree:true});};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

/* MARTINS_HML_ICONS_PLANNING_V2 */
(()=>{'use strict';const style=document.createElement('style');style.dataset.martinsMenuIconFix='v2';style.textContent=`
/* Somente os dois atalhos de Planejamento e Conferencia: nao altera rotas. */
#drawer-menu-lateral #sm-planning #ma-menu-planejamento,
#drawer-menu-lateral #sm-planning #ma-menu-conferencia{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;min-height:44px!important;height:auto!important;width:100%!important;padding:9px 10px!important;margin:2px 0!important;text-align:left!important;box-sizing:border-box!important}
#drawer-menu-lateral #sm-planning #ma-menu-planejamento svg,
#drawer-menu-lateral #sm-planning #ma-menu-conferencia svg{display:block!important;width:20px!important;height:20px!important;min-width:20px!important;max-width:20px!important;max-height:20px!important;flex:0 0 20px!important;transform:none!important}
#drawer-menu-lateral #sm-planning #ma-menu-planejamento img,
#drawer-menu-lateral #sm-planning #ma-menu-conferencia img{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important;object-fit:contain!important;flex:0 0 20px!important}
#drawer-menu-lateral #sm-planning #ma-menu-planejamento>span,
#drawer-menu-lateral #sm-planning #ma-menu-conferencia>span{font-size:13px!important;line-height:1.4!important;min-width:0!important;margin:0!important}
#drawer-menu-lateral #sm-planning>summary{font-size:12px!important;padding:10px!important}
`;document.head.appendChild(style)})();

/* MARTINS_HML_ORDEM_OBRAS_V1 */
(()=>{'use strict';
function ajustarOrdem(){
 const obras=document.getElementById('sm-works');const planejamento=document.getElementById('sm-planning');
 if(!obras||!planejamento||planejamento.parentElement!==obras)return;
 const dashboard=[...obras.querySelectorAll('[data-nav]')].find(el=>el.dataset.nav==='gestao');
 if(!dashboard)return;
 const principal=dashboard.closest('button,a')||dashboard;
 if(principal.parentElement!==obras)return;
 principal.after(planejamento);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(ajustarOrdem),{once:true});else queueMicrotask(ajustarOrdem);
const drawer=document.getElementById('drawer-menu-lateral');if(drawer){drawer.addEventListener('click',()=>queueMicrotask(ajustarOrdem),{capture:true});}
})();
