/* Melhoria 1 — Cabeçalho compacto. Sem alterar autenticação ou RLS.
 * Contrato obrigatório: window.getUnidadesAutorizadasHeader() retorna APENAS
 * unidades autorizadas ao usuário atual, [{id, nome, empresaNome, cnpj}].
 * Sem provedor autorizado, o seletor não é exibido (fail closed).
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const style=document.createElement('style');
style.textContent=`
body>header{max-width:100%;box-sizing:border-box}
body>header>div{max-width:100%;min-width:0}
#header-empresa-seletor-container{position:relative;min-width:0;max-width:240px;flex:1 1 auto}
#btn-header-empresa-dropdown{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:40px;width:100%;padding:5px 9px;border:1px solid #475569;border-radius:10px;background:#0f172a;color:#f8fafc;text-align:left}
#header-empresa-nome-label{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:750}
#header-empresa-cnpj-sub{display:block;color:#94a3b8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#header-empresa-dropdown-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:70;width:min(320px,calc(100vw - 20px));max-height:280px;overflow:auto;border:1px solid #a16207;border-radius:12px;background:#0f172a;padding:6px;box-shadow:0 14px 30px #0006}
#header-empresa-dropdown-menu[hidden]{display:none!important}
#header-empresa-dropdown-menu button{display:block;width:100%;text-align:left;color:#f8fafc;padding:10px;border-radius:8px;min-height:44px}
#header-empresa-dropdown-menu button:hover,#header-empresa-dropdown-menu button:focus-visible{background:#334155}
#header-empresa-dropdown-menu small{display:block;color:#cbd5e1}
@media(max-width:640px){body>header{min-height:56px}body>header>div{padding-left:8px;padding-right:8px}#header-empresa-seletor-container{max-width:145px}#header-empresa-cnpj-sub{display:none}#header-empresa-dropdown-menu{right:-35px}#header-empresa-nome-label{font-size:11px}}
`;
document.head.append(style);
let selectedId=null;
function authorized(){try{const data=window.getUnidadesAutorizadasHeader?.();return Array.isArray(data)?data.filter(u=>u&&typeof u.id==='string'&&typeof u.nome==='string'):[];}catch{return [];}}
function close(){const menu=$('header-empresa-dropdown-menu'),btn=$('btn-header-empresa-dropdown');if(menu)menu.hidden=true;if(btn)btn.setAttribute('aria-expanded','false');}
function refresh(){
const root=$('header-empresa-seletor-container');if(!root)return;
const units=authorized();root.hidden=!units.length;if(!units.length){selectedId=null;close();return;}
if(!units.some(u=>u.id===selectedId))selectedId=units[0].id;
const current=units.find(u=>u.id===selectedId);$('header-empresa-nome-label').textContent=current.nome;
$('header-empresa-cnpj-sub').textContent=[current.empresaNome,current.cnpj].filter(Boolean).join(' · ');
const menu=$('header-empresa-dropdown-menu');menu.replaceChildren();
for(const unit of units){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(unit.id===selectedId));
const title=document.createElement('strong');title.textContent=unit.nome;b.append(title);
const sub=document.createElement('small');sub.textContent=[unit.empresaNome,unit.cnpj].filter(Boolean).join(' · ');b.append(sub);
b.addEventListener('click',()=>{if(!authorized().some(u=>u.id===unit.id)){refresh();return;}selectedId=unit.id;close();refresh();window.dispatchEvent(new CustomEvent('martins:unidade-visual-alterada',{detail:{unidadeId:unit.id}}));});
menu.append(b);}
}
function install(){const header=document.querySelector('body>header');if(!header||$('header-empresa-seletor-container'))return;
const layout=header.querySelector(':scope > div > div')||header.querySelector(':scope > div');if(!layout)return;
const root=document.createElement('div');root.id='header-empresa-seletor-container';root.hidden=true;
const btn=document.createElement('button');btn.id='btn-header-empresa-dropdown';btn.type='button';btn.setAttribute('aria-haspopup','listbox');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','header-empresa-dropdown-menu');
const label=document.createElement('span');label.style.minWidth='0';const name=document.createElement('span');name.id='header-empresa-nome-label';label.append(name);const sub=document.createElement('span');sub.id='header-empresa-cnpj-sub';label.append(sub);btn.append(label);
const arrow=document.createElement('span');arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');btn.append(arrow);
const menu=document.createElement('div');menu.id='header-empresa-dropdown-menu';menu.setAttribute('role','listbox');menu.hidden=true;root.append(btn,menu);
const children=[...layout.children];layout.insertBefore(root,children[Math.floor(children.length/2)]||null);
btn.addEventListener('click',()=>{refresh();if(!root.hidden){menu.hidden=!menu.hidden;btn.setAttribute('aria-expanded',String(!menu.hidden));}});
document.addEventListener('click',e=>{if(!root.contains(e.target))close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();btn.focus();}});
window.addEventListener('martins:permissoes-atualizadas',refresh);
window.addEventListener('martins:usuario-alterado',()=>{selectedId=null;refresh();});
window.atualizarSeletorEmpresaHeader=refresh;refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
