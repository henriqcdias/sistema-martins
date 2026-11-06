import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acessoEmpresa, podeAdministrarEmpresa, podeVerFinanceiroCompartilhado
} from './permissoes_apresentacao.mjs';

const empresas = { construtora: 'construtora', calhas: 'calhas', acos: 'acos' };
const vinculos = [
  ...Object.values(empresas).map(empresa_id => ({
    usuario_id: 'henrique', empresa_id, papel: 'master', ativo: true
  })),
  { usuario_id: 'jose', empresa_id: empresas.calhas, papel: 'consulta', ativo: true },
  { usuario_id: 'inativo', empresa_id: empresas.calhas, papel: 'master', ativo: false },
  { usuario_id: 'operador', empresa_id: empresas.acos, papel: 'colaborador', ativo: true }
];
const args = (usuarioId, empresaId) => ({ usuarioId, empresaId, vinculos });

test('Master explicitamente vinculado acessa as três empresas', () => {
  for (const empresaId of Object.values(empresas)) {
    assert.equal(acessoEmpresa(args('henrique', empresaId)), true);
    assert.equal(podeAdministrarEmpresa(args('henrique', empresaId)), true);
  }
});
test('José só acessa Calhas e não administra', () => {
  assert.equal(acessoEmpresa(args('jose', empresas.calhas)), true);
  assert.equal(podeAdministrarEmpresa(args('jose', empresas.calhas)), false);
  assert.equal(acessoEmpresa(args('jose', empresas.construtora)), false);
  assert.equal(acessoEmpresa(args('jose', empresas.acos)), false);
});
test('Conta inativa, vínculo inexistente e dados ausentes negam acesso', () => {
  assert.equal(acessoEmpresa(args('inativo', empresas.calhas)), false);
  assert.equal(acessoEmpresa(args('desconhecido', empresas.calhas)), false);
  assert.equal(acessoEmpresa({ usuarioId: 'jose', empresaId: empresas.calhas }), false);
  assert.equal(acessoEmpresa({ usuarioId: 'jose', empresaId: empresas.calhas, vinculos: null }), false);
  assert.equal(podeAdministrarEmpresa(args('operador', empresas.acos)), false);
});
test('Financeiro exige compartilhamento explícito do documento e empresa', () => {
  const compartilhamentos = [{
    usuario_id: 'jose', empresa_id: empresas.calhas, documento_id: 'doc1',
    permissao: 'visualizar', ativo: true
  }];
  const base = { ...args('jose', empresas.calhas), compartilhamentos };
  assert.equal(podeVerFinanceiroCompartilhado({ ...base, documentoId: 'doc1' }), true);
  assert.equal(podeVerFinanceiroCompartilhado({ ...base, documentoId: 'doc2' }), false);
  assert.equal(podeVerFinanceiroCompartilhado({
    ...base, empresaId: empresas.acos, documentoId: 'doc1'
  }), false);
  assert.equal(podeVerFinanceiroCompartilhado({
    ...base, documentoId: 'doc1', compartilhamentos: [{...compartilhamentos[0], ativo: false}]
  }), false);
});
test('Papel arbitrário não concede acesso', () => {
  assert.equal(acessoEmpresa({
    usuarioId: 'x', empresaId: empresas.calhas,
    vinculos: [{ usuario_id: 'x', empresa_id: empresas.calhas, papel: 'superadmin', ativo: true }]
  }), false);
});
