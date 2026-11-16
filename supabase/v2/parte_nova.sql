-- ============================================================================
-- Contratos v2: cadastros, centros de custo e despesas com confidencialidade.
-- Aditivo sobre martins_producao_v1. Não altera nem remove registros existentes.
-- Regras: Manual de funções e integração (seções 2, 3, 10, 11, 12, 19, 24) e
-- briefing de 15/11/2026 (seção 4, despesas confidenciais).
-- ============================================================================

-- 1. Módulos aceitos.
ALTER TABLE martins_producao_v1.registros DROP CONSTRAINT registros_modulo_check;
ALTER TABLE martins_producao_v1.registros ADD CONSTRAINT registros_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas'));
ALTER TABLE martins_producao_v1.permissoes DROP CONSTRAINT permissoes_modulo_check;
ALTER TABLE martins_producao_v1.permissoes ADD CONSTRAINT permissoes_modulo_check CHECK (modulo IN (
 'funcionarios','obras','planejamento','rdos','frequencia','orcamentos',
 'clientes','fornecedores','vendedores','motoristas','veiculos','produtos','depositos','centros_custo','contas_bancarias','despesas'));

-- 2. Unicidade garantida pelo banco (erros 23505, já tratados pelo frontend).
CREATE UNIQUE INDEX pessoas_documento_empresa ON martins_producao_v1.registros(empresa_id, modulo, (dados->>'documento'))
 WHERE modulo IN ('clientes','fornecedores') AND dados->>'documento' IS NOT NULL;
-- Funcionário, motorista e vendedor são a mesma pessoa: um vínculo por funcionário e módulo.
CREATE UNIQUE INDEX vinculo_funcionario_empresa ON martins_producao_v1.registros(empresa_id, modulo, (dados->>'funcionario_id'))
 WHERE modulo IN ('vendedores','motoristas') AND dados->>'funcionario_id' IS NOT NULL;
CREATE UNIQUE INDEX veiculos_placa_empresa ON martins_producao_v1.registros(empresa_id, (dados->>'placa')) WHERE modulo='veiculos';
CREATE UNIQUE INDEX produtos_codigo_empresa ON martins_producao_v1.registros(empresa_id, (lower(dados->>'codigo')))
 WHERE modulo='produtos' AND NULLIF(dados->>'codigo','') IS NOT NULL;
CREATE UNIQUE INDEX depositos_nome_empresa ON martins_producao_v1.registros(empresa_id, (lower(trim(dados->>'nome')))) WHERE modulo='depositos';
CREATE UNIQUE INDEX depositos_principal_empresa ON martins_producao_v1.registros(empresa_id) WHERE modulo='depositos' AND dados->>'principal'='true';
CREATE UNIQUE INDEX centros_custo_codigo_empresa ON martins_producao_v1.registros(empresa_id, (lower(trim(dados->>'codigo')))) WHERE modulo='centros_custo';

-- 3. Referência a outro cadastro da MESMA empresa (sem copiar nomes).
CREATE FUNCTION martins_producao_v1.existe(e uuid, m text, id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT id IS NOT NULL AND EXISTS(SELECT 1 FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo=m AND x.id=existe.id)
$$;
REVOKE ALL ON FUNCTION martins_producao_v1.existe(uuid,text,uuid) FROM PUBLIC,anon,authenticated;

-- 4. Validação e normalização dos módulos v2. Chamada por martins_producao_salvar
--    depois da verificação de permissão, idempotência e revisão.
CREATE FUNCTION martins_producao_v1.preparar_v2(e uuid, m text, r uuid, v bigint, d jsonb, anterior martins_producao_v1.registros)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE master boolean := public.martins_online_master(e); doc text; ref uuid; valor numeric; centro martins_producao_v1.registros;
 estado_atual text; novo_estado text; conf boolean;
BEGIN
 -- Situação ativa/inativa: inativar substitui a exclusão nos cadastros.
 IF m <> 'despesas' THEN
  IF d ? 'ativo' AND jsonb_typeof(d->'ativo') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Situação inválida' USING ERRCODE='22023'; END IF;
  d := d || jsonb_build_object('ativo', COALESCE((d->>'ativo')::boolean, true));
 END IF;
 IF m IN ('clientes','fornecedores','depositos','centros_custo','contas_bancarias') AND NULLIF(trim(d->>'nome'),'') IS NULL THEN
  RAISE EXCEPTION 'Nome obrigatório' USING ERRCODE='22023'; END IF;

 IF m IN ('clientes','fornecedores') THEN
  doc := NULLIF(regexp_replace(COALESCE(d->>'documento',''),'[^0-9]','','g'),'');
  IF doc IS NOT NULL AND length(doc) NOT IN (11,14) THEN RAISE EXCEPTION 'CPF/CNPJ inválido' USING ERRCODE='22023'; END IF;
  d := CASE WHEN doc IS NULL THEN d - 'documento' ELSE jsonb_set(d,'{documento}',to_jsonb(doc)) END;

 ELSIF m IN ('vendedores','motoristas') THEN
  -- Cadastro funcional não concede permissão de acesso.
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k IN ('papel','perfil','permissoes','master','modulosPermitidos')) THEN
   RAISE EXCEPTION 'Cadastro de % não concede permissões; use Configurações → Usuários', m USING ERRCODE='22023'; END IF;
  ref := NULLIF(d->>'funcionario_id','')::uuid;
  IF ref IS NOT NULL AND NOT martins_producao_v1.existe(e,'funcionarios',ref) THEN RAISE EXCEPTION 'Funcionário não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF ref IS NULL AND NULLIF(trim(d->>'nome'),'') IS NULL THEN RAISE EXCEPTION 'Informe o funcionário vinculado ou o nome' USING ERRCODE='22023'; END IF;
  d := CASE WHEN ref IS NULL THEN d - 'funcionario_id' ELSE jsonb_set(d,'{funcionario_id}',to_jsonb(ref::text)) END;
  IF m='motoristas' THEN
   IF d ? 'cnh_categoria' AND COALESCE(d->>'cnh_categoria','') NOT IN ('A','B','C','D','E','AB','AC','AD','AE') THEN RAISE EXCEPTION 'Categoria de CNH inválida' USING ERRCODE='22023'; END IF;
   IF NULLIF(d->>'cnh_validade','') IS NOT NULL THEN d := jsonb_set(d,'{cnh_validade}',to_jsonb(((d->>'cnh_validade')::date)::text)); END IF;
  END IF;

 ELSIF m='veiculos' THEN
  doc := upper(regexp_replace(COALESCE(d->>'placa',''),'[^A-Za-z0-9]','','g'));
  IF doc !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN RAISE EXCEPTION 'Placa inválida' USING ERRCODE='22023'; END IF;
  d := jsonb_set(d,'{placa}',to_jsonb(doc));

 ELSIF m='produtos' THEN
  IF NULLIF(trim(COALESCE(d->>'descricao',d->>'nome')),'') IS NULL THEN RAISE EXCEPTION 'Descrição obrigatória' USING ERRCODE='22023'; END IF;

 ELSIF m='depositos' THEN
  IF d ? 'principal' AND jsonb_typeof(d->'principal') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Indicador de depósito principal inválido' USING ERRCODE='22023'; END IF;
  IF COALESCE((d->>'principal')::boolean,false) AND NOT (d->>'ativo')::boolean THEN RAISE EXCEPTION 'Depósito principal não pode ser inativado' USING ERRCODE='22023'; END IF;
  ref := NULLIF(d->>'responsavel_id','')::uuid;
  IF ref IS NOT NULL AND NOT martins_producao_v1.existe(e,'funcionarios',ref) THEN RAISE EXCEPTION 'Responsável não pertence à empresa' USING ERRCODE='23503'; END IF;

 ELSIF m='centros_custo' THEN
  IF NULLIF(trim(d->>'codigo'),'') IS NULL THEN RAISE EXCEPTION 'Código obrigatório' USING ERRCODE='22023'; END IF;
  IF COALESCE(d->>'tipo','') NOT IN ('obra','administrativo') THEN RAISE EXCEPTION 'Tipo de centro de custo inválido (obra ou administrativo)' USING ERRCODE='22023'; END IF;
  ref := NULLIF(d->>'obra_id','')::uuid;
  IF d->>'tipo'='obra' AND (ref IS NULL OR NOT martins_producao_v1.existe(e,'obras',ref)) THEN RAISE EXCEPTION 'Centro de custo de obra exige obra da empresa' USING ERRCODE='23503'; END IF;
  IF d->>'tipo'='administrativo' AND ref IS NOT NULL THEN RAISE EXCEPTION 'Centro administrativo não se vincula a obra' USING ERRCODE='22023'; END IF;

 ELSIF m='despesas' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('id','empresa_id','empresaId','descricao','valor_centavos','competencia','vencimento','parcela',
     'classificacao','obra_id','centro_custo_id','fornecedor_id','conta_bancaria_id','documento_numero','observacao','confidencial','estado')) THEN
   RAISE EXCEPTION 'Campo de despesa não reconhecido' USING ERRCODE='22023'; END IF;
  -- Confidencialidade: só o Master marca, desmarca ou toca em despesa confidencial.
  IF anterior.id IS NOT NULL AND COALESCE((anterior.dados->>'confidencial')::boolean,false) AND NOT master THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  IF d ? 'confidencial' AND jsonb_typeof(d->'confidencial') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Indicador confidencial inválido' USING ERRCODE='22023'; END IF;
  conf := COALESCE((d->>'confidencial')::boolean, (anterior.dados->>'confidencial')::boolean, false);
  IF conf AND NOT master THEN RAISE EXCEPTION 'Somente Master classifica despesa confidencial' USING ERRCODE='42501'; END IF;
  -- Estado é do servidor: o payload nunca aprova, paga ou concilia.
  estado_atual := COALESCE(anterior.dados->>'estado','pendente_conferencia');
  IF anterior.id IS NOT NULL AND NOT master AND anterior.criado_por IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  d := d || jsonb_build_object('estado', estado_atual, 'confidencial', conf);
  IF NULLIF(trim(d->>'descricao'),'') IS NULL OR length(d->>'descricao') > 1000 THEN RAISE EXCEPTION 'Descrição obrigatória' USING ERRCODE='22023'; END IF;
  IF COALESCE(d->>'valor_centavos','') !~ '^[0-9]{1,15}$' OR (d->>'valor_centavos')::numeric < 1 THEN RAISE EXCEPTION 'Valor inválido (centavos inteiros e positivos)' USING ERRCODE='22023'; END IF;
  d := jsonb_set(d,'{valor_centavos}',to_jsonb((d->>'valor_centavos')::bigint));
  IF NULLIF(d->>'competencia','') IS NULL THEN RAISE EXCEPTION 'Competência obrigatória' USING ERRCODE='22023'; END IF;
  d := jsonb_set(d,'{competencia}',to_jsonb(((d->>'competencia')::date)::text));
  IF NULLIF(d->>'vencimento','') IS NOT NULL THEN d := jsonb_set(d,'{vencimento}',to_jsonb(((d->>'vencimento')::date)::text)); END IF;
  IF COALESCE(d->>'classificacao','') NOT IN ('obra','administrativa') THEN RAISE EXCEPTION 'Classificação inválida (obra ou administrativa)' USING ERRCODE='22023'; END IF;
  ref := NULLIF(d->>'obra_id','')::uuid;
  IF d->>'classificacao'='obra' AND NOT martins_producao_v1.existe(e,'obras',ref) THEN RAISE EXCEPTION 'Despesa de obra exige obra da empresa' USING ERRCODE='23503'; END IF;
  IF d->>'classificacao'='administrativa' AND ref IS NOT NULL THEN RAISE EXCEPTION 'Despesa administrativa não se vincula a obra' USING ERRCODE='22023'; END IF;
  -- Centro de custo escolhido de cadastro existente e ativo; nunca texto livre.
  SELECT * INTO centro FROM martins_producao_v1.registros x WHERE x.empresa_id=e AND x.modulo='centros_custo' AND x.id=NULLIF(d->>'centro_custo_id','')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Centro de custo não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF NOT COALESCE((centro.dados->>'ativo')::boolean,true) THEN RAISE EXCEPTION 'Centro de custo inativo' USING ERRCODE='22023'; END IF;
  IF centro.dados->>'obra_id' IS NOT NULL AND centro.dados->>'obra_id' IS DISTINCT FROM d->>'obra_id' THEN RAISE EXCEPTION 'Centro de custo pertence a outra obra' USING ERRCODE='22023'; END IF;
  IF NULLIF(d->>'fornecedor_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'fornecedores',(d->>'fornecedor_id')::uuid) THEN RAISE EXCEPTION 'Fornecedor não pertence à empresa' USING ERRCODE='23503'; END IF;
  IF NULLIF(d->>'conta_bancaria_id','') IS NOT NULL AND NOT martins_producao_v1.existe(e,'contas_bancarias',(d->>'conta_bancaria_id')::uuid) THEN RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE='23503'; END IF;
  -- Fora de "pendente de conferência", o conteúdo financeiro fica congelado (comparado já normalizado).
  IF anterior.id IS NOT NULL AND estado_atual <> 'pendente_conferencia'
     AND (NOT master OR (d - 'confidencial' - 'estado' - 'id' - 'empresa_id' - 'empresaId') IS DISTINCT FROM (anterior.dados - 'confidencial' - 'estado' - 'id' - 'empresa_id' - 'empresaId')) THEN
   RAISE EXCEPTION 'Despesa % não pode ser editada; somente a classificação confidencial pode mudar', estado_atual USING ERRCODE='22023'; END IF;
 END IF;
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION martins_producao_v1.preparar_v2(uuid,text,uuid,bigint,jsonb,martins_producao_v1.registros) FROM PUBLIC,anon,authenticated;

-- 5. Fluxo financeiro: obrigação → aprovação → pagamento → confirmação → conciliação.
--    Somente Master. Idempotente pela mesma tabela de operações.
CREATE FUNCTION public.martins_producao_despesa_estado(e uuid, r uuid, v bigint, estado text, motivo text, op uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req jsonb; cached martins_producao_v1.operacoes; anterior martins_producao_v1.registros; novo martins_producao_v1.registros; resposta jsonb; atual text;
BEGIN
 IF NOT public.martins_online_master(e) THEN RAISE EXCEPTION 'Exclusivo do Master' USING ERRCODE='42501'; END IF;
 IF r IS NULL OR op IS NULL OR v IS NULL OR v<1 OR estado IS NULL OR NULLIF(trim(motivo),'') IS NULL OR length(motivo)>1000 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023'; END IF;
 req := jsonb_build_object('acao','despesa_estado','e',e,'r',r,'v',v,'estado',estado,'motivo',motivo);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||op::text,0));
 SELECT * INTO cached FROM martins_producao_v1.operacoes WHERE usuario_id=auth.uid() AND operacao_id=op;
 IF FOUND THEN
  IF cached.requisicao IS DISTINCT FROM req THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente' USING ERRCODE='22023'; END IF;
  RETURN cached.resposta||jsonb_build_object('repetida',true);
 END IF;
 SELECT * INTO anterior FROM martins_producao_v1.registros WHERE empresa_id=e AND modulo='despesas' AND id=r FOR UPDATE;
 IF NOT FOUND OR anterior.revisao<>v THEN RAISE EXCEPTION 'Conflito de revisão' USING ERRCODE='40001'; END IF;
 atual := COALESCE(anterior.dados->>'estado','pendente_conferencia');
 IF NOT ((atual='pendente_conferencia' AND estado IN ('aprovado','cancelado'))
      OR (atual='aprovado' AND estado IN ('pago','cancelado'))
      OR (atual='pago' AND estado='confirmado')
      OR (atual='confirmado' AND estado='conciliado')) THEN
  RAISE EXCEPTION 'Transição de % para % não permitida', atual, estado USING ERRCODE='22023'; END IF;
 UPDATE martins_producao_v1.registros SET revisao=v+1, dados=dados||jsonb_build_object('estado',estado), atualizado_por=auth.uid(), atualizado_em=now()
  WHERE empresa_id=e AND modulo='despesas' AND id=r RETURNING * INTO novo;
 INSERT INTO martins_producao_v1.auditoria(empresa_id,modulo,registro_id,usuario_id,operacao_id,acao,antes,depois)
  VALUES(e,'despesas',r,auth.uid(),op,'editar',to_jsonb(anterior),to_jsonb(novo)||jsonb_build_object('motivo',motivo));
 resposta := jsonb_build_object('empresa_id',e,'modulo','despesas','id',r,'revisao',novo.revisao,'estado',estado);
 INSERT INTO martins_producao_v1.operacoes VALUES(auth.uid(),op,req,resposta,now());
 RETURN resposta||jsonb_build_object('repetida',false);
END $$;

-- 6. Totais por centro de custo e classificação. Contabiliza as confidenciais
--    sem revelar detalhes: para quem não é Master, elas entram em uma única linha agregada.
CREATE FUNCTION public.martins_producao_despesas_totais(e uuid, de date, ate date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE master boolean := public.martins_online_master(e);
BEGIN
 IF NOT public.martins_online_leitor(e) OR martins_producao_v1.pode(e,'despesas','ler') IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 IF de IS NULL OR ate IS NULL OR ate < de OR ate - de > 3660 THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
 RETURN (WITH base AS (
   SELECT x.dados, COALESCE((x.dados->>'confidencial')::boolean,false) AS conf, (x.dados->>'valor_centavos')::bigint AS valor
   FROM martins_producao_v1.registros x
   WHERE x.empresa_id=e AND x.modulo='despesas' AND COALESCE(x.dados->>'estado','') <> 'cancelado'
     AND (x.dados->>'competencia')::date BETWEEN de AND ate)
  SELECT jsonb_build_object('empresa_id',e,'de',de,'ate',ate,
   'total_centavos', COALESCE((SELECT sum(valor) FROM base),0),
   'por_centro_custo', COALESCE((SELECT jsonb_agg(jsonb_build_object('centro_custo_id',c,'total_centavos',t) ORDER BY c)
       FROM (SELECT dados->>'centro_custo_id' c, sum(valor) t FROM base WHERE master OR NOT conf GROUP BY 1) q),'[]'::jsonb),
   'por_classificacao', COALESCE((SELECT jsonb_object_agg(k,t) FROM (SELECT dados->>'classificacao' k, sum(valor) t FROM base WHERE master OR NOT conf GROUP BY 1) q),'{}'::jsonb),
   'confidenciais_centavos', CASE WHEN master THEN NULL ELSE COALESCE((SELECT sum(valor) FROM base WHERE conf),0) END));
END $$;

REVOKE ALL ON FUNCTION public.martins_producao_despesa_estado(uuid,uuid,bigint,text,text,uuid), public.martins_producao_despesas_totais(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.martins_producao_despesa_estado(uuid,uuid,bigint,text,text,uuid), public.martins_producao_despesas_totais(uuid,date,date) TO authenticated;
