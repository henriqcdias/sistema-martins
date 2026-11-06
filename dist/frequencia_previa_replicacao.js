/* Prévia pura da replicação de frequência: não grava, não presume presença. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MartinsPreviaFrequencia=factory();})(globalThis,()=>{
'use strict';
const estados=['presente','falta','atestado','ferias','folga','feriado','afastamento','sabado','domingo','chuva','sem_apontamento'];
function preview(base,dataOrigem,dataDestino,funcionarios){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dataOrigem)||!/^\d{4}-\d{2}-\d{2}$/.test(dataDestino)||dataOrigem===dataDestino)throw Error('Informe datas de origem e destino diferentes');
 if(!Array.isArray(funcionarios))throw Error('Lista de colaboradores inválida');
 const origem=base?.[dataOrigem]||{},destino=base?.[dataDestino]||{},ids=new Set(),itens=[],resumo={};
 for(const funcionario of funcionarios){
  const id=String(funcionario.id);
  if(ids.has(id))throw Error('Colaborador duplicado');ids.add(id);
  if(funcionario.status==='Inativo')continue;
  const anterior=origem[id],existente=destino[id];
  if(existente){itens.push({id,acao:'preservar_existente',status:existente.status});continue;}
  if(!anterior){itens.push({id,acao:'revisar_sem_origem',status:'sem_apontamento'});continue;}
  if(!estados.includes(anterior.status))throw Error('Status de origem inválido');
  // Nenhum status é copiado automaticamente: férias, faltas e presença precisam de conferência no novo dia.
  itens.push({id,acao:'revisar',status:anterior.status,obra:anterior.obra||''});
  resumo[anterior.status]=(resumo[anterior.status]||0)+1;
 }
 return {dataOrigem,dataDestino,itens,resumo,pendentes:itens.filter(x=>x.acao!=='preservar_existente').length,existentes:itens.filter(x=>x.acao==='preservar_existente').length};
}
return {preview};
});
