#!/bin/bash
# Chama a rota que puxa o dia a dia do Meta das campanhas de demanda (/api/v1/cron/campanhas-meta).
# Roda de hora em hora pelo timer `m1-campanhas-meta.timer`. O segredo vem do .env.local do app e
# NUNCA vai para a linha de comando (apareceria em `ps`): o cabeçalho é lido de um descritor
# temporário pelo curl.
set -eu
segredo=$(grep -E '^INTERNAL_CRON_SECRET=' /opt/m1-growth-crm/.env.local | head -1 | cut -d= -f2- | tr -d '"'"'")
[ -n "$segredo" ] || { echo "[m1] INTERNAL_CRON_SECRET vazio no .env.local" >&2; exit 1; }
curl -fsS --max-time 120 -H @<(printf 'Authorization: Bearer %s\n' "$segredo") \
  http://localhost:3001/api/v1/cron/campanhas-meta
echo
