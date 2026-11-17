// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v7/validar-v7.cjs .
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
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(7);
  await db.exec(`INSERT INTO auth.users(id) VALUES ('${MASTER}'),('${OPER}'),('${LEITOR}');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master'),('${OPER}','${E}','Operador'),('${LEITOR}','${E}','Leitor');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${OPER}','operacional',true),('${E}','${LEITOR}','operacional',true);
   INSERT INTO martins_producao_v1.permissoes VALUES ('${OPER}','${E}','frota_eventos',true,true,true),('${OPER}','${E}','ausencias',true,true,true),('${OPER}','${E}','cotacoes',true,true,true),
    ('${LEITOR}','${E}','frota_eventos',true,false,false),('${LEITOR}','${E}','ausencias',true,false,false),('${LEITOR}','${E}','cotacoes',true,false,false);`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const salvar = (u, m, r, v, d) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [E, m, r, v, JSON.stringify(d), id()]).then(x => x.x ?? x);
  const V = id(), V2 = id(), MOT = id(), OB = id(), F = id(), F2 = id(), FO = id(), PED = id();
  await salvar(MASTER, 'veiculos', V, 0, { placa: 'ABC1D23', modelo: 'Caminhão' }); await salvar(MASTER, 'veiculos', V2, 0, { placa: 'XYZ9K88', modelo: 'Pickup' });
  await salvar(MASTER, 'motoristas', MOT, 0, { nome: 'João' }); await salvar(MASTER, 'obras', OB, 0, { nome: 'Obra 1', codigo: 'O1' });
  await salvar(MASTER, 'funcionarios', F, 0, { nome: 'Fulano Teste', cpf: '529.982.247-25' }); await salvar(MASTER, 'funcionarios', F2, 0, { nome: 'Beltrano Teste', cpf: '111.444.777-35' });
  await salvar(MASTER, 'fornecedores', FO, 0, { nome: 'Fornecedor A' });
  const hoje = (await q(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text d`))[0].d;

  console.log('Frota: abastecimento e manutenção');
  const ab = { tipo: 'abastecimento', veiculo_id: V, data: hoje, km: 12000, litros: 45.5, valor_centavos: 31850, posto: 'Posto Central', motorista_id: MOT, obra_id: OB };
  const a1 = await salvar(OPER, 'frota_eventos', id(), 0, ab);
  check(a1.revisao === 1, 'abastecimento válido é gravado');
  const lido = (await q(`SELECT dados FROM martins_producao_v1.registros WHERE modulo='frota_eventos' ORDER BY criado_em LIMIT 1`))[0].dados;
  check(lido.litros_milli === 45500 && lido.litros === undefined && lido.valor_centavos === 31850, 'litros guardados em milésimos (45,5 → 45500); dinheiro em centavos');
  check((await salvar(OPER, 'frota_eventos', id(), 0, ab)).erro === '23505', 'o mesmo abastecimento (veículo, data e km) não entra duas vezes');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 12400 })).revisao === 1, 'outro abastecimento do mesmo veículo em outro km é aceito');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13000, litros: undefined })).erro === '22023', 'abastecimento sem litros é recusado');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13001, litros: -3 })).erro === '22023', 'litros negativos são recusados');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13002, valor_centavos: 0 })).erro === '22023', 'valor zero é recusado');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13003, valor_centavos: 12.5 })).erro === '22023', 'valor com casas decimais (não centavos inteiros) é recusado');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13004, veiculo_id: id() })).erro === '23503', 'veículo de fora é recusado');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13005, obra_id: id() })).erro === '23503', 'obra de fora é recusada');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13006, data: '2999-01-01' })).erro === '22023', 'data no futuro é recusada');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...ab, km: 13007, tipo: 'lavagem' })).erro === '22023', 'tipo desconhecido é recusado');
  const man = { tipo: 'manutencao', veiculo_id: V2, data: hoje, valor_centavos: 120000, descricao: 'Troca de óleo e filtros' };
  check((await salvar(OPER, 'frota_eventos', id(), 0, man)).revisao === 1, 'manutenção (sem litros) é gravada');
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...man, km: null, litros: null, posto: null, motorista_id: null, obra_id: null })).revisao === 1, 'campos opcionais vazios (null), como a tela envia, são aceitos')
  check((await salvar(OPER, 'frota_eventos', id(), 0, { ...man, litros: 10 })).erro === '22023', 'manutenção com litros é recusada');
  check((await salvar(LEITOR, 'frota_eventos', id(), 0, man)).erro === '42501', 'quem só lê não grava evento de frota');

  console.log('Ausências e férias');
  const au = { funcionario_id: F, tipo: 'atestado_medico', inicio: '2026-03-10', fim: '2026-03-12', motivo: 'Consulta', situacao: 'confirmado' };
  const u1 = id(); check((await salvar(OPER, 'ausencias', u1, 0, { ...au, dias: 99 })).revisao === 1, 'ausência válida é gravada');
  check((await q(`SELECT (dados->>'dias')::int d FROM martins_producao_v1.registros WHERE id=$1`, [u1]))[0].d === 3, 'o servidor recalcula os dias (10 a 12 = 3), ignorando o que veio do navegador');
  check((await salvar(OPER, 'ausencias', id(), 0, { ...au, inicio: '2026-03-12', fim: '2026-03-14' })).erro === '23505', 'período que coincide com outra ausência do mesmo funcionário é recusado');
  check((await salvar(OPER, 'ausencias', id(), 0, { ...au, funcionario_id: F2 })).revisao === 1, 'o mesmo período para outro funcionário é aceito');
  check((await salvar(OPER, 'ausencias', id(), 0, { ...au, inicio: '2026-03-13', fim: '2026-03-14' })).revisao === 1, 'período seguinte, sem sobreposição, é aceito');
  check((await salvar(OPER, 'ausencias', u1, 1, { ...au, fim: '2026-03-11' })).revisao === 2, 'editar a própria ausência não conta como sobreposição');
  check((await salvar(OPER, 'ausencias', id(), 0, { ...au, inicio: '2026-04-10', fim: '2026-04-01' })).erro === '22023', 'fim antes do início é recusado');
  check((await salvar(OPER, 'ausencias', id(), 0, { ...au, inicio: '2026-05-01', fim: '2027-08-01' })).erro === '22023', 'período maior que um ano é recusado');
  check((await salvar(OPER, 'ausencias', id(), 0, { ...au, inicio: '2026-06-01', fim: '2026-06-02', funcionario_id: id() })).erro === '23503', 'funcionário de fora é recusado');
  check((await salvar(OPER, 'ausencias', id(), 0, { ...au, inicio: '2026-06-01', fim: '2026-06-02', tipo: 'viagem' })).erro === '22023', 'tipo desconhecido é recusado');
  check((await salvar(OPER, 'ausencias', id(), 0, { funcionario_id: F, tipo: 'ferias', inicio: '2026-07-01', fim: '2026-07-30', situacao: 'programado' })).revisao === 1, 'férias programadas são gravadas');
  check((await salvar(OPER, 'ausencias', id(), 0, { funcionario_id: F, tipo: 'folga', inicio: '2026-08-05' })).revisao === 1, 'sem data final, vale um dia só');
  check((await salvar(LEITOR, 'ausencias', id(), 0, { ...au, funcionario_id: F2, inicio: '2026-09-01', fim: '2026-09-01' })).erro === '42501', 'quem só lê não registra ausência');

  console.log('Propostas de cotação');
  const co = { referencia: 'Cimento CP-II · obra 1', fornecedor_id: FO, subtotal_centavos: 100000, frete_centavos: 5000, desconto_centavos: 2000, prazo_dias: 7, condicao: '28 dias' };
  const c1 = id(); check((await salvar(OPER, 'cotacoes', c1, 0, { ...co, total_centavos: 1 })).revisao === 1, 'proposta válida é gravada');
  check((await q(`SELECT (dados->>'total_centavos')::bigint t FROM martins_producao_v1.registros WHERE id=$1`, [c1]))[0].t === 103000, 'total calculado no servidor (1000 + 50 − 20 = 1030,00), ignorando o do navegador');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, fornecedor_id: undefined, fornecedor_nome: 'Fornecedor sem cadastro' })).revisao === 1, 'fornecedor informado só pelo nome é aceito');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, fornecedor_id: undefined })).erro === '22023', 'sem fornecedor (id ou nome) é recusado');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, fornecedor_id: id() })).erro === '23503', 'fornecedor de fora é recusado');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, desconto_centavos: 999999 })).erro === '23514', 'desconto maior que a proposta é recusado');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, subtotal_centavos: 0 })).erro === '22023', 'subtotal zero é recusado');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, frete_centavos: -5 })).erro === '22023', 'frete negativo é recusado');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, prazo_dias: 400 })).erro === '22023', 'prazo acima de 365 dias é recusado');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, referencia: '  ' })).erro === '22023', 'sem referência é recusado');
  check((await salvar(OPER, 'cotacoes', id(), 0, { ...co, pedido_id: id() })).erro === '23503', 'pedido de fora é recusado');
  check((await salvar(LEITOR, 'cotacoes', id(), 0, co)).erro === '42501', 'quem só lê não lança proposta');

  console.log('Leitura, auditoria e módulos anteriores');
  const lista = (await como(LEITOR, 'SELECT public.martins_producao_consultar($1,$2) AS x', [E, 'frota_eventos'])).x;
  check(Array.isArray(lista) && lista.length >= 3, 'quem tem leitura lista os eventos de frota');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE modulo IN ('frota_eventos','ausencias','cotacoes')`))[0].n >= 10, 'gravações dos módulos novos têm trilha de auditoria');
  check((await salvar(MASTER, 'feriados', id(), 0, { nome: 'Natal', data: '2026-12-25' })).revisao === 1, 'módulos da v3 continuam funcionando');
  check((await salvar(MASTER, 'pedidos_compra', id(), 0, { fornecedor_id: FO, itens: [] })).erro !== '42501', 'pedidos de compra (v5) continuam sendo processados pelo validador próprio');
  check((await salvar(MASTER, 'estoque_movimentos', id(), 0, { tipo: 'entrada' })).erro === '42501', 'estoque continua só pelas funções próprias');

  console.log('Reversão');
  const limpo = await banco(7);
  try { await limpo.exec(sql('supabase/v7/reverter_v7.sql')); check(true, 'sem dados v7, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async d => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname='martins_producao_salvar'`)).rows[0].h;
  check((await h(await banco(6))) === (await h(limpo)), 'reversão devolve a função salvar exatamente à da v5/v6');
  try { await db.exec(sql('supabase/v7/reverter_v7.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/reversão apagaria dados/.test(e.message), 'com dados v7, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
