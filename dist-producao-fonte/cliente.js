(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MartinsProducaoClient=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 const modules=['funcionarios','obras','planejamento','rdos','frequencia','orcamentos'];
 const validId=x=>typeof x==='string'&&UUID.test(x);
 function create({rpc,context,randomUUID=()=>crypto.randomUUID()}={}){
  if(!rpc?.consultar||!rpc?.salvar||typeof context!=='function')throw Error('Transporte da v5 obrigatório');
  let generation=0;const pending=new Map();
  function identity(){const c=context();if(!validId(c?.uid))throw Error('Sessão v5 indisponível');return c;}
  function allowed(e,m,action){
   const c=identity();if(!validId(e)||!modules.includes(m))throw Error('Empresa ou módulo inválido');
   const link=c.vinculos?.find(x=>x.empresa_id===e&&x.ativo===true);
   if(link?.permissoes?.[m]?.[action]!==true)throw Error('Operação não autorizada');return c;
  }
  function unchanged(g,uid){if(g!==generation||context()?.uid!==uid)throw Error('Sessão alterada; resposta descartada');}
  async function load(e,m,id=null,{after=null,limit=100}={}){
   const c=allowed(e,m,'ler'),g=generation;
   if(id!==null&&!validId(id)||after!==null&&!validId(after)||!Number.isInteger(limit)||limit<1||limit>200)throw Error('Consulta inválida');
   const rows=await rpc.consultar({e,m,r:id,apos:after,limite:limit});unchanged(g,c.uid);
   if(!Array.isArray(rows)||rows.some(x=>x.empresa_id!==e||x.modulo!==m||!validId(x.id)||id&&x.id!==id||!Number.isSafeInteger(Number(x.revisao))||Number(x.revisao)<1||!x.dados||Array.isArray(x.dados)||typeof x.dados!=='object'))throw Error('Resposta fora do contrato');
   return structuredClone(rows);
  }
  function prepare({empresa,modulo,id=randomUUID(),revisao=0,dados,operacao=randomUUID()}){
   const c=allowed(empresa,modulo,revisao===0?'criar':'editar');
   if(!validId(id)||!validId(operacao)||!Number.isSafeInteger(revisao)||revisao<0||revisao>=Number.MAX_SAFE_INTEGER||!dados||typeof dados!=='object'||Array.isArray(dados))throw Error('Comando inválido');
   if(modulo==='rdos'&&dados.status!=='rascunho')throw Error('RDO restrito a rascunho');
   const cmd=structuredClone({usuario:c.uid,empresa,modulo,id,revisao,dados,operacao});
   if(pending.has(operacao)&&JSON.stringify(pending.get(operacao))!==JSON.stringify(cmd))throw Error('Operação reutilizada com outros dados');
   pending.set(operacao,cmd);return structuredClone(cmd);
  }
  async function send(op){
   const cmd=pending.get(op);if(!cmd)throw Error('Operação não preparada');
   const c=allowed(cmd.empresa,cmd.modulo,cmd.revisao===0?'criar':'editar');if(c.uid!==cmd.usuario)throw Error('Operação de outra conta');
   const g=generation;
   const result=await rpc.salvar({e:cmd.empresa,m:cmd.modulo,r:cmd.id,v:cmd.revisao,d:cmd.dados,op:cmd.operacao});unchanged(g,c.uid);
   if(result?.empresa_id!==cmd.empresa||result.modulo!==cmd.modulo||result.id!==cmd.id||Number(result.revisao)!==cmd.revisao+1||typeof result.repetida!=='boolean')throw Error('Gravação não confirmada; conservar mesma operação');
   const rows=await load(cmd.empresa,cmd.modulo,cmd.id);unchanged(g,c.uid);
   if(rows.length!==1||Number(rows[0].revisao)<Number(result.revisao))throw Error('Releitura não confirmou persistência; conservar mesma operação');
   return {confirmacao:structuredClone(result),registro:rows[0],confirmadoPeloServidor:true};
  }
  function exportPending(op){if(!pending.has(op))throw Error('Operação ausente');return structuredClone(pending.get(op));}
  function restore(cmd){if(cmd?.usuario!==identity().uid)throw Error('Operação de outra conta');return prepare(cmd);}
  function reset(){generation++;pending.clear();}
  return {load,prepare,send,exportPending,restore,reset};
 }
 return {create,modules};
});
