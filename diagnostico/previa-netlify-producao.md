# Prévia protegida do Sistema Martins

Base: `f273791b97263de99837ec0dd0821f91c3ce0b11`. Projeto Supabase de destino: `kkjwmnxgcbonbwavaaya`. O endereço oficial permanece no deploy de reversão.

## Condições para a prévia

- Montar `dist-producao-fonte` com as telas completas da base, configuração injetada e adaptadores ligados aos contratos de produção. O build verifica a URL, a chave publicável e a ausência de arquivos e contratos de QA.
- Usar cache PWA próprio da revisão de produção. Retirar os scripts QA do precache. Conferir a navegação após atualização e após fechar/reabrir. Recursos de autenticação, API e permissões ficam fora do cache.
- Confirmar no Netlify que o destino de prévia exige acesso antes do deploy. Usar um deploy de prévia sem promover o site oficial. Depois, conferir o marcador de revisão e as origens em Network.
- Esta rodada de aceite produtivo é somente leitura. Não fazer submissões nem usar Desbloquear edição.

## Financeiro

A definição de referência documenta `public.martins_producao_salvar(e uuid, m text, r uuid, v bigint, d jsonb, op uuid) RETURNS jsonb`. Ela condiciona leitura/criação/edição à autorização por empresa e módulo, e usa revisão e UUID de operação. Módulos aceitos no contrato de referência: `funcionarios`, `obras`, `planejamento`, `rdos`, `frequencia` e `orcamentos`. A instalação da RPC foi confirmada anteriormente. Sua definição atual ainda precisa ser conferida ao vivo para este aceite.

A gravação financeira fica bloqueada. Antes de habilitá-la, localizar a estrutura financeira oficial e verificar se já existe uma RPC apropriada. Caso falte, revisar um contrato separado que valide empresa, obra, centro de custo, valores, autoria, autorização, revisão, idempotência e auditoria. Depois, integrar o formulário à confirmação e releitura no servidor. Apenas incluir o módulo na lista de permissões não completa esse contrato.

## Aceite manual

1. Em janela sem sessão Netlify, acessar a URL de prévia e confirmar a barreira.
2. Autenticar o Master ao abrir a prévia autorizada. Conferir a empresa selecionada, F5, reabertura, logout e ausência de falhas de sessão.
3. Em outro perfil de navegador, autenticar uma conta restrita já autorizada. Conferir somente as empresas permitidas e a resposta sem dados na tentativa de consultar UUID de outra empresa.
4. Abrir Funcionários, Frequência e Orçamentos nas duas sessões. Confirmar o escopo da leitura. Manter a escrita financeira bloqueada e conferir módulos ainda não homologados.
5. Antes da promoção, registrar o SHA e o ID do deploy oficial existente para reversão. A promoção depende de confirmação específica.
