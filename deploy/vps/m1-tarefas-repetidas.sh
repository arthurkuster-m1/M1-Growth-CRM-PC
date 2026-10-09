#!/bin/bash
# Chama a rota que cria as tarefas dos modelos que repetem (/api/v1/cron/tarefas-repetidas).
# Roda a cada 5 min pelo timer `m1-tarefas-repetidas.timer`. O segredo vem do .env.local do
# app e NUNCA vai para a linha de comando (apareceria em `ps`): o cabeçalho é lido de um
# descritor temporário pelo curl.
set -eu
segredo=$(grep -E '^INTERNAL_CRON_SECRET=' /opt/m1-growth-crm/.env.local | head -1 | cut -d= -f2- | tr -d '"'"'")
[ -n "$segredo" ] || { echo "[m1] INTERNAL_CRON_SECRET vazio no .env.local" >&2; exit 1; }
curl -fsS --max-time 60 -H @<(printf 'Authorization: Bearer %s\n' "$segredo") \
  http://localhost:3001/api/v1/cron/tarefas-repetidas
echo
