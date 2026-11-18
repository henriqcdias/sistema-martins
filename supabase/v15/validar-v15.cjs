// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v15/validar-v15.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', VENDAS = '22222222-2222-4222-8222-222222222222', SEMCR = '33333333-3333-4333-8333-333333333333', ADMIN = '44444444-4444-4444-8444-444444444444', ALMOX = '55555555-5555-4555-8555-555555555555', OPER = '66666666-6666-4666-8666-666666666666';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(15);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','m@t.com'),('${VENDAS}','v@t.com'),('${SEMCR}','s@t.com'),('${ADMIN}','a@t.com'),('${ALMOX}','al@t.com'),('${OPER}','o@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${VENDAS}','${E}','Comercial'),('${SEMCR}','${E}','Comercial sem cobrança'),('${ADMIN}','${E}','Administrador'),('${ALMOX}','${E}','Almox'),('${OPER}','${E}','Operador');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo, leitura_integral) VALUES ('${E}','${MASTER}','master',true,false),('${E}','${VENDAS}','operacional',true,false),('${E}','${SEMCR}','operacional',true,false),('${E}','${ADMIN}','administrador',true,true),('${E}','${ALMOX}','operacional',true,false),('${E}','${OPER}','operacional',true,false);
   INSERT INTO martins_producao_v1.permissoes SELECT '${VENDAS}','${E}',m,true,true,true FROM unnest(ARRAY['orcamentos','contas_receber','pedidos_venda']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${SEMCR}','${E}',m,true,true,true FROM unnest(ARRAY['orcamentos']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${ALMOX}','${E}',m,true,true,true FROM unnest(ARRAY['estoque_movimentos','requisicoes_material','pedidos_compra','obras']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${OPER}','${E}',m,true,true,true FROM unnest(ARRAY['despesas','obras']) m;`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const x = r => r?.x ?? r;
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x);
  const lido = async r => (await q(`SELECT revisao, dados FROM martins_producao_v1.registros WHERE id=$1`, [r]))[0];
  const hoje = (await q(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text d`))[0].d;
  const FORN = id(), CC = id(), A = id(), D = id(), OBRA = id();
  await salvar(MASTER, 'fornecedores', FORN, 0, { nome: 'F' }); await salvar(MASTER, 'centros_custo', CC, 0, { codigo: 'ADM', nome: 'Administrativo', tipo: 'administrativo' });
  await salvar(MASTER, 'produtos', A, 0, { codigo: 'A', descricao: 'Cimento' }); await salvar(MASTER, 'depositos', D, 0, { nome: 'Almox' }); await salvar(MASTER, 'obras', OBRA, 0, { nome: 'Obra 1', codigo: 'O1' });
  async function comprar(preco, qtd, nf) {
    const P = id(); await salvar(ALMOX, 'pedidos_compra', P, 0, { fornecedor_id: FORN, centro_custo_id: CC, itens: [{ produto_id: A, qtd_milli: qtd, preco_centavos: preco }] });
    await como(MASTER, 'SELECT public.martins_producao_compras_estado($1,$2,$3,$4,$5,$6) AS x', [E, P, 1, 'aprovado', 'ok', id()]);
    return como(ALMOX, 'SELECT public.martins_producao_compras_receber($1,$2,$3,$4,$5,$6) AS x', [E, id(), P, D, JSON.stringify([{ produto_id: A, qtd_milli: qtd }]), JSON.stringify({ numero: nf })]).then(x);
  }
  const consumir = qtd => como(ALMOX, 'SELECT public.martins_producao_obra_consumir($1,$2,$3,$4,$5,$6,$7) AS x', [E, id(), OBRA, D, JSON.stringify([{ produto_id: A, qtd_milli: qtd }]), null, null]).then(x);
  const gastos = u => como(u, 'SELECT public.martins_producao_obra_gastos($1,$2) AS x', [E, OBRA]).then(x);
  const custoDoMov = async mid => (await q(`SELECT dados->>'custo_unitario_centavos' c FROM martins_producao_v1.registros WHERE id=$1`, [mid]))[0].c;

  console.log('Custo congelado no consumo');
  await comprar(500, 10000, 'NF1');
  const c1 = await consumir(3000);
  check(await custoDoMov(c1.ids[0]) === '500', 'consumo grava o custo médio do momento: R$ 5,00 por unidade');
  await comprar(700, 10000, 'NF2');
  const c2 = await consumir(2000);
  check(await custoDoMov(c2.ids[0]) === '600', 'depois de uma compra mais cara, o novo consumo grava o novo custo médio (R$ 6,00)');
  let g = await gastos(MASTER);
  check(g.material_centavos === 1500 + 1200, 'Gastos da Obra soma o custo gravado: 3 un × R$ 5,00 + 2 un × R$ 6,00 = R$ 27,00');
  await comprar(1000, 10000, 'NF3');
  g = await gastos(MASTER);
  check(g.material_centavos === 2700, 'uma nova compra a R$ 10,00 NÃO altera o custo do que já foi consumido (continua R$ 27,00)');
  const dv = await como(ALMOX, 'SELECT public.martins_producao_obra_devolver($1,$2,$3,$4,$5) AS x', [E, id(), c1.ids[0], 1000, 'sobrou']).then(x);
  check(await custoDoMov(dv.id) === '500', 'a devolução usa o custo do consumo original (R$ 5,00), não o atual');
  g = await gastos(MASTER);
  check(g.material_centavos === 2700 - 500, 'devolver 1 un reduz o custo da obra em R$ 5,00 (o custo original)');
  await db.query(`INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por) VALUES ($1,'estoque_movimentos',$2,1,$3::jsonb,$4,$4)`, [E, id(), JSON.stringify({ tipo: 'consumo', produto_id: A, origem_id: D, quantidade_milli: 1000, obra_id: OBRA }), MASTER]);
  g = await gastos(MASTER);
  const linha = g.material.find(m => m.produto_id === A);
  check(linha.estimado_milli === 1000 && g.material_centavos === 2200 + Math.round(1000 * 22000 / 30000), 'movimento antigo, sem custo gravado, continua estimado pelo custo médio atual (e vem sinalizado: 1 un estimada)');
  check((await gastos(OPER)).erro === '42501', 'quem não é Master/Administrador com leitura integral continua sem ver custos');

  console.log('Conversão com parcelas a receber');
  const base = { nome: 'Orçamento', cliente: 'Cliente X', itens: [{ desc: 'Serviço', qtd: 1, precoUnit: 100 }] };
  const converter = (u, o, v, aprovar, parc, venc, intv, op = id()) => como(u, 'SELECT public.martins_producao_orcamento_converter($1,$2,$3,$4,$5,$6,$7,$8) AS x', [E, op, o, v, aprovar, parc, venc, intv]).then(x);
  const O1 = id(); await salvar(VENDAS, 'orcamentos', O1, 0, base);
  const op1 = id(); const cv = await converter(VENDAS, O1, 1, true, 3, '2026-12-10', 30, op1);
  const parcelas = await q(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND dados->>'pedido_id'=$1 ORDER BY (dados->>'parcela')::int`, [cv.pedido_id]);
  check(cv.pedido_numero === 1 && parcelas.length === 3, 'a conversão cria o pedido nº 1 e 3 parcelas a receber');
  check(parcelas.map(p => p.dados.valor_centavos).join(',') === '3333,3333,3334' && parcelas.reduce((s, p) => s + p.dados.valor_centavos, 0) === 10000, 'as parcelas somam exatamente R$ 100,00 (33,33 + 33,33 + 33,34): a última absorve o centavo que sobra');
  check(parcelas.map(p => p.dados.vencimento).join(',') === '2026-12-10,2027-01-09,2027-02-08' && parcelas.every(p => p.dados.estado === 'aberta' && p.dados.cliente_nome === 'Cliente X' && /PV-0001/.test(p.dados.descricao)), 'vencimentos a cada 30 dias a partir de 10/12; títulos abertos, com cliente e descrição do pedido');
  check((await converter(VENDAS, O1, 1, true, 3, '2026-12-10', 30, op1)).repetida === true && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND dados->>'pedido_id'=$1`, [cv.pedido_id]))[0].n === 3, 'reenviar a mesma conversão não gera as parcelas de novo');
  const rev = (await lido(O1)).revisao;
  check((await converter(VENDAS, O1, rev, false, 3, '2026-12-10', 30)).erro === '23505' && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND dados->>'pedido_id'=$1`, [cv.pedido_id]))[0].n === 3, 'converter de novo é recusado e continua havendo só 3 parcelas');
  const pid = parcelas[0] && (await q(`SELECT id FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND dados->>'pedido_id'=$1 AND dados->>'parcela'='1'`, [cv.pedido_id]))[0].id;
  check((await salvar(VENDAS, 'contas_receber', pid, 1, { ...parcelas[0].dados, vencimento: '2026-12-15' })).revisao === 2, 'a parcela gerada pode ser editada (data de vencimento) enquanto está aberta e sem recebimento');
  const bx = await como(VENDAS, 'SELECT public.martins_producao_receber_baixar($1,$2,$3,$4,$5,$6,$7,$8) AS x', [E, id(), pid, 2, 3333, hoje, null, null]).then(x);
  check(bx.estado === 'recebida', 'e recebe normalmente pelo fluxo de contas a receber (parcela quitada)');
  const O2 = id(); await salvar(VENDAS, 'orcamentos', O2, 0, base);
  const c2v = await como(VENDAS, 'SELECT public.martins_producao_orcamento_converter($1,$2,$3,$4,$5) AS x', [E, id(), O2, 1, true]).then(x);
  const um = await q(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND dados->>'pedido_id'=$1`, [c2v.pedido_id]);
  check(um.length === 1 && um[0].dados.valor_centavos === 10000 && um[0].dados.vencimento === (await q(`SELECT ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 30)::text d`))[0].d, 'sem informar nada: 1 parcela com o valor total, vencendo em 30 dias');
  const O3 = id(); await salvar(VENDAS, 'orcamentos', O3, 0, base);
  const c3v = await converter(VENDAS, O3, 1, true, 0, null, 30);
  check(c3v.pedido_numero === 3 && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='contas_receber' AND dados->>'pedido_id'=$1`, [c3v.pedido_id]))[0].n === 0, 'parcelas = 0 converte o pedido sem gerar cobrança');
  const O4 = id(); await salvar(SEMCR, 'orcamentos', O4, 0, base);
  check((await converter(SEMCR, O4, 1, true, 2, null, 30)).erro === '42501', 'quem não pode criar contas a receber não consegue converter gerando cobrança');
  check((await converter(SEMCR, O4, 1, true, 0, null, 30)).pedido_numero === 4, 'mas pode converter sem cobrança (parcelas = 0)');
  const O5 = id(); await salvar(VENDAS, 'orcamentos', O5, 0, base);
  check((await converter(VENDAS, O5, 1, true, 61, null, 30)).erro === '22023' && (await converter(VENDAS, O5, 1, true, 2, null, 0)).erro === '22023', 'parcelas acima de 60 e intervalo zero são recusados');

  console.log('Relatórios financeiros');
  const mesPg = hoje.slice(0, 7); const ate = (await q(`SELECT ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 40)::text d`))[0].d;
  const T1 = id(), T2 = id(); await salvar(VENDAS, 'contas_receber', T1, 0, { cliente_nome: 'C', descricao: 'T1', valor_centavos: 100000, vencimento: '2026-10-20', competencia: '2026-10-05' });
  await salvar(VENDAS, 'contas_receber', T2, 0, { cliente_nome: 'C', descricao: 'T2', valor_centavos: 50000, vencimento: ate, competencia: '2026-11-03' });
  await como(VENDAS, 'SELECT public.martins_producao_receber_baixar($1,$2,$3,$4,$5,$6,$7,$8) AS x', [E, id(), T1, 1, 40000, '2026-10-22', null, null]);
  const dsp = (d, o = {}) => salvar(OPER, 'despesas', d.id, 0, { descricao: d.t, valor_centavos: d.v, competencia: d.c, vencimento: d.venc, classificacao: d.cl, centro_custo_id: CC, obra_id: d.cl === 'obra' ? OBRA : undefined, ...o });
  const D1 = id(), D2 = id(), D3 = id();
  await dsp({ id: D1, t: 'Andaime', v: 20000, c: '2026-10-10', cl: 'obra' }); await dsp({ id: D2, t: 'Luz', v: 30000, c: '2026-11-05', venc: '2026-11-25', cl: 'administrativa' });
  await salvar(MASTER, 'despesas', D3, 0, { descricao: 'Sigilosa', valor_centavos: 7000, competencia: '2026-10-15', classificacao: 'administrativa', centro_custo_id: CC, confidencial: true });
  for (const est of ['aprovado', 'pago']) await como(MASTER, 'SELECT public.martins_producao_despesa_estado($1,$2,$3,$4,$5,$6) AS x', [E, D1, est === 'aprovado' ? 1 : 2, est, 'ok', id()]);
  const rel = (u, de = '2026-10-01', a = ate) => como(u, 'SELECT public.martins_producao_financeiro_relatorios($1,$2,$3) AS x', [E, de, a]).then(x);
  const rm = await rel(MASTER); if (process.env.DBG) console.log(JSON.stringify(rm)); const mes = k => rm.fluxo_caixa.meses.find(m => m.mes === k);
  check(mes('2026-10').entradas_centavos === 40000 && mes('2026-10').saidas_centavos === (mesPg === '2026-10' ? 20000 : 0), 'fluxo de caixa: outubro recebeu R$ 400,00 (a baixa de 22/10)');
  check(mes(mesPg).saidas_centavos === 20000 && mes(mesPg).entradas_centavos === 3333 && mes(mesPg).saldo_centavos === 3333 - 20000, 'a saída real (despesa paga) e a parcela recebida hoje caem no mês em que foi paga (' + mesPg + '), não na competência');
  check(mes('2026-10').previstas_entradas_centavos === 60000 && mes('2026-10').previstas_saidas_centavos === 7000, 'previsto de outubro: R$ 600,00 a receber (saldo do título) e R$ 70,00 a pagar (despesa confidencial, só no Master)');
  check(rm.fluxo_caixa.totais.entradas_centavos === 43333 && rm.fluxo_caixa.totais.saidas_centavos === 20000 && rm.fluxo_caixa.totais.saldo_centavos === 23333, 'totais do período: entradas R$ 433,33, saídas R$ 200, saldo R$ 233,33');
  check(rm.dre.receitas_centavos === 170000 && rm.dre.despesas_centavos === 79000 && rm.dre.resultado_centavos === 91000, 'DRE por competência: receitas R$ 1.700 − despesas R$ 790 (inclui R$ 220 de compras recebidas) = R$ 910');
  check(rm.dre.despesas_por_classificacao.find(c => c.classificacao === 'obra').total_centavos === 20000 && rm.dre.despesas_por_centro_custo[0].codigo === 'ADM' && rm.dre.despesas_por_centro_custo[0].total_centavos === 79000, 'a DRE separa as despesas por classificação (obra/administrativa) e por centro de custo');
  check(rm.dfc.recebimentos_de_clientes_centavos === 43333 && rm.dfc.pagamentos_obra_centavos === 20000 && rm.dfc.pagamentos_administrativos_centavos === 0 && rm.dfc.caixa_liquido_centavos === 23333, 'DFC (caixa efetivo): recebimentos R$ 433,33, pagamentos de obra R$ 200, caixa líquido R$ 200');
  const ra = await rel(ADMIN);
  check(ra.inclui_confidenciais === false && ra.dre.despesas_centavos === 72000 && ra.fluxo_caixa.meses.find(m => m.mes === '2026-10').previstas_saidas_centavos === 0 , 'o Administrador não vê a despesa confidencial (nem o valor de R$ 70,00 aparece no resultado)');
  check((await rel(OPER)).erro === '42501' && (await rel(VENDAS)).erro === '42501', 'operador comum e comercial não veem os relatórios financeiros');
  check((await rel(MASTER, '2026-11-30', '2026-11-01')).erro === '22023' && (await rel(MASTER, '2020-01-01', '2026-11-01')).erro === '22023', 'período invertido ou maior que 3 anos é recusado');
  const vazio = await rel(MASTER, '2019-01-01', '2019-03-31');
  check(vazio.fluxo_caixa.meses.length === 3 && vazio.fluxo_caixa.totais.saldo_centavos === 0 && vazio.dre.resultado_centavos === 0, 'período sem movimento: 3 meses zerados, sem erro');
  const fx = await q(`SELECT count(*)::int n FROM pg_class WHERE relname='_fin_mov'`); check(fx[0].n === 0, 'o relatório não deixa tabelas temporárias nem altera dados (só leitura)');

  console.log('Reversão');
  const limpo = await banco(15);
  await limpo.exec(`DELETE FROM martins_producao_v1.registros WHERE modulo='contas_receber'`).catch(() => {});
  try { await limpo.exec(sql('supabase/v15/reverter_v15.sql')); check(true, 'sem parcelas geradas, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async (d, nome) => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname=$1 ORDER BY pronargs DESC LIMIT 1`, [nome])).rows[0].h;
  const v14 = await banco(14);
  check((await h(v14, 'martins_producao_obra_consumir')) === (await h(limpo, 'martins_producao_obra_consumir')) && (await h(v14, 'martins_producao_obra_gastos')) === (await h(limpo, 'martins_producao_obra_gastos')) && (await h(v14, 'martins_producao_orcamento_converter')) === (await h(limpo, 'martins_producao_orcamento_converter')), 'a reversão devolve consumir, gastos e converter exatamente às versões anteriores');
  try { await db.exec(sql('supabase/v15/reverter_v15.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria vínculos/.test(e.message), 'com parcelas geradas por pedido, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
