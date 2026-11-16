// Uso (na raiz do repositório):
//   npm install --no-save @electric-sql/pglite@0.2.17
//   node supabase/v2/validar-v2.cjs .
// Aplica a base, as 6 migrações de produção e a v2 num Postgres descartável (PGlite)
// e testa as regras do Manual de integração para cadastros, centros de custo e despesas.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.');
const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');

const E = '4d9b925e-732f-4055-8f52-c40373425dd5';          // Construtora (empresa da 1ª migração)
const MASTER = '11111111-1111-4111-8111-111111111111';
const LANCADOR = '22222222-2222-4222-8222-222222222222';   // Lançador Financeiro (permissão despesas: ler+criar)
const LANCADOR2 = '33333333-3333-4333-8333-333333333333';
const LEITOR = '44444444-4444-4444-8444-444444444444';     // administrador com leitura integral
const COQUINHO = '55555555-5555-4555-8555-555555555555';   // só Calhas
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };

(async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial');`);
  for (const f of fs.readdirSync(path.join(raiz, 'supabase/producao/migrations')).sort()) await db.exec(sql('supabase/producao/migrations/' + f));
  for (const f of fs.readdirSync(path.join(raiz, 'supabase/v2/migrations')).sort()) { await db.exec(sql('supabase/v2/migrations/' + f)); console.log('v2 aplicada:', f); }

  const CALHAS = (await db.query(`SELECT id FROM public.martins_empresas WHERE cnpj='60.408.057/0001-56'`)).rows[0].id;
  await db.exec(`
    INSERT INTO auth.users(id) VALUES ('${MASTER}'),('${LANCADOR}'),('${LANCADOR2}'),('${LEITOR}'),('${COQUINHO}');
    INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${LANCADOR}','${E}','Lançador'),('${LANCADOR2}','${E}','Lançador 2'),('${LEITOR}','${E}','Leitor'),('${COQUINHO}','${CALHAS}','Coquinho');
    INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo, leitura_integral) VALUES
      ('${E}','${MASTER}','master',true,false),('${E}','${LANCADOR}','operacional',true,false),('${E}','${LANCADOR2}','operacional',true,false),
      ('${E}','${LEITOR}','administrador',true,true),('${CALHAS}','${COQUINHO}','operacional',true,false);
    INSERT INTO martins_producao_v1.permissoes(usuario_id, empresa_id, modulo, ler, criar, editar) VALUES
      ('${LANCADOR}','${E}','despesas',true,true,true),('${LANCADOR2}','${E}','despesas',true,true,true),
      ('${COQUINHO}','${CALHAS}','despesas',true,true,true),('${COQUINHO}','${CALHAS}','clientes',true,true,true);`);

  async function como(uid, q, p = []) {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);
    try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); }
  }
  const salvar = (uid, m, r, v, d, emp = E, op = id()) => como(uid, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [emp, m, r, v, JSON.stringify(d), op]).then(x => x.x ?? x);
  const consultar = (uid, m, r = null, emp = E) => como(uid, 'SELECT public.martins_producao_consultar($1,$2,$3) AS x', [emp, m, r]).then(x => x.x ?? x);
  const estado = (uid, r, v, est, op = id()) => como(uid, 'SELECT public.martins_producao_despesa_estado($1,$2,$3,$4,$5,$6) AS x', [E, r, v, est, 'teste', op]).then(x => x.x ?? x);

  console.log('\nContexto e compatibilidade v1');
  const ctx = (await como(MASTER, 'SELECT public.martins_producao_contexto() AS x')).x;
  check(ctx.empresas[0].permissoes.despesas.editar === true && ctx.empresas[0].permissoes.funcionarios.ler === true, 'contexto traz permissões dos módulos v1 e v2');
  const func = id(), obra = id();
  check((await salvar(MASTER, 'funcionarios', func, 0, { nome: 'Fulano Teste', cpf: '529.982.247-25' })).revisao === 1, 'v1 continua: Master cria funcionário');
  check((await salvar(MASTER, 'obras', obra, 0, { nome: 'Obra Teste', codigo: 'OB-1' })).revisao === 1, 'v1 continua: Master cria obra');

  console.log('\nCadastros (seção 2)');
  check((await salvar(MASTER, 'clientes', id(), 0, { nome: 'Cliente A', documento: '11.222.333/0001-81' })).revisao === 1, 'cliente com CNPJ');
  check((await salvar(MASTER, 'clientes', id(), 0, { nome: 'Cliente B', documento: '11222333000181' })).erro === '23505', 'CNPJ repetido na empresa é recusado (23505)');
  check((await salvar(MASTER, 'fornecedores', id(), 0, { nome: 'Forn', documento: '123' })).erro === '22023', 'documento com tamanho inválido é recusado');
  check((await salvar(COQUINHO, 'clientes', id(), 0, { nome: 'Cliente Calhas', documento: '11222333000181' }, CALHAS)).revisao === 1, 'mesmo CNPJ em outra empresa é permitido (isolamento)');
  const mot = id();
  check((await salvar(MASTER, 'motoristas', mot, 0, { funcionario_id: func, cnh_categoria: 'D', cnh_validade: '2028-05-01' })).revisao === 1, 'motorista vinculado ao funcionário (sem duplicar a pessoa)');
  check((await salvar(MASTER, 'motoristas', id(), 0, { funcionario_id: func })).erro === '23505', 'segundo motorista para o mesmo funcionário é recusado');
  check((await salvar(MASTER, 'motoristas', id(), 0, { nome: 'Externo', cnh_categoria: null, cnh_validade: null })).revisao === 1, 'campos opcionais vazios (null) são aceitos');
  check((await salvar(MASTER, 'motoristas', id(), 0, { nome: 'Externo 2', cnh_categoria: 'Z' })).erro === '22023', 'categoria de CNH inválida é recusada');
  const cli = id();
  await salvar(MASTER, 'clientes', cli, 0, { nome: 'Cliente Limpa', documento: '529.982.247-25', telefone: '1' });
  await salvar(MASTER, 'clientes', cli, 1, { nome: 'Cliente Limpa', documento: null, telefone: null });
  const cliLido = (await consultar(MASTER, 'clientes', cli))[0];
  check(cliLido.dados.documento === undefined && cliLido.dados.telefone === null, 'edição com campo vazio limpa o valor anterior');
  check((await salvar(MASTER, 'vendedores', id(), 0, { funcionario_id: func })).revisao === 1, 'a mesma pessoa pode ser vendedor (vínculo diferente)');
  check((await salvar(MASTER, 'vendedores', id(), 0, { nome: 'V', perfil: 'Master' })).erro === '22023', 'cadastro de vendedor não concede permissão');
  check((await salvar(MASTER, 'motoristas', id(), 0, { funcionario_id: id() })).erro === '23503', 'motorista com funcionário de fora é recusado');
  check((await salvar(MASTER, 'veiculos', id(), 0, { placa: 'abc-1d23' })).revisao === 1, 'veículo com placa normalizada');
  check((await salvar(MASTER, 'veiculos', id(), 0, { placa: 'ABC1D23' })).erro === '23505', 'placa repetida é recusada');
  const dep1 = id();
  check((await salvar(MASTER, 'depositos', dep1, 0, { nome: 'Almoxarifado', principal: true })).revisao === 1, 'depósito principal');
  check((await salvar(MASTER, 'depositos', id(), 0, { nome: 'Pátio', principal: true })).erro === '23505', 'segundo depósito principal na empresa é recusado');
  check((await salvar(MASTER, 'depositos', id(), 0, { nome: 'almoxarifado ' })).erro === '23505', 'nome de depósito repetido é recusado');
  check((await salvar(MASTER, 'depositos', dep1, 1, { nome: 'Almoxarifado', principal: true, ativo: false })).erro === '22023', 'depósito principal não pode ser inativado');

  console.log('\nCentros de custo (seção 10 do briefing)');
  const ccAdm = id(), ccObra = id(), ccInativo = id();
  check((await salvar(MASTER, 'centros_custo', ccAdm, 0, { codigo: 'ADM-01', nome: 'Administrativo', tipo: 'administrativo' })).revisao === 1, 'centro administrativo');
  check((await salvar(MASTER, 'centros_custo', ccObra, 0, { codigo: 'OB-01', nome: 'Obra Teste', tipo: 'obra', obra_id: obra })).revisao === 1, 'centro de obra vinculado à obra');
  check((await salvar(MASTER, 'centros_custo', id(), 0, { codigo: 'OB-02', nome: 'X', tipo: 'obra' })).erro === '23503', 'centro de obra sem obra é recusado');
  check((await salvar(MASTER, 'centros_custo', id(), 0, { codigo: 'adm-01', nome: 'Dup', tipo: 'administrativo' })).erro === '23505', 'código de centro repetido é recusado');
  await salvar(MASTER, 'centros_custo', ccInativo, 0, { codigo: 'INA', nome: 'Inativo', tipo: 'administrativo', ativo: false });

  console.log('\nDespesas, lançador e fluxo (seção 19)');
  const base = { descricao: 'Cimento', valor_centavos: 150000, competencia: '2026-11-10', classificacao: 'administrativa', centro_custo_id: ccAdm };
  const dl = id();
  const rL = await salvar(LANCADOR, 'despesas', dl, 0, { ...base, estado: 'pago' });
  const lida = (await consultar(LANCADOR, 'despesas', dl))[0];
  check(rL.revisao === 1 && lida.dados.estado === 'pendente_conferencia', 'lançador cria; estado vira "pendente_conferencia" mesmo enviando "pago"');
  check((await salvar(LANCADOR, 'despesas', id(), 0, { ...base, centro_custo_id: undefined, centro_custo: 'Texto livre' })).erro === '22023', 'centro de custo digitado (texto livre) é recusado');
  check((await salvar(LANCADOR, 'despesas', id(), 0, { ...base, centro_custo_id: id() })).erro === '23503', 'centro de custo inexistente é recusado');
  check((await salvar(LANCADOR, 'despesas', id(), 0, { ...base, centro_custo_id: ccInativo })).erro === '22023', 'centro de custo inativo é recusado');
  check((await salvar(LANCADOR, 'despesas', id(), 0, { ...base, classificacao: 'obra' })).erro === '23503', 'despesa de obra sem obra é recusada');
  check((await salvar(LANCADOR, 'despesas', id(), 0, { ...base, classificacao: 'obra', obra_id: obra, centro_custo_id: ccObra })).revisao === 1, 'despesa de obra com obra e centro da obra');
  check((await salvar(LANCADOR, 'despesas', id(), 0, { ...base, classificacao: 'administrativa', centro_custo_id: ccObra })).erro === '22023', 'centro de obra em despesa administrativa é recusado');
  check((await salvar(LANCADOR, 'despesas', id(), 0, { ...base, confidencial: true })).erro === '42501', 'lançador não marca confidencial');
  check((await consultar(LANCADOR2, 'despesas', dl)).length === 0, 'outro lançador não vê a despesa alheia (nem por id)');
  check((await salvar(LANCADOR2, 'despesas', dl, 1, { ...base, descricao: 'x' })).erro === '42501', 'outro lançador não edita a despesa alheia');
  check((await estado(LANCADOR, dl, 1, 'aprovado')).erro === '42501', 'lançador não aprova');
  check((await estado(MASTER, dl, 1, 'pago')).erro === '22023', 'pular etapa (pendente → pago) é recusado');
  const op = id();
  const ap = await estado(MASTER, dl, 1, 'aprovado', op);
  check(ap.revisao === 2 && (await estado(MASTER, dl, 1, 'aprovado', op)).repetida === true, 'Master aprova; repetir a operação é idempotente');
  check((await salvar(LANCADOR, 'despesas', dl, 2, { ...base, valor_centavos: 1 })).erro === '22023', 'despesa aprovada não pode ter o valor alterado');
  check((await estado(MASTER, dl, 2, 'pago')).revisao === 3 && (await estado(MASTER, dl, 3, 'confirmado')).revisao === 4
    && (await estado(MASTER, dl, 4, 'conciliado')).revisao === 5, 'fluxo completo: pago → confirmado → conciliado');

  console.log('\nDespesas confidenciais (briefing, seção 4)');
  const dc = id();
  check((await salvar(MASTER, 'despesas', dc, 0, { ...base, descricao: 'Honorários sigilosos', valor_centavos: 990000, confidencial: true })).revisao === 1, 'Master cria despesa confidencial');
  check((await consultar(MASTER, 'despesas', dc)).length === 1, 'Master vê a confidencial');
  check((await consultar(LEITOR, 'despesas', dc)).length === 0, 'administrador com leitura integral NÃO vê (nem por id)');
  const listaLeitor = await consultar(LEITOR, 'despesas');
  check(listaLeitor.every(x => !x.dados.confidencial) && listaLeitor.length === 2, 'listagem do leitor traz as não confidenciais e omite a confidencial');
  check((await consultar(LANCADOR, 'despesas', dc)).length === 0, 'lançador não vê a confidencial');
  check((await salvar(LANCADOR, 'despesas', dc, 1, { ...base })).erro === '42501', 'lançador não consegue sobrescrever a confidencial');
  check((await consultar(COQUINHO, 'despesas', dc, CALHAS)).length === 0, 'usuário de outra empresa não vê');
  const tm = (await como(MASTER, 'SELECT public.martins_producao_despesas_totais($1,$2,$3) AS x', [E, '2026-11-01', '2026-11-30'])).x;
  const tl = (await como(LEITOR, 'SELECT public.martins_producao_despesas_totais($1,$2,$3) AS x', [E, '2026-11-01', '2026-11-30'])).x;
  const somaCentros = t => t.por_centro_custo.reduce((s, c) => s + Number(c.total_centavos), 0);
  check(Number(tm.total_centavos) === Number(tl.total_centavos), 'total geral é o mesmo para Master e leitor (confidencial contabilizada)');
  check(somaCentros(tm) === Number(tm.total_centavos) && tm.confidenciais_centavos === null, 'Master vê a confidencial no seu centro de custo');
  check(somaCentros(tl) + Number(tl.confidenciais_centavos) === Number(tl.total_centavos) && Number(tl.confidenciais_centavos) === 990000,
    'leitor vê a confidencial só agregada, fora dos centros de custo');
  check((await como(LANCADOR, 'SELECT public.martins_producao_despesas_totais($1,$2,$3) AS x', [E, '2026-11-01', '2026-11-30'])).erro === '42501', 'lançador não acessa os totais');
  check((await salvar(MASTER, 'despesas', dc, 1, { ...base, descricao: 'Honorários sigilosos', valor_centavos: 990000, confidencial: false })).revisao === 2, 'Master desclassifica a confidencial');
  check((await consultar(LEITOR, 'despesas', dc)).length === 1, 'depois de desclassificada, o leitor passa a ver');

  console.log('\nCatálogos de seleção');
  const cat = (await como(LANCADOR, 'SELECT public.martins_producao_catalogos($1) AS x', [E])).x;
  check(cat.centros_custo.length === 2 && !cat.centros_custo.some(c => c.codigo === 'INA'), 'lançador recebe a lista de centros ativos para selecionar');
  check(cat.depositos.length === 0 && cat.clientes.length === 0, 'catálogo não expõe módulos sem permissão');
  const aud = (await db.query(`SELECT count(*)::int AS n FROM martins_producao_v1.auditoria WHERE modulo='despesas'`)).rows[0].n;
  check(aud >= 8, 'auditoria registrou criações, edições e mudanças de estado das despesas');

  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
