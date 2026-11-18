// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v16/validar-v16.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', FIN = '22222222-2222-4222-8222-222222222222', ADMIN = '44444444-4444-4444-8444-444444444444', SEM = '55555555-5555-4555-8555-555555555555';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15', 'v16'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(16);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','m@t.com'),('${FIN}','f@t.com'),('${ADMIN}','a@t.com'),('${SEM}','s@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${FIN}','${E}','Financeiro'),('${ADMIN}','${E}','Administrador'),('${SEM}','${E}','Sem acesso');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo, leitura_integral) VALUES ('${E}','${MASTER}','master',true,false),('${E}','${FIN}','operacional',true,false),('${E}','${ADMIN}','administrador',true,true),('${E}','${SEM}','operacional',true,false);
   INSERT INTO martins_producao_v1.permissoes SELECT '${FIN}','${E}',m,true,true,true FROM unnest(ARRAY['extratos_bancarios','contas_receber','despesas']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${ADMIN}','${E}',m,true,true,true FROM unnest(ARRAY['extratos_bancarios','contas_receber','despesas']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${SEM}','${E}',m,true,false,false FROM unnest(ARRAY['extratos_bancarios']) m;`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows; const x = r => r?.x ?? r;
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x);
  const CONTA = id(), CONTA2 = id(), CLI = id();
  await salvar(MASTER, 'contas_bancarias', CONTA, 0, { nome: 'Banco A' }); await salvar(MASTER, 'contas_bancarias', CONTA2, 0, { nome: 'Banco B' });
  const imp = (u, conta, linhas, op = id(), origem = 'ofx') => como(u, 'SELECT public.martins_producao_extrato_importar($1,$2,$3,$4,$5) AS x', [E, op, conta, origem, JSON.stringify(linhas)]).then(x);
  const linhaDe = async d => (await q(`SELECT id, revisao, dados FROM martins_producao_v1.registros WHERE modulo='extratos_bancarios' AND dados->>'descricao'=$1 ORDER BY criado_em, id LIMIT 1`, [d]))[0];
  const conc = (u, l, tipo, alvo, baixa = null, v, op = id()) => como(u, 'SELECT public.martins_producao_extrato_conciliar($1,$2,$3,$4,$5,$6,$7) AS x', [E, op, l.id, v ?? l.revisao, tipo, alvo, baixa]).then(x);
  const desc = (u, l, motivo, v, op = id()) => como(u, 'SELECT public.martins_producao_extrato_desconciliar($1,$2,$3,$4,$5) AS x', [E, op, l.id, v ?? l.revisao, motivo]).then(x);

  console.log('Importação');
  const L = [{ data: '2026-11-10', valor_centavos: 50000, descricao: 'PIX CLIENTE X', fitid: 'F1' }, { data: '2026-11-11', valor_centavos: -20000, descricao: 'PAG ANDAIME', fitid: 'F2' }, { data: '2026-11-12', valor_centavos: 7000, descricao: 'TARIFA' }, { data: '2026-11-12', valor_centavos: 7000, descricao: 'TARIFA' }];
  const opA = id(); const r1 = await imp(FIN, CONTA, L, opA);
  check(r1.inseridas === 4 && r1.ignoradas === 0, 'importa 4 linhas (duas iguais, sem FITID, entram como duas ocorrências)');
  check((await imp(FIN, CONTA, L, opA)).repetida === true, 'reenviar a mesma operação devolve o mesmo resultado, sem regravar');
  const r2 = await imp(FIN, CONTA, L); check(r2.inseridas === 0 && r2.ignoradas === 4, 'importar o mesmo arquivo de novo ignora tudo: nada duplica');
  const r3 = await imp(FIN, CONTA, [...L, { data: '2026-11-13', valor_centavos: 1234, descricao: 'NOVA', fitid: 'F9' }]);
  check(r3.inseridas === 1 && r3.ignoradas === 4, 'arquivo que se sobrepõe ao anterior: entra só a linha nova');
  const r4 = await imp(FIN, CONTA2, [L[0]]); check(r4.inseridas === 1, 'o mesmo FITID em outra conta bancária é outra linha');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='extratos_bancarios'`))[0].n === 6, 'total no banco: 6 linhas');
  check((await imp(SEM, CONTA, [L[0]])).erro === '42501', 'quem não tem permissão de criar no módulo não importa');
  check((await imp(FIN, id(), [L[0]])).erro === '23503', 'conta bancária inexistente é recusada');
  check((await imp(FIN, CONTA, [{ data: '10/11/2026', valor_centavos: 1, descricao: 'x' }])).erro === '22023' && (await imp(FIN, CONTA, [{ data: '2026-11-10', valor_centavos: 0, descricao: 'x' }])).erro === '22023' && (await imp(FIN, CONTA, [])).erro === '22023', 'data fora do formato, valor zero e lista vazia são recusados');
  check((await imp(FIN, CONTA, [{ data: '1990-01-01', valor_centavos: 5, descricao: 'x' }])).erro === '22023', 'data absurda é recusada');
  check((await imp(FIN, CONTA, [L[0]], id(), 'xls')).erro === '22023', 'origem diferente de ofx/csv é recusada');
  check((await salvar(MASTER, 'extratos_bancarios', id(), 0, { valor_centavos: 5 })).erro !== undefined, 'o cadastro genérico não grava extrato (só as funções próprias)');

  console.log('Conciliação com recebimento');
  const T = id(); await salvar(FIN, 'contas_receber', T, 0, { cliente_nome: 'Cliente X', descricao: 'Título', valor_centavos: 90000, vencimento: '2026-11-20', competencia: '2026-11-01' });
  const bx = await como(FIN, 'SELECT public.martins_producao_receber_baixar($1,$2,$3,$4,$5,$6,$7,$8) AS x', [E, id(), T, 1, 50000, '2026-11-10', null, null]).then(x);
  const BX = (await q(`SELECT dados->'baixas'->0->>'id' b FROM martins_producao_v1.registros WHERE id=$1`, [T]))[0].b;
  const pix = await linhaDe('PIX CLIENTE X'); const andaime = await linhaDe('PAG ANDAIME'); const tarifa = await linhaDe('TARIFA');
  check((await conc(FIN, andaime, 'baixa', T, BX)).erro === '22023', 'saída (débito) não concilia com recebimento');
  check((await conc(FIN, tarifa, 'baixa', T, BX)).erro === '22023', 'valor diferente do recebimento é recusado (R$ 70,00 ≠ R$ 500,00)');
  check((await conc(SEM, pix, 'baixa', T, BX)).erro === '42501', 'sem permissão de editar o módulo, não concilia');
  const oc = id(); const c1 = await conc(FIN, pix, 'baixa', T, BX, undefined, oc);
  check(c1.situacao === 'conciliada' && c1.revisao === 2, 'entrada de R$ 500,00 concilia com a baixa de R$ 500,00');
  check((await conc(FIN, pix, 'baixa', T, BX, undefined, oc)).repetida === true, 'repetir a mesma operação não concilia de novo');
  check((await conc(FIN, pix, 'baixa', T, BX, 2)).erro === '23505', 'linha já conciliada não é conciliada outra vez');
  const pixB = (await q(`SELECT id, revisao, dados FROM martins_producao_v1.registros WHERE modulo='extratos_bancarios' AND dados->>'conta_bancaria_id'=$1`, [CONTA2]))[0];
  check((await conc(FIN, pixB, 'baixa', T, BX)).erro === '23505', 'o mesmo recebimento não liga a duas linhas do extrato (mesmo em outra conta)');
  check((await conc(FIN, pix, 'baixa', T, BX, 1)).erro !== undefined, 'revisão antiga é recusada');
  const dentro = (await q(`SELECT dados FROM martins_producao_v1.registros WHERE id=$1`, [pix.id]))[0].dados;
  check(dentro.situacao === 'conciliada' && dentro.conciliacao.tipo === 'baixa' && dentro.conciliacao.baixa === BX, 'a linha guarda a que recebimento foi ligada, quem e quando');
  const T2 = id(); await salvar(FIN, 'contas_receber', T2, 0, { cliente_nome: 'Cliente Y', descricao: 'T2', valor_centavos: 7000, vencimento: '2026-11-20', competencia: '2026-11-01' });
  await como(FIN, 'SELECT public.martins_producao_receber_baixar($1,$2,$3,$4,$5,$6,$7,$8) AS x', [E, id(), T2, 1, 7000, '2026-11-12', null, null]);
  const BX2 = (await q(`SELECT dados->'baixas'->0->>'id' b FROM martins_producao_v1.registros WHERE id=$1`, [T2]))[0].b;
  await como(MASTER, 'SELECT public.martins_producao_receber_estornar($1,$2,$3,$4,$5,$6) AS x', [E, id(), T2, 2, BX2, 'erro de lançamento']);
  check((await conc(FIN, tarifa, 'baixa', T2, BX2)).erro === '22023', 'recebimento estornado não concilia');

  console.log('Conciliação com despesa');
  const CC = id(), D1 = id(), D2 = id(), D3 = id(); await salvar(MASTER, 'centros_custo', CC, 0, { codigo: 'ADM', nome: 'Adm', tipo: 'administrativo' });
  const desp = (idd, v, extra = {}) => salvar(MASTER, 'despesas', idd, 0, { descricao: 'Andaime', valor_centavos: v, competencia: '2026-11-05', classificacao: 'administrativa', centro_custo_id: CC, ...extra });
  await desp(D1, 20000); await desp(D2, 20000); await desp(D3, 20000, { confidencial: true });
  const estD = (idd, rev, est) => como(MASTER, 'SELECT public.martins_producao_despesa_estado($1,$2,$3,$4,$5,$6) AS x', [E, idd, rev, est, 'ok', id()]);
  check((await conc(FIN, andaime, 'despesa', D1)).erro === '42501', 'operador sem leitura integral não concilia despesa (vê só as suas)');
  check((await conc(ADMIN, andaime, 'despesa', D1)).erro === '22023', 'despesa ainda não paga não concilia');
  await estD(D1, 1, 'aprovado'); await estD(D1, 2, 'pago'); await estD(D1, 3, 'confirmado');
  await estD(D3, 1, 'aprovado'); await estD(D3, 2, 'pago');
  check((await conc(ADMIN, tarifa, 'despesa', D1)).erro === '22023', 'entrada (crédito) não concilia com despesa');
  check((await conc(ADMIN, andaime, 'despesa', D3)).erro === '42501', 'o Administrador não concilia despesa confidencial (só o Master)');
  const dv = await conc(ADMIN, andaime, 'despesa', D1);
  check(dv.situacao === 'conciliada' && dv.despesa_conciliada === false, 'o Administrador concilia a despesa paga/confirmada com a saída de R$ 200,00 (sem mexer no estado: isso é do Master)');
  await desc(ADMIN, { id: andaime.id }, 'engano', 2);
  const and2 = await linhaDe('PAG ANDAIME');
  const dm = await conc(MASTER, and2, 'despesa', D1);
  check(dm.situacao === 'conciliada' && dm.despesa_conciliada === true && (await q(`SELECT dados->>'estado' s FROM martins_producao_v1.registros WHERE id=$1`, [D1]))[0].s === 'conciliado', 'o Master concilia e a despesa confirmada passa a "conciliado", com auditoria');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE registro_id=$1`, [D1]))[0].n >= 4, 'a mudança de estado da despesa ficou na auditoria');

  console.log('Desfazer');
  const pix2 = await linhaDe('PIX CLIENTE X');
  check((await desc(FIN, pix2, '')).erro === '22023', 'desfazer exige motivo');
  check((await desc(FIN, pix2, 'lançado errado')).situacao === 'pendente', 'desfazer devolve a linha a pendente');
  const pix3 = await linhaDe('PIX CLIENTE X');
  check(pix3.dados.conciliacao === undefined && pix3.dados.alvo_chave === undefined && (await desc(FIN, pix3, 'de novo')).erro === '22023', 'a ligação some e não se desfaz o que não está conciliado');
  check((await conc(FIN, pix3, 'baixa', T, BX)).situacao === 'conciliada', 'depois de desfeita, a mesma linha e o mesmo recebimento podem ser ligados de novo');

  console.log('Reversão');
  const limpo = await banco(16); try { await limpo.exec(sql('supabase/v16/reverter_v16.sql')); check(true, 'sem extratos, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async (d, nome) => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname=$1 ORDER BY pronargs DESC LIMIT 1`, [nome])).rows[0].h;
  const v15 = await banco(15);
  check((await h(v15, 'martins_producao_salvar')) === (await h(limpo, 'martins_producao_salvar')) && (await h(v15, 'martins_producao_contexto')) === (await h(limpo, 'martins_producao_contexto')), 'a reversão devolve salvar e contexto às versões anteriores');
  try { await db.exec(sql('supabase/v16/reverter_v16.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/Reversão bloqueada/.test(e.message), 'com extratos importados, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
