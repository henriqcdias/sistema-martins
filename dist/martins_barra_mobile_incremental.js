/* Gemini Melhoria 3 — aprimoramento progressivo da barra já existente.
 * Não recria botões, rotas ou permissões.
 */
(()=>{'use strict';
function setup(){
 const bar=document.getElementById('martins-bottom-bar');
 if(!bar||bar.dataset.martinsMobileV3==='1')return;
 bar.dataset.martinsMobileV3='1';
 bar.setAttribute('aria-label',bar.getAttribute('aria-label')||'Navegação rápida');
 const css=document.createElement('style');
 css.textContent=`
 @media(max-width:767px){
  #martins-bottom-bar{padding-bottom:max(6px,env(safe-area-inset-bottom));}
  #martins-bottom-bar button{min-width:0;min-height:44px;touch-action:manipulation}
  #martins-bottom-bar button span{overflow-wrap:anywhere}
  body{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
  body.martins-teclado-aberto #martins-bottom-bar{visibility:hidden;pointer-events:none}
 }
 #martins-bottom-bar button[aria-current="page"]{color:#fbbf24!important}
 #martins-bottom-bar button:focus-visible{outline:3px solid #f59e0b;outline-offset:-3px}
 `;
 document.head.append(css);
 const keys=['novo','historico','colaboradores','comercial','suprimentos'];
 const selectors=['bnav-btn-inicio','bnav-btn-rdos','bnav-btn-frequencia','bnav-btn-vendas','bnav-btn-estoque'];
 function sync(){
  const current=window.secaoAtiva;
  selectors.forEach((id,i)=>{
   const btn=document.getElementById(id);
   if(!btn||!bar.contains(btn))return;
   if(current===keys[i])btn.setAttribute('aria-current','page');
   else btn.removeAttribute('aria-current');
  });
 }
 window.addEventListener('hashchange',sync);
 bar.addEventListener('click',()=>queueMicrotask(sync));
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-nav]'))queueMicrotask(sync);
 });
 const onFocus=event=>{
  if(!window.matchMedia('(max-width:767px)').matches)return;
  if(event.target.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]'))document.body.classList.add('martins-teclado-aberto');
 };
 document.addEventListener('focusin',onFocus);
 document.addEventListener('focusout',()=>queueMicrotask(()=>{
  const focused=document.activeElement;
  if(!focused||!focused.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]'))document.body.classList.remove('martins-teclado-aberto');
 }));
 window.addEventListener('resize',()=>{if(window.innerWidth>=768)document.body.classList.remove('martins-teclado-aberto')});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
