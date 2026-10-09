#!/bin/bash
# Baixa o build novo do M1 (release `m1-build-latest`, feito por .github/workflows/build-m1.yml),
# troca a pasta `.next` e reinicia o app. Se o app não subir, volta ao build anterior.
# Roda a cada 2 min pelo timer `m1-puxar-build.timer`; também serve rodar à mão:
#   sudo /usr/local/bin/m1-puxar-build.sh
set -euo pipefail

REPO="${M1_REPO:-arthurkuster-m1/M1-Growth-CRM-PC}"
DIR=/opt/m1-growth-crm
ESTADO=/var/lib/m1-build
mkdir -p "$ESTADO"

# Uma execução por vez.
exec 9>/var/lock/m1-puxar-build.lock
flock -n 9 || exit 0

json=$(curl -fsS --max-time 20 "https://api.github.com/repos/$REPO/releases/tags/m1-build-latest") || exit 0
leitura() { python3 -c "$1" <<<"$json"; }
sha=$(leitura 'import json,sys; print(((json.load(sys.stdin).get("body") or "").strip().splitlines() or [""])[0])')
url=$(leitura 'import json,sys
for a in json.load(sys.stdin).get("assets", []):
    if a["name"] == "m1-build.tgz" and a.get("state") == "uploaded":
        print(a["browser_download_url"])')
[ -n "$sha" ] && [ -n "$url" ] || exit 0
[ "$sha" = "$(cat "$ESTADO/ultimo-sha" 2>/dev/null || true)" ] && exit 0

echo "[m1] build novo: $sha"
tmp=$(mktemp -d /var/tmp/m1-build.XXXXXX)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --max-time 900 -o "$tmp/m1-build.tgz" "$url"
tar -tzf "$tmp/m1-build.tgz" >/dev/null   # o arquivo veio inteiro?
mkdir "$tmp/x"
tar -xzf "$tmp/m1-build.tgz" -C "$tmp/x"
[ -f "$tmp/x/.next/BUILD_ID" ] || { echo "[m1] arquivo sem BUILD_ID, ignorado"; exit 1; }

cd "$DIR"
# O código-fonte acompanha (public/, package.json…) — só se a pasta não tem mudança solta.
if git diff --quiet && git diff --cached --quiet; then
  git pull --ff-only -q || echo "[m1] git pull não avançou (commits locais à frente?), seguindo"
fi
# Dependências: só reinstala se o pnpm-lock.yaml mudou desde a última vez.
atual_lock=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
if [ "$atual_lock" != "$(cat "$ESTADO/lock-hash" 2>/dev/null || true)" ]; then
  pnpm install --frozen-lockfile
  echo "$atual_lock" > "$ESTADO/lock-hash"
fi

rm -rf .next.antigo
mv .next .next.antigo
mv "$tmp/x/.next" .next
systemctl restart m1-app

ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 5
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:3001/login || true)
  if [ "$codigo" = "200" ] || [ "$codigo" = "307" ]; then ok=1; break; fi
done
if [ "$ok" != 1 ]; then
  echo "[m1] o app não subiu com o build novo — voltando ao anterior"
  rm -rf .next
  mv .next.antigo .next
  systemctl restart m1-app
  exit 1
fi
echo "$sha" > "$ESTADO/ultimo-sha"
echo "[m1] no ar: $sha"
