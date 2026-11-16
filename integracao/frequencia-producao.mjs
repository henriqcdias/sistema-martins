// Traduz um dia QA para comandos da RPC de produção. Nenhuma chamada de rede.
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const situacoes = new Set(['presente', 'falta', 'folga', 'ferias', 'atestado']);

function idValido(id) {
  return typeof id === 'string' && uuid.test(id);
}

export function prepararLoteFrequencia({ empresa, documento, registrosAtuais, novaIdentidade }) {
  const { data, apontamentos } = documento;
  if (!idValido(empresa) || !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      !Array.isArray(registrosAtuais) || !apontamentos || typeof apontamentos !== 'object' ||
      Array.isArray(apontamentos)) throw new Error('Contexto diário inválido.');

  const itens = [];
  const registrosDoLote = new Set();
  const operacoesDoLote = new Set();
  const funcionariosDoLote = new Set();
  for (const [funcionario_id, ponto] of Object.entries(apontamentos)) {
    const situacao = ponto.status === 'meio_periodo' ? 'presente' : ponto.status;
    if (!idValido(funcionario_id)) throw new Error('Vínculo sem UUID confirmado.');
    if (situacao === 'compensacao') {
      throw new Error('Compensação indisponível no contrato de produção. Preserve o rascunho.');
    }
    if (!situacoes.has(situacao)) throw new Error('Situação sem correspondência em produção.');
    if (situacao === 'folga' && ponto.folgaConfirmada !== true) {
      throw new Error('Confirme que o apontamento é Folga. O seletor QA também usa esse valor para Compensação.');
    }
    if (!Array.isArray(ponto.alocacoes) ||
        (situacao === 'presente') !== (ponto.alocacoes.length > 0)) {
      throw new Error('Alocações incompatíveis com a situação.');
    }
    const alocacoes = situacao === 'presente' ? ponto.alocacoes :
      [{ obra_id: null, minutos_normais: 0, minutos_extras: 0 }];
    const pessoa = funcionario_id.toLowerCase();
    if (funcionariosDoLote.has(pessoa)) throw new Error('Vínculo duplicado no dia.');
    funcionariosDoLote.add(pessoa);
    const anteriores = registrosAtuais.filter(row => row.dados?.funcionario_id?.toLowerCase() === pessoa);
    const obras = new Set();
    let total = 0;
    let totalAnterior = 0;
    const alteracoes = [];
    const porObra = new Map();
    for (const row of anteriores) {
      const horas = Number(row.dados.horas_normais);
      const obra = row.dados.obra_id?.toLowerCase() ?? null;
      if (row.empresa_id !== empresa || row.modulo !== 'frequencia' || row.dados.data !== data ||
          !idValido(row.id) || !Number.isSafeInteger(row.revisao) || row.revisao < 1 ||
          !Number.isFinite(horas) || horas < 0 || porObra.has(obra)) {
        throw new Error('Releitura produtiva inválida.');
      }
      porObra.set(obra, row);
      totalAnterior += horas * 60;
    }
    for (const { obra_id, minutos_normais, minutos_extras } of alocacoes) {
      const obra = obra_id?.toLowerCase() ?? null;
      if ((situacao === 'presente' && !idValido(obra_id)) || obras.has(obra)) {
        throw new Error('Obra inválida ou duplicada.');
      }
      if ([minutos_normais, minutos_extras].some(n => !Number.isSafeInteger(n) || n < 0) ||
          minutos_normais + minutos_extras > 1440) throw new Error('Minutos inválidos.');
      obras.add(obra);
      total += minutos_normais;
      const anterior = porObra.get(obra);
      const r = anterior?.id ?? novaIdentidade();
      const op = novaIdentidade();
      if (!idValido(r) || !idValido(op) || registrosDoLote.has(r.toLowerCase()) ||
          operacoesDoLote.has(op.toLowerCase())) throw new Error('UUID de gravação inválido ou duplicado.');
      registrosDoLote.add(r.toLowerCase());
      operacoesDoLote.add(op.toLowerCase());
      alteracoes.push({
        id: r.toLowerCase(),
        delta: minutos_normais - Number(anterior?.dados.horas_normais ?? 0) * 60
      });
      itens.push({ r, v: anterior?.revisao ?? 0, op, d: {
        ...anterior?.dados, funcionario_id: pessoa, data, obra_id: obra, situacao,
        horas_normais: minutos_normais / 60, horas_extras: minutos_extras / 60,
        observacao: ponto.observacao ?? ''
      } });
    }
    if ([...porObra.keys()].some(obra => !obras.has(obra))) {
      throw new Error('A alteração remove uma alocação e requer contrato de cancelamento.');
    }
    if (total > 480) throw new Error('Limite de 480 minutos normais no dia.');
    // A definição de referência da RPC aplica as alocações na ordem do UUID.
    alteracoes.sort((a, b) => a.id < b.id ? -1 : Number(a.id > b.id));
    for (const { delta } of alteracoes) {
      totalAnterior += delta;
      if (totalAnterior > 480 + 1e-8) {
        throw new Error('O lote ultrapassa 480 minutos normais na ordem de gravação da RPC.');
      }
    }
  }
  if (!itens.length || itens.length > 100) throw new Error('Lote fora do limite da RPC.');
  return { e: empresa, m: 'frequencia', itens };
}
