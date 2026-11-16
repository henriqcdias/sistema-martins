const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const bundle = fs.readFileSync('dist/dist/app-martins.min.js', 'utf8');
const begin = bundle.lastIndexOf('(function () {', bundle.indexOf('const prefixoRascunho'));
const end = bundle.indexOf('\n})();', bundle.indexOf('window.encerrarSessaoSupabaseWork', begin)) + '\n})();'.length;
assert.ok(begin >= 0 && end > begin, 'Bloco do adapter Work deve existir');

const sessionStore = new Map();
const localStore = new Map();
const sessionStorage = {
  getItem: k => sessionStore.get(k) ?? null,
  setItem: (k, v) => sessionStore.set(k, String(v)),
  removeItem: k => sessionStore.delete(k)
};
const localStorage = {
  getItem: k => localStore.get(k) ?? null,
  setItem: (k, v) => localStore.set(k, String(v)),
  removeItem: k => localStore.delete(k)
};

const uid = '757de32b-2280-4413-80d6-aab80abcd573';
const emp1 = 'ad90f829-e6de-4739-a828-f8d8a921af63';
const emp2 = '00000000-0000-4000-8000-000000000002';
const obra1 = '00000000-0000-4000-8000-000000000010';
const obra2 = '00000000-0000-4000-8000-000000000011';
const func1 = '00000000-0000-4000-8000-000000000021';

let papelAtivo = 'administrador';
let permissoesModulo = { funcionarios: true, frequencia: true, orcamentos: true };
let falhaRedeSalvar = false;
let forcarCodigoErroRpc = null;
const bancoRegistros = new Map();
const operacoesExecutadas = new Map();

const fetch = async (url, req) => {
  const u = new URL(url);
  const path = u.pathname;
  if (path.endsWith('/token')) {
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({
        user: { id: uid, email: 'qa@example.test' },
        access_token: 'tok-v5', refresh_token: 'ref-v5', expires_in: 3600
      })
    };
  }
  if (path.endsWith('/membros')) {
    assert.equal(req.headers['Accept-Profile'], 'martins_hml_v1');
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify([
        { empresa_id: emp1, usuario_id: uid, papel: papelAtivo, ativo: true }
      ])
    };
  }
  if (path.endsWith('/rpc/permitido')) {
    assert.equal(req.headers['Content-Profile'], 'martins_hml_v1');
    const args = JSON.parse(req.body);
    const ok = args.p_empresa === emp1 && permissoesModulo[args.p_modulo] === true;
    return { ok: true, status: 200, text: async () => JSON.stringify(ok) };
  }
  if (path.endsWith('/registros')) {
    assert.equal(req.headers['Accept-Profile'], 'martins_hml_v1');
    const emp = u.searchParams.get('empresa_id')?.replace('eq.', '');
    const mod = u.searchParams.get('modulo')?.replace('eq.', '');
    const dataFiltro = u.searchParams.get('dados->>data')?.replace('eq.', '');
    let rows = [...bancoRegistros.values()].filter(r => r.empresa_id === emp && r.modulo === mod);
    if (dataFiltro) rows = rows.filter(r => r.dados?.data === dataFiltro);
    rows.sort((a, b) => (a.id < b.id ? -1 : 1));
    return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
  }
  if (path.endsWith('/rpc/salvar_registro')) {
    assert.equal(req.headers['Content-Profile'], 'martins_hml_v1');
    if (falhaRedeSalvar) {
      const err = new Error('TimeoutError');
      err.name = 'TimeoutError';
      throw err;
    }
    if (forcarCodigoErroRpc) {
      return {
        ok: false, status: 409,
        text: async () => JSON.stringify({ code: forcarCodigoErroRpc, message: 'Conflito ou duplicidade no banco' })
      };
    }
    const args = JSON.parse(req.body);
    assert.ok(args.p_operacao, 'Exige UUID p_operacao');
    if (operacoesExecutadas.has(args.p_operacao)) {
      return { ok: true, status: 200, text: async () => JSON.stringify(operacoesExecutadas.get(args.p_operacao)) };
    }
    const key = `${args.p_empresa}:${args.p_modulo}:${args.p_id}`;
    const existente = bancoRegistros.get(key);
    const versaoAtual = existente ? existente.versao : 0;
    if (args.p_versao !== versaoAtual) {
      return { ok: false, status: 409, text: async () => JSON.stringify({ code: '40001', message: 'Conflito de versão' }) };
    }
    const salvo = {
      empresa_id: args.p_empresa,
      modulo: args.p_modulo,
      id: args.p_id,
      versao: versaoAtual + 1,
      dados: args.p_dados
    };
    bancoRegistros.set(key, salvo);
    operacoesExecutadas.set(args.p_operacao, salvo);
    return { ok: true, status: 200, text: async () => JSON.stringify(salvo) };
  }
  throw new Error('Rota não mapeada: ' + path);
};

class Element {
  constructor(textContent = '', value = '') {
    this.textContent = textContent;
    this.value = value;
    this.children = [];
    this.dataset = {};
  }
  replaceChildren(...children) { this.children = children; }
  appendChild(c) { this.children.push(c); }
  append(c) { this.children.push(c); }
  prepend(c) { this.children.unshift(c); }
  add(c) { this.children.push(c); }
  setAttribute() {}
  addEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

function criarJanela() {
  const window = {
    MARTINS_SUPABASE_ENV_CONFIG: { VITE_SUPABASE_HOMOLOG_ANON_KEY: 'sb_publishable_fixture' },
    obterConfiguracaoAmbienteSupabaseV16: () => ({ supabaseUrl: 'https://oczxyiakpmgnrpoyhwov.supabase.co', credenciaisValidas: true }),
    MARTINS_MAPA_IDS_FREQUENCIA: {
      [emp1]: {
        nome: 'Construtora Martins QA',
        empresas: { 'emp-1': emp1 },
        obras: { 'OBR-UBS-NP-01': obra1, 'OBR-UEMG-04': obra2 },
        funcionarios: { 'COL-01': func1 }
      }
    }
  };
  const navigator = { locks: { request: async (_name, fn) => fn() } };
  vm.runInNewContext(bundle.slice(begin, end), {
    window, navigator, sessionStorage, localStorage,
    crypto, TextEncoder, TextDecoder, fetch, AbortSignal, URLSearchParams, Option: Element,
    structuredClone,
    document: { createElement: () => new Element(), querySelectorAll: () => [], getElementById: () => null },
    location: { origin: 'https://qa.example', hostname: 'qa.example', search: '' }
  });
  return window;
}

(async () => {
  const w = criarJanela();
  assert.equal((await w.autenticarUsuarioSupabaseWork('qa@example.test', 'SenhaQA!')).sucesso, true);

  // 1. Funcionários: criação, edição, consulta pós-F5 e bloqueio de duplicidade (23505)
  const rhCriado = await w.salvarVinculoRhWork({
    empresa: emp1,
    base: null,
    campos: {
      nome: 'Colaborador Fictício QA',
      vinculo: 'CLT',
      origem: 'esocial',
      chave_vinculo: 'CHAVE-QA-001',
      vigencia_inicio: '2026-02-01',
      vigencia_fim: ''
    }
  });
  assert.equal(rhCriado.versao, 1);

  const rhEditado = await w.salvarVinculoRhWork({
    empresa: emp1,
    base: rhCriado,
    campos: {
      nome: 'Colaborador Fictício QA Atualizado',
      vinculo: 'CLT',
      origem: 'esocial',
      chave_vinculo: 'CHAVE-QA-001',
      vigencia_inicio: '2026-02-01',
      vigencia_fim: '2026-10-31'
    }
  });
  assert.equal(rhEditado.versao, 2);

  // Simula F5 (nova janela restaurando sessão v5)
  const wPosF5Rh = criarJanela();
  assert.equal((await wPosF5Rh.restaurarSessaoQaWork()).sucesso, true);
  await wPosF5Rh.desbloquearRascunhosQaWork('SenhaQA!');
  const listaRhPosF5 = await wPosF5Rh.listarVinculosRhWork(emp1);
  assert.equal(listaRhPosF5.length, 1);
  assert.equal(listaRhPosF5[0].versao, 2);
  assert.equal(listaRhPosF5[0].dados.nome, 'Colaborador Fictício QA Atualizado');

  forcarCodigoErroRpc = '23505';
  await assert.rejects(
    wPosF5Rh.salvarVinculoRhWork({
      empresa: emp1, base: null,
      campos: { nome: 'Duplicado', vinculo: 'CLT', origem: 'esocial', chave_vinculo: 'CHAVE-QA-001', vigencia_inicio: '2026-02-01' }
    }),
    { code: '23505' }
  );
  forcarCodigoErroRpc = null;

  // 2. Frequência: limite 480 min normais, horas extras separadas, 2 obras, meio_periodo, falta, ferias, folga e F5
  const dia0 = await wPosF5Rh.carregarFrequenciaVersionadaWork('2026-11-13', emp1);
  assert.equal(dia0.versao, 0);

  const acimaLimite = await wPosF5Rh.salvarFrequenciaLoteColetivaRpcWork({
    empresa_id: emp1,
    data: '2026-11-13',
    versaoBase: 0,
    apontamentos: [{
      colaborador_id: func1,
      status: 'presente',
      observacao: 'Teste excesso',
      alocacoes: [
        { obra_id: obra1, minutos_normais: 300, minutos_extras: 0 },
        { obra_id: obra2, minutos_normais: 240, minutos_extras: 0 }
      ]
    }]
  });
  assert.equal(acimaLimite.sucesso, false);
  assert.equal(acimaLimite.statusSincronizacao, 'LIMITE_HORAS');

  const obraDuplicada = await wPosF5Rh.salvarFrequenciaLoteColetivaRpcWork({
    empresa_id: emp1,
    data: '2026-11-13',
    versaoBase: 0,
    apontamentos: [{
      colaborador_id: func1,
      status: 'presente',
      observacao: 'Mesma obra duas vezes',
      alocacoes: [
        { obra_id: obra1, minutos_normais: 240, minutos_extras: 0 },
        { obra_id: obra1, minutos_normais: 240, minutos_extras: 0 }
      ]
    }]
  });
  assert.equal(obraDuplicada.sucesso, false);
  assert.equal(obraDuplicada.statusSincronizacao, 'OBRA_DUPLICADA');

  const freqOk = await wPosF5Rh.salvarFrequenciaLoteColetivaRpcWork({
    empresa_id: emp1,
    data: '2026-11-13',
    versaoBase: 0,
    apontamentos: [{
      colaborador_id: func1,
      status: 'presente',
      observacao: 'Rateio 8h + 1h extra',
      alocacoes: [
        { obra_id: obra1, minutos_normais: 240, minutos_extras: 0 },
        { obra_id: obra2, minutos_normais: 240, minutos_extras: 60 }
      ]
    }]
  });
  assert.equal(freqOk.sucesso, true);
  assert.equal(freqOk.version, 1);

  const wPosF5Freq = criarJanela();
  assert.equal((await wPosF5Freq.restaurarSessaoQaWork()).sucesso, true);
  await wPosF5Freq.desbloquearRascunhosQaWork('SenhaQA!');
  const diaPosF5 = await wPosF5Freq.carregarFrequenciaVersionadaWork('2026-11-13', emp1);
  assert.equal(diaPosF5.versao, 1);
  assert.equal(diaPosF5.dados.apontamentos[func1].status, 'presente');
  assert.equal(diaPosF5.dados.apontamentos[func1].alocacoes.length, 2);

  const folgaComObra = await wPosF5Freq.salvarFrequenciaLoteColetivaRpcWork({
    empresa_id: emp1, data: '2026-11-13', versaoBase: 1,
    apontamentos: [{ colaborador_id: func1, status: 'folga', alocacoes: [
      { obra_id: obra1, minutos_normais: 60, minutos_extras: 0 }
    ] }]
  });
  assert.equal(folgaComObra.statusSincronizacao, 'ALOCACOES_INVALIDAS');
  for (const st of ['meio_periodo', 'falta', 'atestado', 'ferias', 'folga']) {
    const atual = await wPosF5Freq.carregarFrequenciaVersionadaWork('2026-11-13', emp1);
    const aloc = st === 'meio_periodo' ? [{ obra_id: obra1, minutos_normais: 240, minutos_extras: 0 }] : [];
    const salvo = await wPosF5Freq.salvarFrequenciaLoteColetivaRpcWork({
      empresa_id: emp1,
      data: '2026-11-13',
      versaoBase: atual.versao,
      apontamentos: [{ colaborador_id: func1, status: st, observacao: 'Status ' + st, alocacoes: aloc }]
    });
    assert.equal(salvo.sucesso, true);
    const conferido = await wPosF5Freq.carregarFrequenciaVersionadaWork('2026-11-13', emp1);
    assert.equal(conferido.dados.apontamentos[func1].status, st);
    assert.equal(conferido.dados.apontamentos[func1].alocacoes.length, st === 'meio_periodo' ? 1 : 0);
  }

  // 3. Orçamentos: falha de rede + retomada idempotente, edição, conflito 40001, duplicidade 23505 e isolamento 42501
  falhaRedeSalvar = true;
  await assert.rejects(
    wPosF5Freq.salvarOrcamentoVersionadoWork({
      empresa: emp1,
      base: null,
      campos: {
        codigo: 'ORC-SUP-001',
        cliente: 'Construtora Martins QA',
        status: 'aberto',
        vidro_codigo: 'VID-CONFIRMADO-QA',
        descricao: 'Esquadria Linha Suprema Preta Fixa 1,98m x 2,55m (Vidro Único)',
        unidade: 'pç',
        quantidade: 2,
        valor_unitario: 1989.50,
        observacao: 'Teste homologação QA'
      }
    }),
    { code: 'QA_REDE' }
  );
  falhaRedeSalvar = false;

  const orcRetomado = await wPosF5Freq.salvarOrcamentoVersionadoWork({ empresa: emp1, retomar: true });
  assert.equal(orcRetomado.versao, 1);
  assert.equal(orcRetomado.dados.valor_total, 3979.00);

  const orcEditado = await wPosF5Freq.salvarOrcamentoVersionadoWork({
    empresa: emp1,
    base: orcRetomado,
    campos: {
      codigo: 'ORC-SUP-001',
      cliente: 'Construtora Martins QA',
      status: 'fechado',
      vidro_codigo: 'VID-CONFIRMADO-QA',
      descricao: 'Esquadria Linha Suprema Preta Fixa 1,98m x 2,55m',
      unidade: 'pç',
      quantidade: 2,
      valor_unitario: 2725.88,
      observacao: 'Fechado'
    }
  });
  assert.equal(orcEditado.versao, 2);
  assert.equal(orcEditado.dados.valor_total, 5451.76);

  await assert.rejects(
    wPosF5Freq.salvarOrcamentoVersionadoWork({
      empresa: emp1,
      base: { ...orcEditado, versao: 1 },
      campos: {
        codigo: 'ORC-SUP-001',
        cliente: 'Construtora Martins QA',
        status: 'fechado',
        descricao: 'Concorrência obsoleta',
        unidade: 'pç',
        quantidade: 1,
        valor_unitario: 1000
      }
    }),
    { code: '40001' }
  );

  await assert.rejects(wPosF5Freq.listarOrcamentosVersionadosWork(emp2), { code: '42501' });
  permissoesModulo = { funcionarios: false, frequencia: true, orcamentos: false };
  await assert.rejects(wPosF5Freq.listarVinculosRhWork(emp1), { code: '42501' });
  await assert.rejects(wPosF5Freq.listarOrcamentosVersionadosWork(emp1), { code: '42501' });

  console.log('PASS: Funcionários, Frequência (todos os status + 480min + 2 obras + F5) e Orçamentos (retry idempotente, v1->v2, 40001, 23505 e 42501).');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
