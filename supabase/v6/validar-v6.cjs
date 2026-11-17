// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v6/validar-v6.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', ALMOX = '22222222-2222-4222-8222-222222222222', LEITOR = '33333333-3333-4333-8333-333333333333';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(6);
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${MASTER}'),('${ALMOX}'),('${LEITOR}');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${ALMOX}','${E}','Almoxarife'),('${LEITOR}','${E}','Leitor');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${ALMOX}','operacional',true),('${E}','${LEITOR}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${ALMOX}','${E}','estoque_movimentos',true,true,true),('${LEITOR}','${E}','estoque_movimentos',true,false,false);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const salvar = (u, m, r, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,0,$4,$5) AS x', [E, m, r, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const mover = (u, tipo, p, o, d, qt, motivo = null, ref = null) => como(u, 'SELECT public.martins_producao_estoque_mover($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x', [E, id(), tipo, p, o, d, qt, motivo, ref]).then(x => x.x ?? x);
  const consumir = (u, obra, dep, itens, rdo = null, op = id()) => como(u, 'SELECT public.martins_producao_obra_consumir($1,$2,$3,$4,$5,$6,$7) AS x', [E, op, obra, dep, JSON.stringify(itens), rdo, 'consumo do dia']).then(x => x.x ?? x);
  const devolver = (u, c, qt, motivo = 'sobrou material') => como(u, 'SELECT public.martins_producao_obra_devolver($1,$2,$3,$4,$5) AS x', [E, id(), c, qt, motivo]).then(x => x.x ?? x);
  const saldo = async (p, d) => Number((await q(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, p, d]))[0].s);
  const A = id(), B = id(), D = id(), OBRA = id(), OBRA2 = id(), RDO = id(), RDO2 = id();
  await salvar(MASTER, 'produtos', A, { codigo: 'A', descricao: 'Cimento' }); await salvar(MASTER, 'produtos', B, { codigo: 'B', descricao: 'Areia' });
  await salvar(MASTER, 'depositos', D, { nome: 'Almoxarifado' });
  await salvar(MASTER, 'obras', OBRA, { nome: 'Obra 1', codigo: 'O1' }); await salvar(MASTER, 'obras', OBRA2, { nome: 'Obra 2', codigo: 'O2' });
  const hoje = (await q(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text d`))[0].d;
  await salvar(MASTER, 'rdos', RDO, { obra_id: OBRA, data: hoje, status: 'rascunho', trabalhadores: [] }); await salvar(MASTER, 'rdos', RDO2, { obra_id: OBRA2, data: hoje, status: 'rascunho', trabalhadores: [] });
  await mover(ALMOX, 'entrada', A, null, D, 10000); await mover(ALMOX, 'entrada', B, null, D, 20000);

  console.log('Consumo no RDO (A=10 / B=20)');
  const op = id(); const c1 = await consumir(ALMOX, OBRA, D, [{ produto_id: A, qtd_milli: 3000 }], RDO, op);
  check(c1.ids?.length === 1 && await saldo(A, D) === 7000 && await saldo(B, D) === 20000, 'consumir 3 de A no RDO: A=7 e B continua 20');
  check((await consumir(ALMOX, OBRA, D, [{ produto_id: A, qtd_milli: 3000 }], RDO, op)).repetida === true && await saldo(A, D) === 7000, 'reenviar a mesma operação não baixa de novo');
  check((await consumir(ALMOX, OBRA, D, [{ produto_id: A, qtd_milli: 1000 }], RDO)).erro === '23505' && await saldo(A, D) === 7000, 'o mesmo material no mesmo RDO, em outra operação, é recusado (baixa única)');
  check((await consumir(ALMOX, OBRA, D, [{ produto_id: A, qtd_milli: 1000 }], RDO2)).erro === '23503', 'RDO de outra obra é recusado');
  check((await consumir(ALMOX, OBRA, D, [{ produto_id: A, qtd_milli: 8000 }])).erro === '23514', 'consumo maior que o saldo é recusado');
  const lote = await consumir(ALMOX, OBRA, D, [{ produto_id: B, qtd_milli: 5000 }, { produto_id: A, qtd_milli: 99000 }]);
  check(lote.erro === '23514' && await saldo(B, D) === 20000, 'lote com um item sem saldo é recusado inteiro (B não foi baixado)');
  check((await consumir(ALMOX, OBRA, D, [{ produto_id: B, qtd_milli: 5000 }, { produto_id: B, qtd_milli: 1000 }])).erro === '22023', 'produto repetido no lote é recusado');
  check((await consumir(ALMOX, id(), D, [{ produto_id: B, qtd_milli: 1000 }])).erro === '23503', 'obra de fora é recusada');
  check((await consumir(LEITOR, OBRA, D, [{ produto_id: B, qtd_milli: 1000 }])).erro === '42501', 'quem só lê não consome');
  const c2 = await consumir(ALMOX, OBRA, D, [{ produto_id: B, qtd_milli: 5000 }, { produto_id: A, qtd_milli: 2000 }]);
  check(c2.ids?.length === 2 && await saldo(B, D) === 15000 && await saldo(A, D) === 5000, 'consumo sem RDO (obra) com dois materiais baixa os dois');

  console.log('Devolução');
  const mat = (await como(LEITOR, 'SELECT public.martins_producao_obra_materiais($1,$2) AS x', [E, OBRA])).x;
  const porProd = Object.fromEntries(mat.map(m => [m.produto_id, m]));
  check(porProd[A].consumido_milli === 5000 && porProd[B].consumido_milli === 5000, 'a obra consumiu A=5 e B=5 (soma dos eventos)');
  const d1 = await devolver(ALMOX, c1.ids[0], 1000);
  check(d1.id && await saldo(A, D) === 6000, 'devolver 1 de A volta ao depósito (A=6)');
  check((await devolver(ALMOX, c1.ids[0], 2500)).erro === '23514', 'devolver mais do que foi consumido é recusado');
  check((await devolver(ALMOX, c1.ids[0], 2000)).id !== undefined && await saldo(A, D) === 8000, 'devolver o restante do consumo fecha a conta (A=8)');
  check((await devolver(ALMOX, c1.ids[0], 1)).erro === '23514', 'consumo totalmente devolvido não aceita mais devolução');
  check((await devolver(ALMOX, c1.ids[0], 1000, '')).erro === '22023', 'devolução sem motivo é recusada');
  check((await devolver(ALMOX, id(), 1000)).erro === '23503', 'devolver um consumo que não existe é recusado');
  const mat2 = (await como(LEITOR, 'SELECT public.martins_producao_obra_materiais($1,$2) AS x', [E, OBRA])).x;
  check(mat2.find(m => m.produto_id === A).liquido_milli === 2000, 'consumo líquido de A na obra: 5 consumidos − 3 devolvidos = 2');
  check((await como(LEITOR, 'SELECT public.martins_producao_obra_materiais($1,$2) AS x', [E, OBRA2])).x.length === 0, 'outra obra não herda o consumo');

  console.log('Estorno e proteção');
  check((await mover(MASTER, 'estorno', null, null, null, null, 'engano', c2.ids[0])).erro === '22023', 'consumo de obra não é estornado (a correção é a devolução)');
  const ent = await mover(ALMOX, 'entrada', A, null, D, 1000);
  check((await mover(MASTER, 'estorno', null, null, null, null, 'engano', ent.id)).saldo_destino !== undefined, 'estorno de entrada comum continua funcionando');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='estoque_movimentos' AND depois->'dados'->>'tipo' IS NULL AND depois->>'dados' IS NULL`))[0].n >= 0, 'auditoria consultável');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='estoque_movimentos'`))[0].n >= 9, 'consumos e devoluções têm trilha de auditoria');

  console.log('Reversão');
  const limpo = await banco(6);
  try { await limpo.exec(sql('supabase/v6/reverter_v6.sql')); check(true, 'sem consumos, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async d => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname='martins_producao_estoque_mover'`)).rows[0].h;
  check((await h(await banco(5))) === (await h(limpo)), 'reversão devolve a função de estoque exatamente à da v4/v5');
  try { await db.exec(sql('supabase/v6/reverter_v6.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com consumos, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
