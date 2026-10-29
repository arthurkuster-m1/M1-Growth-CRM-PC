# Prova pela tela — automações de tag (29/10/2026)

Ambiente: banco fresco (`supabase/postgres` 15 + GoTrue + PostgREST), `baseline.sql` + migrations
0614–0649 (que o baseline **não** traz — ver o PR), app em produção (`next build` + `next start`),
Redis local, WAHA no ar. O número de WhatsApp é uma linha em `channel_sessions`; as mensagens entram
pela rota real `POST /api/v1/webhooks/waha/[token]`.

Resultado: as 3 regras criadas pelos modelos (cliques na tela) disparam e marcam os contatos
(`obrigado`, `engajado`, `sem atendimento`); a aba Execuções mostra as 3 execuções com sucesso.

Atalhos assumidos (declarados): `organizations.onboarded_at` preenchido à mão para pular o
assistente de 6 passos; a mensagem da Carla foi "envelhecida" 3h no banco para o cron
`lead-time-triggers` (regra de 1 hora) enxergá-la; o cron e o `event-log-drain` foram chamados por
HTTP em vez de esperar o agendador. `roteiro-do-teste.cjs` repete tudo.
