/* Frequência realizada: validação pura, sem rede ou alteração de RDO. */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./integracao_jornada'),require('./planejamento_periodos'));else root.MartinsFrequencia=factory(root.MartinsJornada,root.MartinsPlanejamento);})(globalThis,(J,P)=>{
'use strict';
const statuses=['presente','falta','atestado','ferias','folga','feriado','afastamento','sabado','domingo','chuva','sem_apontamento'];
const brDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
function clock(value){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))throw Error('Horário inválido');const [h,m]=value.split(':').map(Number);return h*60+m;}
function calculateHours(input){
 const start=clock(input.entrada),end=clock(input.saida),pause=Number(input.intervaloMinutos),normal=Number(input.jornadaHoras)*60;
 if(end<=start)throw Error('Saída deve ser posterior à entrada no mesmo dia');
 if(input.intervaloMinutos===''||!Number.isInteger(pause)||pause<0||pause>=end-start||pause%15)throw Error('Intervalo deve ser informado em minutos, múltiplos de 15');
 if(!Number.isInteger(normal)||normal<=0||normal>480||normal%15)throw Error('Jornada normal deve ser de até 8h, em intervalos de 15 minutos');
 const worked=end-start-pause;if(worked%15)throw Error('Horas trabalhadas devem ter intervalos de 15 minutos');
 const atrasoMinutos=input.entradaPrevista?Math.max(0,start-clock(input.entradaPrevista)):0;
 return {entrada:input.entrada,saida:input.saida,entradaPrevista:input.entradaPrevista||'',intervaloMinutos:pause,jornadaHoras:normal/60,minutosNormais:Math.min(worked,normal),minutosExtras:Math.max(0,worked-normal),atrasoMinutos};
}
function validateDetail(detail,record){
 const fresh=calculateHours(detail);for(const key of ['minutosNormais','minutosExtras','atrasoMinutos'])if(detail[key]!==fresh[key])throw Error('Detalhamento de horas inconsistente');
 if(record.status!=='presente'||Math.abs(Number(record.horas)*60-fresh.minutosNormais)>.001)throw Error('Horas normais divergem da jornada detalhada');
 if(fresh.minutosExtras&&(!Number.isSafeInteger(detail.valorHoraExtraCentavos)||detail.valorHoraExtraCentavos<=0||!detail.obraExtra))throw Error('Informe obra e valor da hora extra');
 return fresh;
}
function withHours(input,hours,actor){
 if(typeof actor!=='string'||!actor.trim())throw Error('Informe o responsável pela conferência');
 const detail=calculateHours(hours);let rate=0;
 if(detail.minutosExtras){const value=String(hours.valorHoraExtra??'');if(!/^\d+(?:\.\d{1,2})?$/.test(value))throw Error('Informe valor da hora extra com até 2 casas decimais');rate=Math.round(Number(value)*100);if(!Number.isSafeInteger(rate)||rate<=0||!hours.obraExtra)throw Error('Informe obra e valor da hora extra');}
 return {...input,horas:detail.minutosNormais/60,entrada:detail.entrada,saida:detail.saida,jornadaDetalhe:{...detail,valorHoraExtraCentavos:rate,obraExtra:detail.minutosExtras?hours.obraExtra:'',conferidoPor:actor,conferidoEm:new Date().toISOString()}};
}
const OBSERVED='cm_jornadas_observadas_v1';
function stamp(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Informe data e horário completos');J.date(value.slice(0,10));clock(value.slice(11));return Date.parse(value+':00Z');}
function previewObserved(input){const start=stamp(input.inicio),end=stamp(input.fim);if(end<=start||end-start>86400000)throw Error('Jornada observada deve durar até 24h, com fim posterior ao início');if(!Array.isArray(input.intervalos)||input.intervalos.length>20)throw Error('Intervalos inválidos');const intervals=input.intervalos.map(x=>({start:stamp(x.inicio),end:stamp(x.fim)})).sort((a,b)=>a.start-b.start);for(let i=0;i<intervals.length;i++){const x=intervals[i];if(x.start<start||x.end>end||x.end<=x.start||i&&x.start<intervals[i-1].end)throw Error('Intervalos fora da jornada ou sobrepostos');}const parts=[];for(let cursor=start;cursor<end;){const day=new Date(cursor).toISOString().slice(0,10),boundary=Date.parse(day+'T00:00:00Z')+86400000,limit=Math.min(end,boundary);const pause=intervals.reduce((n,x)=>n+Math.max(0,Math.min(limit,x.end)-Math.max(cursor,x.start)),0),minutes=(limit-cursor-pause)/60000;if(minutes>0)parts.push({data:day,minutos:minutes});cursor=limit;}if(!parts.length)throw Error('Jornada sem tempo efetivo');return {inicio:input.inicio,fim:input.fim,intervalos:structuredClone(input.intervalos),trechos:parts,minutos:parts.reduce((n,x)=>n+x.minutos,0)};}
function observedRows(list){if(!Array.isArray(list))throw Error('Base de jornadas observadas inválida');const ids=new Set;for(const row of list){if(!row||!row.id||ids.has(row.id)||typeof row.funcionarioId!=='string'||!['pendente','conferida','cancelada'].includes(row.status)||!Array.isArray(row.historico))throw Error('Jornada observada inválida ou duplicada');ids.add(row.id);const fresh=previewObserved(row);if(JSON.stringify(fresh.trechos)!==JSON.stringify(row.trechos)||fresh.minutos!==row.minutos)throw Error('Trechos da jornada observada inconsistentes');}return list;}
function addObserved(list,input,employee,actor,{id=crypto.randomUUID(),today=brDay(),now=new Date().toISOString()}={}){observedRows(list);if(!actor||!String(input.justificativa||'').trim())throw Error('Informe responsável e justificativa');const preview=previewObserved(input);if(preview.fim.slice(0,10)>J.date(today))throw Error('Jornada futura não comprova trabalho');for(const day of [preview.inicio.slice(0,10),preview.fim.slice(0,10)]){const issue=P.employeeIssue(employee,day);if(issue)throw Error(issue);}const fingerprint=JSON.stringify({...preview,funcionarioId:String(employee.id),justificativa:input.justificativa.trim()}),existing=list.find(x=>x.id===id);if(existing){if(existing.fingerprint!==fingerprint)throw Error('Identificação da jornada já utilizada');return structuredClone(list);}if(list.some(x=>x.status!=='cancelada'&&x.funcionarioId===String(employee.id)&&x.inicio<input.fim&&x.fim>input.inicio))throw Error('Jornada observada sobreposta ou duplicada');return [...structuredClone(list),{id,...preview,funcionarioId:String(employee.id),nome:employee.nome,justificativa:input.justificativa.trim(),fingerprint,status:'pendente',historico:[{acao:'observada_sem_apuracao_financeira',por:actor,em:now}]}];}
function confirmObserved(list,id,frequency,actor,{now=new Date().toISOString()}={}){observedRows(list);if(!actor)throw Error('Informe responsável');const next=structuredClone(list),row=next.find(x=>x.id===id);if(!row||row.status!=='pendente')throw Error('Jornada não disponível para conferência');for(const part of row.trechos){const expected=list.filter(x=>x.status!=='cancelada'&&x.funcionarioId===row.funcionarioId).flatMap(x=>x.trechos).filter(x=>x.data===part.data).reduce((n,x)=>n+x.minutos,0),record=frequency[part.data]?.[row.funcionarioId];if(record?.status!=='presente')throw Error('Confirme a Frequência de cada dia antes da jornada');J.allocations(record);let extra=0;if(record.jornadaDetalhe){validateDetail(record.jornadaDetalhe,record);extra=record.jornadaDetalhe.minutosExtras;}if(Math.abs(Number(record.horas)*60+extra-expected)>.001)throw Error('Frequência e jornada observada divergem em '+part.data+'; confira as horas de cada dia, sem arredondamento presumido');}row.status='conferida';row.historico.push({acao:'conferida_com_frequencia_diaria',por:actor,em:now});return next;}
function cancelObserved(list,id,reason,actor,{now=new Date().toISOString()}={}){observedRows(list);if(!actor||!String(reason||'').trim())throw Error('Informe responsável e justificativa');const next=structuredClone(list),row=next.find(x=>x.id===id);if(!row||row.status==='cancelada')throw Error('Jornada não disponível');row.status='cancelada';row.historico.push({acao:'cancelada',motivo:reason.trim(),por:actor,em:now});return next;}
function record(previous,input,employee,day,config,works,{today=brDay()}={}){
 J.date(day);J.date(today);if(day>today)throw Error('Data futura: use o planejamento');
 const issue=P.employeeIssue(employee,day);if(issue)throw Error(issue);
 if(!statuses.includes(input.status))throw Error('Situação de frequência inválida');
 const next={...structuredClone(previous||{}),nome:employee.nome,status:input.status,obs:String(input.obs??previous?.obs??'').trim()};
 if(input.status!=='presente'){
  next.obra='';next.horas=0;for(const key of ['alocacoes','entrada','saida','horasExtras','extras','jornadaDetalhe'])delete next[key];return next;
 }
 const unavailable=P.unavailable(String(employee.id),day,{},config);if(unavailable)throw Error('Funcionário indisponível: '+unavailable);
 if(input.preserveAllocations){if(previous?.status!=='presente'||!Array.isArray(previous.alocacoes))throw Error('Rateio ausente; atualize a conferência');}
 else{next.obra=input.obra;next.horas=Number(input.horas);delete next.alocacoes;}
 const parts=J.allocations(next);for(const part of parts){if(!works.includes(part.obra))throw Error('Obra ausente do cadastro');if(!Number.isInteger(part.horas*4))throw Error('Horas normais devem ter intervalos de 15 minutos');}
 if(input.entrada!==undefined||input.saida!==undefined){next.entrada=String(input.entrada||'');next.saida=String(input.saida||'');}
 if(Boolean(next.entrada)!==Boolean(next.saida))throw Error('Informe entrada e saída juntas');
 if(next.entrada){const minutes=v=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('Horário inválido');const [h,m]=v.split(':').map(Number);return h*60+m;};const duration=minutes(next.saida)-minutes(next.entrada);if(duration<=0||next.horas*60>duration)throw Error('Horários incompatíveis com horas normais');}
 if(input.jornadaDetalhe!==undefined)next.jornadaDetalhe=structuredClone(input.jornadaDetalhe);
 if(next.jornadaDetalhe){validateDetail(next.jornadaDetalhe,next);if(next.jornadaDetalhe.minutosExtras&&!works.includes(next.jornadaDetalhe.obraExtra))throw Error('Obra da hora extra ausente do cadastro');}
 return next;
}
function apply(frequency,day,inputs,employees,config,works,options){
 const seen=new Set(),next=structuredClone(frequency);
 for(const input of inputs){const id=String(input.id);if(seen.has(id))throw Error('Funcionário duplicado no lançamento');seen.add(id);const matches=employees.filter(e=>String(e.id)===id);if(matches.length!==1)throw Error('Cadastro ausente ou duplicado');const value=record(frequency[day]?.[id],input,matches[0],day,config,works,options);if(!next[day])next[day]={};next[day][id]=value;}
 return next;
}
return {OBSERVED,previewObserved,observedRows,addObserved,confirmObserved,cancelObserved,statuses,brDay,clock,calculateHours,validateDetail,withHours,record,apply};});
