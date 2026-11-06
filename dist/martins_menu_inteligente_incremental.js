/* Melhoria 2 — camada incremental sobre o drawer existente.
 * Não altera rotas, autorizações ou estrutura dos botões.
 */
(()=>{'use strict';
const DRAWER='drawer-menu-lateral';
function init(){
 const drawer=document.getElementById(DRAWER);
 const list=drawer?.querySelector('.overflow-y-auto');
 if(!drawer||!list||drawer.dataset.martinsBuscaInstalada==='1')return;
 drawer.dataset.martinsBuscaInstalada='1';
 const toolbar=document.createElement('div');
 toolbar.className='sm-menu-toolbar';
 toolbar.style.cssText='padding:10px;position:sticky;top:0;background:#fff;z-index:2;border-bottom:1px solid #e2e8f0';
 const input=document.createElement('input');
 input.type='search';input.placeholder='Buscar módulo ou rotina...';
 input.setAttribute('aria-label','Buscar no menu');
 input.style.cssText='width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px';
 const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Recolher grupos';
 toggle.style.cssText='margin-top:8px;font-size:12px;min-height:36px;color:#92400e';
 toolbar.append(input,toggle);list.before(toolbar);
 const groups=()=>[...list.querySelectorAll('details.sm-group')];
 const targets=()=>[...list.querySelectorAll('button,a,[data-nav]')].filter(el=>!el.closest('.sm-menu-toolbar'));
 const normalize=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const originalOpen=new WeakMap();
 const originalVisibility=new WeakMap();
 function setFiltered(el,show){
  if(!originalVisibility.has(el))originalVisibility.set(el,{hidden:el.hidden,display:el.style.display});
  const original=originalVisibility.get(el);
  el.hidden=!show||original.hidden;
  el.style.display=show?original.display:'none';
 }
 function filter(){
  const term=normalize(input.value.trim());
  for(const group of groups()){
   if(term&&!originalOpen.has(group))originalOpen.set(group,group.open);
   const entries=[...group.querySelectorAll('button,a,[data-nav]')].filter(el=>!el.parentElement?.closest('button,a,[data-nav]'));
   const groupMatch=!!term&&normalize(group.querySelector(':scope > summary')?.textContent).includes(term);
   let matches=0;
   for(const el of entries){
    const ok=!term||groupMatch||normalize(el.textContent).includes(term);
    setFiltered(el,ok);if(ok&&!originalVisibility.get(el)?.hidden)matches++;
   }
   group.hidden=!!term&&!matches;
   if(term&&matches)group.open=true;
   if(!term&&originalOpen.has(group)){group.open=originalOpen.get(group);originalOpen.delete(group);}
  }
  for(const el of targets()){
   if(el.closest('details.sm-group'))continue;
   const ok=!term||normalize(el.textContent).includes(term);
   setFiltered(el,ok);
  }
 }
 input.addEventListener('input',filter);
 toggle.addEventListener('click',()=>{
  const all=groups();const expand=all.some(g=>!g.open);
  for(const g of all)g.open=expand;
  toggle.textContent=expand?'Recolher grupos':'Expandir grupos';
 });
 list.addEventListener('click',event=>{
  const target=event.target.closest('[data-nav]');
  if(!target||!list.contains(target)||target.disabled||event.defaultPrevented)return;
  for(const el of targets())el.removeAttribute('aria-current');
  target.setAttribute('aria-current','page');
  if(window.matchMedia('(max-width: 1023px)').matches&&typeof window.fecharDrawerMenu==='function'){
   queueMicrotask(()=>window.fecharDrawerMenu());
  }
 });
 const css=document.createElement('style');
 css.textContent='#'+DRAWER+' [aria-current="page"]{background:#fef3c7!important;box-shadow:inset 3px 0 #d97706}#'+DRAWER+' [hidden]{display:none!important}';
 document.head.append(css);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(init));else queueMicrotask(init);
})();
