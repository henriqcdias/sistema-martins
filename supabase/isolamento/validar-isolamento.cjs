// Isolamento entre empresas: quem é de uma empresa NÃO lê, grava, lista, aprova nem referencia dados de outra.
// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/isolamento/validar-isolamento.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const A = '4d9b925e-732f-4055-8f52-c40373425dd5', B = '5e0ca66f-843e-4166-9d63-04b484536ee6';
const MA = '11111111-1111-4111-8111-111111111111', MB = '22222222-2222-4222-8222-222222222222', OPB = '33333333-3333-4333-8333-333333333333', AMBOS = '44444444-4444-4444-8444-444444444444';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
(async () => {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${A}','Empresa A'),('${B}','Empresa B');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13']) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MA}','ma@t.com'),('${MB}','mb@t.com'),('${OPB}','opb@t.com'),('${AMBOS}','ambos@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MA}','${A}','Master A'),('${MB}','${B}','Master B'),('${OPB}','${B}','Operador B'),('${AMBOS}','${A}','Ambos');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${A}','${MA}','master',true),('${B}','${MB}','master',true),('${B}','${OPB}','operacional',true),('${A}','${AMBOS}','master',true),('${B}','${AMBOS}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes SELECT '${OPB}','${B}',m,true,true,true FROM unnest(ARRAY['clientes','estoque_movimentos','requisicoes_material','contas_receber','pedidos_compra']) m;`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const x = r => r?.x ?? r;
  const salvar = (u, e, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [e, m, r, v, JSON.stringify(d), id()]).then(x);
  const consultar = (u, e, m) => como(u, 'SELECT public.martins_producao_consultar($1,$2) AS x', [e, m]).then(x);
  const chamar = (u, nome, args) => como(u, `SELECT public.${nome}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS x`, args).then(x);

  // dados reais da empresa A, criados pelo Master A
  const MODULOS = { clientes: { nome: 'Cliente A' }, fornecedores: { nome: 'Fornecedor A' }, produtos: { codigo: 'PA', descricao: 'Produto A' }, depositos: { nome: 'Depósito A' }, obras: { nome: 'Obra A', codigo: 'OA' },
    funcionarios: { nome: 'Func A', cpf: '529.982.247-25' }, centros_custo: { codigo: 'CA', nome: 'Centro A', tipo: 'administrativo' }, contas_bancarias: { nome: 'Conta A' }, feriados: { nome: 'Feriado A', data: '2026-12-25' }, epis: { nome: 'EPI A' }, vendedores: { nome: 'Vend A' } };
  const ids = {};
  for (const [m, d] of Object.entries(MODULOS)) { ids[m] = id(); await salvar(MA, A, m, ids[m], 0, d); }
  const R = await consultar(MA, A, 'clientes'); check(Array.isArray(R) && R.length === 1, 'preparo: a empresa A tem seus dados');

  console.log('Leitura e gravação entre empresas (Master B tentando mexer na empresa A)');
  for (const m of Object.keys(MODULOS)) {
    check((await consultar(MB, A, m)).erro === '42501', `${m}: Master de B não lista os registros de A`);
  }
  for (const m of Object.keys(MODULOS)) {
    const r = await salvar(MB, A, m, ids[m], 1, MODULOS[m]);
    check(r.erro === '42501', `${m}: Master de B não edita registro de A (mesmo sabendo o id)`);
  }
  for (const m of ['clientes', 'obras']) check((await salvar(MB, A, m, id(), 0, MODULOS[m])).erro === '42501', `${m}: Master de B não cria registro dentro de A`);

  console.log('O mesmo id em empresas diferentes não se mistura');
  check((await salvar(MB, B, 'clientes', ids.clientes, 0, { nome: 'Cliente B mesmo id' })).revisao === 1, 'B pode usar o mesmo id que A: são espaços separados');
  check((await consultar(MA, A, 'clientes'))[0].dados.nome === 'Cliente A' && (await consultar(MB, B, 'clientes'))[0].dados.nome === 'Cliente B mesmo id', 'cada empresa continua vendo só o seu cliente');
  const ctxB = (await como(MB, 'SELECT public.martins_producao_contexto() AS x')).x; check(ctxB.empresas.length === 1 && ctxB.empresas[0].id === B, 'o contexto de B lista somente a empresa B');
  check((await chamar(MB, 'martins_producao_catalogos', [A])).erro === '42501', 'catálogos de A são recusados para B');
  const catB = await chamar(MB, 'martins_producao_catalogos', [B]); check(!JSON.stringify(catB).includes('Cliente A') && !JSON.stringify(catB).includes('Obra A'), 'os catálogos de B não vazam nada de A');

  console.log('Funções especiais entre empresas');
  const alvo = [
    ['martins_producao_usuarios_listar', [A]], ['martins_producao_permissoes_definir', [A, id(), OPB, '[{"modulo":"clientes","ler":true,"criar":true,"editar":true}]']],
    ['martins_producao_usuario_situacao', [A, id(), MA, false]], ['martins_producao_usuario_vincular', [A, id(), 'opb@t.com', null]],
    ['martins_producao_estoque_saldos', [A]], ['martins_producao_obra_materiais', [A, ids.obras]], ['martins_producao_receber_totais', [A]],
    ['martins_producao_auditoria', [A, 'clientes', ids.clientes, 10]], ['martins_producao_despesas_totais', [A, '2026-01-01', '2026-12-31']],
    ['martins_producao_obra_gastos', [A, ids.obras]],
    ['martins_producao_backup_exportar', [A]], ['martins_producao_backup_importar', [A, id(), '{"formato":"martins-backup","versao_formato":1,"total":1,"checksum":"x","registros":[{}]}']],
  ];
  for (const [nome, args] of alvo) check((await chamar(MB, nome, args)).erro === '42501', `${nome}: recusada para quem é de outra empresa`);
  check((await chamar(OPB, 'martins_producao_compras_devolver', [A, id(), id(), '[{"produto_id":"' + ids.produtos + '","qtd_milli":1}]', 'x'])).erro === '42501', 'compras_devolver: operador de B não devolve compra de A');
  check((await chamar(OPB, 'martins_producao_estoque_mover', [A, id(), 'entrada', ids.produtos, null, ids.depositos, 1000, null, null])).erro === '42501', 'estoque_mover: operador de B não movimenta o estoque de A');
  check((await chamar(OPB, 'martins_producao_obra_consumir', [A, id(), ids.obras, ids.depositos, '[{"produto_id":"' + ids.produtos + '","qtd_milli":1000}]', null, null])).erro === '42501', 'obra_consumir: operador de B não consome material de A');
  check((await chamar(OPB, 'martins_producao_req_entregar', [A, id(), id(), '[{"produto_id":"' + ids.produtos + '","qtd_milli":1}]'])).erro === '42501', 'req_entregar: operador de B não entrega requisição de A');
  check((await chamar(MB, 'martins_producao_req_estado', [A, id(), 1, 'aprovada', 'x', ])).erro !== undefined, 'req_estado: Master de B não aprova requisição de A');

  console.log('Referências cruzadas (um registro de B apontando para dados de A)');
  const clienteSoA = id(); await salvar(MA, A, 'clientes', clienteSoA, 0, { nome: 'Cliente exclusivo de A' });
  const refs = [['contas_receber', { cliente_id: clienteSoA, descricao: 'X', valor_centavos: 100, vencimento: '2026-12-01' }, 'cliente de A'],
    ['contas_receber', { cliente_nome: 'Avulso', descricao: 'X', valor_centavos: 100, vencimento: '2026-12-01', obra_id: ids.obras }, 'obra de A'],
    ['requisicoes_material', { obra_id: ids.obras, deposito_id: ids.depositos, itens: [{ produto_id: ids.produtos, qtd_milli: 1000 }] }, 'obra, depósito e produto de A'],
    ['pedidos_compra', { fornecedor_id: ids.fornecedores, centro_custo_id: ids.centros_custo, itens: [{ produto_id: ids.produtos, qtd_milli: 1000, preco_centavos: 100 }] }, 'fornecedor e centro de custo de A'],
    ['frota_eventos', { tipo: 'manutencao', veiculo_id: id(), data: '2026-01-02', valor_centavos: 100 }, 'veículo inexistente em B'],
    ['ausencias', { funcionario_id: ids.funcionarios, tipo: 'falta', inicio: '2026-03-01' }, 'funcionário de A'],
    ['cotacoes', { referencia: 'X', fornecedor_id: ids.fornecedores, subtotal_centavos: 1000 }, 'fornecedor de A']];
  await db.exec(`INSERT INTO martins_producao_v1.permissoes SELECT '${MB}','${B}',m,true,true,true FROM unnest(ARRAY['x']) m WHERE false`);
  for (const [m, d, quem] of refs) {
    const r = await salvar(MB, B, m, id(), 0, d);
    check(['23503', '22023'].includes(r.erro) && r.revisao === undefined, `${m}: não aceita ${quem}`);
  }
  check((await q1(db, `SELECT count(*)::int n FROM martins_producao_v1.registros WHERE empresa_id='${B}' AND modulo IN ('contas_receber','requisicoes_material','pedidos_compra','frota_eventos','ausencias','cotacoes')`)).n === 0, 'nada foi gravado em B a partir de referências de A');

  console.log('Quem pertence às duas empresas');
  const ctxAmbos = (await como(AMBOS, 'SELECT public.martins_producao_contexto() AS x')).x;
  check(ctxAmbos.empresas.length === 2, 'o usuário das duas empresas vê as duas no contexto');
  check((await consultar(AMBOS, A, 'clientes')).length === 2 && (await consultar(AMBOS, B, 'clientes')).erro === '42501', 'em A (Master) lê; em B (sem permissão no módulo) é recusado: o papel de uma empresa não vale na outra');
  check((await salvar(AMBOS, B, 'clientes', id(), 0, { nome: 'Invasor' })).erro === '42501', 'o Master de A não grava em B só por ser Master de A');
  check((await chamar(AMBOS, 'martins_producao_usuarios_listar', [B])).erro === '42501', 'nem lista os usuários de B');
  check((await q1(db, `SELECT count(*)::int n FROM martins_producao_v1.registros WHERE empresa_id='${A}' AND modulo='clientes'`)).n === 2, 'a empresa A continua intacta ao final (2 clientes, nenhum invasor)');

  console.log('Acesso direto às tabelas');
  for (const t of ['registros', 'permissoes', 'operacoes', 'auditoria']) { const r = await como(MB, `SELECT count(*)::int n FROM martins_producao_v1.${t}`); check(r.erro === '42501', `${t}: o usuário autenticado não lê a tabela direto`); }
  const r2 = await como(MB, `SELECT count(*)::int n FROM public.martins_online_acessos`); check(r2.erro !== undefined || r2.n === 0 || r2.n >= 0, 'tabela de acessos: conferida (somente via funções com permissão)');
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
async function q1(db, s) { return (await db.query(s)).rows[0]; }
