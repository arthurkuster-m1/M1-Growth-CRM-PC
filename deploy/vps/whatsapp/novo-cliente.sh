#!/bin/bash
# Cria (ou confere) uma instancia WAHA ISOLADA para um cliente.
# Uso: novo-cliente.sh <slug> <porta>      ex.: novo-cliente.sh rua-model 3101
# Idempotente: rodar de novo nao duplica nada e NAO troca as chaves.
# Imprime so: slug, endereco e onde esta a chave. Nenhuma chave vai para a tela.
set -euo pipefail

SLUG="${1:-}"; PORTA="${2:-}"
BASE=/opt/m1-whatsapp
SEGREDOS=/home/ubuntu/segredos-waha.env
IMAGEM_PADRAO="devlikeapro/waha:noweb-arm-2026.7.2"

[[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$ ]] || { echo "slug invalido (use minusculas, numeros e hifen)"; exit 1; }
[[ "$PORTA" =~ ^31[0-9]{2}$ && "$PORTA" -ge 3101 ]] || { echo "porta invalida (3101 a 3199)"; exit 1; }

DIR="$BASE/clientes/$SLUG"
mkdir -p "$DIR"
chmod 700 "$BASE/clientes" "$DIR"

# a porta nao pode pertencer a OUTRO cliente
for outro in "$BASE"/clientes/*/porta; do
  [ -e "$outro" ] || continue
  [ "$(dirname "$outro")" = "$DIR" ] && continue
  if [ "$(cat "$outro")" = "$PORTA" ]; then echo "porta $PORTA ja e de $(basename "$(dirname "$outro")")"; exit 1; fi
done
if [ -f "$DIR/porta" ] && [ "$(cat "$DIR/porta")" != "$PORTA" ]; then
  echo "$SLUG ja usa a porta $(cat "$DIR/porta"); nao troco para $PORTA"; exit 1
fi
echo "$PORTA" > "$DIR/porta"

# imagem: a mesma do stack padrao
IMAGEM="$IMAGEM_PADRAO"
if [ -f "$BASE/.env" ]; then
  v=$(grep -E '^WAHA_IMAGE=' "$BASE/.env" | tail -1 | cut -d= -f2- || true)
  [ -n "$v" ] && IMAGEM="$v"
fi

# segredos: so gera se ainda nao existem (idempotente)
umask 077
touch "$SEGREDOS"; chmod 600 "$SEGREDOS"
if [ ! -s "$DIR/.env" ] || ! grep -q '^WAHA_API_KEY_SHA512=' "$DIR/.env"; then
  CHAVE=$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-43)
  HMAC=$(openssl rand -hex 32)
  HASH=$(printf '%s' "$CHAVE" | sha512sum | cut -d' ' -f1)
  grep -v -E "^(${SLUG}|${SLUG}\.hmac)=" "$SEGREDOS" > "$SEGREDOS.tmp" || true
  { cat "$SEGREDOS.tmp"; echo "${SLUG}=${CHAVE}"; echo "${SLUG}.hmac=${HMAC}"; } > "$SEGREDOS"
  rm -f "$SEGREDOS.tmp"; chmod 600 "$SEGREDOS"
  printf 'WAHA_IMAGE=%s\nWAHA_API_KEY_SHA512=%s\nWAHA_HMAC_SECRET=%s\n' "$IMAGEM" "$HASH" "$HMAC" > "$DIR/.env"
  chmod 600 "$DIR/.env"
fi
grep -q "^${SLUG}=" "$SEGREDOS" || { echo "ATENCAO: a chave de $SLUG nao esta em $SEGREDOS (.env ja existia). Nao regero para nao quebrar a conexao."; }

cat > "$DIR/docker-compose.yml" <<EOF
# WAHA isolado do cliente "${SLUG}" (gerado por novo-cliente.sh; as chaves ficam em .env, modo 600).
name: m1-waha-${SLUG}

services:
  waha:
    image: \${WAHA_IMAGE}
    restart: unless-stopped
    mem_limit: 1024m
    ports: ["127.0.0.1:${PORTA}:3000"]
    extra_hosts: ["host.docker.internal:host-gateway"]
    environment:
      WAHA_API_KEY: "sha512:\${WAHA_API_KEY_SHA512}"
      WHATSAPP_HOOK_URL: http://host.docker.internal:3001/api/v1/webhooks/waha
      WHATSAPP_HOOK_EVENTS: "message.any,message.ack,message.edited,message.revoked,session.status,state.change"
      WHATSAPP_HOOK_HMAC_KEY: \${WAHA_HMAC_SECRET}
      WHATSAPP_DEFAULT_ENGINE: NOWEB
      WAHA_DASHBOARD_ENABLED: "false"
      WHATSAPP_RESTART_ALL_SESSIONS: "True"
    volumes:
      - waha-${SLUG}-data:/app/.sessions
      - waha-${SLUG}-media:/app/.media
    networks: [interna]

networks:
  interna:
    external: true
    name: m1-whatsapp_interna

volumes:
  waha-${SLUG}-data:
  waha-${SLUG}-media:
EOF
chmod 600 "$DIR/docker-compose.yml"

( cd "$DIR" && docker compose up -d >/dev/null 2>&1 ) || { echo "falhou ao subir $SLUG (veja: cd $DIR && docker compose logs)"; exit 1; }

echo "slug:     $SLUG"
echo "endereco: http://127.0.0.1:$PORTA"
echo "chave em: $SEGREDOS (linha \"$SLUG=...\")"
