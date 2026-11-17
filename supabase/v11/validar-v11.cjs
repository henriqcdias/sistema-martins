// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v11/validar-v11.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', COMPRAS = '22222222-2222-4222-8222-222222222222', SOMENTE_PEDIDOS = '33333333-3333-4333-8333-333333333333', LEITOR = '44444444-4444-4444-8444-444444444444';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(11);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','m@t.com'),('${COMPRAS}','c@t.com'),('${SOMENTE_PEDIDOS}','p@t.com'),('${LEITOR}','l@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${COMPRAS}','${E}','Compras'),('${SOMENTE_PEDIDOS}','${E}','Só pedidos'),('${LEITOR}','${E}','Leitor');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${COMPRAS}','operacional',true),('${E}','${SOMENTE_PEDIDOS}','operacional',true),('${E}','${LEITOR}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${COMPRAS}','${E}','pedidos_compra',true,true,true),('${COMPRAS}','${E}','estoque_movimentos',true,true,true),('${SOMENTE_PEDIDOS}','${E}','pedidos_compra',true,true,true),('${LEITOR}','${E}','pedidos_compra',true,false,false);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const x = r => r?.x ?? r;
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x);
  const aprovarPedido = (p, v) => como(MASTER, 'SELECT public.martins_producao_compras_estado($1,$2,$3,$4,$5,$6) AS x', [E, p, v, 'aprovado', 'ok', id()]).then(x);
  const receber = (ped, dep, itens, nf) => como(COMPRAS, 'SELECT public.martins_producao_compras_receber($1,$2,$3,$4,$5,$6) AS x', [E, id(), ped, dep, JSON.stringify(itens), JSON.stringify({ numero: nf })]).then(x);
  const devolver = (u, rec, itens, motivo = 'Material com defeito', op = id()) => como(u, 'SELECT public.martins_producao_compras_devolver($1,$2,$3,$4,$5) AS x', [E, op, rec, JSON.stringify(itens), motivo]).then(x);
  const saldo = async (p, d) => Number((await q(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, p, d]))[0].s);
  const lido = async r => (await q(`SELECT revisao, dados FROM martins_producao_v1.registros WHERE id=$1`, [r]))[0];
  const FORN = id(), CC = id(), A = id(), B = id(), C = id(), D = id();
  await salvar(MASTER, 'fornecedores', FORN, 0, { nome: 'Fornecedor X' }); await salvar(MASTER, 'centros_custo', CC, 0, { codigo: 'CC1', nome: 'Admin', tipo: 'administrativo' });
  await salvar(MASTER, 'produtos', A, 0, { codigo: 'A', descricao: 'Cimento' }); await salvar(MASTER, 'produtos', B, 0, { codigo: 'B', descricao: 'Areia' }); await salvar(MASTER, 'produtos', C, 0, { codigo: 'C', descricao: 'Item quebrado' });
  await salvar(MASTER, 'depositos', D, 0, { nome: 'Almoxarifado' });
  async function pedidoRecebido(itens, nf) {
    const P = id(); await salvar(COMPRAS, 'pedidos_compra', P, 0, { fornecedor_id: FORN, centro_custo_id: CC, itens });
    await aprovarPedido(P, 1);
    const r = await receber(P, D, itens.map(i => ({ produto_id: i.produto_id, qtd_milli: i.qtd_milli })), nf);
    return { P, REC: r.id, DESP: r.despesa_id };
  }
  const r1 = await pedidoRecebido([{ produto_id: A, qtd_milli: 10000, preco_centavos: 500 }, { produto_id: B, qtd_milli: 4000, preco_centavos: 250 }, { produto_id: C, qtd_milli: 3333, preco_centavos: 100 }], 'NF-100');
  check(r1.REC && await saldo(A, D) === 10000 && (await lido(r1.DESP)).dados.valor_centavos === 5000 + 1000 + 333, 'preparo: recebimento de A=10, B=4, C=3,333; obrigação de R$ 63,33 pendente');

  console.log('Devolução parcial');
  const op1 = id(); const d1 = await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 2000 }], 'Embalagem rasgada', op1);
  check(d1.valor_devolvido_centavos === 1000 && d1.despesa === 'reduzida' && await saldo(A, D) === 8000, 'devolver 2 de A: estoque 10 → 8, valor devolvido R$ 10,00, obrigação "reduzida"');
  const desp = (await lido(r1.DESP)).dados;
  check(desp.valor_centavos === 5333 && desp.valor_original_centavos === 6333 && desp.devolvido_centavos === 1000 && desp.estado === 'pendente_conferencia', 'a obrigação pendente caiu de R$ 63,33 para R$ 53,33 e guarda o valor original');
  check((await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 2000 }], 'Embalagem rasgada', op1)).repetida === true && await saldo(A, D) === 8000, 'reenviar a mesma operação não devolve de novo');
  const rec = (await lido(r1.REC)).dados;
  check(rec.itens.find(i => i.produto_id === A).devolvido_milli === 2000 && rec.devolucoes.length === 1 && rec.devolucoes[0].motivo === 'Embalagem rasgada', 'o recebimento acompanha o devolvido por item e guarda a devolução com motivo');
  check((await q(`SELECT dados->>'estado' e FROM martins_producao_v1.registros WHERE id=$1`, [r1.P]))[0].e === 'recebido', 'o pedido continua "recebido" (não reabre)');

  console.log('Limites e proteções');
  check((await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 8001 }])).erro === '23514', 'devolver mais que o restante recebido (8,001 > 8) é recusado');
  check((await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 1000 }], ' ')).erro === '22023', 'devolução sem motivo é recusada');
  check((await devolver(COMPRAS, r1.REC, [{ produto_id: D, qtd_milli: 1000 }])).erro === '23503', 'produto que não faz parte do recebimento é recusado');
  check((await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 0 }])).erro === '22023', 'quantidade zero é recusada');
  check((await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 500 }, { produto_id: A, qtd_milli: 500 }])).erro === '22023', 'produto repetido na devolução é recusado');
  check((await devolver(SOMENTE_PEDIDOS, r1.REC, [{ produto_id: A, qtd_milli: 1000 }])).erro === '42501', 'quem não mexe em estoque não devolve');
  check((await devolver(LEITOR, r1.REC, [{ produto_id: A, qtd_milli: 1000 }])).erro === '42501', 'quem só lê não devolve');
  check((await devolver(COMPRAS, id(), [{ produto_id: A, qtd_milli: 1000 }])).erro === '23503', 'recebimento inexistente é recusado');
  // consome parte do estoque: já não há saldo para devolver tudo
  await como(COMPRAS, 'SELECT public.martins_producao_estoque_mover($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x', [E, id(), 'saida', B, D, null, 3500, null, null]);
  const atom = await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 1000 }, { produto_id: B, qtd_milli: 4000 }]);
  check(atom.erro === '23514' && await saldo(A, D) === 8000 && await saldo(B, D) === 500, 'sem saldo para um item: a devolução inteira é recusada e nada é baixado (A continua 8)');
  check((await lido(r1.DESP)).dados.valor_centavos === 5333, 'e a obrigação não é alterada');

  console.log('Arredondamento e devolução total');
  const dd1 = await devolver(COMPRAS, r1.REC, [{ produto_id: C, qtd_milli: 1111 }]);
  const dd2 = await devolver(COMPRAS, r1.REC, [{ produto_id: C, qtd_milli: 2222 }]);
  check(dd1.valor_devolvido_centavos + dd2.valor_devolvido_centavos === 333, 'item de 3,333 un × R$ 1,00 devolvido em duas partes soma exatamente R$ 3,33 (sem sobra de centavo)');
  await como(COMPRAS, 'SELECT public.martins_producao_estoque_mover($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x', [E, id(), 'entrada', B, null, D, 3500, null, null]);
  const dt = await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 8000 }, { produto_id: B, qtd_milli: 4000 }]);
  check(dt.despesa === 'cancelada' && (await lido(r1.DESP)).dados.estado === 'cancelado' && (await lido(r1.DESP)).dados.devolvido_centavos === 6333, 'devolvido tudo: a obrigação pendente é cancelada (R$ 63,33 devolvidos)');
  check(await saldo(A, D) === 0 && await saldo(C, D) === 0, 'o estoque dos itens devolvidos zera');
  check((await devolver(COMPRAS, r1.REC, [{ produto_id: A, qtd_milli: 1 }])).erro === '23514', 'recebimento totalmente devolvido não aceita mais devolução');

  console.log('Obrigação já aprovada ou paga');
  const r2 = await pedidoRecebido([{ produto_id: A, qtd_milli: 5000, preco_centavos: 400 }], 'NF-200');
  await como(MASTER, 'SELECT public.martins_producao_despesa_estado($1,$2,$3,$4,$5,$6) AS x', [E, r2.DESP, 1, 'aprovado', 'conferido', id()]);
  const dc = await devolver(COMPRAS, r2.REC, [{ produto_id: A, qtd_milli: 1000 }], 'Produto errado');
  check(dc.despesa === 'credito_pendente' && dc.credito_pendente_centavos === 400, 'obrigação já aprovada: não é alterada; fica crédito pendente de R$ 4,00 com o fornecedor');
  const dsp2 = (await lido(r2.DESP)).dados; check(dsp2.estado === 'aprovado' && dsp2.valor_centavos === 2000, 'a despesa aprovada continua intacta (R$ 20,00, aprovada)');
  check((await lido(r2.REC)).dados.credito_pendente_centavos === 400 && await saldo(A, D) === 4000, 'o crédito fica registrado no recebimento e o estoque foi baixado (5 → 4)');

  console.log('Auditoria e reversão');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='recebimentos_compra' AND registro_id=$1`, [r1.REC]))[0].n >= 5, 'cada devolução deixa trilha no recebimento');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='despesas' AND registro_id=$1 AND depois->>'motivo' LIKE 'Devolução ao fornecedor%'`, [r1.DESP]))[0].n >= 3, 'e na obrigação, com o motivo');
  const limpo = await banco(11);
  try { await limpo.exec(sql('supabase/v11/reverter_v11.sql')); check(true, 'a reversão remove a função'); } catch (e) { check(false, e.message); }
  check((await limpo.query(`SELECT count(*)::int n FROM pg_proc WHERE proname='martins_producao_compras_devolver'`)).rows[0].n === 0, 'nenhuma função da v11 sobra');
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
