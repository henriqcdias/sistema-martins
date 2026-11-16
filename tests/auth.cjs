const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const bundle = fs.readFileSync('dist/dist/app-martins.min.js','utf8');
const begin = bundle.lastIndexOf('(function () {',bundle.indexOf('const prefixoRascunho'));
const end = bundle.indexOf('\n})();',bundle.indexOf('window.encerrarSessaoSupabaseWork',begin)) + '\n})();'.length;
assert.ok(begin>=0 && end>begin);
const storage = new Map();
const sessionStorage = {getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const uid='3d22ff8c-2cae-49af-9030-9d04b8ed175b', empresa='ad90f829-e6de-4739-a828-f8d8a921af63';
const calls=[];
let leituraAutorizada=true;
let fichaEmpresaInvalida=false;
let modoR1=false;
const obra='00000000-0000-4000-8000-000000000010';
const rdo='00000000-0000-4000-8000-000000000011';
let obraDeOutraEmpresa=false, rdoDeOutraObra=false, versaoRdo=1;
let revogado=false, limite=false, schemaIndisponivel=false, credencialInvalida=false, apiNegada=false, multi=false;
const fetch=async (url,req)=>{
  const path=new URL(url).pathname;
  calls.push({path,method:req.method});
  let data;
  if(path.endsWith('/token')) {
    if (credencialInvalida) return {ok:false,status:400,text:async()=>JSON.stringify({error_code:'invalid_credentials',msg:'Invalid login credentials'})};
    if(url.includes('refresh_token')) assert.equal(JSON.parse(req.body).refresh_token,'refresh');
    data={user:{id:uid,email:'qa@example.test'},access_token:'session',refresh_token:'refresh',expires_in:300};
  } else if(path.endsWith('/membros')) {
    assert.equal(req.headers['Accept-Profile'],'martins_hml_v1');
    if (schemaIndisponivel) return {ok:false,status:406,text:async()=>JSON.stringify({code:'PGRST106'})};
    if (apiNegada) return {ok:false,status:403,text:async()=>JSON.stringify({code:'42501'})};
    data=revogado?[]:multi?[{empresa_id:empresa,usuario_id:uid,papel:'administrador',ativo:true},{empresa_id:'00000000-0000-4000-8000-000000000002',usuario_id:uid,papel:'rh',ativo:true}]:[{empresa_id:empresa,usuario_id:uid,papel:'rh',ativo:true}];
  }
  else if(path.endsWith('/martins_empresas')) {
    data=[{id:empresa,nome_fantasia:'Construtora QA'}, {id:obra,nome_fantasia:'Empresa fora do vínculo'}];
  }
  else if(path.endsWith('/registros')) {
    const filtro = new URL(url).searchParams;
    assert.equal(filtro.get('empresa_id'), 'eq.' + empresa);
    assert.equal(filtro.get('modulo'), 'eq.funcionarios');
    assert.equal(filtro.get('id'), 'eq.' + uid);
    data = [{empresa_id:fichaEmpresaInvalida?obra:empresa,modulo:'funcionarios',id:uid,versao:1,dados:{nome:'Nome compartilhado'}}];
  }
  else if(path.endsWith('/martins_rdos_operacionais')) {
    assert.equal(req.method,'GET');
    assert.equal(req.headers['Accept-Profile'],'public');
    assert.equal(req.headers.Authorization,'Bearer session');
    assert.equal(new URL(url).searchParams.get('empresa_id'),'eq.'+empresa);
    assert.equal(new URL(url).searchParams.get('select'),'id,empresa_id,obra_id,data,status,versao');
    data=[{id:rdo,empresa_id:empresa,obra_id:rdoDeOutraObra?uid:obra,data:'2026-11-13',status:'rascunho',versao:versaoRdo}];
  } else if(path.endsWith('/catalogo_obras_frequencia')) {
    assert.equal(req.method,'POST');
    assert.equal(req.headers['Content-Profile'],'martins_hml_v1');
    assert.equal(req.headers.Authorization,'Bearer session');
    const args = JSON.parse(req.body);
    assert.equal(args.p_empresa,empresa);
    data=[{id:obra,empresa_id:obraDeOutraEmpresa?uid:empresa,nome:'Obra QA'}];
  } else if(path.endsWith('/rpc/permitido')) {
    const args = JSON.parse(req.body);
    assert.equal(args.p_escrita, false);
    assert.equal(args.p_empresa, empresa);
    data = leituraAutorizada;
  } else if(path.endsWith('/martins_obras_consultar')) {
    assert.equal(req.headers['Content-Profile'],'public');
    assert.deepEqual(JSON.parse(req.body),{e:empresa,registro_id:null});
    data = [{id:obra,empresa_id:obraDeOutraEmpresa?uid:empresa,nome:'Obra QA',dados:{sigilo:true}}];
  } else if(path.endsWith('/verify')) {
    assert.deepEqual(JSON.parse(req.body),{type:'recovery',token_hash:'fixture'});
    data={access_token:'recovery'};
  } else if(path.endsWith('/user')) {
    assert.equal(req.headers.Authorization,'Bearer recovery');
    if(req.method==='PUT') assert.equal(JSON.parse(req.body).password,'NovaSenhaQA!');
    data={id:uid};
  } else if(path.endsWith('/recover')) {
    assert.equal(new URL(url).searchParams.get('redirect_to'),'https://qa.example/?recuperar=1');
    if(limite) return {ok:false,status:429,text:async()=>''};
    data={};
  } else if(path.endsWith('/logout')) return {ok:true,status:204,text:async()=>''};
  else throw Error(path);
  return {ok:true,status:200,text:async()=>JSON.stringify(data)};
};
class Element {
  constructor(textContent = '', value = '') {
    this.textContent = textContent;
    this.value = value;
    this.children = [];
    this.events = {};
  }
  replaceChildren(...children) { this.children = children; }
  appendChild(child) { this.children.push(child); }
  add(child) { this.appendChild(child); }
  setAttribute() {}
  addEventListener(event, handler) { this.events[event] = handler; }
  get selectedOptions() { return this.children.filter(child => child.value === this.value); }
}
const browser=()=>{
  const window={
    MARTINS_SUPABASE_ENV_CONFIG:{VITE_SUPABASE_HOMOLOG_ANON_KEY:'sb_publishable_fixture'},
    obterConfiguracaoAmbienteSupabaseV16:()=>({supabaseUrl:'https://oczxyiakpmgnrpoyhwov.supabase.co',credenciaisValidas:true})
  };
  vm.runInNewContext(bundle.slice(begin,end),{window,sessionStorage,localStorage:{getItem:()=>null},
    crypto,TextEncoder,TextDecoder,fetch,AbortSignal,URLSearchParams,Option:Element,
    document:{createElement:()=>new Element(),querySelectorAll:()=>[]},location:{origin:'https://qa.example',hostname:modoR1?'localhost':'qa.example',search:modoR1?'?obras-r1=1':''}});
  return window;
};
(async()=>{
  let w=browser();
  credencialInvalida=true;
  const n=calls.length;
  assert.equal((await w.autenticarUsuarioSupabaseWork('qa@example.test','SenhaQA!')).codigo,'invalid_credentials');
  assert.equal(calls.length,n+1);
  credencialInvalida=false;
  apiNegada=true;
  assert.equal((await w.autenticarUsuarioSupabaseWork('qa@example.test','SenhaQA!')).codigo,'QA_VINCULOS_API');
  apiNegada=false;
  schemaIndisponivel=true;
  const erro = await w.autenticarUsuarioSupabaseWork('qa@example.test','SenhaQA!');
  assert.equal(erro.codigo,'PGRST106');
  assert.match(erro.erro,/consulta de vínculos/);
  assert.equal(w.obterContextoSegurancaAutenticadoWork(),null);
  schemaIndisponivel=false;
  assert.equal((await w.autenticarUsuarioSupabaseWork('qa@example.test','SenhaQA!')).sucesso,true);
  assert.equal(w.verificarAcessoEmpresaAutenticadoWork(empresa).permitido,true);
  assert.equal((await w.consultarVinculoRhWork(empresa, uid)).id, uid);
  await assert.rejects(w.consultarVinculoRhWork(empresa, 'Nome compartilhado'), {code:'ID_NAO_MAPEADO'});
  await assert.rejects(w.consultarVinculoRhWork(obra, uid), {code:'42501'});
  fichaEmpresaInvalida=true;
  await assert.rejects(w.consultarVinculoRhWork(empresa, uid), {code:'RESPOSTA_INVALIDA'});
  fichaEmpresaInvalida=false;

  assert.equal(w.verificarPermissaoMasterAutenticadaWork(),false);
  multi=true;
  assert.equal((await w.autenticarUsuarioSupabaseWork('qa@example.test','SenhaQA!')).sucesso,true);
  assert.equal(w.verificarPermissaoMasterAutenticadaWork(),false);
  const seletor = new Element();
  const lista = new Element();
  const painel = {isConnected:true,querySelector: id => id === '#fin-reg-empresa' ? seletor : lista};
  w.rascunhoFormularioFinanceiroState = {};
  w.lancamentosFinanceirosDb = [
    {empresaId:empresa,descricao:'Empresa autorizada'},
    {empresaId:'00000000-0000-4000-8000-000000000002',descricao:'Empresa sem Master'},
    {empresaId:'emp-1',descricao:'Empresa legada'}
  ];
  await w.renderizarSeletorFluxoCaixaQa(painel);
  assert.deepEqual(seletor.children.map(option => option.value), ['', empresa]);
  assert.equal(seletor.children[1].textContent, 'Construtora QA');
  seletor.value = empresa;
  seletor.events.change();
  await new Promise(setImmediate);
  assert.equal(lista.children.length, 1);
  assert.match(lista.children[0].textContent,/Consulta e gravação financeira remotas indisponíveis/);
  revogado=true;
  await w.renderizarSeletorFluxoCaixaQa(painel);
  assert.equal(seletor.disabled,true);
  assert.equal(lista.children.length,1);
  revogado=false;
  w.getDb = options => {
    assert.equal(options.somenteLeitura,true);
    return [{id:'RDO-local',obra:'Obra antiga',data:'2026-11-13'}];
  };
  w.classificarAcessoRdoLocalWork = () => 'recuperacao';
  assert.equal((await w.prepararConciliacaoRdoLocalWork({id:'RDO-local',empresa,obra})).obraOperacional,'Obra QA');
  obraDeOutraEmpresa=true;
  await assert.rejects(w.prepararConciliacaoRdoLocalWork({id:'RDO-local',empresa,obra}),{code:'RESPOSTA_OPERACIONAL_INVALIDA'});
  obraDeOutraEmpresa=false;
  assert.equal((await w.consultarReferenciaRdoOperacionalWork({empresa,obra,rdo,data:'2026-11-13'})).id,rdo);
  assert.equal((await w.listarObrasOperacionaisWork({empresa})).registros[0].id,obra);
  assert.equal((await w.listarHistoricoRdosOperacionaisWork({empresa,obra})).registros[0].id,rdo);
  leituraAutorizada=false;
  const chamadasRdoAntes = calls.filter(c => c.path.endsWith('/martins_rdos_operacionais')).length;
  await assert.rejects(w.listarHistoricoRdosOperacionaisWork({empresa,obra}),{code:'42501'});
  await assert.rejects(w.consultarReferenciaRdoOperacionalWork({empresa,obra,rdo,data:'2026-11-13'}),{code:'42501'});
  assert.equal(calls.filter(c => c.path.endsWith('/martins_rdos_operacionais')).length,chamadasRdoAntes);
  leituraAutorizada=true;
  modoR1=true;
  const local = browser();
  assert.equal((await local.restaurarSessaoQaWork()).sucesso,true);
  const obrasR1 = await local.listarObrasOperacionaisWork({empresa});
  assert.equal(obrasR1.registros[0].id,obra);
  assert.equal(obrasR1.registros[0].dados,undefined);
  obraDeOutraEmpresa=true;
  await assert.rejects(local.listarObrasOperacionaisWork({empresa}),{code:'RESPOSTA_OPERACIONAL_INVALIDA'});
  obraDeOutraEmpresa=false;
  modoR1=false;
  versaoRdo=null;
  await assert.rejects(w.listarHistoricoRdosOperacionaisWork({empresa,obra}),{code:'RESPOSTA_OPERACIONAL_INVALIDA'});
  versaoRdo=1;
  rdoDeOutraObra=true;
  await assert.rejects(w.listarHistoricoRdosOperacionaisWork({empresa,obra}),{code:'RESPOSTA_OPERACIONAL_INVALIDA'});
  rdoDeOutraObra=false;
  await assert.rejects(w.listarObrasOperacionaisWork({empresa,apos:obra}),{code:'RESPOSTA_OPERACIONAL_INVALIDA'});
  revogado=true;
  const chamadasAntesDaRevogacao = calls.length;
  await assert.rejects(w.listarObrasOperacionaisWork({empresa}),{code:'42501'});
  assert.deepEqual(calls.slice(chamadasAntesDaRevogacao).map(x=>x.path),['/rest/v1/membros']);
  revogado=false;
  const antes = calls.length;
  await assert.rejects(w.consultarReferenciaRdoOperacionalWork({empresa:'emp-1',obra,rdo,data:'2026-11-13'}),{code:'RDO_REFERENCIA_INVALIDA'});
  assert.equal(calls.length,antes);
  const listar = w.listarObrasOperacionaisWork;
  const empresaB = '00000000-0000-4000-8000-000000000002';
  let entregarA;
  w.listarObrasOperacionaisWork = ({empresa: alvo}) => alvo === empresa
    ? new Promise(resolve => { entregarA = resolve; })
    : Promise.resolve({registros:[{id:obra,empresa_id:empresaB,nome:'Obra B'}]});
  const estados = [];
  const atualizar = estado => estados.push({empresa:estado.empresa,obra:estado.obra,obras:[...estado.obras]});
  const atrasada = w.selecionarEmpresaOperacionalWork(empresa,atualizar);
  await w.selecionarEmpresaOperacionalWork(empresaB,atualizar);
  entregarA({registros:[{id:obra,empresa_id:empresa,nome:'Obra A'}]});
  await atrasada;
  assert.equal(estados.length,3);
  assert.equal(estados[1].obra,null);
  assert.equal(estados[1].obras.length,0);
  assert.equal(estados[2].obras[0].nome,'Obra B');
  w.listarObrasOperacionaisWork = async () => { throw new Error('Sem rede'); };
  await w.selecionarEmpresaOperacionalWork(empresa, estado => {
    if (!estado.carregando) assert.equal(estado.erro,'Sem rede');
  });
  w.listarObrasOperacionaisWork = listar;
  assert.ok(!calls.some(chamada=>chamada.path.endsWith('/martins_obras_operacionais')));
  w.selecionarEmpresaFrequenciaWork(empresa);
  assert.equal(w.verificarPermissaoMasterAutenticadaWork(),true);
  assert.throws(()=>w.selecionarEmpresaFrequenciaWork('00000000-0000-4000-8000-000000000009'),{code:'42501'});
  w=browser();
  assert.equal((await w.restaurarSessaoQaWork()).sucesso,true);
  assert.equal(w.verificarPermissaoMasterAutenticadaWork(),true);
  apiNegada=true;
  assert.equal((await browser().restaurarSessaoQaWork()).codigo,'QA_VINCULOS_API');
  assert.ok(storage.get('martins.qa.auth.v1'));
  apiNegada=false;
  await w.desbloquearRascunhosQaWork('SenhaQA!');
  await w.encerrarSessaoSupabaseWork();
  assert.equal(await browser().restaurarSessaoQaWork(),null);
  await w.solicitarRecuperacaoQaWork('qa@example.test');
  limite=true;
  await assert.rejects(w.solicitarRecuperacaoQaWork('qa@example.test'),{code:'429'});
  assert.equal(await w.verificarRecuperacaoQaWork({token:'recovery'}),'recovery');
  assert.equal(await w.verificarRecuperacaoQaWork({hash:'fixture'}),'recovery');
  await w.redefinirSenhaQaWork('recovery','NovaSenhaQA!');
  assert.ok(calls.some(c=>c.path.endsWith('/user')&&c.method==='PUT'));
  assert.equal(w.obterContextoSegurancaAutenticadoWork(),null);
  assert.equal((await w.autenticarUsuarioSupabaseWork('qa@example.test','NovaSenhaQA!')).sucesso,true);
  revogado=true;
  assert.equal((await browser().restaurarSessaoQaWork()).codigo,'SEM_VINCULO');
  assert.equal(await browser().restaurarSessaoQaWork(),null);
  console.log('PASS: login, perfil QA, reload, logout, recuperação hash/token, PUT, 429 e revogação (HTTP simulado).');
})().catch(e=>{console.error(e);process.exitCode=1;});
