# Aprovação e reabertura de RDO

Etapa anterior confirmada no GitHub: bea1ae62c8e03ab36079b7bba01b4bb4be2b0409.

## Correções
- Perfis inativos não podem reabrir RDO, incluindo Master e Engenharia.
- Negação explícita de reabrirRdo prevalece sobre aprovação previamente concedida.
- Negação explícita de aprovarRdo prevalece sobre perfil Master e CREA ativo.
- Aprovação e reabertura permanecem permissões independentes; aprovação técnica continua exigindo a habilitação já usada no sistema.
- Histórico, conteúdo dos RDOs e mecanismo de datas não foram alterados.

## Validação
387 testes aprovados: 383 anteriores e 4 novos testes de autorização.
62 scripts compilados. Auditoria de publicação sem achados no escopo examinado.
A etapa altera regras compartilhadas, não cria telas novas. O painel da etapa anterior foi inspecionado em larguras de computador e celular em fixture isolada. O fluxo completo de aprovação/reabertura com contas reais e teste físico continua pendente.

## Limites
Esta é uma proteção do código cliente/local. Não equivale à validação de RLS ou autorização no servidor.
Não houve conexão ao Supabase, mudança de usuário real, revogação de chave ou migração.
Navegadores com senhas legadas persistidas ainda precisam de troca dessas senhas no respectivo ambiente; a fonte não contém senha padrão.

## Próxima prioridade
Revisar os fluxos de Frequência, ausência e horas normais/extraordinárias sem presumir parâmetros trabalhistas ainda não definidos. A sincronização entre dispositivos depende de inventário do esquema e testes de autenticação/RLS em ambiente próprio de homologação.
Main, Netlify oficial e dados definitivos preservados.
