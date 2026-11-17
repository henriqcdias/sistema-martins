// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v14/validar-v14.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', VENDAS = '22222222-2222-4222-8222-222222222222', LEITOR = '33333333-3333-4333-8333-333333333333';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(14);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','m@t.com'),('${VENDAS}','v@t.com'),('${LEITOR}','l@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${VENDAS}','${E}','Comercial'),('${LEITOR}','${E}','Leitor');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${VENDAS}','operacional',true),('${E}','${LEITOR}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${VENDAS}','${E}','orcamentos',true,true,true),('${VENDAS}','${E}','pedidos_venda',true,false,false),('${LEITOR}','${E}','orcamentos',true,false,false);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const x = r => r?.x ?? r;
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x);
  const estado = (u, o, v, s, motivo = null, op = id()) => como(u, 'SELECT public.martins_producao_orcamento_estado($1,$2,$3,$4,$5,$6) AS x', [E, op, o, v, s, motivo]).then(x);
  const converter = (u, o, v, aprovar = false, op = id()) => como(u, 'SELECT public.martins_producao_orcamento_converter($1,$2,$3,$4,$5) AS x', [E, op, o, v, aprovar]).then(x);
  const lido = async r => (await q(`SELECT revisao, dados FROM martins_producao_v1.registros WHERE id=$1`, [r]))[0];
  const base = { nome: 'Orçamento · Cliente', cliente: 'Cliente A', itens: [{ desc: 'Item 1', qtd: 2, precoUnit: 100 }], condicoes: 'PIX', prazo: '5 dias' };

  console.log('Número e situação do orçamento');
  const O1 = id(), O2 = id();
  const r1 = await salvar(VENDAS, 'orcamentos', O1, 0, { ...base, numero: 999, status: 'Aprovado' });
  check(r1.revisao === 1, 'orçamento válido é gravado');
  let d1 = (await lido(O1)).dados;
  check(d1.numero === 1 && d1.status === 'Em elaboração' && d1.total === 200, 'o servidor define o número (1) e a situação inicial; o que veio do navegador é descartado; total calculado (200)');
  await salvar(VENDAS, 'orcamentos', O2, 0, { ...base, cliente: 'Cliente B' });
  check((await lido(O2)).dados.numero === 2, 'o número é sequencial por empresa (2)');
  await salvar(VENDAS, 'orcamentos', O1, 1, { ...base, cliente: 'Cliente A editado', numero: 77, status: 'Entregue' });
  d1 = (await lido(O1)).dados;
  check(d1.numero === 1 && d1.status === 'Em elaboração' && d1.cliente === 'Cliente A editado', 'editar mantém número e situação (não dá para mudar pelo cadastro)');
  // orçamento antigo, sem número (anterior à v14)
  const OANT = id(); await db.query(`INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por) VALUES ($1,'orcamentos',$2,1,$3::jsonb,$4,$4)`, [E, OANT, JSON.stringify({ nome: 'Antigo', cliente: 'Cliente Antigo', status: 'Em Orçamento', itens: [{ desc: 'x', qtd: 1, precoUnit: 10 }], total: 10 }), MASTER]);
  await salvar(MASTER, 'orcamentos', OANT, 1, { nome: 'Antigo', cliente: 'Cliente Antigo', itens: [{ desc: 'x', qtd: 1, precoUnit: 10 }] });
  check((await lido(OANT)).dados.numero === 3 && (await lido(OANT)).dados.status === 'Em elaboração', 'orçamento antigo sem número ganha o próximo número ao ser editado e a situação "Em Orçamento" vira "Em elaboração"');
  check((await salvar(LEITOR, 'orcamentos', id(), 0, base)).erro === '42501', 'quem só lê não cria orçamento');

  console.log('Mudança de situação');
  let rev = (await lido(O1)).revisao;
  check((await estado(VENDAS, O1, rev, 'Aprovado', null)).status === 'Aprovado', 'em elaboração → aprovado');
  rev = (await lido(O1)).revisao;
  check((await estado(VENDAS, O1, rev, 'Em elaboração')).status === 'Em elaboração', 'aprovado pode voltar a "em elaboração"');
  rev = (await lido(O1)).revisao;
  check((await estado(VENDAS, O1, rev, 'Entregue')).erro === '22023', 'em elaboração não vai direto a entregue');
  check((await estado(VENDAS, O1, rev, 'Convertido em venda')).erro === '22023', 'não se marca "convertido em venda" por aqui: só pela conversão');
  check((await estado(VENDAS, O1, rev, 'Recusado', '')).erro === '22023', 'recusar exige motivo');
  check((await estado(VENDAS, O1, rev - 1, 'Enviado')).erro === '40001', 'revisão desatualizada é recusada (conflito)');
  check((await estado(LEITOR, O1, rev, 'Enviado')).erro === '42501', 'quem só lê não muda situação');
  const op = id(); check((await estado(VENDAS, O1, rev, 'Enviado', 'Enviado ao cliente por e-mail', op)).status === 'Enviado', 'em elaboração → enviado');
  check((await estado(VENDAS, O1, rev, 'Enviado', 'Enviado ao cliente por e-mail', op)).repetida === true, 'reenviar a mesma operação é idempotente');
  const h = (await lido(O1)).dados.historicoStatus;
  check(h.length === 3 && h[2].de === 'Em elaboração' && h[2].para === 'Enviado' && h[2].motivo === 'Enviado ao cliente por e-mail', 'o histórico guarda de, para e motivo de cada mudança');
  rev = (await lido(O1)).revisao;
  check((await estado(VENDAS, O1, rev, 'Recusado', 'Cliente achou caro')).status === 'Recusado', 'enviado → recusado (com motivo)');
  rev = (await lido(O1)).revisao; check((await estado(VENDAS, O1, rev, 'Em elaboração')).status === 'Em elaboração', 'recusado pode ser reaberto');

  console.log('Conversão em pedido de venda');
  rev = (await lido(O2)).revisao;
  check((await converter(VENDAS, O2, rev)).erro === '22023', 'orçamento que não está aprovado não converte');
  const op2 = id(); const c = await converter(VENDAS, O2, rev, true, op2);
  check(c.pedido_numero === 1 && c.status === 'Convertido em venda' && c.repetida === false, 'aprovar e converter de uma vez gera o pedido nº 1');
  const ped = (await q(`SELECT id, dados FROM martins_producao_v1.registros WHERE modulo='pedidos_venda'`));
  check(ped.length === 1 && ped[0].dados.orcamento_id === O2 && ped[0].dados.total === 200 && ped[0].dados.itens.length === 1 && ped[0].dados.estado === 'aberto' && ped[0].dados.cliente === 'Cliente B', 'o pedido nasce com cliente, itens e total do orçamento');
  const dO2 = (await lido(O2)).dados; check(dO2.status === 'Convertido em venda' && dO2.pedido_numero === 1 && String(dO2.pedido_id) === String(ped[0].id), 'o orçamento fica "convertido em venda" apontando para o pedido');
  check((await converter(VENDAS, O2, rev, true, op2)).repetida === true && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='pedidos_venda'`))[0].n === 1, 'reenviar a mesma conversão não cria outro pedido');
  const dup = await converter(VENDAS, O2, c.revisao, false);
  check(dup.erro === '23505' && /nº 1/.test(dup.msg), 'converter de novo, com outra operação, é recusado informando o pedido nº 1');
  check((await converter(MASTER, O2, 1, true)).erro === '23505' && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE modulo='pedidos_venda'`))[0].n === 1, 'outro usuário (mesmo com revisão antiga) também não duplica: continua 1 pedido');
  check((await salvar(VENDAS, 'orcamentos', O2, c.revisao, { ...base, cliente: 'Tentativa' })).erro === '22023', 'orçamento convertido não pode mais ser editado');
  check((await salvar(MASTER, 'pedidos_venda', id(), 0, { numero: 5, orcamento_id: O1 })).erro === '42501', 'pedido de venda não é gravado direto: só pela conversão');
  rev = c.revisao; check((await estado(VENDAS, O2, rev, 'Entregue')).status === 'Entregue', 'convertido → entregue');
  const semItens = id(); await db.query(`INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por) VALUES ($1,'orcamentos',$2,1,$3::jsonb,$4,$4)`, [E, semItens, JSON.stringify({ nome: 'Vazio', cliente: 'Z', status: 'Aprovado', numero: 50, itens: [], total: 0 }), MASTER]);
  check((await converter(VENDAS, semItens, 1)).erro === '22023', 'orçamento sem itens ou sem valor não vira pedido');
  const O3 = id(); await salvar(VENDAS, 'orcamentos', O3, 0, { ...base, cliente: 'Cliente C' }); const r3 = (await lido(O3)).revisao;
  await estado(VENDAS, O3, r3, 'Aprovado'); const c3 = await converter(VENDAS, O3, r3 + 1);
  check(c3.pedido_numero === 2, 'orçamento já aprovado converte direto (pedido nº 2)');
  check((await converter(LEITOR, O3, c3.revisao)).erro === '42501', 'quem só lê não converte');
  check((await como(LEITOR, 'SELECT public.martins_producao_consultar($1,$2) AS x', [E, 'pedidos_venda'])).erro === '42501', 'quem não tem permissão em pedidos de venda não os lista');
  check((await como(VENDAS, 'SELECT public.martins_producao_consultar($1,$2) AS x', [E, 'pedidos_venda'])).x.length === 2, 'quem tem permissão lista os 2 pedidos');
  const ctx = (await como(MASTER, 'SELECT public.martins_producao_contexto() AS x')).x.empresas[0].permissoes;
  const itens = Object.keys(ctx).map(m => ({ modulo: m, ler: true, criar: false, editar: false }));
  check(Object.keys(ctx).includes('pedidos_venda') && (await como(MASTER, 'SELECT public.martins_producao_permissoes_definir($1,$2,$3,$4) AS x', [E, id(), LEITOR, JSON.stringify(itens)])).x?.permissoes?.pedidos_venda?.ler === true, 'a tela de permissões aceita TODOS os módulos do contexto, inclusive pedidos_venda');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo IN ('orcamentos','pedidos_venda')`))[0].n >= 12, 'situações e conversões têm trilha de auditoria');

  console.log('Reversão');
  const limpo = await banco(14);
  try { await limpo.exec(sql('supabase/v14/reverter_v14.sql')); check(true, 'sem pedidos de venda, a reversão funciona'); } catch (e) { check(false, e.message); }
  const hh = async (d, nome) => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname=$1`, [nome])).rows[0].h;
  const v10 = await banco(10);
  check((await hh(v10, 'martins_producao_salvar')) === (await hh(limpo, 'martins_producao_salvar')) && (await hh(v10, 'martins_producao_permissoes_definir')) === (await hh(limpo, 'martins_producao_permissoes_definir')), 'a reversão devolve salvar e permissões_definir exatamente às versões anteriores');
  try { await db.exec(sql('supabase/v14/reverter_v14.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com pedidos de venda, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
