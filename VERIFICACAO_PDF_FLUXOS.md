# Correções de PDF, interface e fluxos — 05/11/2026

## Implementado

- PDF do RDO gerado diretamente como arquivo, sem depender de window.print. Motor pdf-lib distribuído localmente com licença; logo oficial incorporado no arquivo e repetido em cada página. Sem carregamento de biblioteca, imagem ou fonte pela rede.
- Visualização do RDO recebe o mesmo logo incorporado. Arquivo inclui identificação, clima, atividades, equipe, equipamentos, materiais e ocorrências já registrados no RDO e fotos. Não lê registros de consumo da Gestão nem anotações internas da obra.
- Texto longo segue para páginas adicionais. Imagem que não puder ser incorporada é identificada no documento e no aviso. PNG/JPEG e WebP convertido localmente são aceitos no cliente. Símbolos fora da fonte padrão são sinalizados e representados por [?], sem alterar o cadastro original.
- A interface mantém links explícitos Baixar PDF gerado e Abrir PDF. Não abre impressão automaticamente. Os links anteriores são descartados ao abrir outro RDO.
- Proposta/orçamento também recebe arquivo PDF direto com logo. Assinaturas do Departamento Comercial e fiscal do contrato são omitidas; o aceite do cliente permanece. A impressão legada da proposta esconde o bloco genérico de assinaturas e mantém os demais documentos separados.
- Barra inferior em sete colunas equivalentes, ícone Menu com dimensão igual aos demais. Item lateral RDO e fotos renomeado para Preencher RDO, com descrição do formulário.
- Ranking de uso retirado da Frequência. Auditoria e logs preservados em seu módulo. Botão de acesso rápido Planejar e conferir ocultado; as rotas de Planejar/Conferir na barra e no menu continuam operando.
- Cliente, importação de NF-e e sucesso do orçamento fecham pelo X/Cancelar/Concluir, toque fora ou Escape, removendo também o display flex que se sobrepunha à classe hidden.
- Cadastro rápido de cliente no orçamento, Novo cliente e Editar cliente na Gestão ligados ao cadastro existente. Edição conserva ID e metadados e recusa cadastro removido, nome ambíguo ou mudança concorrente. Não renomeia documentos históricos.
- Datas exibidas como dd/mm/aaaa, com acesso ao calendário nativo. Valores internos continuam ISO, preservando comparações e dados existentes. Não há migração de datas.
- Réplica aceita destinos brasileiros ou ISO, separados por vírgulas, ponto e vírgula ou linhas. Preparação limpa resultado antigo antes de validar e apresenta retorno junto do botão. Preparar continua sem escrever frequência; destinos existentes/futuros e indisponibilidades continuam bloqueados.
- Feriados com ID independente de randomUUID disponível, retorno visível junto do botão e lista de datas/nomes/abrangência cadastrados. Não há importação automática de feriados oficiais.
- Auditoria reúne módulos encontrados no histórico e opções do sistema, usuários cadastrados e antigos. Filtros combinados por usuário/módulo/período e busca por termos ignorando acentos. Campos ausentes não interrompem a tabela. Linhas renderizadas como texto, sem interpretar HTML do log.

## Testes concluídos

30 testes automatizados aprovados, sem falhas (18 regressões anteriores, 9 testes de datas/feriados/réplica/auditoria/clientes e 3 testes de PDF). Resultado completo em scripts/RESULTADOS_CORRECOES_FLUXOS.txt.

O teste de PDF produziu um RDO de seis páginas, verificou imagens em todas elas, extraiu o texto com um segundo leitor de PDF e confirmou o marcador final, acentos, nomes e exclusão de anotação interna. A primeira página foi renderizada e inspecionada; logo e conteúdo presentes, sem corte. A proposta foi extraída e conferida: total correto, aceite do cliente, sem Departamento Comercial ou Fiscalização.

Compilação: 31 scripts da aplicação/inline e verificação adicional da biblioteca PDF local. Nenhuma alteração nos bancos reais ou no esquema Supabase.

No navegador, cenário descartável com controles do sistema e dados fictícios confirmou: data brasileira, cadastro de feriado e lista, preparação de dois destinos brasileiros, edição de cliente com atualização do seletor, abertura do cadastro rápido, fechamento de cliente, XML e Concluir e Voltar; filtros de módulos e usuários, busca sem acento e logo carregado na visualização. O arquivo PDF e seus links foram gerados no navegador. O evento de download automático não foi confirmado pela ferramenta; os links manuais de baixar/abrir permanecem disponíveis.

No sistema completo, confirmados: ranking ausente da Frequência, botão rápido oculto, rótulo Preencher RDO, 37 campos de data com apresentação brasileira, cadastro rápido presente e barra inferior em grade. A autenticação privada publicada permanece preservada; o navegador de QA não autenticou a conta do proprietário.

## Limites e pendências

Não foi realizado teste em Android/iOS físico, seleção do destino de download pelo sistema operacional, microfone, NF-e real ou fluxo completo de envio externo. Um arquivo PDF válido foi gerado e inspecionado; a conclusão do salvamento na pasta Downloads do aparelho depende do navegador e ainda requer validação nesse aparelho. Layouts de fotos e PDFs muito volumosos continuam sujeitos a ensaios de carga. Não há assinatura digital certificada.

Os cenários temporários, PDFs sintéticos e imagens de inspeção foram excluídos da publicação. A aplicação continua completa no mesmo endereço privado de homologação, com dados locais preservados e integração remota desativada. Site oficial e dados definitivos não foram alterados.
