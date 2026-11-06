/* Frequência realizada: validação pura, sem rede ou alteração de RDO. */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./integracao_jornada'),require('./planejamento_periodos'));else root.MartinsFrequencia=factory(root.MartinsJornada,root.MartinsPlanejamento);})(globalThis,(J,P)=>{
'use strict';
const statuses=['presente','falta','atestado','ferias','folga','feriado','afastamento','sabado','domingo','chuva','sem_apontamento'];
const brDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
function record(previous,input,employee,day,config,works,{today=brDay()}={}){
 J.date(day);J.date(today);if(day>today)throw Error('Data futura: use o planejamento');
 const issue=P.employeeIssue(employee,day);if(issue)throw Error(issue);
 if(!statuses.includes(input.status))throw Error('Situação de frequência inválida');
 const next={...structuredClone(previous||{}),nome:employee.nome,status:input.status,obs:String(input.obs??previous?.obs??'').trim()};
 if(input.status!=='presente'){
  next.obra='';next.horas=0;for(const key of ['alocacoes','entrada','saida','horasExtras','extras'])delete next[key];return next;
 }
 const unavailable=P.unavailable(String(employee.id),day,{},config);if(unavailable)throw Error('Funcionário indisponível: '+unavailable);
 if(input.preserveAllocations){if(previous?.status!=='presente'||!Array.isArray(previous.alocacoes))throw Error('Rateio ausente; atualize a conferência');}
 else{next.obra=input.obra;next.horas=Number(input.horas);delete next.alocacoes;}
 const parts=J.allocations(next);for(const part of parts){if(!works.includes(part.obra))throw Error('Obra ausente do cadastro');if(!Number.isInteger(part.horas*4))throw Error('Horas normais devem ter intervalos de 15 minutos');}
 if(input.entrada!==undefined||input.saida!==undefined){next.entrada=String(input.entrada||'');next.saida=String(input.saida||'');}
 if(Boolean(next.entrada)!==Boolean(next.saida))throw Error('Informe entrada e saída juntas');
 if(next.entrada){const minutes=v=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('Horário inválido');const [h,m]=v.split(':').map(Number);return h*60+m;};const duration=minutes(next.saida)-minutes(next.entrada);if(duration<=0||next.horas*60>duration)throw Error('Horários incompatíveis com horas normais');}
 return next;
}
function apply(frequency,day,inputs,employees,config,works,options){
 const seen=new Set(),next=structuredClone(frequency);
 for(const input of inputs){const id=String(input.id);if(seen.has(id))throw Error('Funcionário duplicado no lançamento');seen.add(id);const matches=employees.filter(e=>String(e.id)===id);if(matches.length!==1)throw Error('Cadastro ausente ou duplicado');const value=record(frequency[day]?.[id],input,matches[0],day,config,works,options);if(!next[day])next[day]={};next[day][id]=value;}
 return next;
}
return {statuses,brDay,record,apply};});
