const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('dist/qa-auth-ui.js','utf8');
const origin = 'https://qa.example';
async function visit(path) {
  const state = { replacements: [], restores: 0 };
  const fields = [{value:'NovaSenhaQA!'},{value:'NovaSenhaQA!'}];
  const submit = {disabled:false}, cancel = {}, msg = {};
  const form = {
    querySelectorAll: () => fields,
    querySelector: q => q === '[type=submit]' ? submit : cancel,
    remove() {}
  };
  const login = {hidden:false,before(el) { if (el === form) state.form = form; }};
  const solicitar = {addEventListener() {}};
  let ready;
  const document = {
    getElementById: id => ({'form-login-gate':login,'btn-recuperar-senha-gate':solicitar})[id],
    createElement: tag => tag === 'form' ? form : tag === 'p' ? msg : {setAttribute() {}},
    addEventListener: (_name,cb) => { ready = cb; },
    body:{append() {}}
  };
  msg.setAttribute = () => {};
  const window = {
    restaurarSessaoQaWork: async () => { state.restores++; },
    verificarRecuperacaoQaWork: async value => { state.retorno = {...value}; return 'test-recovery'; },
    redefinirSenhaQaWork: async (token,senha) => { state.update = [token,senha]; }
  };
  vm.runInNewContext(source,{URL,URLSearchParams,location:{href:origin+path},window,document,
    history:{replaceState:(_state,_title,dest)=>state.replacements.push(dest)}});
  await ready();
  if (state.form?.onsubmit) await form.onsubmit({preventDefault() {}});
  return {...state, message:msg.textContent, loginHidden:login.hidden, disabled:submit.disabled};
}
(async()=>{
  for (const [path,key] of [
    ['/#type=recovery&access_token=test','token'],
    ['/?type=recovery#access_token=test','token'],
    ['/?recuperar=1#access_token=test','token'],
    ['/?type=recovery&token_hash=test','hash'],
    ['/#type=recovery&token_hash=test','hash']
  ]) {
    const res = await visit(path);
    assert.equal(res.retorno[key],'test');
    assert.deepEqual(res.replacements,['/']);
    assert.equal(res.restores,0);
    assert.deepEqual(res.update,['test-recovery','NovaSenhaQA!']);
  }
  const expired = await visit('/?recuperar=1#error_code=otp_expired');
  assert.equal(expired.disabled,true);
  assert.match(expired.message,/expirado/);
  const pkce = await visit('/?recuperar=1&code=test');
  assert.equal(pkce.disabled,true);
  assert.match(pkce.message,/troca de código/);
  const invite = await visit('/?recuperar=1#type=invite&access_token=test');
  assert.equal(invite.form,undefined);
  assert.deepEqual(invite.replacements,['/']);
  assert.equal((await visit('/')).restores,1);
  console.log('PASS: retorno de recuperação, limpeza da URL, expiração, código sem verificador e convite separado.');
})().catch(e=>{console.error(e);process.exitCode=1;});
