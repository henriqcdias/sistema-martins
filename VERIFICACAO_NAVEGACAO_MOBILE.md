# Navegação e cabeçalho — 06/11/2026

Corrigido fechamento dos filtros no modal de auditoria. O HTML incorreto colocava os modais seguintes e o MENU dentro da auditoria oculta. As duas entradas HTML permanecem idênticas.

MENU recebe foco, suporta Escape, contém navegação por Tab e restaura foco ao botão de origem. Cabeçalho acompanha altura variável do aviso offline, evitando sobreposição.

Validação: 563 testes automatizados aprovados; 64 scripts compilados. Teste de navegador local nas duas páginas, em 360, 390 e 1280 pixels: clique no MENU superior/inferior, navegação para Obras, Escape, restauração de foco, cabeçalho offline e abertura do orçamento. Dados fictícios, rede externa bloqueada. Revisão visual de captura em 390 pixels; sem teste em aparelho físico.

Validações de valores negativos em propostas e de saldo insuficiente em depósitos já existem e foram preservadas. Os IDs antigos modal-sucesso-orcamento e modal-importar-nfe não existem na fonte atual: a correção anterior que os referencia não comprova um fluxo XML funcional. Concluir e Voltar não aparece no formulário comercial atual, que utiliza salvar/fechar com preservação de preenchimento. Conferência desses fluxos exige acompanhar a implementação atual, sem inventar telas antigas.

Supabase remoto adiado por solicitação. Nenhuma alteração de produção, main ou dados definitivos. Exceções financeiras dependentes do servidor continuam bloqueadas.
