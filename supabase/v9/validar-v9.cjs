// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v9/validar-v9.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', E2 = '5e0ca66f-843e-4166-9d63-04b484536ee6', MASTER = '11111111-1111-4111-8111-111111111111', MASTER2 = '55555555-5555-4555-8555-555555555555', ALMOX = '22222222-2222-4222-8222-222222222222', LEITOR = '33333333-3333-4333-8333-333333333333', NOVO = '66666666-6666-4666-8666-666666666666', FORA = '77777777-7777-4777-8777-777777777777';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial'),('${E2}','Outra empresa');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(9);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','master@teste.com'),('${MASTER2}','master2@teste.com'),('${ALMOX}','almox@teste.com'),('${LEITOR}','leitor@teste.com'),('${NOVO}','Novo.Usuario@Teste.com'),('${FORA}','fora@teste.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${MASTER2}','${E}','Master Dois'),('${ALMOX}','${E}','Almoxarife'),('${LEITOR}','${E}','Leitor'),('${FORA}','${E2}','De outra empresa');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${MASTER2}','master',true),('${E}','${ALMOX}','operacional',true),('${E}','${LEITOR}','operacional',true),('${E2}','${FORA}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${ALMOX}','${E}','estoque_movimentos',true,true,false);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const listar = (u, e = E) => como(u, 'SELECT public.martins_producao_usuarios_listar($1) AS x', [e]).then(r => r.x ?? r);
  const definir = (u, alvo, itens, op = id()) => como(u, 'SELECT public.martins_producao_permissoes_definir($1,$2,$3,$4) AS x', [E, op, alvo, JSON.stringify(itens)]).then(r => r.x ?? r);
  const situacao = (u, alvo, ativo, op = id()) => como(u, 'SELECT public.martins_producao_usuario_situacao($1,$2,$3,$4) AS x', [E, op, alvo, ativo]).then(r => r.x ?? r);
  const vincular = (u, email, nome = null, op = id()) => como(u, 'SELECT public.martins_producao_usuario_vincular($1,$2,$3,$4) AS x', [E, op, email, nome]).then(r => r.x ?? r);
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const perm = (modulo, ler, criar, editar) => ({ modulo, ler, criar, editar });

  console.log('Listar');
  const l = await listar(MASTER);
  check(Array.isArray(l) && l.length === 4 && l.some(u => u.email === 'almox@teste.com' && u.permissoes.estoque_movimentos?.criar === true), 'o Master vê os 4 vínculos da empresa, com e-mail e permissões');
  check(!l.some(u => u.usuario_id === FORA), 'não aparece usuário de outra empresa');
  check((await listar(ALMOX)).erro === '42501' && (await listar(LEITOR)).erro === '42501', 'quem não é Master não lista usuários');
  check((await listar(MASTER, E2)).erro === '42501', 'Master de uma empresa não lista a outra');

  console.log('Definir permissões');
  const op1 = id(); const r1 = await definir(MASTER, LEITOR, [perm('obras', true, false, false), perm('requisicoes_material', true, true, true), perm('estoque_movimentos', true, true, false)], op1);
  check(r1.permissoes?.obras?.ler === true && r1.permissoes?.requisicoes_material?.editar === true && r1.repetida === false, 'o Master define permissões de vários módulos de uma vez');
  check((await definir(MASTER, LEITOR, [perm('obras', true, false, false), perm('requisicoes_material', true, true, true), perm('estoque_movimentos', true, true, false)], op1)).repetida === true, 'reenviar a mesma operação não duplica');
  check((await como(LEITOR, 'SELECT public.martins_producao_contexto() AS x')).x.empresas[0].permissoes.requisicoes_material.criar === true, 'a permissão vale de imediato no contexto do usuário');
  check((await salvar(LEITOR, 'requisicoes_material', id(), 0, {})).erro !== '42501', 'e libera o módulo de verdade (a gravação passa da checagem de acesso)');
  const r2 = await definir(MASTER, LEITOR, [perm('obras', false, false, false)]);
  check(r2.permissoes.obras === undefined, 'tirar tudo de um módulo remove a permissão');
  check((await definir(MASTER, LEITOR, [perm('obras', false, true, false)])).erro === '22023', 'criar sem poder ver é recusado');
  check((await definir(MASTER, LEITOR, [perm('modulo_fantasma', true, false, false)])).erro === '22023', 'módulo desconhecido é recusado');
  check((await definir(MASTER, LEITOR, [perm('obras', true, false, false), perm('obras', true, true, false)])).erro === '22023', 'módulo repetido é recusado');
  check((await definir(MASTER, LEITOR, [{ modulo: 'obras', ler: 'sim', criar: false, editar: false }])).erro === '22023', 'valor que não é verdadeiro/falso é recusado');
  check((await definir(MASTER, LEITOR, [])).erro === '22023', 'lista vazia é recusada');
  check((await definir(MASTER, MASTER2, [perm('obras', true, false, false)])).erro === '22023', 'não se configura permissão de Master (já tem acesso total)');
  check((await definir(MASTER, FORA, [perm('obras', true, false, false)])).erro === '23503', 'usuário de outra empresa é recusado');
  check((await definir(ALMOX, LEITOR, [perm('obras', true, true, true)])).erro === '42501', 'quem não é Master não consegue se promover nem promover outros');
  check((await definir(LEITOR, LEITOR, [perm('despesas', true, true, true)])).erro === '42501', 'ninguém altera a própria permissão sem ser Master');

  console.log('Ativar e desativar');
  check((await situacao(MASTER, LEITOR, false)).acesso_ativo === false, 'o Master desativa o acesso de um usuário');
  check((await como(LEITOR, 'SELECT public.martins_producao_contexto() AS x')).x.empresas.length === 0, 'usuário desativado perde as empresas do contexto');
  check((await situacao(MASTER, LEITOR, true)).acesso_ativo === true, 'e reativa depois');
  check((await situacao(MASTER, MASTER, false)).erro === '22023', 'o Master não desativa o próprio acesso');
  check((await situacao(ALMOX, LEITOR, false)).erro === '42501', 'quem não é Master não desativa ninguém');
  check((await situacao(MASTER, FORA, false)).erro === '23503', 'vínculo de outra empresa não é alterado');

  console.log('Vincular conta existente');
  const v1 = await vincular(MASTER, ' NOVO.usuario@teste.com ', 'Fulana Almoxarife');
  check(v1.usuario_id === NOVO, 'vincula pelo e-mail (sem diferenciar maiúsculas) uma conta que já existe no Auth');
  const novo = (await q(`SELECT a.papel, a.ativo, p.nome FROM public.martins_online_acessos a JOIN public.martins_perfis p ON p.usuario_id=a.usuario_id WHERE a.usuario_id=$1`, [NOVO]))[0];
  check(novo.papel === 'operacional' && novo.ativo === true && novo.nome === 'Fulana Almoxarife', 'o vínculo nasce "operacional", ativo e sem nenhuma permissão');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.permissoes WHERE usuario_id=$1`, [NOVO]))[0].n === 0, 'sem permissões até o Master definir');
  check((await vincular(MASTER, 'novo.usuario@teste.com')).erro === '23505', 'vincular de novo é recusado');
  check((await vincular(MASTER, 'naoexiste@teste.com')).erro === '23503', 'e-mail que não existe no Auth é recusado, com orientação');
  check((await vincular(MASTER, 'isso-nao-e-email')).erro === '22023', 'e-mail inválido é recusado');
  check((await vincular(ALMOX, 'fora@teste.com')).erro === '42501', 'quem não é Master não vincula');
  const vf = await vincular(MASTER, 'fora@teste.com');
  check(vf.usuario_id === FORA && (await q(`SELECT papel FROM public.martins_online_acessos WHERE usuario_id=$1 AND empresa_id=$2`, [FORA, E]))[0].papel === 'operacional', 'conta de outra empresa pode ser vinculada, sempre como operacional');
  check((await q(`SELECT count(*)::int n FROM public.martins_online_acessos WHERE papel='master' AND empresa_id=$1`, [E]))[0].n === 2, 'nenhum Master novo foi criado');
  check((await como(NOVO, 'SELECT public.martins_producao_contexto() AS x')).x.empresas[0].permissoes.obras.ler === false, 'o novo usuário entra sem acesso a nenhum módulo');

  console.log('Auditoria');
  const aud = await q(`SELECT acao, antes, depois FROM martins_producao_v1.auditoria WHERE modulo='permissoes' ORDER BY evento_id`);
  check(aud.length >= 5 && aud.some(a => a.acao === 'criar' && a.depois.vinculo === 'operacional') && aud.some(a => a.acao === 'editar' && a.antes?.permissoes && a.depois?.permissoes) && aud.some(a => a.depois?.acesso_ativo === false), 'permissões, ativação e vínculos geram trilha de auditoria (antes e depois)');

  console.log('Reversão');
  const limpo = await banco(9);
  try { await limpo.exec(sql('supabase/v9/reverter_v9.sql')); check(true, 'a reversão remove as funções'); } catch (e) { check(false, e.message); }
  check((await limpo.query(`SELECT count(*)::int n FROM pg_proc WHERE proname LIKE 'martins_producao_usuario%' OR proname='martins_producao_permissoes_definir'`)).rows[0].n === 0, 'nenhuma função da v9 sobra');
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
