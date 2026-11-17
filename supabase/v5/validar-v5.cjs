// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v5/validar-v5.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', COMPRAS = '22222222-2222-4222-8222-222222222222', SEMEST = '33333333-3333-4333-8333-333333333333';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(5);
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${MASTER}'),('${COMPRAS}'),('${SEMEST}');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${COMPRAS}','${E}','Comprador'),('${SEMEST}','${E}','Comprador sem estoque');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${COMPRAS}','operacional',true),('${E}','${SEMEST}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${COMPRAS}','${E}','pedidos_compra',true,true,true),('${COMPRAS}','${E}','estoque_movimentos',true,true,false),('${SEMEST}','${E}','pedidos_compra',true,true,true);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const estado = (u, r, v, est, op = id()) => como(u, 'SELECT public.martins_producao_compras_estado($1,$2,$3,$4,$5,$6) AS x', [E, r, v, est, 'conferido', op]).then(x => x.x ?? x);
  const receber = (u, ped, dep, itens, doc, op = id()) => como(u, 'SELECT public.martins_producao_compras_receber($1,$2,$3,$4,$5,$6) AS x', [E, op, ped, dep, JSON.stringify(itens), JSON.stringify(doc)]).then(x => x.x ?? x);
  const q = async (sqlq, p = []) => (await db.query(sqlq, p)).rows;
  const saldo = async (prod, dep) => Number((await q(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [E, prod, dep]))[0].s);
  const FORN = id(), CC = id(), P1 = id(), P2 = id(), DEP = id(), OBRA = id();
  await salvar(MASTER, 'fornecedores', FORN, 0, { nome: 'Fornecedor X', documento: '11222333000181' });
  await salvar(MASTER, 'centros_custo', CC, 0, { codigo: 'ADM', nome: 'Adm', tipo: 'administrativo' });
  await salvar(MASTER, 'produtos', P1, 0, { codigo: 'CIM', descricao: 'Cimento' }); await salvar(MASTER, 'produtos', P2, 0, { codigo: 'ARE', descricao: 'Areia' });
  await salvar(MASTER, 'depositos', DEP, 0, { nome: 'Almoxarifado', principal: true });
  const itens = [{ produto_id: P1, qtd_milli: 100000, preco_centavos: 3000 }, { produto_id: P2, qtd_milli: 20000, preco_centavos: 15000 }];
  const PED = id(); const ped = { fornecedor_id: FORN, centro_custo_id: CC, itens };

  console.log('Pedido');
  check((await salvar(COMPRAS, 'pedidos_compra', PED, 0, ped)).revisao === 1, 'comprador cria o pedido (rascunho)');
  let lido = (await q(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='pedidos_compra' AND id=$1`, [PED]))[0].dados;
  check(lido.estado === 'rascunho' && lido.numero === 1 && lido.itens.every(i => i.recebido_milli === 0), 'nasce rascunho, numerado e com recebido = 0');
  check((await salvar(COMPRAS, 'pedidos_compra', id(), 0, { ...ped, estado: 'aprovado' })).revisao === 1 && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='pedidos_compra' AND dados->>'estado'='aprovado'`))[0].n === 0, 'enviar estado "aprovado" no payload não aprova (servidor decide)');
  check((await salvar(COMPRAS, 'pedidos_compra', id(), 0, { ...ped, itens: [{ ...itens[0], recebido_milli: 99999999 }, itens[1]] })).revisao === 1 && (await q(`SELECT bool_and((i->>'recebido_milli')::int=0) ok FROM martins_producao_v1.registros, jsonb_array_elements(dados->'itens') i WHERE modulo='pedidos_compra'`))[0].ok, 'recebido enviado pelo cliente é ignorado');
  check((await salvar(COMPRAS, 'pedidos_compra', id(), 0, { ...ped, itens: [itens[0], itens[0]] })).erro === '22023', 'produto repetido é recusado');
  check((await salvar(COMPRAS, 'pedidos_compra', id(), 0, { ...ped, itens: [{ ...itens[0], preco_centavos: 0 }] })).erro === '22023', 'preço zero é recusado');
  check((await salvar(COMPRAS, 'pedidos_compra', id(), 0, { ...ped, fornecedor_id: id() })).erro === '23503', 'fornecedor de fora é recusado');

  console.log('Aprovação');
  check((await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 1000 }], { numero: '1' })).erro === '22023', 'pedido em rascunho não pode ser recebido');
  check((await estado(COMPRAS, PED, 1, 'aprovado')).erro === '42501', 'comprador não aprova (exclusivo do Master)');
  const ap = await estado(MASTER, PED, 1, 'aprovado'); check(ap.revisao === 2, 'Master aprova');
  check((await salvar(COMPRAS, 'pedidos_compra', PED, 2, { ...ped, itens: [itens[0]] })).erro === '22023', 'pedido aprovado não pode ser editado');

  console.log('Recebimento parcial');
  const op = id(); const r1 = await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 40000 }], { numero: '123', chave_acesso: '' }, op);
  check(r1.estado_pedido === 'recebido_parcial' && r1.total_centavos === 120000, 'recebe 40 de 100 de cimento: pedido parcial e valor R$ 1.200,00');
  check(await saldo(P1, DEP) === 40000, 'estoque ganhou a entrada de 40 (uma movimentação)');
  const desp = (await q(`SELECT dados, criado_por FROM martins_producao_v1.registros WHERE modulo='despesas' AND id=$1`, [r1.despesa_id]))[0].dados;
  check(desp.estado === 'pendente_conferencia' && desp.valor_centavos === 120000 && desp.fornecedor_id === FORN && desp.classificacao === 'administrativa' && desp.documento_numero === '123', 'gerou a obrigação pendente de conferência, com fornecedor, centro e NF');
  const rep = await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 40000 }], { numero: '123', chave_acesso: '' }, op);
  check(rep.repetida === true && await saldo(P1, DEP) === 40000 && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='despesas' AND dados->>'documento_numero'='123'`))[0].n === 1, 'reenviar o mesmo recebimento não duplica estoque nem obrigação');
  check((await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 1000 }], { numero: '123' })).erro === '23505', 'a mesma NF em outra operação é recusada (sem duplicar)');
  const chave = '35261112345678000195550010000000011000000015';
  check((await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 1000 }], { chave_acesso: '123' })).erro === '22023', 'chave de acesso com tamanho errado é recusada');
  check((await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 70000 }], { numero: '124' })).erro === '23514', 'receber mais do que falta no pedido é recusado');
  check((await receber(COMPRAS, PED, DEP, [{ produto_id: id(), qtd_milli: 1000 }], { numero: '125' })).erro === '22023', 'produto fora do pedido é recusado');
  check((await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 1000 }], {})).erro === '22023', 'recebimento sem nota fiscal é recusado');
  check((await receber(COMPRAS, PED, id(), [{ produto_id: P1, qtd_milli: 1000 }], { numero: '126' })).erro === '23503', 'depósito de fora é recusado');
  check((await estado(MASTER, PED, 3, 'cancelado')).erro === '22023', 'pedido com recebimento não pode ser cancelado');
  check(await saldo(P1, DEP) === 40000 && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='estoque_movimentos'`))[0].n === 1, 'as tentativas recusadas não deixaram rastro no estoque');

  console.log('Recebimento final');
  const r2 = await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 60000 }, { produto_id: P2, qtd_milli: 20000 }], { numero: '200', chave_acesso: chave });
  check(r2.estado_pedido === 'recebido' && r2.total_centavos === 180000 + 300000, 'recebe o restante: pedido recebido; valor 60×30 + 20×150 = R$ 4.800,00');
  check(await saldo(P1, DEP) === 100000 && await saldo(P2, DEP) === 20000, 'estoque: cimento 100 e areia 20');
  check((await receber(COMPRAS, PED, DEP, [{ produto_id: P1, qtd_milli: 1000 }], { chave_acesso: chave })).erro === '22023', 'pedido já recebido não aceita novo recebimento');
  const ped2 = id(); await salvar(MASTER, 'obras', OBRA, 0, { nome: 'Obra', codigo: 'O1' });
  await salvar(COMPRAS, 'pedidos_compra', ped2, 0, { fornecedor_id: FORN, centro_custo_id: CC, obra_id: OBRA, itens: [itens[0]] }); await estado(MASTER, ped2, 1, 'aprovado');
  const r3 = await receber(COMPRAS, ped2, DEP, [{ produto_id: P1, qtd_milli: 10000 }], { chave_acesso: chave });
  check(r3.erro === '23505', 'a mesma chave de acesso de outro pedido também é recusada (XML + manual não duplicam)');
  const r4 = await receber(COMPRAS, ped2, DEP, [{ produto_id: P1, qtd_milli: 10000 }], { numero: '900' });
  const d4 = (await q(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='despesas' AND id=$1`, [r4.despesa_id]))[0].dados;
  check(d4.classificacao === 'obra' && d4.obra_id === OBRA, 'pedido de obra gera obrigação de obra, vinculada à obra');

  console.log('Proteções');
  check((await receber(SEMEST, ped2, DEP, [{ produto_id: P1, qtd_milli: 1000 }], { numero: '901' })).erro === '42501', 'quem não tem permissão de estoque não recebe (e nada fica gravado)');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='recebimentos_compra'`))[0].n === 3, 'recebimentos gravados: 3 (os recusados não deixaram nada)');
  check((await salvar(MASTER, 'recebimentos_compra', id(), 0, { numero_nf: '1' })).erro === '42501', 'gravar recebimento pelo contrato genérico é bloqueado');
  const ped3 = id(); await salvar(COMPRAS, 'pedidos_compra', ped3, 0, { fornecedor_id: FORN, centro_custo_id: CC, itens: [itens[1]] });
  check((await estado(MASTER, ped3, 1, 'cancelado')).revisao === 2, 'Master cancela pedido sem recebimento');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo IN ('recebimentos_compra','pedidos_compra')`))[0].n >= 8, 'recebimento, pedido, despesa e movimentos têm trilha de auditoria');

  console.log('Reversão');
  const limpo = await banco(5);
  try { await limpo.exec(sql('supabase/v5/reverter_v5.sql')); check(true, 'sem dados de compras, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async d => (await d.query(`SELECT string_agg(md5(prosrc), ',' ORDER BY proname) h FROM pg_proc WHERE proname IN ('pode','martins_producao_contexto','martins_producao_salvar','martins_producao_catalogos')`)).rows[0].h;
  check((await h(await banco(4))) === (await h(limpo)), 'reversão devolve as funções exatamente à v4');
  try { await db.exec(sql('supabase/v5/reverter_v5.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com dados de compras, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
