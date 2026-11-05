(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MartinsFormularios=factory();})(globalThis,()=>{'use strict';
class Guard{constructor(){this.pending=new Set}dirty(id){this.pending.add(id)}clean(id){this.pending.delete(id)}has(id){return this.pending.has(id)}leave(ids,confirm){const dirty=ids.filter(id=>this.has(id));if(!dirty.length)return true;if(!confirm('Há alterações não salvas. Deseja descartá-las e continuar?'))return false;dirty.forEach(id=>this.clean(id));return true;}}
return {Guard};});
