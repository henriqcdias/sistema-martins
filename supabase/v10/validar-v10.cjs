// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v10/validar-v10.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
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
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(10);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','m@t.com'),('${OPER}','o@t.com'),('${LEITOR}','l@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${OPER}','${E}','Financeiro'),('${LEITOR}','${E}','Leitor');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${OPER}','operacional',true),('${E}','${LEITOR}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${OPER}','${E}','contas_receber',true,true,true),('${LEITOR}','${E}','contas_receber',true,false,false);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const salvar = (u, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, 'contas_receber', r, v, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const salvarM = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const hoje = (await q(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text d`))[0].d;
  const baixar = (u, c, v, valor, data = hoje, cb = null, op = id()) => como(u, 'SELECT public.martins_producao_receber_baixar($1,$2,$3,$4,$5,$6,$7,$8) AS x', [E, op, c, v, valor, data, cb, null]).then(x => x.x ?? x);
  const cancelar = (u, c, v, motivo = 'Cliente desistiu') => como(u, 'SELECT public.martins_producao_receber_estado($1,$2,$3,$4,$5,$6) AS x', [E, id(), c, v, 'cancelada', motivo]).then(x => x.x ?? x);
  const estornar = (u, c, v, b, motivo = 'Lançado errado') => como(u, 'SELECT public.martins_producao_receber_estornar($1,$2,$3,$4,$5,$6) AS x', [E, id(), c, v, b, motivo]).then(x => x.x ?? x);
  const lido = async r => (await q(`SELECT revisao, dados FROM martins_producao_v1.registros WHERE id=$1`, [r]))[0];
  const CLI = id(), OBRA = id(), ORC = id(), CB = id();
  await salvarM(MASTER, 'clientes', CLI, 0, { nome: 'Cliente A' }); await salvarM(MASTER, 'obras', OBRA, 0, { nome: 'Obra 1', codigo: 'O1' }); await salvarM(MASTER, 'contas_bancarias', CB, 0, { nome: 'Itaú' });
  await salvarM(MASTER, 'orcamentos', ORC, 0, { nome: 'Orçamento 1', itens: [{ desc: 'Serviço', qtd: 1, precoUnit: 100 }] });
  const base = { cliente_id: CLI, descricao: 'Medição 1 - Obra 1', valor_centavos: 100000, vencimento: '2026-12-10', obra_id: OBRA, orcamento_id: ORC, numero_documento: 'NF 10' };

  console.log('Cadastro do título');
  const T1 = id(); check((await salvar(OPER, T1, 0, { ...base, estado: 'recebida', recebido_centavos: 999, baixas: [{ valor_centavos: 1 }] })).revisao === 1, 'título válido é gravado');
  const d1 = (await lido(T1)).dados;
  check(d1.estado === 'aberta' && d1.recebido_centavos === 0 && d1.baixas.length === 0, 'estado, recebido e baixas são do servidor (o que veio do navegador é descartado)');
  check((await salvar(OPER, id(), 0, { ...base, cliente_id: undefined, cliente_nome: 'Cliente avulso' })).revisao === 1, 'cliente só pelo nome é aceito');
  for (const [m, d, e] of [['valor zero', { valor_centavos: 0 }, '22023'], ['valor em reais quebrados', { valor_centavos: 10.5 }, '22023'], ['sem descrição', { descricao: ' ' }, '22023'], ['sem cliente', { cliente_id: undefined }, '22023'],
    ['cliente de fora', { cliente_id: id() }, '23503'], ['sem vencimento', { vencimento: undefined }, '22023'], ['vencimento inválido', { vencimento: '2026-13-45' }, '22008'], ['obra de fora', { obra_id: id() }, '23503'],
    ['orçamento de fora', { orcamento_id: id() }, '23503'], ['campo desconhecido', { juros: 5 }, '22023']]) {
    const r = await salvar(OPER, id(), 0, { ...base, ...d }); check(r.erro === e || (e === '22008' && !!r.erro && r.erro !== '42501'), 'recusa: ' + m);
  }
  check((await salvar(LEITOR, id(), 0, base)).erro === '42501', 'quem só lê não cria título');
  check((await salvar(OPER, T1, 1, { ...base, valor_centavos: 120000 })).revisao === 2, 'título aberto e sem recebimento pode ser editado');

  console.log('Recebimentos');
  let rev = (await lido(T1)).revision ?? (await lido(T1)).revisao;
  const op1 = id(); const b1 = await baixar(OPER, T1, rev, 40000, hoje, CB, op1);
  check(b1.estado === 'parcial' && b1.recebido_centavos === 40000, 'recebimento parcial de R$ 400 de R$ 1.200: estado "parcial"');
  check((await baixar(OPER, T1, rev, 40000, hoje, CB, op1)).repetida === true && (await lido(T1)).dados.recebido_centavos === 40000, 'reenviar a mesma operação não recebe duas vezes');
  check((await baixar(OPER, T1, rev, 1000)).erro === '40001', 'revisão desatualizada é recusada (conflito)');
  rev = (await lido(T1)).revisao;
  check((await baixar(OPER, T1, rev, 90000)).erro === '23514', 'recebimento maior que o saldo é recusado');
  check((await baixar(OPER, T1, rev, 1000, '2999-01-01')).erro === '22023', 'data futura é recusada');
  check((await baixar(OPER, T1, rev, 1000, hoje, id())).erro === '23503', 'conta bancária de fora é recusada');
  check((await baixar(OPER, T1, rev, 0)).erro === '22023', 'valor zero é recusado');
  check((await baixar(LEITOR, T1, rev, 1000)).erro === '42501', 'quem só lê não registra recebimento');
  check((await salvar(OPER, T1, rev, base)).erro === '22023', 'título com recebimento não é editado');
  check((await cancelar(OPER, T1, rev)).erro === '22023', 'título com recebimento não é cancelado (estorne antes)');
  const b2 = await baixar(OPER, T1, rev, 80000, hoje);
  check(b2.estado === 'recebida' && b2.recebido_centavos === 120000, 'recebimento do restante quita o título: "recebida"');
  rev = (await lido(T1)).revisao;
  check((await baixar(OPER, T1, rev, 1)).erro === '22023', 'título quitado não aceita novo recebimento');

  console.log('Estorno (Master)');
  check((await estornar(OPER, T1, rev, b2.baixa_id)).erro === '42501', 'quem não é Master não estorna');
  check((await estornar(MASTER, T1, rev, b2.baixa_id, ' ')).erro === '22023', 'estorno sem motivo é recusado');
  const es = await estornar(MASTER, T1, rev, b2.baixa_id);
  check(es.estado === 'parcial' && es.recebido_centavos === 40000, 'estornar o segundo recebimento: volta a "parcial" com R$ 400');
  const dl = (await lido(T1)).dados;
  check(dl.baixas.length === 2 && dl.baixas.find(b => b.id === b2.baixa_id).estornada === true && dl.baixas.find(b => b.id === b2.baixa_id).estorno_motivo === 'Lançado errado', 'a baixa não some: fica marcada como estornada, com motivo');
  rev = (await lido(T1)).revisao;
  check((await estornar(MASTER, T1, rev, b2.baixa_id)).erro === '23505', 'estornar de novo o mesmo recebimento é recusado');
  check((await estornar(MASTER, T1, rev, id())).erro === '23503', 'recebimento inexistente é recusado');
  const es2 = await estornar(MASTER, T1, rev, b1.baixa_id);
  check(es2.estado === 'aberta' && es2.recebido_centavos === 0, 'estornando tudo o título volta a "aberta"');
  rev = (await lido(T1)).revisao;
  check((await cancelar(OPER, T1, rev, '')).erro === '22023', 'cancelar sem motivo é recusado');
  check((await cancelar(OPER, T1, rev)).estado === 'cancelada', 'título aberto sem recebimento válido pode ser cancelado');
  rev = (await lido(T1)).revisao;
  check((await baixar(OPER, T1, rev, 1000)).erro === '22023', 'título cancelado não recebe');

  console.log('Totais calculados no servidor');
  const T2 = id(), T3 = id(), T4 = id();
  await salvar(OPER, T2, 0, { ...base, descricao: 'Vencido', valor_centavos: 5000, vencimento: '2020-01-01' }); await salvar(OPER, T3, 0, { ...base, descricao: 'A vencer', valor_centavos: 30000, vencimento: '2999-01-01' });
  await salvar(OPER, T4, 0, { ...base, descricao: 'Parcial vencida', valor_centavos: 10000, vencimento: '2020-02-01' }); await baixar(OPER, T4, 1, 4000);
  const tot = (await como(LEITOR, 'SELECT public.martins_producao_receber_totais($1) AS x', [E])).x;
  const todos = await q(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='contas_receber'`);
  const abertos = todos.map(r => r.dados).filter(d => ['aberta', 'parcial'].includes(d.estado));
  const esperadoAReceber = abertos.reduce((s, d) => s + d.valor_centavos - d.recebido_centavos, 0);
  const esperadoVencido = abertos.filter(d => d.vencimento < hoje).reduce((s, d) => s + d.valor_centavos - d.recebido_centavos, 0);
  const mes = hoje.slice(0, 7);
  const esperadoMes = todos.flatMap(r => r.dados.baixas).filter(b => !b.estornada && b.data.slice(0, 7) === mes).reduce((s, b) => s + b.valor_centavos, 0);
  check(tot.a_receber_centavos === esperadoAReceber && tot.a_receber_centavos === 100000 + 5000 + 30000 + 6000, 'a receber = saldo dos títulos abertos e parciais (R$ 1.410)');
  check(tot.vencido_centavos === esperadoVencido && tot.vencido_centavos === 5000 + 6000, 'vencido = saldo dos títulos com vencimento passado (R$ 110)');
  check(tot.recebido_mes_centavos === esperadoMes && tot.titulos_abertos === 4, 'recebido no mês ignora estornos; 4 títulos em aberto');
  check((await como(id(), 'SELECT public.martins_producao_receber_totais($1) AS x', [E])).erro === '42501', 'quem não tem acesso não vê os totais');

  console.log('Auditoria e permissões');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='contas_receber'`))[0].n >= 10, 'criação, recebimentos, estornos e cancelamento têm trilha');
  const ctx = (await como(MASTER, 'SELECT public.martins_producao_contexto() AS x')).x.empresas[0].permissoes; const mods = Object.keys(ctx);
  const itens = mods.map(m => ({ modulo: m, ler: true, criar: false, editar: false }));
  check(mods.includes('contas_receber') && (await como(MASTER, 'SELECT public.martins_producao_permissoes_definir($1,$2,$3,$4) AS x', [E, id(), LEITOR, JSON.stringify(itens)])).x?.permissoes?.contas_receber?.ler === true, 'a tela de permissões (v9) aceita TODOS os módulos do contexto, inclusive contas_receber');

  console.log('Reversão');
  const limpo = await banco(10);
  try { await limpo.exec(sql('supabase/v10/reverter_v10.sql')); check(true, 'sem contas a receber, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async (d, nome) => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname=$1`, [nome])).rows[0].h;
  const v9 = await banco(9);
  check((await h(v9, 'martins_producao_salvar')) === (await h(limpo, 'martins_producao_salvar')) && (await h(v9, 'martins_producao_permissoes_definir')) === (await h(limpo, 'martins_producao_permissoes_definir')), 'reversão devolve salvar e permissões_definir exatamente às versões anteriores');
  try { await db.exec(sql('supabase/v10/reverter_v10.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com contas a receber, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
