const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const html = readFileSync('dist/index.html', 'utf8');
const bundle = readFileSync('dist/dist/app-martins.min.js', 'utf8');
const dbSource = html.slice(html.indexOf('    function getDb('), html.indexOf('    window.getDb = getDb;'));
const viewSource = html.slice(html.indexOf('    window.classificarAcessoRdoLocalWork ='), html.indexOf('    // Atualiza renderHistorico para incluir'));
const wrapperSource = bundle.slice(bundle.indexOf('  const _origVisualizarRdo ='), bundle.indexOf('  // PARTE 3: FLUXO COMPLETO DE APROVAR'));
const empresa = '00000000-0000-4000-8000-000000000001';
const rdo = { id: 123, empresa_id: empresa, obra: 'Obra QA', data: '2026-11-13', num: '007', servicos: '<b>literal</b>', status: 'Rascunho' };
let stored = JSON.stringify([rdo, { ...rdo, id: 456, empresa_id: 'outra' }]);
let opened = false;
let writes = 0;
let alerts = 0;
const detalhe = {};
const titulo = {};
const subtitulo = {};
const imprimir = {};
const modal = { classList: { remove() { opened = true; } }, querySelector: () => null };
const document = { getElementById: id => ({
  'modal-visualizar-rdo': modal, 'vrdo-obra-titulo': titulo, 'vrdo-conteudo-detalhado': detalhe, 'vrdo-subtitulo': subtitulo, 'btn-print-from-view-rdo': imprimir
})[id] };
const context = vm.createContext({
  document, window: { obterContextoSegurancaAutenticadoWork: () => ({ empresas: [empresa], uid: 'usuario-qa', email: 'qa@example.test' }), alert: () => alerts++ },
  localStorage: { getItem: () => stored, setItem: () => writes++ },
  initialRdos: [], currentViewRdoId: null, currentShareRdoId: null, formatDate: value => value
});
vm.runInContext(dbSource + viewSource + '\nwindow.abrirModalVisualizarRdo = abrirModalVisualizarRdo;\n' + wrapperSource, context);
assert.equal(context.window.abrirModalVisualizarRdo('123').id, 123);
assert.equal(opened, true);
assert.equal(titulo.textContent, 'Obra QA');
assert.match(detalhe.innerHTML, /Rascunho/);
assert.match(detalhe.innerHTML, /&lt;b&gt;literal&lt;\/b&gt;/);
assert.equal(writes, 0);
opened = false;
assert.equal(context.window.abrirModalVisualizarRdo('456'), false);
stored = JSON.stringify([rdo, { ...rdo, id: '123' }]);
assert.equal(context.window.abrirModalVisualizarRdo('123'), false);
assert.equal(opened, false);
assert.equal(alerts, 2);

const legado = { ...rdo, empresa_id: 'emp-1', loginCriador: 'QA@example.test' };
stored = JSON.stringify([legado]);
assert.equal(context.window.abrirModalVisualizarRdo('123').id, 123);
assert.match(subtitulo.textContent, /empresa e obra pendentes/);
assert.equal(imprimir.disabled, true);
assert.equal(writes, 0);
for (const registro of [
  { ...legado, loginCriador: 'outra@example.test' },
  { ...legado, usuario_id: 'outro-usuario' },
  { ...legado, empresaId: empresa },
  { ...legado, empresa_id: '00000000-0000-4000-8000-000000000099' }
]) {
  stored = JSON.stringify([registro]);
  assert.equal(context.window.abrirModalVisualizarRdo('123'), false);
}
