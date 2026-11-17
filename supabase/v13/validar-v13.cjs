// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v13/validar-v13.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const A = '4d9b925e-732f-4055-8f52-c40373425dd5', B = '5e0ca66f-843e-4166-9d63-04b484536ee6', C = '6f1db77a-954f-4277-8e74-15c595647fff';
const MA = '11111111-1111-4111-8111-111111111111', MB = '22222222-2222-4222-8222-222222222222', MC = '33333333-3333-4333-8333-333333333333', OPA = '44444444-4444-4444-8444-444444444444', FANTASMA = '99999999-9999-4999-8999-999999999999';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${A}','Empresa A'),('${B}','Empresa B'),('${C}','Empresa C');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(13);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MA}','ma@t.com'),('${MB}','mb@t.com'),('${MC}','mc@t.com'),('${OPA}','op@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MA}','${A}','Master A'),('${MB}','${B}','Master B'),('${MC}','${C}','Master C'),('${OPA}','${A}','Operador A');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${A}','${MA}','master',true),('${B}','${MB}','master',true),('${C}','${MC}','master',true),('${A}','${OPA}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes SELECT '${OPA}','${A}',m,true,true,true FROM unnest(ARRAY['clientes','estoque_movimentos']) m;`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const x = r => r?.x ?? r;
  const salvar = (u, e, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [e, m, r, v, JSON.stringify(d), id()]).then(x);
  const exportar = (u, e) => como(u, 'SELECT public.martins_producao_backup_exportar($1) AS x', [e]).then(x);
  const importar = (u, e, b, op = id()) => como(u, 'SELECT public.martins_producao_backup_importar($1,$2,$3) AS x', [e, op, JSON.stringify(b)]).then(x);
  const saldo = async (e, p, d) => Number((await q(`SELECT martins_producao_v1.saldo($1,$2,$3) s`, [e, p, d]))[0].s);
  const viaArquivo = o => JSON.parse(JSON.stringify(o)); // o que o navegador faz: baixa o JSON, salva, relê e reenvia

  // empresa A com dados variados
  const CLI = id(), PRO = id(), DEP = id(), OBRA = id(), DESP = id(), CONF = id(), FUNC = id();
  await salvar(MA, A, 'clientes', CLI, 0, { nome: 'Cliente A', empresaId: A }); await salvar(MA, A, 'produtos', PRO, 0, { codigo: 'P1', descricao: 'Cimento' }); await salvar(MA, A, 'depositos', DEP, 0, { nome: 'Almox' });
  await salvar(MA, A, 'obras', OBRA, 0, { nome: 'Obra 1', codigo: 'O1', valorContratado: 1000.50 }); await salvar(MA, A, 'funcionarios', FUNC, 0, { nome: 'Fulano', cpf: '529.982.247-25', salarioBase: 2500.00 });
  await como(OPA, 'SELECT public.martins_producao_estoque_mover($1,$2,$3,$4,$5,$6,$7,$8,$9) AS x', [A, id(), 'entrada', PRO, null, DEP, 12500, null, null]);
  const FORN = id(), CC = id(); await salvar(MA, A, 'fornecedores', FORN, 0, { nome: 'Forn' }); await salvar(MA, A, 'centros_custo', CC, 0, { codigo: 'C1', nome: 'Admin', tipo: 'administrativo' });
  await salvar(MA, A, 'despesas', CONF, 0, { descricao: 'Sigilosa', valor_centavos: 12345, competencia: '2026-11-01', classificacao: 'administrativa', centro_custo_id: CC, confidencial: true });
  await db.query(`INSERT INTO martins_producao_v1.registros(empresa_id,modulo,id,revisao,dados,criado_por,atualizado_por) VALUES ($1,'clientes',$2,3,'{"nome":"Cliente de autor removido"}'::jsonb,$3,$3)`, [A, id(), MA]);
  await db.query(`UPDATE auth.users SET id=id WHERE false`);

  console.log('Exportar');
  check((await exportar(OPA, A)).erro === '42501', 'quem não é Master não exporta');
  check((await exportar(MB, A)).erro === '42501', 'Master de outra empresa não exporta');
  const bk = await exportar(MA, A);
  const totalA = Number((await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE empresa_id=$1`, [A]))[0].n);
  check(bk.formato === 'martins-backup' && bk.total === totalA && bk.registros.length === totalA && Object.values(bk.por_modulo).reduce((s, v) => s + Number(v), 0) === totalA, 'o backup traz todos os registros da empresa e a contagem por módulo');
  check(bk.registros.some(r => r.modulo === 'despesas' && r.dados.confidencial === true), 'inclui a despesa confidencial (é do Master)');
  check(bk.registros.every(r => r.dados.empresa_id === undefined || r.dados.empresa_id === A) && !JSON.stringify(bk).includes(B), 'não traz nada de outra empresa');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo='backup' AND depois->>'acao'='exportar'`))[0].n === 2 - 1, 'a exportação fica registrada na auditoria (só a do Master; a recusada não)');

  console.log('Restaurar em empresa vazia (B)');
  const arq = viaArquivo(bk);
  // backup vindo de outro projeto: o autor de um dos registros não existe nesta base
  for (const r of arq.registros) if (r.dados.nome === 'Cliente de autor removido') { r.criado_por = FANTASMA; r.atualizado_por = FANTASMA; }
  check((await importar(OPA, B, arq)).erro === '42501' && (await importar(MA, B, arq)).erro === '42501', 'quem não é Master da empresa destino não restaura');
  const op = id(); const r = await importar(MB, B, arq, op);
  check(r.total === totalA && r.repetida === false, 'o Master restaura todos os registros na empresa vazia');
  const origem = await q(`SELECT modulo,id,revisao,dados,criado_por FROM martins_producao_v1.registros WHERE empresa_id=$1 ORDER BY modulo,id`, [A]);
  const destino = await q(`SELECT modulo,id,revisao,dados,criado_por FROM martins_producao_v1.registros WHERE empresa_id=$1 ORDER BY modulo,id`, [B]);
  const semEmpresa = d => { const c = { ...d }; delete c.empresaId; delete c.empresa_id; return c; };
  check(origem.length === destino.length && origem.every((o, i) => o.modulo === destino[i].modulo && o.id === destino[i].id && o.revisao === destino[i].revisao && JSON.stringify(semEmpresa(o.dados)) === JSON.stringify(semEmpresa(destino[i].dados))), 'ids, revisões e dados idênticos (inclusive R$ 1.000,50 e salário 2500)');
  check(destino.find(d => d.dados.nome === 'Cliente A').dados.empresaId === B, 'o id da empresa dentro dos dados é reescrito para a empresa destino');
  check(await saldo(B, PRO, DEP) === 12500 && await saldo(A, PRO, DEP) === 12500, 'o saldo do estoque volta junto (derivado dos movimentos), e a origem não mudou');
  check(destino.find(d => d.dados.nome === 'Cliente de autor removido').criado_por === MB, 'autor que não existe mais vira quem restaurou');
  check(destino.find(d => d.dados.nome === 'Cliente A').criado_por === MA, 'autor que existe é preservado');
  check((await salvar(MB, B, 'clientes', CLI, 1, { nome: 'Cliente A editado', empresaId: B })).revisao === 2, 'depois de restaurar, editar usa a revisão preservada e funciona normalmente');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE empresa_id=$1 AND modulo='clientes' AND dados->>'nome'='Cliente A'`, [A]))[0].n === 1, 'a edição na empresa B não afeta a empresa A');
  check((await importar(MB, B, arq, op)).repetida === true, 'reenviar a mesma operação é idempotente');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE empresa_id=$1 AND modulo='backup' AND depois->>'acao'='restaurar'`, [B]))[0].n === 1, 'a restauração fica registrada na auditoria');

  console.log('Proteções');
  check((await importar(MB, B, arq)).erro === '22023', 'restaurar em empresa que já tem dados é recusado');
  check((await importar(MA, A, arq)).erro === '22023', 'e na empresa de origem também (nada é sobrescrito nem misturado)');
  const faltando = viaArquivo(bk); faltando.registros.pop();
  check((await importar(MC, C, faltando)).erro === '22023', 'backup incompleto (faltou um registro) é recusado');
  const adulterado = viaArquivo(bk); adulterado.registros[0].revisao = 99;
  check((await importar(MC, C, adulterado)).erro === '22023', 'backup com revisão alterada é recusado pelo checksum');
  const trocado = viaArquivo(bk); trocado.registros[0].id = id();
  check((await importar(MC, C, trocado)).erro === '22023', 'backup com id alterado é recusado pelo checksum');
  check((await importar(MC, C, { ...viaArquivo(bk), formato: 'outro' })).erro === '22023' && (await importar(MC, C, { ...viaArquivo(bk), versao_formato: 2 })).erro === '22023', 'formato ou versão desconhecidos são recusados');
  check((await importar(MC, C, { formato: 'martins-backup', versao_formato: 1, registros: [], total: 0 })).erro === '22023', 'backup vazio é recusado');
  const modInvalido = viaArquivo(bk); modInvalido.registros[0].modulo = 'modulo_inventado';
  // refaz o checksum para chegar até a inserção e provar que o banco recusa módulo desconhecido
  const crypto = require('node:crypto'); modInvalido.checksum = crypto.createHash('md5').update(modInvalido.registros.map(r => `${r.modulo}:${r.id}:${r.revisao}`).join(',')).digest('hex');
  check(!!(await importar(MC, C, modInvalido)).erro && (await q(`SELECT count(*)::int n FROM martins_producao_v1.registros WHERE empresa_id=$1`, [C]))[0].n === 0, 'módulo desconhecido: a restauração falha inteira e a empresa continua vazia (tudo ou nada)');
  const r3 = await importar(MC, C, arq);
  check(r3.total === totalA, 'depois das recusas, uma empresa vazia ainda restaura normalmente (nenhum estado preso)');

  console.log('Reversão');
  const limpo = await banco(13);
  try { await limpo.exec(sql('supabase/v13/reverter_v13.sql')); check(true, 'a reversão remove as funções'); } catch (e) { check(false, e.message); }
  check((await limpo.query(`SELECT count(*)::int n FROM pg_proc WHERE proname LIKE 'martins_producao_backup%'`)).rows[0].n === 0, 'nenhuma função da v13 sobra');
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
