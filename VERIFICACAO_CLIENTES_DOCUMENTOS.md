# Clientes e documentos — 06/11/2026

Recuperado formulário de cadastro/edição ausente, utilizado pelos atalhos comerciais e pela Frota. Criado fallback vazio somente quando a base padrão não está definida; nenhum cadastro persistido é substituído.

Validação de CPF e CNPJ, numérico ou alfanumérico. Normalização ignora máscara e caixa sem remover letras. CNPJ usa módulo 11, valores ASCII menos 48 e pesos da documentação da Receita: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj . Validação de dígitos não consulta inscrição ou situação cadastral.

Documento é opcional. Novos documentos inválidos são bloqueados. Documentos antigos inválidos permanecem se não forem alterados; edição apresenta pendência. Duplicidade é verificada por documento normalizado e por nome. IDs repetidos, bases inválidas e alterações simultâneas são recusados. Atualização preserva ID e campos adicionais. Propostas e vendas históricas não são reescritas.

Cadastro exige perfil comercial autorizado e sessão local correspondente. Permissão negada prevalece sobre Master. Não equivale à autenticação ou autorização remota.

Validação: 574 testes automatizados aprovados, 64 scripts compilados e auditoria sem achados no escopo verificado. Navegador local a 390/1280 pixels: criação, documento inválido, documento duplicado, edição e conflito de cadastro; revisão de captura mobile. Testes sintéticos; sem Supabase remoto ou aparelho físico.
