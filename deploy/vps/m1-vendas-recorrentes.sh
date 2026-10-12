#!/bin/bash
# Chama a rota que gera as parcelas das recorrências e abre os avisos de cobrança
# (/api/v1/cron/vendas-recorrentes). Roda uma vez por dia pelo timer `m1-vendas-recorrentes.timer`.
set -eu
segredo=$(grep -E '^INTERNAL_CRON_SECRET=' /opt/m1-growth-crm/.env.local | head -1 | cut -d= -f2- | tr -d '"'"'")
[ -n "$segredo" ] || { echo "[m1] INTERNAL_CRON_SECRET vazio no .env.local" >&2; exit 1; }
curl -fsS --max-time 120 -H @<(printf 'Authorization: Bearer %s\n' "$segredo") \
  http://localhost:3001/api/v1/cron/vendas-recorrentes
echo
