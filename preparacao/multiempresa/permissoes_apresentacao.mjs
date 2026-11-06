/* Sistema Martins — avaliador de permissões para apresentação (NÃO substitui RLS).
 * Não importar no código de produção sem testes e integração revisada.
 * A decisão final de leitura/escrita é sempre do Supabase.
 */
export const PAPEIS = Object.freeze(['master', 'administrador', 'colaborador', 'consulta']);

export function acessoEmpresa({ usuarioId, empresaId, vinculos = [] }) {
  if (!usuarioId || !empresaId || !Array.isArray(vinculos)) return false;
  return vinculos.some(v =>
    v.usuario_id === usuarioId &&
    v.empresa_id === empresaId &&
    v.ativo === true &&
    PAPEIS.includes(v.papel)
  );
}

export function podeAdministrarEmpresa({ usuarioId, empresaId, vinculos = [] }) {
  if (!usuarioId || !empresaId || !Array.isArray(vinculos)) return false;
  return vinculos.some(v =>
    v.usuario_id === usuarioId &&
    v.empresa_id === empresaId &&
    v.ativo === true &&
    (v.papel === 'master' || v.papel === 'administrador')
  );
}

export function podeVerFinanceiroCompartilhado({
  usuarioId, empresaId, documentoId, vinculos = [], compartilhamentos = []
}) {
  if (!usuarioId || !empresaId || !documentoId) return false;
  if (!acessoEmpresa({ usuarioId, empresaId, vinculos })) return false;
  return Array.isArray(compartilhamentos) && compartilhamentos.some(c =>
    c.usuario_id === usuarioId &&
    c.empresa_id === empresaId &&
    c.documento_id === documentoId &&
    c.ativo === true &&
    c.permissao === 'visualizar'
  );
}
