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
    titulo.textContent = 'Contexto empresarial · ' + (W.gravacaoHabilitadaWork?.() ? 'homologação com gravação' : 'prévia somente leitura');
    barra.append(titulo);
    const info = D.createElement('span');
    info.className = 'ml-3';
    if (vinculo) {
      info.textContent = 'Empresa: ' + (vinculo.nomeEmpresa || empresaId) + ' · Perfil: ' + ({ master: 'Master', administrador: 'Administrador', operacional: 'Operacional' }[vinculo.papelServidor] || 'Operacional');
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
 function visao(m){return seguro(listar(m).map(r=>({...r,empresa:contexto()?.vinculos.find(v=>v.empresa_id===r.empresa_id)?.nomeEmpresa||'',...(m==='funcionarios'?{obraId:r.obra_id||null,obra:catalogos.obras.find(o=>o.id===r.obra_id)?.nome||''}:{}),...(m==='orcamentos'?{num:r.numero?'ORC-'+String(r.numero).padStart(4,'0'):'',valorTotal:r.total,status:(!r.status||r.status==='Em Orçamento')?'Em elaboração':r.status,obra:catalogos.obras.find(o=>o.id===r.obra_id)?.nome||'',vendedor:r.vendedorResponsavel||''}:{})})));}
 function tabelaFrequencia(){const out={};for(const r of listar('frequencia')){out[r.data]??={};const p=out[r.data][r.funcionario_id]??={colabId:r.funcionario_id,nome:catalogos.funcionarios.find(x=>x.id===r.funcionario_id)?.nome||'',status:r.situacao,horas:0,he50:0,he100:0,alocacoes:[]};p.horas+=Number(r.horas_normais);p.he50+=Number(r.horas_extras||0);p.obra=r.obra_id||'';p.obraId=r.obra_id||'';p.rowVersion=r.revisao;p.alocacoes.push(r);}return seguro(out);}
 // O código antigo copiava a lista de orçamentos/pedidos (agora vinda do servidor) para o navegador. Essas cópias locais
 // não são mais gravadas: a única fonte é o servidor.
 try{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(chave,valor){if(this===W.localStorage&&/^cm_(orcamentos_|pedidos_venda_db|previsao_recebimentos_vendas_db|supabase_cloud_tables_v16)/.test(String(chave)))return;return original.call(this,chave,valor);};}catch{}
 // Orçamentos: a lista em memória do código antigo é sempre a do servidor. Sementes de demonstração (UEMG, SENAI…)
 // e cópias locais não conseguem mais se misturar a ela.
 try{Object.defineProperty(W,'orcamentosComerciaisDb',{configurable:true,enumerable:true,get:()=>visao('orcamentos'),set:()=>{}});}catch{}
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
  // Telas legadas às vezes repovoam o select com dados locais: confere as opções reais, não só a marcação.
  const atuais=JSON.stringify([...s.options].slice(1).map(o=>[o.value.replace(prefixo,''),o.textContent]));
  if(s.dataset.catalogoProducao===assinatura&&atuais===assinatura)return;s.dataset.catalogoProducao=assinatura;
  s.replaceChildren(new Option(label,''));for(const x of lista)s.add(new Option(x.nome,prefixo+x.id));
  if([...s.options].some(o=>o.value===prev))s.value=prev;
 }
 function seletores(){
  for(const f of D.querySelectorAll('#form-novo-orcamento-venda'))if(!el('orc-inp-obra')){const label=D.createElement('label');label.textContent='Obra vinculada (opcional)';const select=D.createElement('select');select.id='orc-inp-obra';select.className='w-full border rounded p-2';label.append(select);f.prepend(label);}
  for(const s of D.querySelectorAll('.sel-trab-cadastrado')){const item=typeof currentTrabalhadores!=='undefined'?currentTrabalhadores[Number(s.dataset.index)]:null;preencherSelect(s,catalogos.funcionarios,'Selecione o funcionário');if(item?.funcionario_id&&catalogos.funcionarios.some(x=>x.id===item.funcionario_id))s.value=item.funcionario_id;}

  // Orçamento: cliente, vendedor, obra e produto vêm do cadastro compartilhado, não de listas fixas do código antigo.
  if(el('orc-select-cliente-cadastrado')?.tagName==='SELECT')preencherSelect(el('orc-select-cliente-cadastrado'),Array.isArray(catalogos.clientes)?catalogos.clientes:[],'-- Selecionar cliente cadastrado --');
  if(el('orc-inp-vendedor-responsavel')?.tagName==='SELECT')preencherSelect(el('orc-inp-vendedor-responsavel'),Array.isArray(catalogos.vendedores)?catalogos.vendedores:[],'Selecione o vendedor (opcional)');
  if(el('orc-select-obra-destino')?.tagName==='SELECT')preencherSelect(el('orc-select-obra-destino'),catalogos.obras,catalogos.obras.length?'Selecione a obra':'Nenhuma obra cadastrada nesta empresa');
  for(const s of D.querySelectorAll('#form-novo-orcamento-venda select'))if(!s.id&&/Escolher Produto do Cat[aá]logo/.test(s.options[0]?.textContent||'')){s.hidden=true;s.closest('div')&&(s.closest('div').title='O catálogo de produtos do orçamento ainda não está no servidor: descreva o item manualmente.');}
  const semObras='Nenhuma obra cadastrada nesta empresa — cadastre em Gestão de Obras';
  for(const id of ['obra-select','gestao-obra-select','nc-obra','edit-colab-obra','filtro-obra-hist','orc-inp-obra','atividade-obra-select','ficha-inp-obra']){const s=el(id);if(s?.tagName==='SELECT'){preencherSelect(s,catalogos.obras,id==='filtro-obra-hist'?'Todas as obras':(catalogos.obras.length?'Selecione a obra':semObras));if(id==='filtro-obra-hist'&&s.options[0])s.options[0].value='todas';}}
  if(el('obra-inp-cliente-select')?.tagName==='SELECT'&&Array.isArray(catalogos.clientes))preencherSelect(el('obra-inp-cliente-select'),catalogos.clientes,'Selecione o cliente (cadastro compartilhado)');
  for(const id of ['select-add-trabalhador','colab-select','rf-colab-select','rel-colab-select'])if(el(id)?.tagName==='SELECT')preencherSelect(el(id),catalogos.funcionarios,'Selecione o funcionário');
  for(const s of D.querySelectorAll('.sel-destino-ponto')){
   const key=JSON.stringify(catalogos.obras);if(s.dataset.catalogoProducao===key)continue;const prev=s.value;
   s.replaceChildren(new Option('Selecione destino ou situação',''));
   if(!catalogos.obras.length){const o=new Option('(nenhuma obra cadastrada — cadastre em Gestão de Obras)','');o.disabled=true;s.add(o);}
   for(const x of catalogos.obras)s.add(new Option(x.nome,'OBRA:'+x.id));
   for(const [id,nome] of [['falta','Falta'],['folga','Folga'],['ferias','Férias'],['atestado','Atestado']])s.add(new Option(nome,'STATUS:'+id));
   s.dataset.catalogoProducao=key;if([...s.options].some(o=>o.value===prev))s.value=prev;
   const row=s.closest('tr');if(row&&!row.querySelector('.freq-inp-horas')){const input=D.createElement('input');input.type='number';input.min='0';input.max='8';input.step='0.25';input.className='freq-inp-horas w-20 border rounded p-1';input.setAttribute('aria-label','Horas normais de '+(row.dataset.colabNome||'funcionário'));const obra=s.value.startsWith('OBRA:')?s.value.slice(5):null;const atual=listar('frequencia').find(x=>x.funcionario_id===row.dataset.colabId&&x.obra_id===obra&&x.data===(val('ponto-data-filtro')||val('freq-input-data')));input.value=atual?.horas_normais??8;s.after(input);}

  }
  for(const s of D.querySelectorAll('#orc-inp-empresa,#orc-empresa-emitente,#ficha-inp-empresa')){const c=contexto();preencherSelect(s,(c?.vinculos||[]).map(v=>({id:v.empresa_id,nome:v.nomeEmpresa})));s.value=empresa||'';s.disabled=true;}
 }
 function atualizarVisoes(){
  instalarLeituras();W.colaboradoresDb=visao('funcionarios');W.funcionariosDb=W.colaboradoresDb;W.colaboradoresOficialDb=W.colaboradoresDb;
  W.empreendimentosObrasDb=visao('obras');
  W.etapasPlanejamentoObraDb=visao('planejamento');
  // A fonte lexical original é mantida; apenas sua projeção de tela é atualizada.
  if(typeof dadosObras==='object'&&dadosObras){for(const k of Object.keys(dadosObras))delete dadosObras[k];for(const r of visao('obras'))dadosObras[r.id]={...r,cliente:r.clienteResponsavel||'',resp:r.responsavelTecnico||'',contrato:r.valorContratado||0,medido:0,itensMedicao:r.itensMedicao||[],planilhaRef:r.planilhaRef||[],obs:r.obs||[]};}
  for(const name of ['renderColaboradoresTable','filtrarERenderizarQuadroColaboradoresV169','renderListaOrcamentosVendas','renderizarModuloOrcamentosOtimizadoFase24','renderizarPainelPedidosConvertidosUi','renderHistorico','renderAuditoriaPonto'])try{W[name]?.();}catch(error){console.warn('Projeção de tela',name,error.message);}
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
 // O bundle chama estas funções (ficha individual do funcionário); só existiam na árvore antiga de QA.
 if(!W.consultarVinculoRhWork)W.consultarVinculoRhWork=async(emp,id)=>{
  const r=dados.funcionarios.get(id)||[...dados.funcionarios.values()].find(x=>x.dados.nome===id);
  if(!r||(emp&&r.empresa_id!==emp))throw Error('Funcionário não encontrado nesta empresa. Use Atualizar dados e tente de novo.');
  return {id:r.id,empresa_id:r.empresa_id,dados:clone(r.dados)};
 };
 if(!W.rotuloEmpresaQaWork)W.rotuloEmpresaQaWork=emp=>contexto()?.vinculos.find(v=>v.empresa_id===emp)?.nomeEmpresa||'';
 async function enviar(modulo,conteudo,id=null,rev=null,{somente=null}={}){
  const e=requireEmpresa();if(!api)throw Error('Entre com sua sessão v5.');const antigo=id?registro(modulo,id):null;
  if(id&&!antigo)throw Error('Registro não encontrado na empresa ativa. Recarregue a consulta.');
  // Com 'somente', envia apenas essas chaves (o servidor completa o restante a partir do registro atual).
  const base=somente?{}:(antigo?.dados||{}),novo=clone(conteudo);if(somente)for(const k of Object.keys(novo))if(!somente.includes(k))delete novo[k];
  const d={...base,...novo};delete d.id;delete d.empresaId;delete d.empresa_id;delete d.revisao;delete d.rowVersion;
  return W.MartinsProducaoRpc.comRascunho(e,async(estado,persistir)=>{
   estado.pendentes??={};let cmd=estado.pendentes[modulo];
   if(cmd){if(JSON.stringify(cmd.dados)!==JSON.stringify(d)||cmd.id!==(id||cmd.id))throw Error('Há uma operação pendente deste módulo. Use Reenviar pendentes antes de alterar os dados.');api.restore(cmd);}
   else{cmd=api.prepare({empresa:e,modulo,id:id||crypto.randomUUID(),revisao:rev??antigo?.revisao??0,dados:d});estado.pendentes[modulo]=cmd;await persistir();}
   let result;try{result=await api.send(cmd.operacao);}catch(error){if(recusaDefinitiva(error)){delete estado.pendentes[modulo];await persistir();}throw error;}delete estado.pendentes[modulo];await persistir();
   dados[modulo].set(result.registro.id,result.registro);return result.registro;
  });
 }
 function snapshot(form,id,m){const r=id&&registro(m,id);return form.dataset.revisaoProducao?Number(form.dataset.revisaoProducao):r?.revisao??0;}
 async function formularioFuncionario(form){
  const ficha=form.id==='form-editar-ficha-colab-estab',p=ficha?'ficha-inp-':form.id==='form-editar-colaborador'?'edit-colab-':'nc-';
  // O modal "Cadastrar Novo Colaborador" usa o id 'NOVO': isso é criação, não edição de um registro existente.
  const idInformado=ficha?form.dataset.registroProducao:form.id==='form-editar-colaborador'?val('edit-colab-id'):null,id=uuid(idInformado)?idInformado:null,editar=!!id;
  const dados={nome:val(p+'nome'),cpf:val(p+'cpf'),rg:val(p+'rg'),funcao:val(p+'funcao'),vinculo:val(p+'vinculo'),dataAdmissao:val(p+'admissao'),status:ficha?(registro('funcionarios',id)?.dados.status||'Ativo'):p==='edit-colab-'?(val('edit-colab-status')||'Ativo'):'Ativo',obs:val(p+'obs'),
   // No modal de cadastro a obra é um campo oculto ("Rotativo": alocação dinâmica pela frequência); só um id real vira vínculo fixo.
   obra_id:p==='edit-colab-'&&!uuid(val(p+'obra'))?null:referencia('obras',val(p+'obra'),true)};
  if(ficha&&el('ficha-inp-salario'))dados.salarioBase=num(val('ficha-inp-salario'));
  if(p==='edit-colab-'){
   // Campos do bloco RH/SST do modal: vazio fica null (limpa o valor anterior na edição).
   const opcional=(chave,campo,conv=x=>x)=>{if(!el(campo))return;const v=val(campo);dados[chave]=v===''?null:conv(v);};
   opcional('salarioBase','edit-colab-salario',num);opcional('tipoChavePix','edit-colab-tipo-pix');opcional('chavePix','edit-colab-pix');opcional('anexoDocumento','edit-colab-anexo-documento');
   opcional('asoValidade','edit-colab-aso-venc');opcional('cnhValidade','edit-colab-cnh-validade');opcional('nr10Validade','edit-colab-nr10-venc');opcional('nr18Validade','edit-colab-nr18-venc');opcional('nr35Validade','edit-colab-nr35-venc');
   opcional('dataEncerramento','edit-colab-encerramento');opcional('motivoEncerramento','edit-colab-motivo-encerramento');
  }
  if(!dados.nome||!dados.funcao)throw Error('Informe nome e função do funcionário.');
  await enviar('funcionarios',dados,id,editar?snapshot(form,id,'funcionarios'):0);
  if(form.id==='form-editar-colaborador')el('edit-colab-id').value='';
 }
 async function formularioObra(form){
  const editar=form.id==='form-gestao-obra',id=editar?(form.dataset.registroProducao||val('gestao-obra-select')):null,p=editar?'mo-':'nova-obra-';
  const d={nome:val(p+'nome'),clienteResponsavel:val(p+'cliente'),valorContratado:num(val(editar?'mo-valor':'nova-obra-valor')),responsavelTecnico:val(p+'resp'),dataInicio:val('mo-data-inicio'),previsaoConclusao:val('mo-data-fim'),situacaoAtual:editar?val('mo-status'):'Em Planejamento'};
  if(!d.nome||!d.clienteResponsavel||d.valorContratado<0)throw Error('Confira nome, cliente e valor da obra.');
  d.codigo=editar?registro('obras',id)?.dados.codigo:'OBR-'+crypto.randomUUID().slice(0,8).toUpperCase();
  await enviar('obras',d,id,editar?snapshot(form,id,'obras'):0,ehMaster()?{}:{somente:CAMPOS_OBRA_OPERACIONAIS});
 }
 const CAMPOS_OBRA_OPERACIONAIS=['nome','codigo','status','clienteResponsavel','enderecoLocalizacao','responsavelTecnico','encarregado','equipesVinculadas','equipesTerceirizadas','dataInicio','previsaoConclusao','situacaoAtual','descricao'];
 const ehMaster=()=>contexto()?.vinculos.find(v=>v.empresa_id===empresa)?.papelServidor==='master';
 async function formularioObraCompleta(form){
  const nome=val('obra-inp-nome');if(!nome)throw Error('Informe o nome da obra.');
  const nomeOriginal=val('obra-inp-nome-original'),edicao=el('obra-inp-is-edicao')?.value==='true';
  const codigoInformado=val('obra-inp-codigo');
  const existente=edicao?[...dados.obras.values()].find(r=>r.dados.nome===nomeOriginal||(codigoInformado&&r.dados.codigo===codigoInformado)):null;
  if(edicao&&!existente)throw Error('Obra não encontrada no servidor para edição. Use Atualizar dados e abra a obra novamente.');
  const clienteSel=el('obra-inp-cliente-select'),clienteId=uuid(clienteSel?.value)?clienteSel.value:null;
  const clienteNome=clienteId?(catalogos.clientes||[]).find(c=>c.id===clienteId)?.nome||'':(clienteSel?.selectedOptions?.[0]?.value?clienteSel.selectedOptions[0].textContent.trim():'');
  const endereco=[val('obra-inp-logradouro'),val('obra-inp-numero-end'),val('obra-inp-complemento'),val('obra-inp-bairro'),[val('obra-inp-cidade'),val('obra-inp-estado')].filter(Boolean).join('/'),val('obra-inp-cep')].filter(Boolean).join(', ');
  const d={nome,codigo:codigoInformado||existente?.dados.codigo||'OBR-'+crypto.randomUUID().slice(0,8).toUpperCase(),
   status:val('obra-inp-status'),situacaoAtual:val('obra-inp-status'),clienteResponsavel:clienteNome,enderecoLocalizacao:endereco,
   responsavelTecnico:val('obra-inp-resp'),encarregado:val('obra-inp-resp-obra'),dataInicio:val('obra-inp-data-inicio'),previsaoConclusao:val('obra-inp-data-fim'),
   // Campos adicionais (gravados só pelo Master; o servidor recusa de outros perfis).
   tipo:val('obra-inp-tipo'),visivel:val('obra-inp-visivel'),cliente_id:clienteId,areaM2:val('obra-inp-area')?num(val('obra-inp-area')):null,unidade:val('obra-inp-unidade'),art:val('obra-inp-art'),cei:val('obra-inp-cei'),
   cep:val('obra-inp-cep'),logradouro:val('obra-inp-logradouro'),numero:val('obra-inp-numero-end'),complemento:val('obra-inp-complemento'),bairro:val('obra-inp-bairro'),estado:val('obra-inp-estado'),cidade:val('obra-inp-cidade'),
   justificativaPrazo:val('obra-inp-justificativa-prazo'),valorContratado:val('obra-inp-valor')?num(val('obra-inp-valor')):null,numeroContrato:val('obra-inp-num-contrato'),dadosBancarios:val('obra-inp-dados-bancarios')};
  if(d.valorContratado!==null&&d.valorContratado<0)throw Error('Valor contratual inválido.');
  const master=ehMaster(),financeiroPreenchido=!master&&(d.valorContratado||d.numeroContrato||d.dadosBancarios);
  const r=await enviar('obras',d,existente?.id||null,existente?snapshot(form,existente.id,'obras'):0,master?{}:{somente:CAMPOS_OBRA_OPERACIONAIS});
  W.fecharModalCadastroObraCompleto?.();
  return financeiroPreenchido?{aviso:'Obra salva. Valor, nº do contrato e dados bancários são gravados somente pelo Master.'}:r;
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
  const cadastrado=(catalogos.clientes||[]).find(x=>x.id===val('orc-select-cliente-cadastrado')&&x.nome===cliente);
  const vend=(catalogos.vendedores||[]).find(x=>x.id===val('orc-inp-vendedor-responsavel'));
  const destino=form.querySelector('input[type=radio][id*="tipo-destino"]:checked')?.value==='OBRA'?val('orc-select-obra-destino'):'';
  const conteudo={nome:'Orçamento · '+cliente,cliente,cliente_id:cadastrado?.id,vendedor_id:vend?.id,vendedorResponsavel:vend?.nome,itens:itensOrcamento(),condicoes:val('orc-inp-condicoes'),prazo:val('orc-inp-prazo'),validade:val('orc-inp-validade'),obra_id:referencia('obras',val('orc-inp-obra')||destino,true),data:registro('orcamentos',id)?.dados.data||hoje()};
  for(const k of Object.keys(conteudo))if(conteudo[k]===undefined||conteudo[k]===null||conteudo[k]==='')delete conteudo[k];
  // Número e situação são do servidor: o navegador não os envia.
  await enviar('orcamentos',conteudo,id,id?snapshot(form,id,'orcamentos'):0);W.currentEditingOrcamentoId=null;
 }
 // ---- Fluxo do orçamento no servidor (v14): situação com histórico, conversão em pedido (um só) e duplicação ----
 function aviso(texto,erro=false){mensagem(texto,erro);if(W.showToast)W.showToast(texto,erro?'error':'success');}
 async function orcamentoAcao(id,rotulo,chamar){
  try{
   const r=registro('orcamentos',id);if(!r)throw Error('Orçamento não encontrado na empresa ativa. Use Atualizar dados.');
   const res=await chamar(r);await carregar();if(res?.aviso)aviso(res.aviso);return {sucesso:true,...res};
  }catch(error){aviso((error.code==='40001'?'Outra sessão alterou este orçamento. Recarregue. ':'')+(error.message||('Não foi possível '+rotulo+'.')),true);return {sucesso:false,erro:error.message};}
 }
 const orcamentoEstado=(id,estado,motivo=null)=>orcamentoAcao(id,'mudar a situação',async r=>{
  await W.MartinsProducaoRpc.orcamentoEstado({e:requireEmpresa(),op:crypto.randomUUID(),orcamento:id,v:Number(r.revisao),estado,motivo});return {aviso:'Situação do orçamento: '+estado+'.'};
 });
 const orcamentoConverter=(id,aprovarAntes=false)=>{
  if(!confirm('Converter este orçamento em pedido de venda? Cada orçamento gera um único pedido e isso não pode ser desfeito.'))return Promise.resolve({sucesso:false,erro:'Conversão cancelada.'});
  return orcamentoAcao(id,'converter em venda',async r=>{
   const res=await W.MartinsProducaoRpc.orcamentoConverter({e:requireEmpresa(),op:crypto.randomUUID(),orcamento:id,v:Number(r.revisao),aprovar_antes:!!aprovarAntes});
   return {pedidoNumero:res.pedido_numero,aviso:'Pedido de venda nº '+res.pedido_numero+' criado. Os recebimentos são lançados em Cadastros e Despesas → Contas a receber.'};
  });
 };
 const orcamentoDuplicar=id=>orcamentoAcao(id,'duplicar',async r=>{
  const d=clone(r.dados);for(const k of ['numero','status','historicoStatus','pedido_id','pedido_numero','id','empresa_id','empresaId','revisao','rowVersion'])delete d[k];
  d.nome=(d.nome||'Orçamento')+' (cópia)';d.data=hoje();await enviar('orcamentos',d,null,0);return {aviso:'Cópia criada como novo orçamento em elaboração.'};
 });
 for(const [nome,fn] of Object.entries({
  alterarStatusOrcamentoVenda:(id,novo)=>/Vendido|Convertido/i.test(novo||'')?orcamentoConverter(id,true):orcamentoEstado(id,({'Em Orçamento':'Em elaboração','Orçamento Aberto':'Em elaboração','Venda Aprovada':'Aprovado'})[novo]||novo),
  aprovarOrcamentoComercial:id=>orcamentoEstado(id,'Aprovado'),marcarOrcamentoComoVendido:id=>orcamentoConverter(id,true),marcarOrcamentoComoEntregue:id=>orcamentoEstado(id,'Entregue'),
  converterOrcamentoEmVenda:id=>orcamentoConverter(id,true),converterOrcamentoEmVendaUnificado:id=>orcamentoConverter(id,true),converterOrcamentoEmPedidoFechadoCompleto:id=>orcamentoConverter(id,true),
  converterOrcamentoEmVendaEstoqueLegado:id=>orcamentoEstado(id,'Entregue'),converterOrcamentoEmVendaIntegrada:id=>orcamentoConverter(id,true),converterOrcamentoMultiplasTelhasEmVendaEProducao:id=>orcamentoConverter(id,true),converterOrcamentoEsquadriasEmPedidoVenda:id=>orcamentoConverter(id,true),
  aprovarOuConverterOrcamentoComPagamentoFase24:(id,op)=>op?.apenasAprovar?orcamentoEstado(id,'Aprovado'):orcamentoConverter(id,true),duplicarOrcamentoComercialFase24:id=>orcamentoDuplicar(id)
 })){try{Object.defineProperty(W,nome,{configurable:false,enumerable:true,get:()=>fn,set:()=>{}});}catch{}}
 // O select de cliente cadastrado entrega o id; o campo do orçamento recebe o NOME do cliente.
 try{Object.defineProperty(W,'selecionarClienteNoOrcamento',{configurable:false,enumerable:true,get:()=>idOuNome=>{const c=(catalogos.clientes||[]).find(x=>x.id===idOuNome),i=el('orc-inp-cliente');if(i&&idOuNome)i.value=c?c.nome:'';},set:()=>{}});}catch{}
 // "Pedidos Convertidos": a lista é a do servidor (Cadastros e Despesas → Pedidos de venda).
 try{Object.defineProperty(W,'renderizarPainelPedidosConvertidosUi',{configurable:false,enumerable:true,get:()=>()=>{
  const p=el('painel-com-pedidos-convertidos');if(!p)return;const h=D.createElement('h3');h.className='font-black text-slate-900';h.textContent='Pedidos de venda (do servidor)';
  const t=D.createElement('p');t.className='text-xs text-slate-600';t.textContent='Os pedidos nascem da conversão de um orçamento aprovado (um pedido por orçamento) e ficam em Cadastros e Despesas → Pedidos de venda.';
  const b=D.createElement('button');b.type='button';b.className='bg-slate-900 text-amber-400 font-black text-xs px-3 py-2 rounded-xl';b.textContent='Abrir pedidos de venda';b.onclick=()=>W.MartinsCadastrosServidor?.abrir('pedidos_venda');
  p.replaceChildren(h,t,b);
 },set:()=>{}});}catch{}
 function resumo(){
  // O painel inicial vem do servidor (painel-servidor.js); o resumo antigo fica só como reserva.
  if(W.MartinsPainelServidor){W.MartinsPainelServidor.renderizarPainel();return;}
  const painel=el('view-painel');if(!painel)return;el('resumo-producao')?.remove();const sec=D.createElement('section');sec.id='resumo-producao';sec.className='space-y-4';
  const h=D.createElement('h2');h.className='text-xl font-bold';h.textContent='Operação · '+(contexto()?.vinculos.find(x=>x.empresa_id===empresa)?.nomeEmpresa||'Selecione a empresa');sec.append(h);
  const cards=D.createElement('div');cards.className='grid grid-cols-2 md:grid-cols-5 gap-3';for(const m of ['funcionarios','obras','rdos','frequencia','orcamentos']){const c=D.createElement('div');c.className='bg-white border rounded-xl p-4';c.textContent=m+': '+dados[m].size;cards.append(c);}sec.append(cards);
  for(const o of catalogos.obras){const b=D.createElement('button');b.type='button';b.className='block bg-white border rounded p-3 w-full text-left';b.textContent=o.nome;b.onclick=()=>{if(el('gestao-obra-select'))el('gestao-obra-select').value=o.id;try{W.renderGestaoObra?.(o.id);}catch{}D.querySelector('[data-view="gestao-obras"]')?.click();};sec.append(b);}painel.append(sec);
 }
 const handlers={'form-novo-colaborador':formularioFuncionario,'form-editar-colaborador':formularioFuncionario,'form-editar-ficha-colab-estab':formularioFuncionario,'form-nova-obra-sistema':formularioObra,'form-gestao-obra':formularioObra,'form-rdo':formularioRdo,'form-novo-orcamento-venda':formularioOrcamento,'form-cadastro-obra-completo':formularioObraCompleta};
 // Recusa definitiva do servidor (dado inválido, duplicado, referência, permissão, conflito): reenviar a mesma
 // operação daria o mesmo erro, então ela não fica pendente. Falhas de rede/limite continuam pendentes para reenvio.
 function recusaDefinitiva(error){const c=String(error?.code||'');return /^(22|23)[0-9A-Z]{3}$/.test(c)||['42501','40001','PGRST202','PGRST106'].includes(c);}
 // Depois do F5 a sessão volta sem a senha: em vez de falhar em silêncio, pede a senha e refaz a operação uma vez.
 async function comDesbloqueio(acao){try{return await acao();}catch(error){if(error?.code!=='RASCUNHO_BLOQUEADO'||typeof W.solicitarDesbloqueioEdicaoWork!=='function')throw error;mensagem('Confirme sua senha para salvar.');if(!await W.solicitarDesbloqueioEdicaoWork())throw Error('Edição não desbloqueada: nada foi salvo. Confirme sua senha para salvar.');return await acao();}}
 async function submeter(form){
  if(form.dataset.enviandoProducao==='1')return;form.dataset.enviandoProducao='1';ocupado++;
  const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);const controls=[...form.querySelectorAll('input,select,textarea')].map(x=>[x,x.disabled]);controls.forEach(([x])=>x.disabled=true);mensagem('Aguardando confirmação do Supabase…');
  try{const resultado=await comDesbloqueio(()=>handlers[form.id](form));dirty=false;await carregar();mensagem(resultado?.aviso||'Salvamento confirmado e relido no Supabase.',!!resultado?.aviso);if(form.id!=='form-rdo'){form.closest('[id^=modal-]')?.classList.add('hidden');delete form.dataset.registroProducao;delete form.dataset.revisaoProducao;}}
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
  ocupado++;try{await W.MartinsProducaoRpc.comRascunho(e,async(estado,persistir)=>{estado.pendentes??={};if(estado.pendentes.frequencia)throw Error('Há frequência pendente. Use Reenviar pendentes.');estado.pendentes.frequencia={lote:true,e,m:'frequencia',itens};await persistir();let result;try{result=await W.MartinsProducaoRpc.lote({e,m:'frequencia',itens});}catch(error){if(recusaDefinitiva(error)){delete estado.pendentes.frequencia;await persistir();}throw error;}await confirmarLote(e,'frequencia',itens,result);delete estado.pendentes.frequencia;await persistir();});rows.forEach(r=>delete r.dataset.dirty);dirty=false;await carregar();mensagem('Frequência confirmada pelo servidor.');}finally{ocupado--;}
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
  W.salvarCadastroObraCompleto=event=>{event?.preventDefault?.();return submeter(el('form-cadastro-obra-completo'));};
  W.salvarCadastroUnicoColaboradorSemDuplicidadeV170=event=>{event?.preventDefault?.();return submeter(el(event?.target?.id==='form-editar-colaborador'?'form-editar-colaborador':'form-novo-colaborador'));};
  W.salvarEdicaoColaboradorModal=()=>submeter(el('form-editar-colaborador'));
  W.salvarNovoOrcamentoVendaForm=event=>{event?.preventDefault();return submeter(el('form-novo-orcamento-venda'));};
  W.salvarFrequenciaDiariaDoDia=()=>comDesbloqueio(frequencia).catch(x=>mensagem(x.message,true));
  W.salvarRdo=(status)=>{if(status&&status.toLowerCase()!=='rascunho'){mensagem('Aprovação e assinatura exigem contrato próprio. O RDO operacional é salvo como rascunho.',true);return;}return submeter(el('form-rdo'));};
  const oldEdit=W.abrirModalEditarColaborador;W.abrirModalEditarColaborador=id=>{oldEdit?.(id);const r=registro('funcionarios',id);if(!r)return;const f=el('form-editar-colaborador');f.dataset.registroProducao=id;f.dataset.revisaoProducao=r.revisao;for(const [field,key]of [['nome','nome'],['cpf','cpf'],['rg','rg'],['funcao','funcao'],['vinculo','vinculo'],['admissao','dataAdmissao'],['status','status'],['obra','obra_id'],['obs','obs'],['salario','salarioBase'],['tipo-pix','tipoChavePix'],['pix','chavePix'],['anexo-documento','anexoDocumento'],['aso-venc','asoValidade'],['cnh-validade','cnhValidade'],['nr10-venc','nr10Validade'],['nr18-venc','nr18Validade'],['nr35-venc','nr35Validade'],['encerramento','dataEncerramento'],['motivo-encerramento','motivoEncerramento']])if(el('edit-colab-'+field))el('edit-colab-'+field).value=r.dados[key]??'';};
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
