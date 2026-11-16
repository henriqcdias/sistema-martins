const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bundle = fs.readFileSync('dist/dist/app-martins.min.js', 'utf8');
const html = fs.readFileSync('dist/index.html', 'utf8');
const codigo = bundle.slice(bundle.indexOf('  const TIPO_FIXA_SUPREMA'), bundle.indexOf('  window.recalcularTotaisPedidoMultiEsquadrias'));
const tipologia = 'Fixa Suprema — Vidro Único';
const linha = 'Linha Suprema (Convencional)';
const pedido = {tipologia, linha, cor:'Preto Fosco (Black)', larguraMm:2550, alturaMm:1980, quantidade:2};
const elementos = Object.fromEntries([
  'inp-tipologia', 'inp-linha', 'inp-cor', 'inp-vidro', 'vidro-pendente', 'inp-largura', 'inp-altura', 'inp-qtd',
  'resultado-fixa', 'custos-genericos', 'resumo-generico', 'inserir-item'
].map(id => ['esq-' + id, {dataset:{}}]));
for (const [id, value] of Object.entries({
  tipologia, linha, cor:pedido.cor, vidro:'Vidro Incolor 4mm Comum', largura:'2550', altura:'1980', qtd:'2'
})) elementos['esq-inp-' + id].value = value;
const window = {composicoesTecnicasEsquadriasDb:[
  {tipoEsquadria:'Janela de Correr', linhaModelo:linha, corAcabamento:pedido.cor, homologada:true}
]};
vm.runInNewContext(codigo, {window, document:{getElementById:id=>elementos[id]},
  arredondar2:n=>Number(n.toFixed(2)), arredondar4:n=>Number(n.toFixed(4))});

assert.ok(html.includes('<option value="' + tipologia + '">'));
assert.equal(window.atualizarCalculadoraFixaSuprema(),true);
assert.equal(elementos['esq-inp-vidro'].value,'');
assert.equal(elementos['esq-custos-genericos'].hidden,true);
assert.equal(elementos['esq-inserir-item'].disabled,true);
assert.match(elementos['esq-resultado-fixa'].textContent,/5,049 m² por peça e 10,098 m²/);
const resultado = window.calcularItemEsquadriaDetalhado({...pedido, precoVidroM2:120, valorUnitario:900});
assert.equal(resultado.valido,false);
assert.equal(resultado.quantidadeVidros,2);
assert.equal(resultado.item,undefined);
assert.match(resultado.erro,/tipo e a espessura/);
assert.match(resultado.erro,/Cadastre uma ficha homologada/);
assert.equal(window.calcularItemEsquadriaDetalhado({...pedido, quantidade:1.5}).quantidadeVidros,null);
elementos['esq-inp-tipologia'].value = 'Janela de Correr';
assert.equal(window.atualizarCalculadoraFixaSuprema(),false);
assert.equal(elementos['esq-inp-vidro'].value,'Vidro Incolor 4mm Comum');
assert.equal(elementos['esq-inserir-item'].disabled,false);
assert.equal(window.calcularItemEsquadriaDetalhado({...pedido,tipologia:'Janela de Correr'}).valido,true);

const inicioSync = bundle.indexOf('  if (window.MartinsSupabaseSyncEngine &&', bundle.indexOf('// Aprimora MartinsSupabaseSyncEngine.persistirOperacao'));
const fimSync = bundle.indexOf('  // Auditoria completa de uso de localStorage', inicioSync);
let requisicoes = 0;
window.MartinsSupabaseSyncEngine = {persistirOperacao:()=>({
  sucesso:true, confirmadoPeloServidor:true, operacaoConcluidaNoServidor:true
})};
window.obterContextoSegurancaAutenticadoWork = () => ({uid:'qa'});
window.SUPABASE_CONECTADO_SERVIDOR_REAL = true;
window.filaSincronizacaoRemotaSupabaseDb = [];
window.executarRequisicaoPostgrestRemotaSupabase = () => requisicoes++;
vm.runInNewContext(bundle.slice(inicioSync, fimSync), {window,salvarJsonStorage:()=>{}});
const gravacao = window.MartinsSupabaseSyncEngine.persistirOperacao({
  tabela:'comercial_orcamentos',registro:{id:'ORC-QA'}
});
assert.equal(gravacao.confirmadoPeloServidor,false);
assert.equal(gravacao.confirmadoServidorRemotoReal,false);
assert.equal(gravacao.operacaoConcluidaNoServidor,false);
assert.equal(requisicoes,0);
assert.equal(window.filaSincronizacaoRemotaSupabaseDb.length,1);
