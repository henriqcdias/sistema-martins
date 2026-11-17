// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v4/validar-v4.cjs .
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', OPER = '22222222-2222-4222-8222-222222222222', LEITOR = '33333333-3333-4333-8333-333333333333';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(4);
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${MASTER}'),('${OPER}'),('${LEITOR}');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${OPER}','${E}','Almoxarife'),('${LEITOR}','${E}','Leitor');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${OPER}','operacional',true),('${E}','${LEITOR}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${OPER}','${E}','estoque_movimentos',true,true,false),('${LEITOR}','${E}','estoque_movimentos',true,false,false);`);
  const OUTRA = id(); await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${OUTRA}','Outra Empresa')`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const salvar = (u, m, r, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,0,$4,$5) AS x', [E, m, r, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const mover = (u, tipo, p, o, d, q, motivo = null, ref = null, op = id()) => como(u, 'SELECT public.martins_producao_estoque_mover($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x', [E, op, tipo, p, o, d, q, motivo, ref]).then(x => x.x ?? x);
  const saldos = async u => { const r = (await como(u, 'SELECT public.martins_producao_estoque_saldos($1) AS x', [E])); return r.erro ? r : Object.fromEntries(r.x.map(s => [s.produto_id + '|' + s.deposito_id, Number(s.saldo_milli)])); };
  const A = id(), B = id(), D1 = id(), D2 = id();
  await salvar(MASTER, 'produtos', A, { codigo: 'A', descricao: 'Produto A' }); await salvar(MASTER, 'produtos', B, { codigo: 'B', descricao: 'Produto B' });
  await salvar(MASTER, 'depositos', D1, { nome: 'Almoxarifado', principal: true }); await salvar(MASTER, 'depositos', D2, { nome: 'Obra' });
  const OUT = id(); await db.exec(`INSERT INTO martins_producao_v1.registros VALUES ('${OUTRA}','depositos','${OUT}',1,'{"nome":"Depósito de outra empresa"}','${MASTER}','${MASTER}')`);

  console.log('Cenário do relatório: A=10 / B=20');
  check((await mover(OPER, 'entrada', A, null, D1, 10000)).saldo_destino == 10000, 'entrada de 10 un do produto A');
  check((await mover(OPER, 'entrada', B, null, D1, 20000)).saldo_destino == 20000, 'entrada de 20 un do produto B');
  const op = id(); const saida = await mover(OPER, 'saida', A, D1, null, 3000, 'consumo', null, op);
  let s = await saldos(OPER);
  check(saida.saldo_origem == 7000 && s[`${A}|${D1}`] === 7000 && s[`${B}|${D1}`] === 20000, 'baixar 3 de A: A=7 e B continua 20 (só o alvo muda)');
  check((await mover(OPER, 'saida', A, D1, null, 3000, 'consumo', null, op)).repetida === true && (await saldos(OPER))[`${A}|${D1}`] === 7000, 'reenviar a mesma operação não baixa de novo');
  check((await mover(OPER, 'saida', A, D1, null, 9000, 'x')).erro === '23514', 'baixa maior que o saldo é recusada (23514)');
  check((await mover(MASTER, 'estorno', null, null, null, null, null, saida.id)).erro === '22023', 'estorno sem motivo é recusado');
  const est = await mover(MASTER, 'estorno', null, null, null, null, 'baixa lançada por engano', saida.id);
  s = await saldos(MASTER);
  check(est.saldo_destino == 10000 && s[`${A}|${D1}`] === 10000 && s[`${B}|${D1}`] === 20000, 'estornar volta a A=10 e B=20');
  check((await mover(MASTER, 'estorno', null, null, null, null, 'de novo', saida.id)).erro === '23505', 'estornar de novo é recusado (sem efeito duplicado)');
  check((await mover(MASTER, 'estorno', null, null, null, null, 'estorno do estorno', est.id)).erro === '23503', 'não se estorna um estorno');
  check((await mover(OPER, 'estorno', null, null, null, null, 'x', saida.id)).erro === '42501', 'operacional sem permissão de editar não estorna');

  console.log('Transferência e isolamento');
  const t = await mover(OPER, 'transferencia', B, D1, D2, 5000);
  s = await saldos(OPER);
  check(t.saldo_origem == 15000 && t.saldo_destino == 5000 && s[`${B}|${D1}`] + s[`${B}|${D2}`] === 20000, 'transferência entre depósitos preserva o total (15 + 5 = 20)');
  check((await mover(OPER, 'transferencia', B, D1, D1, 1000)).erro === '22023', 'origem igual ao destino é recusada');
  check((await mover(OPER, 'transferencia', B, D1, OUT, 1000)).erro === '23503', 'transferência para depósito de outra empresa é recusada');
  check((await mover(OPER, 'entrada', id(), null, D1, 1000)).erro === '23503', 'produto inexistente/de outra empresa é recusado');
  check((await mover(OPER, 'entrada', A, null, D1, 0)).erro === '22023', 'quantidade zero é recusada');

  console.log('Permissões e proteção');
  check((await mover(LEITOR, 'entrada', A, null, D1, 1000)).erro === '42501', 'quem só lê não movimenta');
  check((await saldos(LEITOR))[`${A}|${D1}`] === 10000, 'quem lê consulta os saldos');
  check((await salvar(MASTER, 'estoque_movimentos', id(), { tipo: 'entrada', produto_id: A, destino_id: D1, quantidade_milli: 999999 })).erro === '42501', 'gravar movimento pelo contrato genérico é bloqueado (nem Master forja saldo)');
  await db.exec(`UPDATE martins_producao_v1.registros SET dados=dados||'{"ativo":false}' WHERE modulo='depositos' AND id='${D2}'`);
  check((await mover(OPER, 'entrada', A, null, D2, 1000)).erro === '22023', 'depósito inativo não recebe movimento');
  const aud = (await db.query(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='estoque_movimentos'`)).rows[0].n;
  check(aud === 5, 'cada movimento gera um evento de auditoria (' + aud + ')');

  console.log('Reversão');
  const limpo = await banco(4);
  try { await limpo.exec(sql('supabase/v4/reverter_v4.sql')); check(true, 'sem movimentos, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async d => (await d.query(`SELECT string_agg(md5(prosrc), ',' ORDER BY proname) h FROM pg_proc WHERE proname IN ('pode','martins_producao_contexto','martins_producao_salvar','martins_producao_catalogos')`)).rows[0].h;
  check((await h(await banco(3))) === (await h(limpo)), 'reversão devolve as funções exatamente à v3');
  try { await db.exec(sql('supabase/v4/reverter_v4.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com movimentos, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
