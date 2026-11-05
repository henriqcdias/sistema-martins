const test=require('node:test'),a=require('node:assert/strict'),{Guard}=require('../dist/formularios_martins');
test('cancelar saída mantém todos os preenchimentos pendentes',()=>{const g=new Guard;g.dirty('RDO');g.dirty('RH');a.equal(g.leave(['RDO','RH'],()=>false),false);a.equal(g.has('RDO'),true);a.equal(g.has('RH'),true);});
test('descartar afeta apenas o formulário confirmado',()=>{const g=new Guard;g.dirty('Orçamento');g.dirty('RH');a.equal(g.leave(['Orçamento'],()=>true),true);a.equal(g.has('Orçamento'),false);a.equal(g.has('RH'),true);});
test('salvamento bem sucedido limpa somente a pendência correspondente',()=>{const g=new Guard;g.dirty('Financeiro');g.dirty('RDO');g.clean('Financeiro');a.equal(g.has('RDO'),true);a.equal(g.has('Financeiro'),false);});
test('formulário sem alterações não pede confirmação',()=>{const g=new Guard;a.equal(g.leave(['RDO'],()=>{throw Error('Não deveria perguntar')}),true);});
