# WhatsApp do M1 na VPS (WAHA + Redis)

Pasta real na VPS: `/opt/m1-whatsapp` (o `.env` com os segredos mora só lá, fora do git).

- Subir/atualizar: `cd /opt/m1-whatsapp && docker compose up -d`
- Ver estado: `docker compose ps` · logs: `docker compose logs -f waha`
- O app lê `WAHA_API_BASE_URL`, `WAHA_API_KEY`, `WAHA_WEBHOOK_BASE_URL`, `WAHA_HMAC_SECRET`,
  `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` do `.env.local`; trocou algo → `systemctl restart m1-app`.
- Firewall: esta VPS não tem `ufw`; é `iptables`. O serviço `m1-app` (`deploy/vps/m1-app.service`) abre a porta 3001 só para
  o NPM (`172.18.0.0/16`) e para o WAHA (`172.30.0.0/24`, a rede `m1-whatsapp_interna`), e fecha de novo ao parar.
- **Quantos números cabem (uma resposta só, com a fonte):** o WAHA Core **não limita o número de sessões**. Desde a versão
  2026.6.1 o que era o "Plus" (sessões ilimitadas, mídia, storages, segurança) faz parte do Core, grátis e de código aberto; não
  existe mais imagem Plus, use `devlikeapro/waha`. A instância em uso se identifica como `{"version":"2026.7.2","engine":"NOWEB","tier":"CORE"}`
  (`GET /api/server/version`). Fontes (lidas em 05/11/2026):
  - https://waha.devlike.pro/docs/how-to/waha-plus/ ("WAHA Plus is now part of WAHA Core… unlimited sessions… 100% free and open source")
  - https://waha.devlike.pro/docs/overview/faq/ ("Unlimited Sessions - automate as many WhatsApp Accounts as you need")
  - https://waha.devlike.pro/docs/how-to/sessions/ ("WAHA supports multiple sessions in one container")
  - https://waha.devlike.pro/docs/overview/changelog/ (2026.6.1: "WAHA Plus features are now part of the WAHA Core image")
  - Licença do código: Apache-2.0 (https://github.com/devlikeapro/waha), também no rótulo da imagem `org.opencontainers.image.licenses`.
  Apache-2.0 permite uso comercial, inclusive atender números de clientes diferentes. Limite **prático** não é de licença, é de
  memória e de risco (ver "Teste de carga" abaixo quando houver). Não li o termo do Docker Hub da imagem.
- Imagem em ARM64 (esta VPS): `devlikeapro/waha:noweb-arm-2026.7.2` (`WAHA_IMAGE` no `.env`). A tag `latest-2026.7.2` é x86.
- Perder o volume `waha-data` = ter de ler o QR de novo.

## Uma instância por cliente (isoladas entre si)

`/opt/m1-whatsapp/novo-cliente.sh <slug> <porta>` (cópia em `deploy/vps/whatsapp/novo-cliente.sh`) cria
`/opt/m1-whatsapp/clientes/<slug>/` com `docker-compose.yml` próprio (projeto Docker `m1-waha-<slug>`, NOWEB, 1 GB de memória,
`unless-stopped`, porta só em `127.0.0.1:<porta>`, volumes `waha-<slug>-data` e `waha-<slug>-media`), `.env` (modo 600) com o
hash SHA512 da chave e o HMAC do cliente, e entra na rede `m1-whatsapp_interna`. É idempotente: rodar de novo não troca chave.
A chave em texto puro e o HMAC ficam só em `/home/ubuntu/segredos-waha.env` (modo 600, linhas `<slug>=<chave>` e `<slug>.hmac=<hmac>`).

| Cliente | Endereço | Porta |
|---|---|---|
| assessoria-m1 (WAHA padrão, stack `m1-whatsapp`) | http://127.0.0.1:3100 | 3100 |
| rua-model | http://127.0.0.1:3101 | 3101 |
| one-company | http://127.0.0.1:3102 | 3102 |
| diore | http://127.0.0.1:3103 | 3103 |

Próximo cliente: porta 3104, 3105… Conferir: `curl -s -o /dev/null -w "%{http_code}\n" -H "X-Api-Key: <chave>" http://127.0.0.1:<porta>/api/sessions`
(200 com a chave, 401 sem ela). O app só lê um `WAHA_API_BASE_URL` global; o endereço e a chave de cada empresa entram pela aba
Conexões quando o campo "WAHA desta empresa" existir. O webhook é verificado com o segredo da sessão guardado no banco, e o
`WAHA_HMAC_SECRET` global só é reserva (`lib/waha/webhook-auth.ts`): conferir isso ao conectar o primeiro número de cada cliente.
