const {test}=require('node:test');const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {webcrypto}=require('node:crypto');
const UID='11111111-1111-4111-8111-111111111111',E='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function setup({papel='master',rejectLogin=false,authError=null,contextError=null,wrongUID=false,urlConfigurada='https://kkjwmnxgcbonbwavaaya.supabase.co'}={}){
 const calls=[],storage=new Map();
 const ctx=vm.createContext({window:{obterConfiguracaoAmbienteSupabaseV16:()=>({ambienteAtivo:'PRODUCAO',supabaseUrl:urlConfigurada,credenciaisValidas:true}),MARTINS_SUPABASE_ENV_CONFIG:{VITE_MARTINS_ENV:'PRODUCAO',VITE_SUPABASE_PROD_URL:urlConfigurada,VITE_SUPABASE_PROD_ANON_KEY:'sb_publishable_synthetic'}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:webcrypto,TextEncoder,TextDecoder,AbortSignal,Map,Set,Date,JSON,URL,atob,localStorage:{getItem:()=>null},fetch:async(url,options)=>{
  calls.push({url,options});let body;
  if(url.includes('/auth/v1/token')){if(rejectLogin||authError)return {ok:false,status:400,text:async()=>JSON.stringify({error_code:authError||'invalid_credentials'})};body={user:{id:UID,email:'synthetic@example.invalid'},access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600};}
  else if(url.endsWith('/rpc/martins_producao_contexto')&&contextError)return {ok:false,status:403,text:async()=>JSON.stringify({code:contextError})};
  else if(url.endsWith('/rpc/martins_producao_contexto'))body={usuario_id:wrongUID?E:UID,nome:'Usuário sintético',empresas:[{id:E,nome:'Empresa sintética',papel,permissoes:{obras:{ler:true,criar:papel==='master',editar:papel==='master'}}}]};
  else body=[];
  return {ok:true,status:200,text:async()=>JSON.stringify(body)};
 }});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist-producao-fonte/auth-v5.js'),'utf8'),ctx);
 return {window:ctx.window,calls,storage};
}
test('Login usa o motor v5 e o contexto de produção, sem consultar membros HML',async()=>{
 const f=setup();const r=await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');
 a.equal(r.sucesso,true);a.equal(f.calls.length,2);a.ok(f.calls[0].url.includes('/auth/v1/token?grant_type=password'));
 a.ok(f.calls[1].url.endsWith('/rpc/martins_producao_contexto'));a.equal(f.calls[1].options.headers['Accept-Profile'],'public');
 a.ok(f.calls.every(c=>!c.url.includes('oczxyiakpmgnrpoyhwov')));a.ok(f.storage.has('martins.prod.auth.v1'));a.equal(f.storage.has('martins.qa.auth.v1'),false);
 a.equal(f.window.verificarPermissaoMasterAutenticadaWork(),true);
});
test('Administrador público não vira Master na compatibilidade v5',async()=>{
 const f=setup({papel:'administrador'});await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');
 a.equal(f.window.verificarPermissaoMasterAutenticadaWork(),false);a.equal(f.window.obterContextoSegurancaAutenticadoWork().vinculos[0].papelServidor,'administrador');
});
test('Senha recusada não cai no autenticador local legado',async()=>{
 const f=setup({rejectLogin:true});const r=await f.window.autenticarUsuarioSupabaseAuth({email:'synthetic@example.invalid',password:'synthetic-password'});
 a.equal(r.sucesso,false);a.equal(f.window.obterContextoSegurancaAutenticadoWork(),null);a.equal(f.calls.length,1);
});
test('Contexto de outro UID é recusado',async()=>{
 const f=setup({wrongUID:true});const r=await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');a.equal(r.sucesso,false);a.equal(f.window.obterContextoSegurancaAutenticadoWork(),null);
});
test('F5 simulado reutiliza refresh da v5 e não cria outro provedor',async()=>{
 const f=setup();await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');
 const r=await f.window.restaurarSessaoQaWork();a.equal(r.sucesso,true);
 a.ok(f.calls.some(c=>c.url.includes('/auth/v1/token?grant_type=refresh_token')));
 a.equal(f.calls.filter(c=>c.url.includes('grant_type=password')).length,1);
});
test('RPCs dos módulos usam o transporte autenticado da mesma v5',async()=>{
 const f=setup();await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');
 await f.window.MartinsProducaoRpc.consultar({e:E,m:'obras'});a.equal(f.calls.at(-1).options.headers.Authorization,'Bearer synthetic-access');
 a.ok(f.calls.at(-1).url.endsWith('/rpc/martins_producao_consultar'));
});

test('Motor de produção recusa configuração apontando ao QA antes de enviar credenciais',async()=>{
 const f=setup({urlConfigurada:'https://oczxyiakpmgnrpoyhwov.supabase.co'});const r=await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');a.equal(r.sucesso,false);a.equal(f.calls.length,0);
});

test('Prévia bloqueia gravações de módulos e lotes antes da rede', async () => {
 const f=setup();
 await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');
 const chamadas=f.calls.length;
 await a.rejects(f.window.MartinsProducaoRpc.salvar({e:E,m:'financeiro'}), {code:'PREVIA_SOMENTE_LEITURA'});
 await a.rejects(f.window.MartinsProducaoRpc.lote({e:E,m:'frequencia'}), {code:'PREVIA_SOMENTE_LEITURA'});
 await a.rejects(f.window.MartinsProducaoRpc.salvar({e:E,m:'orcamentos'}), {code:'PREVIA_SOMENTE_LEITURA'});
 a.equal(f.calls.length,chamadas);
});

test('E-mail não confirmado para no Auth e não é tratado como senha inválida', async () => {
 const f=setup({authError:'email_not_confirmed'});
 const r=await f.window.autenticarUsuarioSistema(' synthetic@example.invalid ', ' senha com espaços ');
 a.equal(r.codigo,'email_not_confirmed');
 a.equal(f.calls.length,1);
 a.deepEqual(JSON.parse(f.calls[0].options.body),{email:'synthetic@example.invalid',password:' senha com espaços '});
});

test('Negativa da RPC de contexto é distinguida de erro de credenciais', async () => {
 const f=setup({contextError:'42501'});
 const r=await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');
 a.equal(r.codigo,'CONTEXTO_NEGADO');
 a.match(r.erro,/Login aceito/);
 a.equal(f.window.obterContextoSegurancaAutenticadoWork(),null);
 a.equal(f.calls.length,2);
});

test('Falha de renderização após validação mantém login e restauração', async () => {
 const f=setup();
 f.window.MartinsProducaoOnSession=async contexto=>{
   if(contexto)throw new TypeError('Renderizador indisponível');
 };
 a.equal((await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password')).sucesso,true);
 a.equal(f.window.obterContextoSegurancaAutenticadoWork().uid,UID);
 a.equal((await f.window.restaurarSessaoQaWork()).sucesso,true);
 a.ok(f.storage.has('martins.prod.auth.v1'));
});

test('Chamada legada sem senha não derruba a sessão v5 nem inicia login', async () => {
 const f=setup();await f.window.autenticarUsuarioSistema('synthetic@example.invalid','synthetic-password');
 const chamadas=f.calls.length;
 for (const cred of [{login:'henrique'},{login:'synthetic@example.invalid'},{usuario:'qualquer'}]) {
  const r=await f.window.autenticarUsuarioSupabaseAuth(cred);
  a.equal(r.sucesso,true);a.equal(r.reutilizada,true);
 }
 a.equal(f.calls.length,chamadas);
 a.ok(f.window.obterContextoSegurancaAutenticadoWork());
});

test('Sem sessão, chamada legada sem senha só informa credenciais ausentes', async () => {
 const f=setup();
 const r=await f.window.autenticarUsuarioSupabaseAuth({login:'henrique'});
 a.equal(r.sucesso,false);a.equal(r.codigo,'CREDENCIAIS');a.equal(f.calls.length,0);
});
