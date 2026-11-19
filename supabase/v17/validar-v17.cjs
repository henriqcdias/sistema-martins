// Uso: npm install --no-save @electric-sql/pglite@0.2.17 && node supabase/v17/validar-v17.cjs .
const { PGlite } = require('@electric-sql/pglite'); const fs = require('node:fs'); const path = require('node:path');
const raiz = path.resolve(process.argv[2] || '.'); const sql = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const E = '4d9b925e-732f-4055-8f52-c40373425dd5', E2 = '9d9b925e-732f-4055-8f52-c40373425dd9', MASTER = '11111111-1111-4111-8111-111111111111', ENG = '22222222-2222-4222-8222-222222222222', SEM = '55555555-5555-4555-8555-555555555555', ALMOX = '66666666-6666-4666-8666-666666666666', FORA = '77777777-7777-4777-8777-777777777777';
let n = 0; const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; let ok = 0, falhas = 0;
const check = (c, m) => { c ? ok++ : falhas++; console.log(c ? '  ok   ' : '  FALHA', m); };
async function banco(ate) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await db.exec(sql('supabase/producao/base/estrutura_anterior_as_migracoes.sql'));
  await db.exec(`INSERT INTO public.martins_empresas(id, razao_social) VALUES ('${E}', 'Construtora Martins - cadastro inicial'),('${E2}','Outra empresa');`);
  for (const d of ['producao', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15', 'v16', 'v17'].slice(0, ate)) for (const f of fs.readdirSync(path.join(raiz, `supabase/${d}/migrations`)).sort()) await db.exec(sql(`supabase/${d}/migrations/${f}`));
  return db;
}
(async () => {
  const db = await banco(17);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${MASTER}','m@t.com'),('${ENG}','e@t.com'),('${SEM}','s@t.com'),('${ALMOX}','a@t.com'),('${FORA}','f@t.com');
   INSERT INTO public.martins_perfis(usuario_id, empresa_id, nome) VALUES ('${MASTER}','${E}','Master Silva'),('${ENG}','${E}','Eng Souza'),('${SEM}','${E}','Sem Acesso'),('${ALMOX}','${E}','Almox Lima'),('${FORA}','${E2}','Gente de Fora');
   INSERT INTO public.martins_online_acessos(empresa_id, usuario_id, papel, ativo) VALUES ('${E}','${MASTER}','master',true),('${E}','${ENG}','operacional',true),('${E}','${SEM}','operacional',true),('${E}','${ALMOX}','operacional',true),('${E2}','${FORA}','master',true);
   INSERT INTO martins_producao_v1.permissoes SELECT '${ENG}','${E}',m,true,true,true FROM unnest(ARRAY['rdos','obras','funcionarios']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${SEM}','${E}',m,true,false,false FROM unnest(ARRAY['rdos','obras','epi_entregas']) m;
   INSERT INTO martins_producao_v1.permissoes SELECT '${ALMOX}','${E}',m,true,true,true FROM unnest(ARRAY['epi_entregas','epis','funcionarios']) m;`);
  async function como(uid, q, p = []) { await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`); try { return (await db.query(q, p)).rows[0]; } catch (e) { return { erro: e.code, msg: e.message }; } finally { await db.exec('RESET ROLE'); } }
  const q = async (s, p = []) => (await db.query(s, p)).rows; const x = r => r?.x ?? r;
  const salvar = (u, m, r, v, d, emp = E) => como(u, 'SELECT public.martins_producao_salvar($1,$2,$3,$4,$5,$6) AS x', [emp, m, r, v, JSON.stringify(d), id()]).then(x);
  const lido = async r => (await q(`SELECT revisao, dados FROM martins_producao_v1.registros WHERE id=$1`, [r]))[0];
  const hoje = (await q(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text d`))[0].d;

  console.log('Responsável técnico da obra: só funcionário com CREA');
  const F_ENG = id(), F_SEMCREA = id(), OBRA = id(), OBRA2 = id();
  await salvar(MASTER, 'funcionarios', F_ENG, 0, { nome: 'Taiane Engenheira', funcao: 'Engenheira', crea: 'MG-218450/D', status: 'Ativo', cpf: '529.982.247-25' });
  await salvar(MASTER, 'funcionarios', F_SEMCREA, 0, { nome: 'João Pedreiro', funcao: 'Pedreiro', status: 'Ativo', cpf: '111.444.777-35' });
  check((await salvar(MASTER, 'obras', OBRA, 0, { nome: 'Obra A', codigo: 'A', status: 'Em andamento', responsavel_tecnico_id: F_SEMCREA })).erro === '22023', 'funcionário sem CREA não pode ser responsável técnico da obra');
  check((await salvar(MASTER, 'obras', OBRA, 0, { nome: 'Obra A', codigo: 'A', status: 'Em andamento', responsavel_tecnico_id: id() })).erro === '22023', 'funcionário inexistente também é recusado');
  const ro = await salvar(MASTER, 'obras', OBRA, 0, { nome: 'Obra A', codigo: 'A', status: 'Em andamento', responsavelTecnico: 'Nome Digitado Errado', responsavel_tecnico_id: F_ENG });
  const ob = (await lido(OBRA)).dados;
  check(ro.revisao === 1 && ob.responsavelTecnico === 'Taiane Engenheira', 'com CREA, a obra grava o responsável e o nome vem do cadastro do funcionário (não do texto digitado)');
  const vis = await como(ENG, `SELECT public.martins_producao_consultar($1,'obras',$2) AS x`, [E, OBRA]).then(x);
  check(vis[0].dados.responsavel_tecnico_id === F_ENG, 'quem não é Master também enxerga o responsável técnico escolhido');
  await salvar(MASTER, 'obras', OBRA2, 0, { nome: 'Obra sem RT', codigo: 'B', status: 'Em andamento' });

  console.log('RDO: aprovar (encerrar) e reabrir pelo servidor');
  const R1 = id(), R2 = id(), R3 = id();
  const rd = (obra, num) => ({ obra_id: obra, data: hoje, numero: num, status: 'rascunho', responsavel: 'x', servicos: '• Concretagem', trabalhadores: [] });
  await salvar(ENG, 'rdos', R1, 0, rd(OBRA, null)); await salvar(ENG, 'rdos', R2, 0, rd(OBRA2, null)); await salvar(ENG, 'rdos', R3, 0, { ...rd(OBRA, null), servicos: '' });
  const est = (u, r, v, estado, motivo = null, op = id()) => como(u, 'SELECT public.martins_producao_rdo_estado($1,$2,$3,$4,$5,$6) AS x', [E, op, r, v, estado, motivo]).then(x);
  check((await est(ENG, R2, 1, 'aprovado')).erro === '22023' && /responsável técnico/.test((await est(ENG, R2, 1, 'aprovado')).msg), 'obra sem responsável técnico: o RDO não é aprovado e a mensagem diz o que fazer');
  check((await est(ENG, R3, 1, 'aprovado')).erro === '22023', 'RDO sem serviços não é aprovado');
  check((await est(SEM, R1, 1, 'aprovado')).erro === '42501', 'quem só pode ler RDO não aprova');
  check((await est(ENG, R1, 9, 'aprovado')).erro === '40001', 'revisão antiga é recusada');
  const op1 = id(); const ap = await est(ENG, R1, 1, 'aprovado', null, op1);
  const rr = (await lido(R1)).dados;
  check(ap.status === 'aprovado' && rr.status === 'aprovado' && rr.aprovado_por_nome === 'Eng Souza' && rr.rt_nome === 'Taiane Engenheira' && rr.rt_crea === 'MG-218450/D' && rr.responsavel === 'Taiane Engenheira' && rr.aprovado_em, 'aprovado: guarda quem aprovou, quando, e o responsável técnico com CREA no momento');
  check((await est(ENG, R1, 1, 'aprovado', null, op1)).repetida === true, 'reenviar a mesma operação não aprova duas vezes');
  check((await est(ENG, R1, 2, 'aprovado')).erro === '22023', 'RDO já aprovado não é aprovado de novo');
  check((await salvar(ENG, 'rdos', R1, 2, { ...rd(OBRA, 1), servicos: 'mudei' })).erro === '22023', 'RDO aprovado não pode ser editado pelo cadastro');
  check((await est(ENG, R1, 2, 'rascunho')).erro === '22023', 'reabrir exige motivo');
  const rb = await est(ENG, R1, 2, 'rascunho', 'faltou incluir a equipe');
  const rr2 = (await lido(R1)).dados;
  check(rb.status === 'rascunho' && rr2.status === 'rascunho' && rr2.aprovado_por === undefined && rr2.historicoStatus.length === 2 && rr2.historicoStatus[1].motivo === 'faltou incluir a equipe', 'reaberto: volta a rascunho, some a aprovação e o histórico guarda aprovação e reabertura com o motivo');
  const ed = await salvar(ENG, 'rdos', R1, 3, { ...rd(OBRA, 1), servicos: '• Concretagem\n• Armação', aprovado_por: MASTER, status: 'rascunho', rt_crea: 'FALSO' });
  const rr3 = (await lido(R1)).dados;
  check(ed.revisao === 4 && rr3.servicos.includes('Armação') && rr3.aprovado_por === undefined && rr3.rt_crea === undefined && rr3.historicoStatus.length === 2, 'depois de reaberto, edita normalmente; campos de aprovação enviados pelo navegador são descartados e o histórico é preservado');
  check((await est(ENG, R1, 4, 'aprovado')).status === 'aprovado', 'pode ser aprovado de novo depois de ajustado');
  check((await q(`SELECT count(*)::int n FROM martins_producao_v1.auditoria WHERE registro_id=$1`, [R1]))[0].n >= 5, 'cada passo ficou na auditoria');

  console.log('EPI: um recibo com vários itens');
  const EP1 = id(), EP2 = id(), EP3 = id(); await salvar(MASTER, 'epis', EP1, 0, { codigo: 'CAP', nome: 'Capacete', tamanho: 'U', estoque_minimo: 5 }); await salvar(MASTER, 'epis', EP2, 0, { codigo: 'BOT', nome: 'Bota', tamanho: '42', estoque_minimo: 5 }); await salvar(MASTER, 'epis', EP3, 0, { codigo: 'LUV', nome: 'Luva', tamanho: 'M', estoque_minimo: 5 });
  const rec = (itens, extra = {}) => ({ funcionario_id: F_ENG, data: hoje, itens, motivo: 'Admissão', ...extra });
  const REC1 = id(); const r1 = await salvar(ALMOX, 'epi_entregas', REC1, 0, rec([{ epi_id: EP1, qtd: 1 }, { epi_id: EP2, qtd: 1, tamanho: '42' }, { epi_id: EP3, qtd: 2, tamanho: 'M' }]));
  const d1 = (await lido(REC1)).dados;
  check(r1.revisao === 1 && d1.numero === 1 && d1.itens.length === 3 && d1.itens[0].descricao === 'Capacete' && d1.itens[2].qtd === 2 && d1.estado === 'entregue', 'um recibo, três itens, número 1 definido pelo servidor, com a descrição do EPI gravada');
  const REC2 = id(); await salvar(ALMOX, 'epi_entregas', REC2, 0, rec([{ epi_id: EP1, qtd: 1 }]));
  check((await lido(REC2)).dados.numero === 2, 'o segundo recibo é o número 2');
  const e1 = await salvar(ALMOX, 'epi_entregas', REC1, 1, rec([{ epi_id: EP1, qtd: 1 }, { epi_id: EP2, qtd: 1, tamanho: '42' }, { epi_id: EP3, qtd: 3, tamanho: 'M' }], { numero: 99 }));
  const d1b = (await lido(REC1)).dados;
  check(e1.revisao === 2 && d1b.numero === 1 && d1b.itens[2].qtd === 3, 'alterar o recibo (quantidade) mantém o número; número enviado pelo navegador é ignorado');
  check((await salvar(ALMOX, 'epi_entregas', id(), 0, rec([{ epi_id: EP1, qtd: 1 }, { epi_id: EP1, qtd: 2 }]))).erro === '22023', 'o mesmo EPI duas vezes no recibo é recusado (some as quantidades)');
  check((await salvar(ALMOX, 'epi_entregas', id(), 0, rec([{ epi_id: EP1, qtd: 0 }]))).erro === '22023' && (await salvar(ALMOX, 'epi_entregas', id(), 0, rec([]))).erro === '22023', 'quantidade zero e recibo sem itens são recusados');
  check((await salvar(ALMOX, 'epi_entregas', id(), 0, rec([{ epi_id: id(), qtd: 1 }]))).erro === '23503', 'EPI de outra empresa/inexistente é recusado');
  check((await salvar(ALMOX, 'epi_entregas', id(), 0, rec([{ epi_id: EP1, qtd: 1 }], { data: '2099-01-01' }))).erro === '22023', 'data futura é recusada');
  check((await salvar(ALMOX, 'epi_entregas', id(), 0, rec([{ epi_id: EP1, qtd: 1 }], { funcionario_id: id() }))).erro === '23503', 'funcionário inexistente é recusado');
  check((await salvar(ALMOX, 'epi_entregas', id(), 0, rec([{ epi_id: EP1, qtd: 1 }], { campo_estranho: 1 }))).erro === '22023', 'campo desconhecido é recusado');
  check((await salvar(ALMOX, 'epi_entregas', REC1, 2, rec([{ epi_id: EP1, qtd: 1 }], { funcionario_id: F_SEMCREA }))).erro === '22023', 'o funcionário de um recibo não pode ser trocado');
  check((await salvar(SEM, 'epi_entregas', id(), 0, rec([{ epi_id: EP1, qtd: 1 }]))).erro === '42501', 'quem só lê o módulo não cria recibo');
  await salvar(ALMOX, 'epi_entregas', REC2, 1, rec([{ epi_id: EP1, qtd: 1 }], { estado: 'cancelado' }));
  check((await lido(REC2)).dados.estado === 'cancelado' && (await salvar(ALMOX, 'epi_entregas', REC2, 2, rec([{ epi_id: EP1, qtd: 5 }]))).erro === '22023', 'recibo cancelado fica registrado e não é mais editado');

  console.log('Nomes de quem alterou');
  const nm = await como(ENG, 'SELECT public.martins_producao_nomes($1,$2) AS x', [E, [MASTER, ENG, FORA]]).then(x);
  check(nm[MASTER] === 'Master Silva' && nm[ENG] === 'Eng Souza' && nm[FORA] === undefined, 'devolve o nome dos usuários da empresa e não vaza usuário de outra empresa');
  check((await como(FORA, 'SELECT public.martins_producao_nomes($1,$2) AS x', [E, [MASTER]])).erro === '42501', 'quem não é da empresa não consulta nomes');

  console.log('Reversão');
  const limpo = await banco(17); try { await limpo.exec(sql('supabase/v17/reverter_v17.sql')); check(true, 'sem recibos de EPI, a reversão funciona'); } catch (e) { check(false, e.message); }
  const h = async (d, nome) => (await d.query(`SELECT md5(prosrc) h FROM pg_proc WHERE proname=$1 ORDER BY pronargs DESC LIMIT 1`, [nome])).rows[0].h;
  const v16 = await banco(16);
  check((await h(v16, 'martins_producao_salvar')) === (await h(limpo, 'martins_producao_salvar')) && (await h(v16, 'projetar')) === (await h(limpo, 'projetar')) && (await h(v16, 'martins_producao_contexto')) === (await h(limpo, 'martins_producao_contexto')), 'a reversão devolve salvar, projetar e contexto às versões anteriores');
  try { await db.exec(sql('supabase/v17/reverter_v17.sql')); check(false, 'deveria bloquear'); } catch (e) { check(/Reversão bloqueada/.test(e.message), 'com recibos de EPI, a reversão é bloqueada'); }
  console.log(`\n${ok} ok, ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
