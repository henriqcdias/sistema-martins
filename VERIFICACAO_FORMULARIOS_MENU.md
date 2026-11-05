# Proteção de formulários e organização da interface
Data: 05/11/2026

Proteção de alterações não salvas nos formulários RDO, novo/edição de colaborador, Orçamentos e lançamento do Financeiro: confirmação antes de sair por navegação, fechar modal, cancelar, Escape, limpar/substituir o RDO e aviso ao sair/recarregar a página. Salvamento bem sucedido limpa a pendência; falhas mantêm o preenchimento. Alterações de itens são sinalizadas além dos campos comuns.

Não há restauração de rascunho após falha do navegador ou encerramento forçado. O aviso beforeunload depende do navegador e pode não ser exibido em encerramentos pelo sistema operacional. Este bloco protege os caminhos instrumentados; outros fechamentos programáticos ainda dependem da homologação funcional.

Menu: Obras e Planejamento/Equipes com Conferir Divergências subordinado; RH e Financeiro em grupos recolhíveis, Financeiro após RH; retirados atalhos redundantes de RDO/Frequência do grupo adicional e Trocar Senha do Quadro e do drawer, preservando o acesso superior. Os botões existentes foram movidos mantendo seus handlers, sem criar novas permissões.

Ajustes direcionados de telas: dimensionamento de campos e modais, colunas móveis, quebra de texto dos atalhos inferiores, margem inferior para a barra fixa, foco por teclado e rolagem de tabelas.

Testes do controlador: 4 aprovados, cobrindo saída cancelada, descarte seletivo, limpeza após salvar e ausência de confirmação em formulário limpo. Scripts compilados. A revisão no navegador chegou à tela de login e não homologou os fluxos internos. Menus, sobreposições e larguras de celular ainda exigem testes funcionais independentes pelo Gemini. Não foi repetida varredura manual completa.
