# WhatsApp do M1 na VPS (WAHA + Redis)

Pasta real na VPS: `/opt/m1-whatsapp` (o `.env` com os segredos mora só lá, fora do git).

- Subir/atualizar: `cd /opt/m1-whatsapp && docker compose up -d`
- Ver estado: `docker compose ps` · logs: `docker compose logs -f waha`
- O app lê `WAHA_API_BASE_URL`, `WAHA_API_KEY`, `WAHA_WEBHOOK_BASE_URL`, `WAHA_HMAC_SECRET`,
  `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` do `.env.local`; trocou algo → `systemctl restart m1-app`.
- Firewall: o `ufw` libera só `172.30.0.0/24 → 3001` (o WAHA avisar o app de cada mensagem).
- **WAHA Core (grátis) = UM número.** Vários números pedem o WAHA Plus (pago) via `WAHA_IMAGE`.
- Perder o volume `waha-data` = ter de ler o QR de novo.
