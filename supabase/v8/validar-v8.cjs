// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v8/validar-v8.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', ALMOX = '22222222-2222-4222-8222-222222222222', SOLIC = '33333333-3333-4333-8333-333333333333', LEITOR = '44444444-4444-4444-8444-444444444444';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(8);
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${MASTER}'),('${ALMOX}'),('${SOLIC}'),('${LEITOR}');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${ALMOX}','${E}','Almoxarife'),('${SOLIC}','${E}','Solicitante'),('${LEITOR}','${E}','Leitor');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${ALMOX}','operacional',true),('${E}','${SOLIC}','operacional',true),('${E}','${LEITOR}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${ALMOX}','${E}','estoque_movimentos',true,true,true),('${ALMOX}','${E}','requisicoes_material',true,false,false),
    ('${SOLIC}','${E}','requisicoes_material',true,true,true),('${LEITOR}','${E}','requisicoes_material',true,false,false);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const mover = (u, tipo, p, o, d, qt) => como(u, 'SELECT public.martins_producao_estoque_mover($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x', [E, id(), tipo, p, o, d, qt, null, null]).then(x => x.x ?? x);
  const estado = (u, r, v, est, motivo = 'ok', op = id()) => como(u, 'SELECT public.martins_producao_req_estado($1,$2,$3,$4,$5,$6) AS x', [E, r, v, est, motivo, op]).then(x => x.x ?? x);
  const entregar = (u, r, itens, op = id()) => como(u, 'SELECT public.martins_producao_req_entregar($1,$2,$3,$4) AS x', [E, op, r, JSON.stringify(itens)]).then(x => x.x ?? x);
  const consumirRdo = (u, obra, dep, itens, rdo) => como(u, 'SELECT public.martins_producao_obra_consumir($1,$2,$3,$4,$5,$6,$7) AS x', [E, id(), obra, dep, JSON.stringify(itens), rdo, null]).then(x => x.x ?? x);
  const saldo = async (p, d) => Number((await q(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, p, d]))[0].s);
  const rq = async r => (await q(`SELECT revisao, dados FROM martins_producao_v1.registros WHERE id=$1`, [r]))[0];
  const A = id(), B = id(), PI = id(), D = id(), DI = id(), OBRA = id(), OBRA2 = id(), RDO = id(), RDO2 = id();
  await salvar(MASTER, 'produtos', A, 0, { codigo: 'A', descricao: 'Cimento' }); await salvar(MASTER, 'produtos', B, 0, { codigo: 'B', descricao: 'Areia' }); await salvar(MASTER, 'produtos', PI, 0, { codigo: 'PI', descricao: 'Inativo', ativo: false });
  await salvar(MASTER, 'depositos', D, 0, { nome: 'Almoxarifado' }); await salvar(MASTER, 'depositos', DI, 0, { nome: 'Fechado', ativo: false });
  await salvar(MASTER, 'obras', OBRA, 0, { nome: 'Obra 1', codigo: 'O1' }); await salvar(MASTER, 'obras', OBRA2, 0, { nome: 'Obra 2', codigo: 'O2' });
  const hoje = (await q(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text d`))[0].d;
  await salvar(MASTER, 'rdos', RDO, 0, { obra_id: OBRA, data: hoje, status: 'rascunho', trabalhadores: [] }); await salvar(MASTER, 'rdos', RDO2, 0, { obra_id: OBRA2, data: hoje, status: 'rascunho', trabalhadores: [] });
  await mover(ALMOX, 'entrada', A, null, D, 10000); await mover(ALMOX, 'entrada', B, null, D, 4000);

  console.log('Solicitação');
  const base = { obra_id: OBRA, deposito_id: D, itens: [{ produto_id: A, qtd_milli: 5000 }, { produto_id: B, qtd_milli: 2000 }], observacao: 'Para a laje' };
  const R1 = id(); const s1 = await salvar(SOLIC, 'requisicoes_material', R1, 0, { ...base, estado: 'entregue', numero: 99 });
  check(s1.revisao === 1, 'solicitar uma requisição válida');
  const d1 = (await rq(R1)).dados;
  check(d1.estado === 'solicitada' && d1.numero === 1 && d1.itens.every(i => i.entregue_milli === 0), 'o servidor define estado "solicitada", número 1 e entregue 0 (ignora o que veio do navegador)');
  const R2 = id(); await salvar(SOLIC, 'requisicoes_material', R2, 0, { ...base, itens: [{ produto_id: A, qtd_milli: 1000 }] });
  check((await rq(R2)).dados.numero === 2, 'o número da requisição é sequencial (2)');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, itens: [{ produto_id: A, qtd_milli: 1000 }, { produto_id: A, qtd_milli: 1000 }] })).erro === '22023', 'produto repetido é recusado');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, itens: [{ produto_id: A, qtd_milli: 0 }] })).erro === '22023', 'quantidade zero é recusada');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, itens: [] })).erro === '22023', 'requisição sem itens é recusada');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, itens: [{ produto_id: PI, qtd_milli: 1000 }] })).erro === '22023', 'produto inativo é recusado');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, itens: [{ produto_id: id(), qtd_milli: 1000 }] })).erro === '23503', 'produto de fora é recusado');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, obra_id: id() })).erro === '23503', 'obra de fora é recusada');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, rdo_id: RDO2 })).erro === '23503', 'RDO de outra obra é recusado');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, deposito_id: DI })).erro === '22023', 'depósito inativo é recusado');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, deposito_id: id() })).erro === '23503', 'depósito de fora é recusado');
  check((await salvar(SOLIC, 'requisicoes_material', id(), 0, { ...base, campo_estranho: 1 })).erro === '22023', 'campo desconhecido é recusado');
  check((await salvar(LEITOR, 'requisicoes_material', id(), 0, base)).erro === '42501', 'quem só lê não solicita');
  check((await salvar(SOLIC, 'requisicoes_material', R1, 1, { ...base, itens: [{ produto_id: A, qtd_milli: 6000 }, { produto_id: B, qtd_milli: 2000 }] })).revisao === 2, 'requisição solicitada pode ser editada');

  console.log('Aprovação');
  check((await entregar(ALMOX, R1, [{ produto_id: A, qtd_milli: 1000 }])).erro === '22023', 'não se entrega requisição que ainda não foi aprovada');
  check((await estado(SOLIC, R1, 2, 'aprovada')).erro === '42501', 'quem não é Master não aprova');
  check((await estado(MASTER, R1, 1, 'aprovada')).erro === '40001', 'aprovar com revisão desatualizada é recusado (conflito)');
  check((await estado(MASTER, R1, 2, 'aprovada', '')).erro === '22023', 'aprovar sem motivo é recusado');
  const ap = await estado(MASTER, R1, 2, 'aprovada', 'Autorizado pela engenharia');
  check(ap.estado === 'aprovada' && ap.revisao === 3, 'Master aprova com motivo');
  check((await estado(MASTER, R1, 3, 'aprovada')).erro === '22023', 'aprovar de novo é transição inválida');
  check((await salvar(SOLIC, 'requisicoes_material', R1, 3, base)).erro === '22023', 'requisição aprovada não pode mais ser editada');
  check((await estado(MASTER, R2, 1, 'recusada', 'Sem verba')).estado === 'recusada' && (await entregar(ALMOX, R2, [{ produto_id: A, qtd_milli: 1000 }])).erro === '22023', 'requisição recusada não é entregue');
  check((await estado(LEITOR, R1, 3, 'cancelada')).erro === '42501', 'quem só lê não cancela');

  console.log('Entrega (baixa do estoque)');
  check((await entregar(SOLIC, R1, [{ produto_id: A, qtd_milli: 1000 }])).erro === '42501', 'quem não mexe em estoque não entrega');
  const op1 = id(); const e1 = await entregar(ALMOX, R1, [{ produto_id: A, qtd_milli: 3000 }], op1);
  check(e1.estado === 'parcial' && e1.ids.length === 1 && await saldo(A, D) === 7000, 'entrega parcial de 3 de A: estado "parcial" e estoque 10 → 7');
  check((await entregar(ALMOX, R1, [{ produto_id: A, qtd_milli: 3000 }], op1)).repetida === true && await saldo(A, D) === 7000, 'reenviar a mesma entrega não baixa de novo');
  check((await entregar(ALMOX, R1, [{ produto_id: A, qtd_milli: 3500 }])).erro === '23514' && await saldo(A, D) === 7000, 'entregar mais que o pendente (3,5 > 3) é recusado');
  check((await entregar(ALMOX, R1, [{ produto_id: id(), qtd_milli: 1000 }])).erro === '23503', 'produto que não é da requisição é recusado');
  check((await estado(SOLIC, R1, 4, 'cancelada')).erro === '22023', 'requisição com entrega não pode ser cancelada');
  const e2 = await entregar(ALMOX, R1, [{ produto_id: A, qtd_milli: 3000 }, { produto_id: B, qtd_milli: 2000 }]);
  check(e2.estado === 'entregue' && await saldo(A, D) === 4000 && await saldo(B, D) === 2000, 'entrega do restante conclui: estado "entregue" (A=4, B=2)');
  check((await rq(R1)).dados.itens.every(i => i.entregue_milli === i.qtd_milli), 'cada item mostra entregue = solicitado');
  check((await entregar(ALMOX, R1, [{ produto_id: A, qtd_milli: 1000 }])).erro === '22023', 'requisição entregue não aceita nova entrega');

  console.log('Integridade com o estoque e a obra');
  const R3 = id(); await salvar(SOLIC, 'requisicoes_material', R3, 0, { ...base, itens: [{ produto_id: B, qtd_milli: 1500 }, { produto_id: A, qtd_milli: 99000 }] });
  await estado(MASTER, R3, 1, 'aprovada', 'ok');
  const lote = await entregar(ALMOX, R3, [{ produto_id: B, qtd_milli: 1500 }, { produto_id: A, qtd_milli: 99000 }]);
  check(lote.erro === '23514' && await saldo(B, D) === 2000, 'lote com um item sem saldo é recusado inteiro (B não foi baixado)');
  const mat = (await como(ALMOX, 'SELECT public.martins_producao_obra_materiais($1,$2) AS x', [E, OBRA])).x;
  check(mat.find(m => m.produto_id === A).consumido_milli === 6000 && mat.find(m => m.produto_id === B).consumido_milli === 2000, 'a entrega aparece como consumo líquido da obra (A=6, B=2)');
  const movs = await q(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos' AND dados->>'requisicao_id'=$1`, [R1]);
  check(movs.length === 3 && movs.every(m => m.dados.tipo === 'consumo' && m.dados.obra_id === OBRA && /Requisição nº 1/.test(m.dados.motivo)), 'as baixas são consumos da obra, ligados à requisição nº 1');
  const idConsumo = (await q(`SELECT id FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos' AND dados->>'requisicao_id'=$1 AND dados->>'produto_id'=$2 LIMIT 1`, [R1, A]))[0].id;
  const dv = await como(ALMOX, 'SELECT public.martins_producao_obra_devolver($1,$2,$3,$4,$5) AS x', [E, id(), idConsumo, 1000, 'sobrou']);
  check(dv.x?.id !== undefined && await saldo(A, D) === 5000, 'a sobra pode ser devolvida pela função de devolução da v6 (A volta a 5)');
  check((await mover(MASTER, 'estorno', null, null, null, null)).erro !== undefined, 'estorno sem referência continua recusado');
  const R4 = id(); await salvar(SOLIC, 'requisicoes_material', R4, 0, { ...base, rdo_id: RDO, itens: [{ produto_id: A, qtd_milli: 1000 }] });
  await estado(MASTER, R4, 1, 'aprovada', 'ok');
  check((await consumirRdo(ALMOX, OBRA, D, [{ produto_id: A, qtd_milli: 500 }], RDO)).ids?.length === 1, 'consumo direto no RDO (v6) continua funcionando');
  check((await entregar(ALMOX, R4, [{ produto_id: A, qtd_milli: 1000 }])).erro === '23505', 'não baixa de novo o material já baixado no RDO da requisição');
  const R5 = id(); await salvar(SOLIC, 'requisicoes_material', R5, 0, { ...base, itens: [{ produto_id: B, qtd_milli: 500 }] });
  check((await estado(SOLIC, R5, 1, 'cancelada', 'Não é mais necessária')).estado === 'cancelada', 'o solicitante cancela a requisição ainda não entregue');
  const R6 = id(); await salvar(SOLIC, 'requisicoes_material', R6, 0, { ...base, itens: [{ produto_id: B, qtd_milli: 500 }] }); await estado(MASTER, R6, 1, 'aprovada', 'ok');
  check((await estado(SOLIC, R6, 2, 'cancelada', 'Mudou o plano')).estado === 'cancelada', 'requisição aprovada e sem entrega também pode ser cancelada');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='requisicoes_material'`))[0].n >= 14, 'solicitação, aprovação e entrega têm trilha de auditoria');
  check((await salvar(MASTER, 'estoque_movimentos', id(), 0, { tipo: 'entrada' })).erro === '42501', 'estoque continua só pelas funções próprias');

  console.log('Reversão');
  const limpo = await banco(8);
  try { await limpo.exec(sql('supabase/v8/reverter_v8.sql')); check(true, 'sem requisições, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async d => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname='martins_producao_salvar'`)).rows[0].h;
  check((await h(await banco(7))) === (await h(limpo)), 'reversão devolve a função salvar exatamente à da v7');
  try { await db.exec(sql('supabase/v8/reverter_v8.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com requisições, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
