/* Consulta operacional: não escreve Frequência/RDO nem gera despesas. */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./integracao_jornada'),require('./planejamento_periodos'),require('./gastos_obras'));else root.MartinsPainelObra=factory(root.MartinsJornada,root.MartinsPlanejamento,root.MartinsGastosObras);})(globalThis,(J,P,G)=>{'use strict';
function report({plans,frequency,rdos,employees,works,config,ledger=[]},work,day,kind='dia',{includeCosts=false}={}){
 if(!works||!Object.hasOwn(works,work))throw Error('Selecione uma obra cadastrada');
 if(!Array.isArray(plans)||!Array.isArray(rdos)||!Array.isArray(employees)||!frequency||typeof frequency!=='object'||Array.isArray(frequency))throw Error('Fontes de equipe inválidas; dados preservados');
 const ids=new Set;for(const e of employees){if(!e||e.id===undefined||ids.has(String(e.id)))throw Error('Cadastro de colaborador ausente/duplicado');ids.add(String(e.id));}
 const days=P.period(day,kind),rows=[],warnings=[],totals={planejado:0,frequencia:0,rdoAprovado:0,rdoRascunho:0},people=new Set;
 for(const date of days){
  for(const p of plans.filter(p=>p.data===date)){if(!p.funcionarioId||!p.obra||!Number.isFinite(Number(p.horas))||Number(p.horas)<=0)throw Error('Planejamento com horas ou identificação inválida');}
  const audit=J.auditDay(plans,frequency,rdos,date,employees);warnings.push(...audit.warnings.map(s=>date+': '+s));
  for(const line of audit.lines.filter(x=>x.obra===work)){
   const employee=employees.find(e=>String(e.id)===String(line.funcionarioId)),unavailable=P.unavailable(line.funcionarioId,date,frequency,config),contract=P.employeeIssue(employee,date),allPlanned=plans.filter(p=>p.data===date&&String(p.funcionarioId)===String(line.funcionarioId)),totalPlanned=allPlanned.reduce((n,p)=>n+Number(p.horas),0),issues=[];
   if(unavailable)issues.push('Indisponibilidade: '+unavailable);if(contract)issues.push(contract);if(totalPlanned>8)issues.push('Planejamento acumulado acima de 8h entre obras');
   const duplicates=new Set;for(const p of allPlanned){if(duplicates.has(p.obra)&&!issues.includes('Planejamento duplicado para a mesma obra'))issues.push('Planejamento duplicado para a mesma obra');duplicates.add(p.obra);}
   const parts=J.allocations(frequency[date]?.[String(line.funcionarioId)]),row={...line,data:date,nome:employee?.nome||line.nome||'Cadastro não localizado',vinculo:employee?.vinculo||'Não informado',equipes:[...new Set(allPlanned.filter(p=>p.obra===work&&p.equipeId).map(p=>config.teams.find(t=>t.id===p.equipeId)?.nome||'Equipe '+p.equipeId))],outrasObrasPlanejadas:[...new Set(allPlanned.filter(p=>p.obra!==work).map(p=>p.obra))],outrasObrasRealizadas:parts.filter(p=>p.obra!==work).map(p=>({obra:p.obra,horas:p.horas})),issues,situacao:issues.length?'Conferir impedimento':line.situacao};
   rows.push(row);people.add(String(line.funcionarioId));for(const k of Object.keys(totals))totals[k]+=line[k];
  }
 }
 rows.sort((a,b)=>a.data.localeCompare(b.data)||a.nome.localeCompare(b.nome)||String(a.funcionarioId).localeCompare(String(b.funcionarioId)));
 const costs=includeCosts?G.report(ledger,{obra:work,from:days[0],to:days.at(-1)}):null;
 return {work,inicio:days[0],fim:days.at(-1),rows,totals,colaboradores:people.size,diasComEquipe:new Set(rows.map(r=>r.data)).size,warnings:[...new Set(warnings)],costs:costs?{pago:costs.pago,pendente:costs.pendente,cancelado:costs.cancelado,lancamentos:costs.rows.length}:null};
}
function csv(r){const cell=v=>'"'+String(v??'').replace(/^[\s]*[=+@\-]|^[\t\r\n]/,"'$&").replaceAll('"','""')+'"';return '\uFEFF'+[['Data','Obra','Colaborador ID','Nome','Vínculo','Equipe','Planejado h','Frequência h','RDO aprovado h','RDO rascunho h','Situação','Impedimentos','Outras obras planejadas'],...r.rows.map(x=>[x.data,r.work,x.funcionarioId,x.nome,x.vinculo,x.equipes.join('; '),x.planejado,x.frequencia,x.rdoAprovado,x.rdoRascunho,x.situacao,x.issues.join('; '),x.outrasObrasPlanejadas.join('; ')])].map(row=>row.map(cell).join(';')).join('\r\n');}
return {report,csv};});
