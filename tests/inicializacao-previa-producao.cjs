const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const raiz=path.join(__dirname,'../dist-producao-fonte');

test('Scripts de produção existem e a UI Auth segue os adaptadores',()=>{
 const html=fs.readFileSync(path.join(raiz,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map(m=>m[1].split('?')[0]);
 for(const script of scripts.filter(src=>src!=='producao-config.js'&&!/^https?:/.test(src))){
  assert.ok(fs.existsSync(path.join(raiz,script)),script);
 }
 for(const nome of ['producao-config.js','auth-v5.js','cliente.js','formularios.js']){
  assert.ok(scripts.indexOf(nome)>=0 && scripts.indexOf(nome)<scripts.indexOf('auth-ui-v5.js'),nome);
 }
});

test('Falhas de catálogo e Frequência preservam sessão, Funcionários e Orçamentos',async()=>{
 const e='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const permissoes={funcionarios:{ler:true},frequencia:{ler:true},orcamentos:{ler:true}};
 const context={uid:id,empresas:[e],vinculos:[{empresa_id:e,nomeEmpresa:'Empresa QA sintética',permissoes}]};
 const status={dataset:{}};
 const document={readyState:'loading',body:{dataset:{}},addEventListener(){},querySelectorAll(){return [];},
   getElementById(id){return id==='producao-status'?status:null;}};
 const consultados=[];
 const window={empresaFrequenciaWork:e,obterContextoSegurancaAutenticadoWork:()=>context,
   MartinsProducaoRpc:{async catalogos(){throw Error('Catálogo indisponível');}},
   MartinsProducaoClient:{create(){return {async load(empresa,modulo){
     assert.equal(empresa,e);consultados.push(modulo);
     if(modulo==='frequencia')throw Error('Falha em Frequência');
     return [{id,empresa_id:e,revisao:1,dados:{nome:modulo}}];
   }};}}};
 vm.runInNewContext(fs.readFileSync(path.join(raiz,'formularios.js'),'utf8'),
   {window,document,structuredClone,console});
 assert.equal(typeof window.renderizarContextoOperacionalWork,'function');
 await window.MartinsProducaoOnSession(context);
 assert.equal(document.body.dataset.sessaoProducao,'ativa');
 assert.equal(document.body.dataset.empresaProducao,'ativa');
 assert.equal(window.MartinsOperacional.listar('funcionarios').length,1);
 assert.equal(window.MartinsOperacional.listar('orcamentos').length,1);
 assert.equal(window.MartinsOperacional.listar('frequencia').length,0);
 assert.deepEqual(consultados,['funcionarios','frequencia','orcamentos']);
 assert.match(status.textContent,/catálogo, frequencia/);
});
