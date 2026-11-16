// Uso (na raiz do repositório):
//   npm install --no-save @electric-sql/pglite@0.2.17
//   node supabase/producao/validar-contratos.cjs .
// Aplica a base reconstruída e as 6 migrações num Postgres descartável (PGlite)
// e exercita os contratos como o frontend faria.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const raiz = process.argv[2];
const dir = path.join(raiz, 'supabase/producao');

const MASTER = '11111111-1111-4111-8111-111111111111';
const LEITOR = '22222222-2222-4222-8222-222222222222';
const CONSTRUTORA = '4d9b925e-732f-4055-8f52-c40373425dd5';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let ok = 0, falhas = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ok  ', msg); } else { falhas++; console.log('  FALHA', msg); } };

(async () => {
  const db = new PGlite();
  // Simulação mínima do Supabase: papéis, schema auth e auth.uid() a partir da claim do JWT.
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
  `);
  await db.exec(fs.readFileSync(path.join(dir, 'base/estrutura_anterior_as_migracoes.sql'), 'utf8'));
  console.log('base aplicada');
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${CONSTRUTORA}', 'Construtora Martins - cadastro inicial');`);
  for (const f of fs.readdirSync(path.join(dir, 'migrations')).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, 'migrations', f), 'utf8'));
    console.log('migração aplicada:', f);
  }
  const empresas = (await db.query('SELECT razao_social, cnpj FROM public.martins_empresas ORDER BY cnpj')).rows;
  check(empresas.length === 3 && empresas.every(e => e.cnpj), '3 empresas com CNPJ após a primeira migração');

  // Usuários: um Master na Construtora e um administrador com leitura integral.
  await db.exec(`
    INSERT INTO auth.users VALUES ('${MASTER}', 'master@example.invalid'), ('${LEITOR}', 'leitor@example.invalid');
    INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}', '${CONSTRUTORA}', 'Master Teste'), ('${LEITOR}', '${CONSTRUTORA}', 'Leitor Teste');
    INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo, leitura_integral) VALUES
      ('${CONSTRUTORA}', '${MASTER}', 'master', true, false), ('${CONSTRUTORA}', '${LEITOR}', 'administrador', true, true);
  `);

  async function como(uid, sql, params = []) {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);
    try { return (await db.query(sql, params)).rows[0]; }
    catch (e) { return { erro: e.code || e.message, msg: e.message }; }
    finally { await db.exec(`RESET ROLE;`); }
  }
  const salvar = (uid, m, r, v, d, op) => como(uid, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [CONSTRUTORA, m, r, v, JSON.stringify(d), op]);

  const ctx = await como(MASTER, 'SELECT public.martins_producao_contexto() AS x');
  check(ctx.x && ctx.x.empresas.length === 1 && ctx.x.empresas[0].permissoes.funcionarios.editar === true, 'contexto: Master tem as permissões da empresa');

  const anon = await (async () => { await db.exec('SET ROLE anon'); try { await db.query('SELECT public.martins_producao_contexto()'); return 'executou'; } catch (e) { return e.code; } finally { await db.exec('RESET ROLE'); } })();
  check(anon === '42501', 'anon não executa martins_producao_contexto (42501)');

  const direto = await como(MASTER, 'SELECT count(*) FROM martins_producao_v1.registros');
  check(direto.erro === '42501', 'nem o Master lê martins_producao_v1 direto, só pelas funções');

  const obra = uuid(1), func = uuid(2), func2 = uuid(3);
  check((await salvar(MASTER, 'obras', obra, 0, { nome: 'Obra Teste', codigo: 'OB-1' }, uuid(101))).x?.revisao === 1, 'Master cria obra');
  const r1 = await salvar(MASTER, 'funcionarios', func, 0, { nome: 'Funcionário Teste', cpf: '529.982.247-25' }, uuid(102));
  check(r1.x?.revisao === 1 && r1.x.repetida === false, 'Master cria funcionário');
  const rep = await salvar(MASTER, 'funcionarios', func, 0, { nome: 'Funcionário Teste', cpf: '529.982.247-25' }, uuid(102));
  check(rep.x?.repetida === true, 'reenvio com a mesma operação é idempotente (repetida=true)');
  check((await salvar(MASTER, 'funcionarios', func, 0, { nome: 'Outro' }, uuid(102))).erro === '22023', 'mesma operação com outro conteúdo é recusada (22023)');
  check((await salvar(MASTER, 'funcionarios', func, 0, { nome: 'Dup' }, uuid(103))).erro === '40001', 'criar registro já existente gera conflito de revisão (40001)');
  check((await salvar(MASTER, 'funcionarios', func2, 0, { nome: 'Mesmo CPF', cpf: '52998224725' }, uuid(104))).erro === '23505', 'CPF duplicado na empresa é recusado (23505)');

  const hoje = (await db.query(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text AS d`)).rows[0].d;
  check((await salvar(MASTER, 'frequencia', uuid(4), 0, { funcionario_id: func, obra_id: obra, data: hoje, situacao: 'presente', horas_normais: 5 }, uuid(105))).x?.revisao === 1, 'frequência de 5h registrada');
  const obra2 = uuid(5);
  await salvar(MASTER, 'obras', obra2, 0, { nome: 'Obra 2', codigo: 'OB-2' }, uuid(106));
  check((await salvar(MASTER, 'frequencia', uuid(6), 0, { funcionario_id: func, obra_id: obra2, data: hoje, situacao: 'presente', horas_normais: 4 }, uuid(107))).erro === '23514', 'limite de 8h normais somando duas obras (23514)');

  const lista = await como(LEITOR, 'SELECT public.martins_producao_consultar($1, $2) AS x', [CONSTRUTORA, 'funcionarios']);
  check(Array.isArray(lista.x) && lista.x.length === 1, 'administrador com leitura integral consulta funcionários');
  check((await salvar(LEITOR, 'funcionarios', uuid(7), 0, { nome: 'Novo' }, uuid(108))).erro === '42501', 'administrador com leitura integral NÃO grava (42501)');
  const obraLeitor = await como(LEITOR, 'SELECT public.martins_producao_consultar($1, $2) AS x', [CONSTRUTORA, 'obras']);
  check(obraLeitor.x?.length === 2, 'leitor vê as obras (com projeção de campos)');

  const outra = (await db.query(`SELECT id FROM public.martins_empresas WHERE id <> '${CONSTRUTORA}' LIMIT 1`)).rows[0].id;
  const vaz = await como(MASTER, 'SELECT public.martins_producao_consultar($1, $2) AS x', [outra, 'funcionarios']);
  check(vaz.erro === '42501', 'Master de uma empresa não consulta outra empresa (42501)');

  const audit = (await db.query('SELECT count(*)::int AS n FROM martins_producao_v1.auditoria')).rows[0].n;
  check(audit === 4, 'auditoria registrou as 4 gravações bem-sucedidas');

  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
