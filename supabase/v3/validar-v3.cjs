// Uso (na raiz): npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v3/validar-v3.cjs .
// Aplica base + produção + v2 + v3 num Postgres descartável e testa os cadastros auxiliares e a reversão.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.');
const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', MASTER = '11111111-1111-4111-8111-111111111111', OPER = '22222222-2222-4222-8222-222222222222';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };

async function banco({ v3 = true } = {}) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const d of ['supabase/producao/migrations', 'supabase/v2/migrations', ...(v3 ? ['supabase/v3/migrations'] : [])])
    for (const f of fs.readdirSync(path.join(raiz, d)).sort()) await db.exec(sql(d + '/' + f));
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${MASTER}'),('${OPER}');
    INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${OPER}','${E}','Operacional');
    INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${OPER}','operacional',true);`);
  return db;
}

(async () => {
  const db = await banco();
  async function como(uid, q, p = []) {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);
    try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); }
  }
  const salvar = (uid, m, r, v, d) => como(uid, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x => x.x ?? x);

  console.log('Contexto');
  const ctx = (await como(MASTER, 'SELECT public.martins_producao_contexto() AS x')).x;
  check(['feriados', 'precos_insumo', 'epis', 'despesas', 'funcionarios'].every(m => ctx.empresas[0].permissoes[m]?.criar), 'contexto traz os módulos v1, v2 e v3');

  console.log('Feriados');
  check((await salvar(MASTER, 'feriados', id(), 0, { nome: 'Proclamação da República', data: '2026-11-15', abrangencia: 'nacional' })).revisao === 1, 'cadastra feriado');
  check((await salvar(MASTER, 'feriados', id(), 0, { nome: 'Outro', data: '2026-11-15' })).erro === '23505', 'segundo feriado na mesma data é recusado');
  check((await salvar(MASTER, 'feriados', id(), 0, { nome: 'X', data: '2026-12-01', abrangencia: 'galáctica' })).erro === '22023', 'abrangência inválida é recusada');
  check((await salvar(MASTER, 'feriados', id(), 0, { nome: 'Sem data' })).erro === '22023', 'feriado sem data é recusado');

  console.log('Preços de insumo');
  const forn = id(); await salvar(MASTER, 'fornecedores', forn, 0, { nome: 'Forn' });
  check((await salvar(MASTER, 'precos_insumo', id(), 0, { nome: 'Cimento CP-II', unidade: 'SC', preco_centavos: 3990, data: '2026-11-10', fornecedor_id: forn })).revisao === 1, 'registra preço pago com fornecedor do cadastro');
  check((await salvar(MASTER, 'precos_insumo', id(), 0, { nome: 'Areia', unidade: 'M3', preco_centavos: '12,5' })).erro === '22023', 'preço fora de centavos inteiros é recusado');
  check((await salvar(MASTER, 'precos_insumo', id(), 0, { nome: 'Brita', unidade: 'M3', preco_centavos: 100, fornecedor_id: id() })).erro === '23503', 'fornecedor de fora é recusado');

  console.log('EPIs');
  check((await salvar(MASTER, 'epis', id(), 0, { nome: 'Capacete classe B', codigo: 'EPI-01', categoria: 'Proteção da cabeça', tamanho: 'Único', preco_centavos: 2590, estoque_minimo: 10 })).revisao === 1, 'cadastra EPI no catálogo');
  check((await salvar(MASTER, 'epis', id(), 0, { nome: 'Outro capacete', codigo: 'epi-01' })).erro === '23505', 'código de EPI repetido é recusado');
  check((await salvar(MASTER, 'epis', id(), 0, { nome: 'Luva', saldo: 50 })).erro === '22023', 'saldo não é aceito no cadastro (virá de movimentações)');

  console.log('Permissões e v2');
  check((await salvar(OPER, 'feriados', id(), 0, { nome: 'Y', data: '2026-12-25' })).erro === '42501', 'operacional sem permissão não cadastra feriado');
  await db.exec(`INSERT INTO martins_producao_v1.permissoes VALUES ('${OPER}','${E}','feriados',true,true,false)`);
  check((await salvar(OPER, 'feriados', id(), 0, { nome: 'Natal', data: '2026-12-25' })).revisao === 1, 'com permissão de criar, operacional cadastra feriado');
  const cc = id(); await salvar(MASTER, 'centros_custo', cc, 0, { codigo: 'ADM', nome: 'Adm', tipo: 'administrativo' });
  check((await salvar(MASTER, 'despesas', id(), 0, { descricao: 'Teste', valor_centavos: 100, competencia: '2026-11-10', classificacao: 'administrativa', centro_custo_id: cc })).revisao === 1, 'v2 (despesas) continua funcionando');

  console.log('Reversão');
  const limpo = await banco();
  try { await limpo.exec(sql('supabase/v3/reverter_v3.sql')); check(true, 'sem dados v3, a reversão funciona'); } catch (e) { check(false, 'reversão sem dados: ' + e.message); }
  const v2md5 = (await (await banco({ v3: false })).query(`SELECT string_agg(md5(prosrc), ',' ORDER BY proname) h FROM pg_proc WHERE proname IN ('pode','martins_producao_contexto','martins_producao_salvar','martins_producao_catalogos')`)).rows[0].h;
  const revertido = (await limpo.query(`SELECT string_agg(md5(prosrc), ',' ORDER BY proname) h FROM pg_proc WHERE proname IN ('pode','martins_producao_contexto','martins_producao_salvar','martins_producao_catalogos')`)).rows[0].h;
  check(v2md5 === revertido, 'reversão devolve as funções exatamente à v2');
  try { await db.exec(sql('supabase/v3/reverter_v3.sql')); check(false, 'reversão com dados deveria ser bloqueada'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com dados v3, a reversão é bloqueada'); }

  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
