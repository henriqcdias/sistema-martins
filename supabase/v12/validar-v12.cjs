// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v12/validar-v12.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', COMPRAS = '22222222-2222-4222-8222-222222222222', ADMIN = '33333333-3333-4333-8333-333333333333', OPER = '44444444-4444-4444-8444-444444444444';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(12);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','m@t.com'),('${COMPRAS}','c@t.com'),('${ADMIN}','a@t.com'),('${OPER}','o@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${COMPRAS}','${E}','Compras'),('${ADMIN}','${E}','Administrador'),('${OPER}','${E}','Operador');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo, leitura_integral) VALUES ('${E}','${MASTER}','master',true,false),('${E}','${COMPRAS}','operacional',true,false),('${E}','${ADMIN}','administrador',true,true),('${E}','${OPER}','operacional',true,false);
   INSERT INTO martins_producao_v1.permissoes SELECT '${COMPRAS}','${E}',m,true,true,true FROM unnest(ARRAY['pedidos_compra','estoque_movimentos','obras','despesas']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${OPER}','${E}',m,true,true,true FROM unnest(ARRAY['obras','estoque_movimentos','despesas']) m;`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const x = r => r?.x ?? r;
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x);
  const gastos = (u, obra) => como(u, 'SELECT public.martins_producao_obra_gastos($1,$2) AS x', [E, obra]).then(x);
  const mover = (tipo, p, o, d, qt) => como(COMPRAS, 'SELECT public.martins_producao_estoque_mover($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x', [E, id(), tipo, p, o, d, qt, null, null]).then(x);
  const consumir = (obra, dep, itens) => como(COMPRAS, 'SELECT public.martins_producao_obra_consumir($1,$2,$3,$4,$5,$6,$7) AS x', [E, id(), obra, dep, JSON.stringify(itens), null, null]).then(x);
  const devolverObra = (cid, qt) => como(COMPRAS, 'SELECT public.martins_producao_obra_devolver($1,$2,$3,$4,$5) AS x', [E, id(), cid, qt, 'sobrou']).then(x);
  const FORN = id(), CC = id(), A = id(), B = id(), D = id(), OBRA = id(), OBRA2 = id();
  await salvar(MASTER, 'fornecedores', FORN, 0, { nome: 'F' }); await salvar(MASTER, 'centros_custo', CC, 0, { codigo: 'C', nome: 'C', tipo: 'administrativo' });
  await salvar(MASTER, 'produtos', A, 0, { codigo: 'A', descricao: 'Cimento' }); await salvar(MASTER, 'produtos', B, 0, { codigo: 'B', descricao: 'Areia (sem compra)' }); await salvar(MASTER, 'depositos', D, 0, { nome: 'Almox' });
  await salvar(MASTER, 'obras', OBRA, 0, { nome: 'Obra 1', codigo: 'O1' }); await salvar(MASTER, 'obras', OBRA2, 0, { nome: 'Obra 2', codigo: 'O2' });
  async function comprar(itens, nf, obra = null) {
    const P = id(); await salvar(COMPRAS, 'pedidos_compra', P, 0, { fornecedor_id: FORN, centro_custo_id: CC, obra_id: obra, itens });
    await como(MASTER, 'SELECT public.martins_producao_compras_estado($1,$2,$3,$4,$5,$6) AS x', [E, P, 1, 'aprovado', 'ok', id()]);
    return como(COMPRAS, 'SELECT public.martins_producao_compras_receber($1,$2,$3,$4,$5,$6) AS x', [E, id(), P, D, JSON.stringify(itens.map(i => ({ produto_id: i.produto_id, qtd_milli: i.qtd_milli }))), JSON.stringify({ numero: nf })]).then(x);
  }
  const r1 = await comprar([{ produto_id: A, qtd_milli: 10000, preco_centavos: 500 }], 'NF1', OBRA);   // 10 un a R$ 5,00, pedido para a OBRA (a despesa gerada não pode ser somada)
  const r2 = await comprar([{ produto_id: A, qtd_milli: 10000, preco_centavos: 700 }], 'NF2');          // 10 un a R$ 7,00
  await como(COMPRAS, 'SELECT public.martins_producao_compras_devolver($1,$2,$3,$4,$5) AS x', [E, id(), r1.id, JSON.stringify([{ produto_id: A, qtd_milli: 2000 }]), 'defeito']); // devolve 2 da 1ª: 8 un por R$ 40,00
  await mover('entrada', B, null, D, 5000);   // entrada manual: sem compra, sem custo

  console.log('Custo do material');
  const c1 = await consumir(OBRA, D, [{ produto_id: A, qtd_milli: 3000 }, { produto_id: B, qtd_milli: 2000 }]);
  const g = await gastos(MASTER, OBRA);
  // custo médio = (R$ 40,00 + R$ 70,00) / 18 un; 3 un => round(3000 * 11000 / 18000) = 1833
  const linhaA = g.material.find(m => m.produto_id === A);
  check(linhaA.liquido_milli === 3000 && linhaA.custo_unitario_centavos === 611 && linhaA.custo_centavos === 1833, 'cimento: custo médio R$ 6,11 (compras líquidas de devolução) × 3 un = R$ 18,33');
  check(g.sem_custo.length === 1 && g.sem_custo[0].produto_id === B && g.sem_custo[0].liquido_milli === 2000, 'areia (entrada manual, sem compra) fica "sem custo" e não entra no total');
  check(g.material_centavos === 1833, 'o material valorizado soma só o que tem custo (R$ 18,33)');
  const idConsumoA = (await q(`SELECT id FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos' AND dados->>'tipo'='consumo' AND dados->>'produto_id'=$1`, [A]))[0].id;
  await devolverObra(idConsumoA, 1000);
  const g2 = await gastos(MASTER, OBRA);
  check(g2.material.find(m => m.produto_id === A).liquido_milli === 2000 && g2.material_centavos === Math.round(2000 * 11000 / 18000), 'a devolução do material ao estoque reduz o custo da obra (2 un = R$ 12,22)');
  check((await gastos(MASTER, OBRA2)).material.length === 0 && (await gastos(MASTER, OBRA2)).total_centavos === 0, 'outra obra não herda custo');
  // novo recebimento muda o custo médio (calculado na consulta, não congelado)
  await comprar([{ produto_id: A, qtd_milli: 18000, preco_centavos: 1000 }], 'NF3');
  check((await gastos(MASTER, OBRA)).material.find(m => m.produto_id === A).custo_unitario_centavos === Math.round((11000 + 18000) * 1000 / 36000), 'o custo médio acompanha as compras (não congela o custo da data do consumo)');

  console.log('Despesas diretas e sem dupla contagem');
  await salvar(OPER, 'despesas', id(), 0, { descricao: 'Aluguel de andaime', valor_centavos: 20000, competencia: '2026-11-01', classificacao: 'obra', obra_id: OBRA, centro_custo_id: CC });
  const gc = id(); await salvar(MASTER, 'despesas', gc, 0, { descricao: 'Consultoria sigilosa', valor_centavos: 5000, competencia: '2026-11-01', classificacao: 'obra', obra_id: OBRA, centro_custo_id: CC, confidencial: true });
  const cancelada = id(); await salvar(OPER, 'despesas', cancelada, 0, { descricao: 'Lançada e cancelada', valor_centavos: 9999, competencia: '2026-11-01', classificacao: 'obra', obra_id: OBRA, centro_custo_id: CC });
  await como(MASTER, 'SELECT public.martins_producao_despesa_estado($1,$2,$3,$4,$5,$6) AS x', [E, cancelada, 1, 'cancelado', 'engano', id()]);
  const gm = await gastos(MASTER, OBRA);
  check(gm.despesas_diretas_centavos === 25000 && gm.confidenciais_incluidas_centavos === 5000, 'Master: despesas diretas R$ 250,00 (R$ 200 + R$ 50 confidencial); a cancelada fica de fora');
  check(gm.despesas_de_compras_nao_somadas_centavos === 4000, 'a despesa gerada pelo recebimento da compra para a obra (R$ 40,00 líquidos) NÃO é somada (o material entra pelo consumo)');
  check(gm.total_centavos === gm.material_centavos + 25000, 'total = material valorizado + despesas diretas');
  const ga = await gastos(ADMIN, OBRA);
  check(ga.despesas_diretas_centavos === 20000 && ga.confidenciais_incluidas_centavos === null && ga.material_centavos === gm.material_centavos, 'Administrador com leitura integral não vê a despesa confidencial e nem sabe que existe');
  check(JSON.stringify(ga).includes('5000') === false, 'nenhum valor da despesa confidencial vaza no resultado do Administrador');

  console.log('Quem pode ver');
  check((await gastos(OPER, OBRA)).erro === '42501' && (await gastos(COMPRAS, OBRA)).erro === '42501', 'operador comum e comprador não veem custos da obra');
  check((await gastos(MASTER, id())).erro === '23503', 'obra de fora é recusada');
  console.log('Reversão');
  const limpo = await banco(12);
  try { await limpo.exec(sql('supabase/v12/reverter_v12.sql')); check(true, 'a reversão remove a função'); } catch (e) { check(false, e.message); }
  check((await limpo.query(`SELECT count(*)::int n FROM pg_proc WHERE proname='martins_producao_obra_gastos'`)).rows[0].n === 0, 'nenhuma função da v12 sobra');
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
