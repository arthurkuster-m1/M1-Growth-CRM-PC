# Plano de go-live do M1 Growth CRM (colocar para rodar com clientes reais)

Criado em 01/11/2026. É o plano de **operação**: o produto já tem funcionalidade de sobra, o que falta para
atender cliente real é infraestrutura, segurança dos dados e prova de uso. Ligado à frente 18 do
`docs/PLANO-M1.md`. Quem faz cada item: **[A]** Arthur (precisa de conta, cartão ou decisão),
**[C]** Claude (código, scripts e conferências).

Regra: não abrir para cliente antes das fases 1 a 3 estarem marcadas. A fase 4 (piloto) é o teste de verdade.

## Decisões do Arthur (01/11/2026) — valem mais que o texto abaixo quando divergirem

- **Onde roda:** a VPS Oracle Always Free já existente, em **São Paulo** (ARM, 4 núcleos, 24 GB, 200 GB). Tudo
  junto nela: app, worker, agendador, Supabase **self-hosted** (modo `docker-compose.single-server.yml`), Redis,
  WAHA e Caddy. Migrar a conta Oracle para **Pay As You Go** (continua gratuito dentro dos limites) para a
  instância não ser recolhida por ociosidade.
- **Custo mínimo até começar a vender:** sem Supabase Pro. O backup diário é nosso (ver Fase 1): `pg_dump` + mídia
  + chaves, enviados para fora (Cloudflare R2 ou Backblaze B2) e com teste de restauração. Perda máxima: 24 h.
- **Evolution API:** ninguém usa (só testes pessoais do Arthur). Pode sair sem plano de migração. Antes de remover,
  conferir só se algum fluxo do n8n pessoal a chama.
- **WhatsApp:** 1 número por cliente no plano gratuito = **um contêiner WAHA Core por cliente** (a verificar se o
  app aceita um endereço de WAHA por canal; se não, é uma mudança pequena) ou WAHA Plus. API oficial da Meta como
  opção para quem quiser disparar. "Só leitura" não poupa servidor (o custo é a conexão do número, não a tela);
  se quiser, vira uma **permissão** (cliente vê as conversas, sem enviar).
- **O n8n é crítico e não pode cair.** Ele recebe hoje os leads de todas as campanhas e landing pages dos clientes
  e grava no Excel. Esse fluxo **continua como está**; só se **acrescenta** um ramo que também envia o lead ao CRM.
  Regras de proteção abaixo.

### Protegendo o n8n (vale para toda a instalação)

1. **Ele é intocável até o último passo.** O app e o Supabase sobem em um projeto Docker **separado** (rede própria,
   portas próprias). Não paramos, atualizamos nem reiniciamos o n8n durante a instalação.
2. **Antes de qualquer mudança na VPS:** (a) backup de inicialização (boot volume) da Oracle; (b) exportar todos os
   workflows do n8n; (c) copiar o volume de dados do n8n **e a `N8N_ENCRYPTION_KEY`** (sem ela as credenciais
   guardadas não abrem numa restauração). Guardar fora da VPS.
3. **Limites de memória para tudo o que é novo** (`mem_limit` nos contêineres do CRM, Supabase e WAHA) e ajuste de
   prioridade de OOM favorável ao n8n, para que um excesso do CRM nunca derrube o n8n. `restart: unless-stopped`
   no n8n, e swap de 4 GB como rede de segurança.
4. **Proxy:** o n8n é exposto pelo **nginx**. Só acrescentamos arquivos de host novos (ex.: `crm.seudominio.com`), sem
   mexer no host do n8n, sempre com `nginx -t` e `nginx -s reload` (nunca restart). Conferir antes: `curl` no webhook do n8n depois de cada passo.
5. **Monitor externo do webhook do n8n** (UptimeRobot, a cada 5 min, aviso no celular). Se ele cair, os leads param.
6. **Teste do que entra:** após cada etapa, mandar um lead de teste por uma landing e conferir que chega no Excel.

### Como o lead entra no CRM sem arriscar o Excel

- O CRM já recebe lead por URL (`/api/v1/webhooks/in/<token>`, fonte criada em Webhooks, aceita JSON de qualquer
  formato e evita duplicar por `external_id`).
- No n8n, **um ramo em paralelo** logo depois do gatilho (não em série): um nó HTTP Request para essa URL, com
  **"On Error: Continue"**, para que uma falha do CRM nunca impeça o ramo do Excel.
- Primeiro apontar para uma organização de **teste**, depois para a do cliente. Um fluxo por vez.
- Claude monta o nó (URL, corpo, mapeamento de campos e `external_id`) e entrega para o Arthur colar; **nenhum
  workflow de produção é alterado sem o OK dele**.

## Ordem combinada (01/11/2026) — nada disto é executado agora

1. **Primeiro:** terminar as edições e prioridades pendentes do app (frentes do `docs/PLANO-M1.md`).
2. **Quando o Arthur disser que o app está ok:** limpeza geral de tudo o que não é usado (código, telas, dependências e
   rotinas herdadas do DeskcommCRM), para deixar mais leve; otimizar a entrega (tamanho da imagem, build, carga das
   telas); e preparar o pacote de instalação para ARM.
3. **Só então:** o Arthur dá acesso à VPS em uma sessão e a instalação é feita por lá, seguindo o roteiro abaixo.
4. **Fixo:** o n8n é exposto pelo **nginx**; ele continua intacto (ver "Protegendo o n8n").

## Roteiro de instalação na VPS Oracle (para a sessão futura; só anotado, não executar antes do OK)

**A. Só leitura (não altera nada)** — conhecer o terreno: contêineres e imagens em uso (`docker ps`, `docker stats
--no-stream`), memória e disco (`free -h`, `df -h`), portas ocupadas (`ss -ltnp`), arquitetura (`uname -m`, deve ser
`aarch64`), versão do Docker e do Compose, como o nginx está configurado (`/etc/nginx/sites-enabled/`, certificados),
firewall (regras da Oracle e `iptables`), e onde ficam os dados do n8n.

**B. Proteger antes de mexer** — backup de inicialização (boot volume) na Oracle; exportar workflows do n8n; copiar o
volume do n8n e a `N8N_ENCRYPTION_KEY`; levar tudo para fora da VPS (R2/B2). Migrar a conta para Pay As You Go. Criar
swap de 4 GB se não houver. Teste de fumaça do n8n (lead de teste chegando no Excel) e anotar o resultado.

**C. Preparar o ambiente novo, em paralelo ao n8n** — pasta e projeto Docker próprios (`/opt/m1-crm`), rede própria,
`mem_limit` em todos os serviços, `restart: unless-stopped`. Usar o modo `docker-compose.single-server.yml`
(app, worker, agendador, Supabase, Redis, WAHA). **Atenção:** esse modo traz um Caddy que ocupa as portas 80 e 443, e
elas já são do nginx. Na VPS, o Caddy não publica portas: o app e a API do Supabase escutam só em `127.0.0.1`
(por exemplo 3001 e 8000) e o **nginx faz o proxy**. Imagens em versão **ARM64** (WAHA `noweb-arm`, as do Supabase
conferidas uma a uma). Studio do Supabase e o banco **nunca** expostos à internet.

**D. Segredos e banco** — gerar chaves novas (JWT do Supabase, anon, service role, senha do Postgres, chave de cifra
dos segredos, chave da WAHA, token de cron), `.env` só na VPS com permissão 600. Aplicar o `supabase/baseline.sql`
(`ON_ERROR_STOP=1`), rodar `bootstrap-owner`, conferir o isolamento entre organizações (RLS). Ajustar o Postgres para
a máquina (memória compartilhada ~2 GB, conexões) e desligar o que não usamos (analytics, vector).

**E. Publicar com o nginx, sem tocar no n8n** — domínios novos (por exemplo `crm.…` e `api.crm.…`), um arquivo novo em
`sites-enabled` para cada, com `proxy_pass` para `127.0.0.1`, cabeçalhos de WebSocket (`Upgrade` e `Connection`, que o
Realtime exige), `client_max_body_size` para envio de mídia e HTTPS pelo Let's Encrypt (certbot). Sempre
`nginx -t` e depois `nginx -s reload` (recarrega sem derrubar conexões; **nunca** `restart`). Conferir o n8n depois.

**F. Rotinas e backup** — agendar as rotinas do app (lembretes, follow-up, sincronia da Agenda, parcelas, retenção) e
auditar uma a uma; backup diário (`pg_dump` + mídia + chaves) para fora da VPS, com teste de restauração num banco
descartável; monitor externo no `/api/v1/health` do CRM e no webhook do n8n; Sentry.

**G. WhatsApp** — um contêiner WAHA Core por cliente (ou WAHA Plus), cada um com limite de memória; parear por QR;
conferir que as mensagens entram. Anti-banimento ligado.

**H. Só então, os leads** — o ramo paralelo no n8n (HTTP Request com "On Error: Continue") apontando primeiro para uma
organização de teste e depois para a do cliente, um fluxo por vez, conferindo o Excel a cada passo.

**I. Plano de volta** — se algo der errado em qualquer etapa: desligar o projeto novo (`docker compose down`), remover
o arquivo do nginx e recarregar; o n8n nunca foi tocado. Se o n8n falhar por qualquer motivo, restaurar do backup do
passo B.

## Fase 1 — Dados e segurança (bloqueia tudo)

- [ ] **[A]** Criar um projeto Supabase de **produção** (região sa-east-1), separado do de teste, em plano **Pro**
      (backup diário e sem pausa por inatividade). Avaliar o complemento de recuperação a qualquer momento (PITR).
- [ ] **[C]** Aplicar o `supabase/baseline.sql` no projeto novo e rodar `bootstrap-owner` (o que o `install.sh` faz),
      com `ON_ERROR_STOP=1`, e conferir o isolamento entre organizações (RLS) com os testes de invariantes.
- [ ] **[A]** Gerar chaves e senhas **novas** (as de teste foram coladas em chat): Supabase (anon, service role,
      senha do banco), chave de cifra dos segredos (`NUVEMSHOP_OAUTH_ENCRYPTION_KEY`), chave da WAHA, `.env` de produção
      só na VPS, nunca no GitHub.
- [ ] **[C]** Roteiro de **restauração**: script que faz `pg_dump` diário para um armazenamento externo
      (Cloudflare R2 ou Backblaze B2) e um teste de restaurar num banco descartável. Backup que nunca foi
      restaurado não conta como backup.
- [ ] **[A]** Google Cloud: acompanhar a verificação do app (hoje em modo teste só aceita e-mails cadastrados à mão).
      Sem ela, cliente novo não conecta a Agenda do Google.
- [ ] **[C]** Revisar permissões: quem é `admin`, `manager`, `agent` e `viewer` em cada tela do Modo agência, e
      confirmar que o cliente nunca vê dados da agência nem de outro cliente.

## Fase 2 — Servidor estável

- [ ] **[A]** Migrar a conta Oracle para Pay As You Go, tirar o backup de boot e exportar o n8n (ver "Protegendo o n8n"). Apontar o domínio (DNS) do CRM.
- [ ] **[C]** Instalador `instalar-vps.sh` / roteiro de migração para a VPS nova: Caddy (HTTPS automático),
      serviço `systemd` do app, `worker` e `scheduler`, Redis, WAHA, firewall, swap e atualização por
      imagem publicada (o fluxo atual `build-m1` → release → `m1-puxar-build.timer`).
- [ ] **[C]** **Auditar as rotinas em segundo plano** (cron): listar tudo o que o `scheduler` deveria chamar
      (lembretes de compromisso, follow-up, sincronia da Agenda, parcelas vencidas, retenção, recuperar mensagens
      travadas) e confirmar uma a uma que está agendada e executando na VPS. Hoje o contexto avisa que só parte roda.
- [ ] **[A]** Criar monitor externo de queda (UptimeRobot, gratuito) apontando para `/api/v1/health`, com aviso no
      seu celular. **[C]** Ligar o Sentry (envio de erros) com os dados sanitizados.
- [ ] **[C]** Ensaio de recuperação: reiniciar a VPS e conferir que tudo volta sozinho (app, WAHA, Redis, crons).

## Fase 3 — WhatsApp e canais

- [ ] **[A]** Decidir o WhatsApp: **WAHA Plus** (pago, vários números, mesmo risco de banimento) ou **API oficial da
      Meta** (custo por conversa, sem risco de banimento, exige templates e aprovação). Vale a oficial para os
      disparos e o WAHA só para atendimento, se o custo permitir.
- [ ] **[C]** Anti-banimento ligado e conferido: limite de envio, janela 7h–22h, aquecimento do número, opt-out.
- [ ] **[A]** Chave de IA (Vercel AI Gateway) com **limite de gasto** configurado, para um cliente não estourar o custo.
- [ ] **[C]** Conferir o e-mail transacional (Resend ou SMTP): convite, confirmação de cadastro e recuperação de senha
      chegando na caixa de entrada, não no spam.

## Fase 4 — Piloto (a prova de verdade)

- [ ] **[A]** Escolher **1 ou 2 clientes de confiança** e rodar 2 semanas sem cobrar.
- [ ] **[C]** Percurso de cliente novo do zero, pela tela, em ambiente limpo: criar conta, onboarding, conectar o
      WhatsApp, primeiro lead, primeira venda, convidar alguém. Registrar os achados em `docs/testing/user-journey-map.md`.
- [ ] **[A]** Diário de problemas do piloto (print + o que esperava). **[C]** Corrigir na causa, no mesmo dia.
- [ ] Critério para seguir: nenhum erro de dado cruzado entre clientes, nenhuma queda sem aviso, backup restaurado
      com sucesso pelo menos uma vez.

## Fase 5 — Abrir para os demais

- [ ] **[C]** Visão de todos os clientes no `/admin` (frente 14): quem usa, quem parou, quem está com erro,
      consumo de IA e de WhatsApp por cliente.
- [ ] **[A]** Termos de uso, política de privacidade e contrato com cláusula de LGPD (as páginas públicas já existem;
      falta o contrato comercial e o DPO).
- [ ] **[A]** Definir cobrança (Stripe, Asaas ou Pix recorrente) e o que acontece quando o cliente para de pagar.
- [ ] **[C]** Rotina de atualização sem parada: aviso, janela e volta atrás automática (já existe no `puxar-build`).

## Fica para depois do lançamento

IA ajudante (frente 3), barra de pesquisa (13), configurações gerais (12), financeiro completo (15), Hotmart, Lead Ads
nativo e eventos de CAPI. Nenhum bloqueia o uso diário; entram por demanda dos clientes do piloto.

---

## Recomendação de VPS

**Princípio:** o **banco fica no Supabase** (não na VPS) e o app é construído no GitHub, então a VPS só executa. O que
pesa de verdade é o **WhatsApp**: cada número conectado na WAHA consome memória própria (na casa de 300 a 500 MB cada,
a conferir na prática), e é isso que decide o tamanho.

| Estágio | Clientes / números | Configuração | Observação |
| --- | --- | --- | --- |
| **Piloto** | 1–2 clientes, até 3 números | **4 vCPU, 8 GB RAM, 80–100 GB NVMe** | A VPS atual (2 núcleos, 7,8 GB) aguenta o piloto se o build continuar no GitHub; o gargalo é CPU quando vários atendem ao mesmo tempo. |
| **Operação** (recomendado para começar de verdade) | 5–10 clientes, até ~8 números | **4–6 vCPU, 16 GB RAM, 160 GB NVMe** | Folga para a WAHA, o worker e picos. É o ponto de partida que eu contrataria. |
| **Crescimento** | 10–30 clientes, 10+ números | **WAHA em uma VPS própria** (4 vCPU, 8 GB) + app em outra (4 vCPU, 8 GB) | Separar evita que um número travado derrube o app. Mais de um nó WAHA também diminui o risco de banimento em cascata. |

Detalhes que importam mais que o tamanho:

1. **Datacenter no Brasil** (São Paulo). O banco está em sa-east-1; um servidor na Europa adiciona cerca de 200 ms em cada
   consulta e deixa o app visivelmente lento. Por isso eu descartaria opções baratas só europeias.
2. **Sistema:** Ubuntu 24.04 LTS, com atualizações de segurança automáticas, **swap de 2 a 4 GB** (rede de segurança, não
   para o dia a dia) e disco **NVMe**.
3. **Firewall:** abrir só 22 (SSH, só com chave, sem senha), 80 e 443. WAHA, Redis e o app ficam em `localhost`; só o
   Caddy fala com a internet.
4. **Backup da VPS:** snapshot semanal do provedor (custa pouco) **mais** o backup do banco para fora, descrito na fase 1.
   O que está na VPS é reconstruível; os dados estão no Supabase.
5. **Custo de referência** (a confirmar no site de cada provedor, os preços variam): VPS de 4 vCPU/8 GB costuma ficar na
   faixa de R$ 80 a R$ 150 por mês e a de 16 GB, de R$ 150 a R$ 300; Supabase Pro, cerca de US$ 25 por mês.
6. **Quando subir de nível:** CPU acima de 70% por mais de 10 minutos, memória livre abaixo de 1,5 GB, ou mais de 6 números
   conectados.

**Minha recomendação final:** comece com **4 vCPU / 16 GB / 160 GB NVMe em São Paulo**. A diferença de preço para a de 8 GB
é pequena perto do custo de uma queda no meio do atendimento de um cliente, e você só precisa dividir o servidor em dois
quando passar de uns 10 números.
