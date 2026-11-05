# Etapa de correção de datas do RDO
Data: 05/11/2026

## Implementado e corrigido
- Data civil calculada explicitamente em America/Sao_Paulo, independente do fuso do dispositivo.
- Bloqueio de criação e edição com data futura, tanto em rascunho quanto aprovado.
- Bloqueio de aprovação direta, por cartão e pelo portal; o portal também valida a data declarada de aprovação.
- Proteção antes da gravação conjunta de RDO/Frequência e ao concluir uma recuperação interrompida. Reversão continua disponível.
- Campo de data inicializado em Brasília, com limite atualizado ao receber foco; carimbo do fluxo consolidado usa o mesmo fuso.
- RDO futuro legado permanece preservado quando inalterado; é possível corrigir sua data para hoje ou passado.

## Validação
- node --test scripts/*.test.cjs: 317 aprovados, zero falhas (306 anteriores e 11 novos).
- node scripts/check-static.cjs: 52 scripts compilados e dependências verificadas.
- Novos testes: virada 02:59:59.999/03:00 UTC, data inválida, hoje/passado/futuro, rascunho/aprovado, legado, nenhuma escrita parcial e recuperação/reversão.
- Não foi repetida varredura manual completa. Testes funcionais independentes e verificação em aparelho físico ficam com a homologação externa.
- A proteção desta etapa é local. Validação equivalente no backend ainda depende da integração real com Supabase; relógio do dispositivo não é fonte confiável de servidor.

## Pendências e próxima etapa
1. Próxima: limite acumulado de vales de 40%, autorização administrativa com justificativa/auditoria e validação no backend. Não implementado nesta etapa. Definir explicitamente a base do período e preservar fechamento/desconto único.
2. Assinatura eletrônica desenhada de EPI, alternativa manual, numeração simples e revisão das orientações NR-6.
3. Inativação de materiais com histórico preservado.
4. Proteção de preenchimentos não salvos em RDO, colaboradores, orçamentos e financeiro.
5. Correções direcionadas de responsividade e sobreposição.
6. Recuperar apresentação profissional dos Orçamentos mantendo integrações, reorganizar menus e revisar horas normais/extras.
7. Permissões, persistência real e sincronização Supabase ainda não homologadas.

O plano anexado Plano_Melhorias_Sistema_Martins_Work(1).docx foi lido como referência de requisitos. Não comprova implementação. Os limites de 10h/12h nele mencionados continuam sujeitos a confirmação.
Netlify oficial e dados definitivos não foram alterados. Sem migração ou alterações no Supabase.
