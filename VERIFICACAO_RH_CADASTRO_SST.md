# Homologação — cadastro de colaboradores e documentos do RH

Data: 05/11/2026. Incremento da aplicação completa de homologação, sobre a versão com depósitos e preparação de conexão Supabase. Netlify oficial, banco remoto e dados definitivos não foram alterados. Não houve migração.

## Implementado

- CPF opcional nos formulários existentes. Novos documentos ou alterações de CPF validam os dígitos verificadores e bloqueiam duplicidade, mesmo com pontuação diferente ou vinculados a colaborador inativo. CPF fornecido é armazenado sem pontuação.
- Cadastros legados não são reescritos em lote. CPF inválido que não foi alterado pode permanecer ao editar outro campo; aparece na lista de pendências. CPFs legados duplicados também são sinalizados. Isso permite corrigir o cadastro sem apagar documentos ou históricos existentes.
- Campos Apelido, Nascimento, Chave PIX e opção explícita Não possui PIX nos dois formulários. Nascimento futuro/impossível bloqueado. Marcar Não possui PIX limpa a chave ao salvar e elimina essa pendência; sem a marcação, chave vazia permanece pendente. Sem consulta bancária ou validação da titularidade do PIX.
- Botões Editar cadastro, Pendências e Vencimentos RH junto aos acessos de cadastro existentes. Busca por nome/apelido; lista de ativos com opção de incluir inativos. Pendências distinguem CPF ausente/inválido/duplicado, nascimento e PIX. Apelido também entra na busca do Quadro Geral; nome completo permanece a identificação nos registros anteriores.
- Campo Obra de Alocação Principal retirado da interface de novo cadastro. Novo colaborador recebe referência neutra Rotativo para compatibilidade; obras antigas não são apagadas e planejamento/frequência continuam responsáveis pela alocação diária.
- Trocar Senha ocultado no Quadro Geral, preservando o menu superior. Botões de cadastro se ajustam em múltiplas linhas para telas estreitas.
- Primeira remuneração exige admissão e vigência igual à admissão. Reajustes posteriores admitem vigência igual ou posterior à admissão. Alteração de admissão que contradiga vigência existente é bloqueada até conferência explícita. Histórico salarial permanece preservado; nenhuma remuneração antiga foi migrada automaticamente.
- Prontuário na ficha existente: categorias RG, CNH, ASO, NR-35, NR-18 e NR-10, além das categorias genéricas anteriores. Validade obrigatória ao anexar CNH/ASO/NR; não pode anteceder a data do documento. Documento já vencido pode ser anexado com sua data real para registro e alerta.
- Lista de documentos vencidos ou a vencer em até 30 dias, incluindo o dia do vencimento. Documentos antigos dessas categorias sem validade aparecem como pendência; documentos arquivados ficam fora dos alertas, sem perda do conteúdo.
- Horário do dia de referência e apresentação dos novos históricos de RH em Brasília. Instantes de auditoria continuam armazenados em ISO/UTC, preservando significado e precisão. A conversão global de todas as telas do sistema ainda não foi homologada.
- Salvamento segue o mecanismo recuperável existente, conferência de versão, backup anterior e preservação de IDs, recibos e vínculos. Não foi criada uma segunda base de colaboradores.

## Testado

220 testes automatizados aprovados: 202 regressões existentes e 18 novos testes deste bloco. Resultado integral em `scripts/RESULTADOS_RH_CADASTRO.txt`.

- CPF opcional, algoritmo, sequência repetida, caractere indevido, dígito incorreto, duplicidade com máscara e em inativos, edição do próprio documento e preservação de legado.
- Pendências, opção sem PIX, limites de campos, datas inválidas/futuras, preservação de recibos e vínculo antigo.
- Vigência inicial pela admissão, reajuste posterior, bloqueios de incoerência e histórico salarial.
- Brasília na virada UTC; validade obrigatória, data impossível, emissão posterior à validade; vencido, vence hoje, limite de 30/31 dias e exclusão dos arquivados.
- Documento legado sem validade preservado; novos campos e validade mantidos na serialização. Regressões de backup/restauração, quota, concorrência, arquivos, estoque, financeiro, frota, RDO e conector Supabase passaram.
- Verificação estática aprovada: 48 scripts compilados, dependências locais presentes, dados fictícios e rede principal bloqueada; acesso Supabase permanece isolado e opcional.

Navegador: formulários reais extraídos da aplicação e módulos reais em fixture descartável com usuário, armazenamento e documentos sintéticos em memória. Conferidos acesso às pendências, edição, erro de CPF sem perder preenchimento, cadastro sem CPF, apelido, nascimento, opção sem PIX, salário diário e vigência automática pela admissão; busca por apelido e redução da lista de pendências. Conferidos categorias documentais, bloqueio de ASO sem validade, revisão, confirmação, links de abrir/baixar e alerta na central de vencimentos. Fixture removida antes da publicação.

## Limites e pendências

- Não foi executado login completo da aplicação no navegador nesta rodada. O teste de interface usou sessão simulada e armazenamento em memória; não é prova do fluxo autenticado completo em produção.
- Seleção de arquivo no teste de tela foi simulada por File/DataTransfer sintético. Seletor real do Android, câmera, renderização do PDF, download físico e layout em aparelho real ainda exigem conferência. Não foram utilizados documentos pessoais reais.
- Dados e arquivos continuam locais no navegador de homologação, sem sincronização entre aparelhos. Mantidos limites anteriores de 512 KB por arquivo e 2 MiB de caracteres codificados no conjunto de documentos, além da quota efetiva do navegador. Arquivar não libera espaço.
- Os alertas são apresentados ao abrir a central/ficha; não há envio de mensagens, notificações de sistema ou monitoramento com a aplicação fechada.
- Controle de acesso continua local, com regras anteriores: cadastro básico e acesso sensível ao RH diferenciados. ACL granular e autorização de backend/RLS permanecem pendentes, sem ampliação de permissões nesta etapa.
- Categorizar documentos e informar validade não comprova autenticidade, aptidão, habilitação ou conformidade normativa. Integração de produtos EPI/uniformes, CA e recibo múltiplo do novo fluxo permanece no backlog.
- Remuneração continua referência cadastral. Cálculo de folha, horas extras monetárias, diárias por competência, vales e geração de Contas a Pagar não foram implementados neste bloco.
- Demais itens do registro consolidado seguem pendentes: organização completa da navegação, CNPJ, frota marca/modelo, transformação de materiais, conferência de recebimentos, seleção de banco, ACL, correções comerciais e calculadoras. Netlify será retomado após os módulos, conforme orientação do usuário.

## Roteiro de conferência pelo celular

1. Frequência/Quadro Geral → junto ao cadastro, abrir Pendências e selecionar um colaborador de teste.
2. Informar apelido/nascimento e marcar Não possui PIX. CPF pode ficar vazio; se preenchido, precisa ser válido e único.
3. Ao informar o primeiro salário, conferir admissão e vigência correspondente; salvar e reabrir para conferir histórico.
4. Ficha → documentos: escolher ASO/CNH/NR, informar emissão/validade e selecionar um arquivo fictício pequeno; conferir e confirmar.
5. Abrir Vencimentos RH e conferir documentos vencidos ou próximos. Não inserir dados reais no ambiente de testes.

## Arquivos deste bloco

`dist/rh_martins.js`, `dist/rh_martins_ui.js`, `dist/index.html`, `dist/rdo_digital_martins.html`, `scripts/rh.test.cjs` (fixtures de admissão ajustadas à nova regra), `scripts/rh-cadastro.test.cjs`, `scripts/RESULTADOS_RH_CADASTRO.txt` e este relatório.
