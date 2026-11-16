(function(){
 'use strict';
 const W=window,D=document,mods=['funcionarios','obras','planejamento','rdos','frequencia','orcamentos'];
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(x);
 let api=null,empresa=null,geracao=0,ocupado=0,dirty=false,diag={};
 const dados=Object.fromEntries(mods.map(m=>[m,new Map()]));let catalogos={obras:[],funcionarios:[]};
 const el=id=>D.getElementById(id),val=id=>el(id)?.value?.trim()||'';
 const hoje=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const num=v=>{if(v===''||v==null)return 0;const x=Number(String(v).replace(',','.'));if(!Number.isFinite(x))throw Error('Valor numérico inválido');return x;};
 const clone=x=>structuredClone(x);
 function mensagem(texto,erro=false){const s=el('producao-status');if(s){s.textContent=texto;s.dataset.erro=String(erro);}if(erro&&W.showToast)W.showToast(texto,'error');}
  W.renderizarContextoOperacionalWork = function (barra) {
    const ctx = W.obterContextoSegurancaAutenticadoWork?.();
    if (!barra || !ctx || !Array.isArray(ctx.vinculos)) return { sucesso: false };
    const empresaId = W.empresaFrequenciaWork;
    const vinculo = ctx.vinculos.find(v => v.empresa_id === empresaId);
    barra.replaceChildren();
    const titulo = D.createElement('strong');
    titulo.textContent = 'Contexto empresarial · prévia somente leitura';
    barra.append(titulo);
    const info = D.createElement('span');
    info.className = 'ml-3';
    if (vinculo) {
      info.textContent = 'Empresa: ' + (vinculo.nomeEmpresa || empresaId) + ' · Perfil: ' + (vinculo.papel || vinculo.papelServidor || 'Operacional');
    } else {
      info.textContent = 'Selecione uma empresa autorizada no cabeçalho.';
    }
    barra.append(info);
    return { sucesso: true, empresaAutorizada: Boolean(vinculo) };
  };
 function contexto(){return W.obterContextoSegurancaAutenticadoWork?.();}
 function permissao(m,a){return contexto()?.vinculos.find(v=>v.empresa_id===empresa)?.permissoes?.[m]?.[a]===true;}
 function registro(m,id){return dados[m].get(id);}
 function requireEmpresa(){if(!uuid(empresa)||!contexto()?.empresas.includes(empresa))throw Error('Selecione a empresa autorizada no cabeçalho.');return empresa;}
 function referencia(tipo,id,opcional=false){if(!id&&opcional)return null;if(!uuid(id)||!catalogos[tipo].some(x=>x.id===id))throw Error('Selecione '+(tipo==='obras'?'uma obra':'um funcionário')+' da empresa ativa.');return id;}
 // As cópias para os renderizadores legados não são a fonte dos dados editáveis.
 const seguro=x=>typeof x==='string'?x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'’').replaceAll('\\','＼'):Array.isArray(x)?x.map(seguro):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,seguro(v)])):x;
 function listar(m){return [...dados[m].values()].map(r=>({...clone(r.dados),id:r.id,empresaId:r.empresa_id,empresa_id:r.empresa_id,remote_id:r.id,rowVersion:r.revisao,revisao:r.revisao}));}
 function visao(m){return seguro(listar(m).map(r=>({...r,empresa:contexto()?.vinculos.find(v=>v.empresa_id===r.empresa_id)?.nomeEmpresa||'',...(m==='funcionarios'?{obraId:r.obra_id||null,obra:catalogos.obras.find(o=>o.id===r.obra_id)?.nome||''}:{})})));}
 function tabelaFrequencia(){const out={};for(const r of listar('frequencia')){out[r.data]??={};const p=out[r.data][r.funcionario_id]??={colabId:r.funcionario_id,nome:catalogos.funcionarios.find(x=>x.id===r.funcionario_id)?.nome||'',status:r.situacao,horas:0,he50:0,he100:0,alocacoes:[]};p.horas+=Number(r.horas_normais);p.he50+=Number(r.horas_extras||0);p.obra=r.obra_id||'';p.obraId=r.obra_id||'';p.rowVersion=r.revisao;p.alocacoes.push(r);}return seguro(out);}
 function instalarLeituras(){
  W.getColaboradoresDb=()=>visao('funcionarios');W.getDb=()=>visao('rdos').map(r=>({...r,num:r.numero,obra:seguro(catalogos.obras.find(o=>o.id===r.obra_id)?.nome||''),obraId:r.obra_id,cliente:seguro(registro('obras',r.obra_id)?.dados.clienteResponsavel||''),resp:r.responsavel||'',status:'Rascunho'}));
  W.getFrequenciaDiariaDb=tabelaFrequencia;
  W.obterOrcamentosComerciaisUnificadosV167=()=>visao('orcamentos');
  W.sincronizarEObterColaboradoresReaisV169=()=>({sucesso:true,colaboradores:visao('funcionarios')});
  W.garantirTodosFuncionariosCarregadosFase31=()=>visao('funcionarios');
  W.obterCatalogoUnificadoObrasErp=()=>visao('obras');W.obterCatalogoUnificadoObrasSemDuplicidade=W.obterCatalogoUnificadoObrasErp;
  W.obterObrasAtivasAutorizadasUnificadas=()=>visao('obras');
 }
 function preencherSelect(s,lista,label='Selecione...',prefixo=''){
  if(!s)return;const prev=s.value;const assinatura=JSON.stringify(lista.map(x=>[x.id,x.nome]));
  if(s.dataset.catalogoProducao===assinatura)return;s.dataset.catalogoProducao=assinatura;
  s.replaceChildren(new Option(label,''));for(const x of lista)s.add(new Option(x.nome,prefixo+x.id));
  if([...s.options].some(o=>o.value===prev))s.value=prev;
 }
 function seletores(){
  for(const f of D.querySelectorAll('#form-novo-orcamento-venda'))if(!el('orc-inp-obra')){const label=D.createElement('label');label.textContent='Obra vinculada (opcional)';const select=D.createElement('select');select.id='orc-inp-obra';select.className='w-full border rounded p-2';label.append(select);f.prepend(label);}
  for(const s of D.querySelectorAll('.sel-trab-cadastrado')){const item=typeof currentTrabalhadores!=='undefined'?currentTrabalhadores[Number(s.dataset.index)]:null;preencherSelect(s,catalogos.funcionarios,'Selecione o funcionário');if(item?.funcionario_id&&catalogos.funcionarios.some(x=>x.id===item.funcionario_id))s.value=item.funcionario_id;}

  for(const id of ['obra-select','gestao-obra-select','nc-obra','edit-colab-obra','filtro-obra-hist','orc-inp-obra','atividade-obra-select','ficha-inp-obra']){const s=el(id);if(s?.tagName==='SELECT'){preencherSelect(s,catalogos.obras,id==='filtro-obra-hist'?'Todas as obras':'Selecione a obra');if(id==='filtro-obra-hist'&&s.options[0])s.options[0].value='todas';}}
  for(const id of ['select-add-trabalhador','colab-select','rf-colab-select','rel-colab-select'])if(el(id)?.tagName==='SELECT')preencherSelect(el(id),catalogos.funcionarios,'Selecione o funcionário');
  for(const s of D.querySelectorAll('.sel-destino-ponto')){
   const key=JSON.stringify(catalogos.obras);if(s.dataset.catalogoProducao===key)continue;const prev=s.value;
   s.replaceChildren(new Option('Selecione destino ou situação',''));
   for(const x of catalogos.obras)s.add(new Option(x.nome,'OBRA:'+x.id));
   for(const [id,nome] of [['falta','Falta'],['folga','Folga'],['ferias','Férias'],['atestado','Atestado']])s.add(new Option(nome,'STATUS:'+id));
   s.dataset.catalogoProducao=key;if([...s.options].some(o=>o.value===prev))s.value=prev;
   const row=s.closest('tr');if(row&&!row.querySelector('.freq-inp-horas')){const input=D.createElement('input');input.type='number';input.min='0';input.max='8';input.step='0.25';input.className='freq-inp-horas w-20 border rounded p-1';input.setAttribute('aria-label','Horas normais de '+(row.dataset.colabNome||'funcionário'));const obra=s.value.startsWith('OBRA:')?s.value.slice(5):null;const atual=listar('frequencia').find(x=>x.funcionario_id===row.dataset.colabId&&x.obra_id===obra&&x.data===(val('ponto-data-filtro')||val('freq-input-data')));input.value=atual?.horas_normais??8;s.after(input);}

  }
  for(const s of D.querySelectorAll('#orc-inp-empresa,#ficha-inp-empresa')){const c=contexto();preencherSelect(s,(c?.vinculos||[]).map(v=>({id:v.empresa_id,nome:v.nomeEmpresa})));s.value=empresa||'';s.disabled=true;}
 }
 function atualizarVisoes(){
  instalarLeituras();W.colaboradoresDb=visao('funcionarios');W.funcionariosDb=W.colaboradoresDb;W.colaboradoresOficialDb=W.colaboradoresDb;
  W.empreendimentosObrasDb=visao('obras');W.orcamentosComerciaisDb=visao('orcamentos');
  W.etapasPlanejamentoObraDb=visao('planejamento');
  // A fonte lexical original é mantida; apenas sua projeção de tela é atualizada.
  if(typeof dadosObras==='object'&&dadosObras){for(const k of Object.keys(dadosObras))delete dadosObras[k];for(const r of visao('obras'))dadosObras[r.id]={...r,cliente:r.clienteResponsavel||'',resp:r.responsavelTecnico||'',contrato:r.valorContratado||0,medido:0,itensMedicao:r.itensMedicao||[],planilhaRef:r.planilhaRef||[],obs:r.obs||[]};}
  for(const name of ['renderColaboradoresTable','filtrarERenderizarQuadroColaboradoresV169','renderListaOrcamentosVendas','renderHistorico','renderAuditoriaPonto'])try{W[name]?.();}catch(error){console.warn('Projeção de tela',name,error.message);}
  seletores();
 }
 const ROTULOS={conexao:'falha de conexão com o Supabase',permissao:'acesso negado pelo servidor (permissão ou sessão)',contrato:'função ou schema indisponível na API do Supabase',limite:'limite de requisições do Supabase',resposta:'resposta fora do contrato esperado'};
 function classificarFalha(erro){
  const c=String(erro?.code||''),t=String(erro?.message||'');
  if(c==='QA_REDE')return 'conexao';
  if(c==='429'||/rate_limit/i.test(c))return 'limite';
  if(['PGRST106','PGRST202','404','42883','CONFIGURACAO'].includes(c))return 'contrato';
  if(['42501','401','403','PGRST301'].includes(c)||/não autorizada|sess[ãa]o expirada/i.test(t))return 'permissao';
  return 'resposta';
 }
 async function carregar(){
  const e=requireEmpresa(),g=geracao,uid=contexto().uid;
  const perms=contexto().vinculos.find(x=>x.empresa_id===e).permissoes;
  const modulos=mods.filter(m=>perms[m]?.ler);
  const vazio={empresa_id:e,obras:[],funcionarios:[]};
  const carregarCatalogo=async()=>{
   if(!modulos.length)return vazio;
   const cat=await W.MartinsProducaoRpc.catalogos(e);
   if(cat?.empresa_id!==e||!Array.isArray(cat.obras)||!Array.isArray(cat.funcionarios)||
      [...cat.obras,...cat.funcionarios].some(x=>!uuid(x?.id)))throw Error('Catálogo inválido.');
   return cat;
  };
  const resultados=await Promise.allSettled([carregarCatalogo(),...modulos.map(async m=>{
   const rows=[];let after=null;
   for(let i=0;i<1000;i++){
    const page=await api.load(e,m,null,{after,limit:200});rows.push(...page);
    if(page.length<200)return rows;
    after=page.at(-1).id;
   }
   throw Error('Consulta exige paginação adicional.');
  })]);
  if(g!==geracao||e!==empresa||contexto()?.uid!==uid)return;
  catalogos=resultados[0].status==='fulfilled'?resultados[0].value:vazio;
  for(const m of mods)dados[m].clear();
  const falhas=[],causas={};
  if(resultados[0].status==='rejected'){falhas.push('catálogo');causas['catálogo']=classificarFalha(resultados[0].reason);}
  const vazios=[];
  modulos.forEach((m,i)=>{
   const resultado=resultados[i+1];
   if(resultado.status==='fulfilled'){resultado.value.forEach(r=>dados[m].set(r.id,r));if(!resultado.value.length)vazios.push(m);}
   else{falhas.push(m);causas[m]=classificarFalha(resultado.reason);}
  });
  // Diferencia: sem permissão de leitura, falha (conexão/permissão/contrato) e consulta vazia sem erro.
  const semLeitura=mods.filter(m=>!perms[m]?.ler);
  const estadoFunc=semLeitura.includes('funcionarios')?'sem_permissao_leitura':causas.funcionarios||causas['catálogo']||(vazios.includes('funcionarios')?'vazio':'ok');
  diag={empresa:e,funcionarios:estadoFunc,falhas:{...causas},semLeitura:[...semLeitura],vazios:[...vazios]};
  D.body.dataset.empresaProducao='ativa';D.body.dataset.cargaFuncionarios=estadoFunc;atualizarVisoes();resumo();
  const nomeEmpresa=contexto().vinculos.find(x=>x.empresa_id===e)?.nomeEmpresa||e;
  const detalhes=[...new Set(Object.values(causas))].map(c=>ROTULOS[c]);
  const avisos=[];
  if(semLeitura.includes('funcionarios'))avisos.push('Este vínculo não tem permissão de leitura de Funcionários; peça a liberação ao administrador.');
  if(estadoFunc==='vazio')avisos.push('A consulta de Funcionários respondeu sem erro e não há funcionários cadastrados nesta empresa.');
  const erro=falhas.length>0||semLeitura.includes('funcionarios');
  mensagem(falhas.length?'Consulta indisponível: '+falhas.join(', ')+'. Motivo: '+detalhes.join('; ')+'. '+avisos.join(' ')+' Use Atualizar dados.':
   'Consulta concluída para '+nomeEmpresa+'.'+(avisos.length?' '+avisos.join(' '):''),erro);
 }
 function zerar(){diag={};delete D.body.dataset.cargaFuncionarios;geracao++;api?.reset();api=null;empresa=null;for(const m of mods)dados[m].clear();catalogos={obras:[],funcionarios:[]};D.body.dataset.sessaoProducao='inativa';D.body.dataset.empresaProducao='pendente';instalarLeituras();}
 function usuarioInterface(c){const v=c?.vinculos.find(x=>x.empresa_id===empresa);const user=c?{...c,perfil:v?.papelServidor==='master'?'Master':v?.permissoes.funcionarios?.ler?'RH':'Operacional',empresaId:empresa}:null;W.currentLoggedUser=user;if(typeof currentLoggedUser!=='undefined')currentLoggedUser=user;}
 W.MartinsProducaoOnSession=async c=>{
  zerar();if(!c){usuarioInterface(null);return;}empresa=W.empresaFrequenciaWork;usuarioInterface(c);api=W.MartinsProducaoClient.create({rpc:W.MartinsProducaoRpc,context:contexto});
  D.body.dataset.sessaoProducao='ativa';
  if(empresa)await carregar();else {D.body.dataset.empresaProducao='ativa';atualizarVisoes();mensagem('Selecione sua empresa para consultar os dados.');}
 };
 W.MartinsProducaoOnEmpresa=()=>{};
 async function enviar(modulo,conteudo,id=null,rev=null){
  const e=requireEmpresa();if(!api)throw Error('Entre com sua sessão v5.');const antigo=id?registro(modulo,id):null;
  if(id&&!antigo)throw Error('Registro não encontrado na empresa ativa. Recarregue a consulta.');
  const d={...(antigo?.dados||{}),...clone(conteudo)};delete d.id;delete d.empresaId;delete d.empresa_id;delete d.revisao;delete d.rowVersion;
  return W.MartinsProducaoRpc.comRascunho(e,async(estado,persistir)=>{
   estado.pendentes??={};let cmd=estado.pendentes[modulo];
   if(cmd){if(JSON.stringify(cmd.dados)!==JSON.stringify(d)||cmd.id!==(id||cmd.id))throw Error('Há uma operação pendente deste módulo. Use Reenviar pendentes antes de alterar os dados.');api.restore(cmd);}
   else{cmd=api.prepare({empresa:e,modulo,id:id||crypto.randomUUID(),revisao:rev??antigo?.revisao??0,dados:d});estado.pendentes[modulo]=cmd;await persistir();}
   const result=await api.send(cmd.operacao);delete estado.pendentes[modulo];await persistir();
   dados[modulo].set(result.registro.id,result.registro);return result.registro;
  });
 }
 function snapshot(form,id,m){const r=id&&registro(m,id);return form.dataset.revisaoProducao?Number(form.dataset.revisaoProducao):r?.revisao??0;}
 async function formularioFuncionario(form){
  const ficha=form.id==='form-editar-ficha-colab-estab',editar=ficha||form.id==='form-editar-colaborador',p=ficha?'ficha-inp-':editar?'edit-colab-':'nc-',id=ficha?form.dataset.registroProducao:editar?val('edit-colab-id'):null;
  const dados={nome:val(p+'nome'),cpf:val(p+'cpf'),rg:val(p+'rg'),funcao:val(p+'funcao'),vinculo:val(p+'vinculo'),dataAdmissao:val(p+'admissao'),status:ficha?(registro('funcionarios',id)?.dados.status||'Ativo'):editar?val('edit-colab-status'):'Ativo',obs:val(p+'obs'),obra_id:referencia('obras',val(p+'obra'),true)};
  if(ficha&&el('ficha-inp-salario'))dados.salarioBase=num(val('ficha-inp-salario'));
  if(!dados.nome||!dados.funcao)throw Error('Informe nome e função do funcionário.');
  await enviar('funcionarios',dados,id,editar?snapshot(form,id,'funcionarios'):0);
 }
 async function formularioObra(form){
  const editar=form.id==='form-gestao-obra',id=editar?(form.dataset.registroProducao||val('gestao-obra-select')):null,p=editar?'mo-':'nova-obra-';
  const d={nome:val(p+'nome'),clienteResponsavel:val(p+'cliente'),valorContratado:num(val(editar?'mo-valor':'nova-obra-valor')),responsavelTecnico:val(p+'resp'),dataInicio:val('mo-data-inicio'),previsaoConclusao:val('mo-data-fim'),situacaoAtual:editar?val('mo-status'):'Em Planejamento'};
  if(!d.nome||!d.clienteResponsavel||d.valorContratado<0)throw Error('Confira nome, cliente e valor da obra.');
  d.codigo=editar?registro('obras',id)?.dados.codigo:'OBR-'+crypto.randomUUID().slice(0,8).toUpperCase();
  await enviar('obras',d,id,editar?snapshot(form,id,'obras'):0);
 }
 function trabalhadoresRdo(){
  const list=typeof currentTrabalhadores!=='undefined'?currentTrabalhadores:W.currentTrabalhadores||[];
  return list.map(t=>{const id=t.funcionario_id||t.colaborador_id||t.id||(uuid(t.nome)?t.nome:null);referencia('funcionarios',id);return {...clone(t),id,funcionario_id:id,nome:catalogos.funcionarios.find(x=>x.id===id).nome};});
 }
 async function formularioRdo(form){
  const id=form.dataset.registroProducao||null,obra=referencia('obras',val('obra-select'));
  const d={obra_id:obra,data:val('input-data'),numero:id?registro('rdos',id)?.dados.numero:null,status:'rascunho',responsavel:val('resp-select')||contexto().nome,servicos:val('textarea-servicos'),climaManha:val('clima-manha'),pratManha:val('prat-manha'),climaTarde:val('clima-tarde'),pratTarde:val('prat-tarde'),equipamentos:val('textarea-equipamentos'),materiais:val('textarea-materiais'),ocorrencias:val('textarea-ocorrencias'),trabalhadores:trabalhadoresRdo(),fotos:typeof currentFotos!=='undefined'?clone(currentFotos):[]};
  if(!d.data||!d.servicos)throw Error('Preencha data e serviços do RDO.');
  const r=await enviar('rdos',d,id,id?snapshot(form,id,'rdos'):0);form.dataset.registroProducao=r.id;form.dataset.revisaoProducao=r.revisao;el('input-rdo-num').value=r.dados.numero;
 }
 function itensOrcamento(){
  const itens=W.linhasOrcamentoModal;if(!Array.isArray(itens)||!itens.length)throw Error('Adicione os itens do orçamento.');
  return itens.map(x=>({desc:x.desc||x.descricao||'',unid:x.unid||x.unidade||'UN',qtd:num(x._raw_qtd??x.qtd??x.quantidade),metragem:num(x._raw_metragem??x.metragem??1),precoUnit:num(x._raw_precoUnit??x.precoUnit??x.precoUnitario??x.unit),descontoPct:num(x._raw_descontoPct??x.descontoPct),acrescimoPct:num(x._raw_acrescimoPct??x.acrescimoPct),...(x._raw_totalEditavel!==undefined&&String(x._raw_totalEditavel).trim()!==''?{totalEditado:num(x._raw_totalEditavel)}:{})}));
 }
 async function formularioOrcamento(form){
  const id=W.currentEditingOrcamentoId||form.dataset.registroProducao||null,cliente=val('orc-inp-cliente');if(!cliente)throw Error('Informe o cliente.');
  await enviar('orcamentos',{nome:'Orçamento · '+cliente,cliente,itens:itensOrcamento(),condicoes:val('orc-inp-condicoes'),prazo:val('orc-inp-prazo'),obra_id:referencia('obras',val('orc-inp-obra'),true),status:registro('orcamentos',id)?.dados.status||'Em Orçamento',data:registro('orcamentos',id)?.dados.data||hoje()},id,id?snapshot(form,id,'orcamentos'):0);W.currentEditingOrcamentoId=null;
 }
 function resumo(){
  const painel=el('view-painel');if(!painel)return;el('resumo-producao')?.remove();const sec=D.createElement('section');sec.id='resumo-producao';sec.className='space-y-4';
  const h=D.createElement('h2');h.className='text-xl font-bold';h.textContent='Operação · '+(contexto()?.vinculos.find(x=>x.empresa_id===empresa)?.nomeEmpresa||'Selecione a empresa');sec.append(h);
  const cards=D.createElement('div');cards.className='grid grid-cols-2 md:grid-cols-5 gap-3';for(const m of ['funcionarios','obras','rdos','frequencia','orcamentos']){const c=D.createElement('div');c.className='bg-white border rounded-xl p-4';c.textContent=m+': '+dados[m].size;cards.append(c);}sec.append(cards);
  for(const o of catalogos.obras){const b=D.createElement('button');b.type='button';b.className='block bg-white border rounded p-3 w-full text-left';b.textContent=o.nome;b.onclick=()=>{if(el('gestao-obra-select'))el('gestao-obra-select').value=o.id;try{W.renderGestaoObra?.(o.id);}catch{}D.querySelector('[data-view="gestao-obras"]')?.click();};sec.append(b);}painel.append(sec);
 }
 const handlers={'form-novo-colaborador':formularioFuncionario,'form-editar-colaborador':formularioFuncionario,'form-editar-ficha-colab-estab':formularioFuncionario,'form-nova-obra-sistema':formularioObra,'form-gestao-obra':formularioObra,'form-rdo':formularioRdo,'form-novo-orcamento-venda':formularioOrcamento};
 async function submeter(form){
  if(form.dataset.enviandoProducao==='1')return;form.dataset.enviandoProducao='1';ocupado++;
  const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);const controls=[...form.querySelectorAll('input,select,textarea')].map(x=>[x,x.disabled]);controls.forEach(([x])=>x.disabled=true);mensagem('Aguardando confirmação do Supabase…');
  try{await handlers[form.id](form);dirty=false;await carregar();mensagem('Salvamento confirmado e relido no Supabase.');if(form.id!=='form-rdo'){form.closest('[id^=modal-]')?.classList.add('hidden');delete form.dataset.registroProducao;delete form.dataset.revisaoProducao;}}
  catch(error){mensagem((error.code==='40001'?'Outra sessão alterou este registro. Seu formulário foi preservado. Recarregue para comparar. ': '')+error.message,true);}
  finally{ocupado--;form.dataset.enviandoProducao='0';buttons.forEach(b=>b.disabled=false);controls.forEach(([x,disabled])=>x.disabled=disabled);}
 }
 async function confirmarLote(e,m,itens,result){
  if(!Array.isArray(result)||result.length!==itens.length||itens.some(item=>!result.some(x=>x.empresa_id===e&&x.modulo===m&&x.id===item.r&&Number(x.revisao)===item.v+1&&typeof x.repetida==='boolean')))throw Error('Lote não confirmado; conserve as operações pendentes.');
  for(const item of itens){const rows=await api.load(e,m,item.r);if(rows.length!==1||Number(rows[0].revisao)<item.v+1)throw Error('Releitura do lote não confirmou a persistência.');}
 }
 async function frequencia(){
  if(ocupado)return;const e=requireEmpresa(),data=val('ponto-data-filtro')||val('freq-input-data')||hoje();
  const rows=[...D.querySelectorAll('#tbody-auditoria-ponto tr[data-colab-id]')].filter(r=>r.dataset.dirty==='true');if(!rows.length)throw Error('Altere ou selecione os apontamentos que deseja salvar.');
  const itens=rows.map(row=>{const pessoa=referencia('funcionarios',row.dataset.colabId),destino=row.querySelector('.sel-destino-ponto')?.value||'';if(!destino)throw Error('Escolha obra ou situação para cada linha alterada.');
   const situacao=destino.startsWith('OBRA:')?'presente':destino.replace('STATUS:',''),obra=situacao==='presente'?referencia('obras',destino.slice(5)):null;
   const anterior=listar('frequencia').find(x=>x.funcionario_id===pessoa&&x.data===data&&(x.obra_id||null)===obra);
   const d={funcionario_id:pessoa,obra_id:obra,data,situacao,horas_normais:situacao==='presente'?num(row.querySelector('.freq-inp-horas')?.value||8):0,horas_extras:situacao==='presente'?num(row.querySelector('.freq-inp-he50')?.value)+num(row.querySelector('.freq-inp-he100')?.value):0,obs:row.querySelector('.inp-obs-ponto,.freq-inp-obs')?.value||''};
   return {r:anterior?.id||crypto.randomUUID(),v:anterior?.revisao||0,d,op:crypto.randomUUID()};});
  ocupado++;try{await W.MartinsProducaoRpc.comRascunho(e,async(estado,persistir)=>{estado.pendentes??={};if(estado.pendentes.frequencia)throw Error('Há frequência pendente. Use Reenviar pendentes.');estado.pendentes.frequencia={lote:true,e,m:'frequencia',itens};await persistir();const result=await W.MartinsProducaoRpc.lote({e,m:'frequencia',itens});await confirmarLote(e,'frequencia',itens,result);delete estado.pendentes.frequencia;await persistir();});rows.forEach(r=>delete r.dataset.dirty);dirty=false;await carregar();mensagem('Frequência confirmada pelo servidor.');}finally{ocupado--;}
 }
 function inicializar(){
  instalarLeituras();D.body.dataset.sessaoProducao='inativa';
  W.verificarSessaoAtivaOuExpirada=()=>({ativa:!!contexto(),motivo:contexto()?'SUPABASE_AUTH_V5':'SEM_SESSAO'});
  W.exigirSessaoAutenticadaValida=()=>({autenticado:!!contexto(),usuario:W.currentLoggedUser,codigo:contexto()?null:'SESSAO_NECESSARIA'});
  const barra=D.createElement('div');barra.className='bg-slate-900 text-white p-3 flex flex-wrap items-center gap-3 no-print';barra.id='barra-producao';
  const status=D.createElement('span');status.id='producao-status';status.setAttribute('role','status');status.textContent='Entre com a autenticação Supabase v5.';barra.append(status);
  const recarregar=D.createElement('button');recarregar.type='button';recarregar.textContent='Atualizar dados';recarregar.onclick=()=>{if(dirty&&!confirm('O formulário contém alterações. Deseja atualizar as consultas sem salvar?'))return;carregar().catch(x=>mensagem(x.message,true));};barra.append(recarregar);
  const pendentes=D.createElement('button');pendentes.disabled=true;pendentes.type='button';pendentes.textContent='Reenviar pendentes';pendentes.onclick=async()=>{try{await W.MartinsProducaoRpc.comRascunho(requireEmpresa(),async(estado,persistir)=>{for(const [m,cmd]of Object.entries(estado.pendentes||{})){if(cmd.lote){const result=await W.MartinsProducaoRpc.lote({e:cmd.e,m:cmd.m,itens:cmd.itens});await confirmarLote(cmd.e,cmd.m,cmd.itens,result);}else{api.restore(cmd);await api.send(cmd.operacao);}delete estado.pendentes[m];await persistir();}});await carregar();mensagem('Operações pendentes reconciliadas.');}catch(x){mensagem(x.message,true);}};barra.append(pendentes);
  el('main-app-header')?.after(barra);if(!barra.isConnected)D.body.prepend(barra);
  W.exibirSessaoQaWork=()=>{if(!contexto())return;D.body.dataset.sessaoProducao='ativa';W.atualizarInterfaceUsuario?.();el('tela-login-gate')?.classList.add('hidden');W.renderizarEmpresaSessaoQaWork?.();};
  D.addEventListener('submit',event=>{const form=event.target;if(handlers[form.id]){event.preventDefault();event.stopImmediatePropagation();submeter(form);}else if(form.id==='form-login-gate'){event.preventDefault();event.stopImmediatePropagation();login(form);}},true);
  D.addEventListener('change',event=>{
   if(event.target.matches?.('.sel-trab-cadastrado')){event.stopImmediatePropagation();const s=event.target,id=referencia('funcionarios',s.value),c=catalogos.funcionarios.find(x=>x.id===id);if(typeof currentTrabalhadores!=='undefined'){const i=Number(s.dataset.index);currentTrabalhadores[i]={...currentTrabalhadores[i],id,funcionario_id:id,nome:seguro(c.nome),funcao:seguro(c.funcao||'')};W.renderTrabalhadoresTable?.();}dirty=true;return;}
   const row=event.target.closest?.('#tbody-auditoria-ponto tr');if(row){row.dataset.dirty='true';dirty=true;}},true);
  D.addEventListener('input',event=>{if(event.target.closest&&Object.keys(handlers).some(id=>event.target.closest('#'+id)))dirty=true;},true);
  D.addEventListener('focusin',event=>{const form=event.target.closest?.('form');if(!form||form.dataset.revisaoProducao)return;const m=form.id.includes('colaborador')?'funcionarios':form.id==='form-rdo'?'rdos':form.id==='form-gestao-obra'?'obras':form.id==='form-novo-orcamento-venda'?'orcamentos':null;
   const id=m==='funcionarios'?val('edit-colab-id'):m==='obras'?val('gestao-obra-select'):m==='orcamentos'?W.currentEditingOrcamentoId:form.dataset.registroProducao;
   if(m&&id&&registro(m,id)){form.dataset.registroProducao=id;form.dataset.revisaoProducao=registro(m,id).revisao;}
  },true);
  W.salvarNovaObraSistema=event=>{event?.preventDefault();return submeter(el('form-nova-obra-sistema'));};
  W.salvarCadastroUnicoColaboradorSemDuplicidadeV170=event=>{event?.preventDefault?.();return submeter(el(event?.target?.id==='form-editar-colaborador'?'form-editar-colaborador':'form-novo-colaborador'));};
  W.salvarEdicaoColaboradorModal=()=>submeter(el('form-editar-colaborador'));
  W.salvarNovoOrcamentoVendaForm=event=>{event?.preventDefault();return submeter(el('form-novo-orcamento-venda'));};
  W.salvarFrequenciaDiariaDoDia=()=>frequencia().catch(x=>mensagem(x.message,true));
  W.salvarRdo=(status)=>{if(status&&status.toLowerCase()!=='rascunho'){mensagem('Aprovação e assinatura exigem contrato próprio. O RDO operacional é salvo como rascunho.',true);return;}return submeter(el('form-rdo'));};
  const oldEdit=W.abrirModalEditarColaborador;W.abrirModalEditarColaborador=id=>{oldEdit?.(id);const r=registro('funcionarios',id);if(!r)return;const f=el('form-editar-colaborador');f.dataset.registroProducao=id;f.dataset.revisaoProducao=r.revisao;for(const [field,key]of [['nome','nome'],['cpf','cpf'],['rg','rg'],['funcao','funcao'],['vinculo','vinculo'],['admissao','dataAdmissao'],['status','status'],['obra','obra_id'],['obs','obs']])if(el('edit-colab-'+field))el('edit-colab-'+field).value=r.dados[key]||'';};
  const oldFicha=W.abrirFichaColaborador;W.abrirFichaColaborador=id=>{
    oldFicha?.(id);const r=registro('funcionarios',id),f=el('form-editar-ficha-colab-estab');if(!r||!f)return;f.dataset.registroProducao=id;f.dataset.revisaoProducao=r.revisao;
    for(const [field,key]of [['nome','nome'],['cpf','cpf'],['funcao','funcao'],['admissao','dataAdmissao'],['salario','salarioBase']])if(el('ficha-inp-'+field))el('ficha-inp-'+field).value=r.dados[key]??'';
    if(el('ficha-inp-obra')?.tagName!=='SELECT'){const old=el('ficha-inp-obra');if(old){const select=D.createElement('select');select.id=old.id;select.className=old.className;old.replaceWith(select);}}
    seletores();if(el('ficha-inp-obra'))el('ficha-inp-obra').value=r.dados.obra_id||'';
  };
  const oldRdo=W.carregarRdoParaEdicao;W.carregarRdoParaEdicao=id=>{oldRdo?.(id);const r=registro('rdos',id);if(!r)return;const f=el('form-rdo');f.dataset.registroProducao=id;f.dataset.revisaoProducao=r.revisao;el('obra-select').value=r.dados.obra_id;};
  for(const b of D.querySelectorAll('header button'))if(/Nuvem Sincronizada/.test(b.textContent))b.hidden=true;
  if(el('btn-salvar-rdo'))el('btn-salvar-rdo').textContent='Salvar rascunho no Supabase';
  if(el('input-rdo-num')){el('input-rdo-num').required=false;el('input-rdo-num').readOnly=true;el('input-rdo-num').placeholder='Automático no servidor';}
  for(const id of ['nova-obra-cliente','nova-obra-valor','nova-obra-resp'])if(el(id))el(id).defaultValue='';
  new MutationObserver(()=>{if(contexto()){seletores();const f=el('form-gestao-obra'),id=val('gestao-obra-select');if(f&&!f.closest('[id^=modal-]')?.classList.contains('hidden')&&f.dataset.registroProducao!==id&&registro('obras',id)){f.dataset.registroProducao=id;f.dataset.revisaoProducao=registro('obras',id).revisao;const r=registro('obras',id).dados;for(const [field,k]of [['nome','nome'],['cliente','clienteResponsavel'],['valor','valorContratado'],['resp','responsavelTecnico'],['data-inicio','dataInicio'],['data-fim','previsaoConclusao']])if(el('mo-'+field))el('mo-'+field).value=r[k]??'';}}}).observe(D.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  D.addEventListener('click',event=>{if(event.target.closest?.('#btn-limpar-form')){event.preventDefault();event.stopImmediatePropagation();if(!confirm('Limpar o formulário? Operações pendentes permanecerão protegidas para reconciliação.'))return;const f=el('form-rdo');f.reset();delete f.dataset.registroProducao;delete f.dataset.revisaoProducao;if(typeof currentTrabalhadores!=='undefined')currentTrabalhadores=[];if(typeof currentFotos!=='undefined')currentFotos=[];dirty=false;W.renderTrabalhadoresTable?.();W.renderFotosGrid?.();return;}
   const b=event.target.closest?.('#btn-logout-header');if(b){event.preventDefault();event.stopImmediatePropagation();W.encerrarSessaoSupabaseWork().finally(()=>location.reload());}},true);
 }
 async function login(form){const b=el('btn-entrar-gate');if(b.disabled)return;b.disabled=true;try{const r=await W.autenticarUsuarioSupabaseWork(val('gate-usuario-input'),el('gate-senha-input').value);if(!r.sucesso)throw Error(r.erro);el('gate-senha-input').value='';W.exibirSessaoQaWork();}catch(error){if(el('login-erro-msg'))el('login-erro-msg').textContent=error.message;el('login-erro-alerta')?.classList.remove('hidden');}finally{b.disabled=false;}}
 W.MartinsOperacional=Object.freeze({carregar,listar,enviar,frequencia,estado:()=>({empresa,ocupado,dirty}),diagnostico:()=>clone(diag),handlers});
 if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',inicializar);else inicializar();
})();
