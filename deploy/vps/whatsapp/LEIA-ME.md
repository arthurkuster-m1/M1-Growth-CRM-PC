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

## Teste de carga do WAHA padrão (05/11/2026): 1 WAHA para vários números?

Feito com 2 números de teste reais no WAHA padrão (`127.0.0.1:3100`, imagem `noweb-arm-2026.7.2`): um na empresa
`assessoria-m1` e outro em `05-rua-model` (a `one-company` não foi usada). Limite de memória elevado a 2048m só durante o teste e
devolvido a 1280m. Registro bruto (fora do git): `/home/ubuntu/teste-waha.log` na VPS.

| Teste | Resultado | Tempo / observação |
|---|---|---|
| T1 duas sessões chegam a WORKING | passou | pareadas às 05:19:52 e 05:20:50; banco e WAHA concordam |
| T2 receber e enviar (texto e imagem) | passou | cada mensagem na empresa certa; 48 webhooks aceitos, 0 `hmac_invalid`; imagem foi ao storage. **Áudio não testado** |
| T3 desconectar o número A pelo celular | passou | A: FAILED em 1 s; B seguiu WORKING e recebeu e respondeu normalmente |
| T4 `stop` de A pela API, depois reiniciar | passou | A: STOPPED em 2 s com B intacta; reiniciada pela tela voltou **sem QR** |
| T5a `docker restart` com as 2 WORKING | passou | API em 6,3 s; **as duas WORKING em 9,4 s, sem QR** |
| T5b WAHA parado 78 s (05:39:09→05:40:28) | **parcial** | volta em 4,6 s (API) / 7,8 s (2 WORKING), sem QR; as 2 mensagens recebidas durante a queda chegaram 7 s depois da volta (nada perdido). **A resposta enviada pela Inbox durante a queda ficou `queued` (`channel_session_not_working`) e NÃO foi reenviada em 3,5 min**, apesar de a tela dizer "sai sozinha quando ele voltar" |
| T6 memória | ver abaixo | |
| T7 watchdog/Central | passou com ressalva | nenhuma sessão saudável foi marcada FAILED. Mas cada mudança de estado abre aviso: a reconexão abriu 3 avisos em 11 s e a queda de 78 s abriu 4 para 2 sessões. Todos se resolveram sozinhos (15 no total, 0 abertos no fim) |

**Memória do WAHA padrão (2 sessões, contas novas):** 249 MiB sem sessão; 444 MiB (pico) durante o pareamento; 367 MiB depois, com
tráfego e uma imagem; 255 MiB (estável) logo após reiniciar o contêiner com as 2 sessões. O custo por sessão **varia** de quase nada
(contêiner recém-reiniciado) a 60-100 MiB (pareamento e atividade). Projeção linear com 100 MiB por sessão: 5 números ≈ 0,75 GiB, 10 números
≈ 1,25 GiB, o que encosta no limite de 1280m. **Contas reais com muito histórico não foram medidas e podem pesar bem mais.** Cada instância
isolada por cliente usa ~300 MiB só para existir.

**Veredito:**
- (a) Medido com segurança: **2 números**. Projetado: ~10 números por WAHA, com limite de 2048m e acompanhamento. Acima disso, ou ao
  ver contas com histórico grande, dividir em mais de uma instância.
- (b) Fora do ar numa queda ou atualização: **~10 s** para o conjunto voltar, sem QR; mensagens recebidas nesse intervalo não se perdem
  (o WhatsApp as guarda). Mensagens **enviadas** pela Inbox nesse intervalo ficam paradas (ver defeito abaixo).
- (c) Recomendação: **começar com 1 WAHA** (o app já o suporta, é mais simples de operar e o teste passou) e revisar ao passar de ~10
  números ou se algum cliente exigir isolamento. Isolar por cliente não protege contra bloqueio do WhatsApp (todos os números saem pelo
  mesmo IP da VPS) e custa ~300 MiB por instância. O que o isolamento compra: uma atualização ou queda de um WAHA afeta só aquele
  cliente, e a chave de um cliente não abre os outros. As instâncias 3101 a 3103 seguem criadas e **vazias**, aguardando decisão.

**Defeitos para a nuvem:** (1) mensagem humana `queued` por canal fora não é reenviada quando o número volta (não achei quem a
reenvie; **não há `agent-worker` rodando nesta VPS**, que talvez seja a causa e precisa ser confirmado); (2) a Central abre um aviso por
passo da reconexão; (3) `messages.media_url` guarda `http://localhost:3000/api/files/...` (o WAHA não tem `WAHA_BASE_URL` definido).
