# Handoff: subir o M1 Growth CRM na VPS nova (sessão com acesso à VPS)

> **STATUS 04/11/2026: itens A–H CONCLUÍDOS** (CRM no ar em app.assessoria-m1.com.br, backup restaurado, reinício ensaiado). Estado atual e pendências: seção "ESTADO EM 04/11/2026" no topo de `CONTEXTO-M1.md`. Falta só o backup de boot da Oracle (adiado por decisão do Arthur) e a Fase 4.

> Para o Claude que vai trabalhar **dentro da VPS** (Remote Control). Escrito em 04/11/2026 pela sessão da nuvem.
> Leia, nesta ordem: `CLAUDE.md` → `CONTEXTO-M1.md` → este arquivo → `docs/PLANO-GO-LIVE-M1.md` (roteiro técnico A–I)
> → `docs/PLANO-GO-LIVE-MVP-M1.md` (fases). Quem manda é o Arthur (não programa, fala português, quer passo a passo
> simples). Em caso de conflito entre documentos, vale este arquivo e o que o Arthur disser na conversa.

## Objetivo de hoje

Colocar o CRM abrindo em **https://app.assessoria-m1.com.br** (também existe `crm.assessoria-m1.com.br`), na VPS Oracle
de São Paulo (**IP 163.176.43.6**, ARM Ampere), **com o n8n funcionando o tempo todo**. Critério de saída (do plano):
o CRM abre no endereço novo, o n8n segue intacto (um lead de teste chega no Excel), o backup roda e foi restaurado uma vez.
Leads reais, Meta Ads, WhatsApp e Google Agenda vêm DEPOIS (Fase 4).

## Regras que não se negociam

1. **O n8n é intocável.** Recebe os leads de todas as campanhas e grava no Excel. Não parar, atualizar nem reiniciar.
2. **Primeiro só leitura.** Mapear o que roda (docker, NPM, portas, memória, disco) antes de qualquer alteração.
3. **Backups antes de mexer:** exportar os workflows do n8n, copiar o volume de dados do n8n e a **`N8N_ENCRYPTION_KEY`**
   (sem ela as credenciais não abrem numa restauração), levar para fora da VPS. O Arthur tira o backup de boot na Oracle.
4. **Proxy = Nginx Proxy Manager (NPM), não nginx do sistema.** O `nginx` NÃO está instalado no host; quem atende as portas
   80/81/443 é o contêiner `npm` (`jc21/nginx-proxy-manager`). Só **acrescentar** hosts novos (pela tela do NPM, porta 81, ou
   pela API dele), sem editar nem reiniciar os hosts existentes do n8n. Nunca reiniciar o contêiner `npm`. Conferir o webhook
   do n8n com `curl` depois de cada passo.
5. **Tudo novo em projeto Docker separado**, rede própria, `mem_limit` em todos os serviços, `restart: unless-stopped`,
   prioridade de OOM favorável ao n8n, swap de 4 GB (hoje não há).
6. **Studio e Postgres do Supabase nunca expostos à internet.** Só o gateway (Kong/Envoy) em `127.0.0.1`, atrás do NPM.
7. **Chaves novas** (nada reaproveitado do banco de teste, cujas chaves foram coladas em chat). `.env` só na VPS, modo 600,
   nunca no git nem no chat.
8. **Avisar o Arthur antes de cada comando que altera algo**, em português simples. Um passo por vez.
9. **Plano de volta (I):** `docker compose down` do projeto novo + remover os Proxy Hosts novos do NPM. O n8n nunca foi tocado.

## Mapa real da VPS (lido em 04/11/2026, só leitura)

- **Máquina:** Ubuntu 22.04.5, **aarch64** (Neoverse-N1), 4 núcleos, **23 GB de RAM (~21 GB livres), sem swap**, disco de 97 GB
  (87 GB livres), carga ~0, 83 dias ligada. Docker 29.7 e Compose v5.5. Usuário dono das coisas: `ubuntu` (home `/home/ubuntu`).
- **Rodando hoje (5 contêineres, ~1,3 GB no total):** `n8n` (~756 MB), `postgres:16-alpine` (banco do n8n, ~177 MB),
  `redis`, `evolution_api` (~174 MB; o Arthur disse que ninguém usa, **confirmar com ele antes de desligar**, e não é
  prioridade) e `npm` (Nginx Proxy Manager, ~179 MB). Rede Docker: `automacoes_automacoes_net`.
- **n8n:** compose em `/home/ubuntu/automacoes/docker-compose.yml`; dados em `/home/ubuntu/automacoes/n8n_data`
  (montado em `/home/node/.n8n`). **Os workflows e as credenciais ficam no banco Postgres do contêiner `postgres`**
  (`DB_TYPE=postgres`), então o backup precisa de `pg_dump` desse banco, **além** da pasta `n8n_data`.
- **`N8N_ENCRYPTION_KEY`:** NÃO está nas variáveis do contêiner. Ela está no arquivo `config` (56 bytes, modo 600) dentro de
  `/home/ubuntu/automacoes/n8n_data`. Copiar esse arquivo para fora da VPS junto com o dump. A string `N8N_ENCRYPTION_KEY`
  também aparece em `/home/ubuntu/.bash_history`: pode haver a chave no histórico; **não imprimir**, e limpar o histórico
  depois que o backup estiver guardado.
- **Portas e firewall:** 22, 80, 81 e 443 abertas (80/81/443 do `npm`). `ufw` inativo; o filtro é o `iptables` com um
  `REJECT` no fim da cadeia INPUT. Duas consequências: (1) a **porta 81 (painel do NPM) está aberta para a internet**:
  avisar o Arthur e restringir depois do go-live; (2) um contêiner (o NPM) falando com um serviço no **host** (o app em
  `127.0.0.1:3001`) **esbarra no REJECT**: ou se libera a porta para a rede Docker (regra de iptables persistida, como na VPS
  atual com o `ufw`), ou se roda o app também em contêiner na mesma rede do NPM. Decidir e testar com `curl` de dentro do `npm`.
  O 127.0.0.1 de dentro do NPM é o próprio NPM, não o host.
- **Capacidade para o CRM:** cabe com folga. Estimativa: Supabase self-hosted 2–3 GB, app ~1 GB, worker/agendador/WAHA/Redis ~1 GB,
  Postgres do Supabase com ~2 GB compartilhados. Mesmo assim, `mem_limit` em tudo que é novo e **criar swap de 4 GB** (hoje não há).
- **Pastas:** `/opt` só tem `containerd` e `unified-monitoring-agent` (agente da Oracle, não mexer). O CRM novo vai em
  `/opt/m1-supabase`, `/opt/m1-growth-crm` e `/opt/m1-whatsapp`.

## Estado do código (04/11/2026)

- Branch `main` do repositório `arthurkuster-m1/M1-Growth-CRM-PC`. O workflow `build-m1` passou no topo da main
  (execução #441, commit `7130f4a`). O `supabase/baseline.sql` é o que instala o banco (não as migrations).
- Já no ar no código: dashboards por link sem login, seletores no desenho do CRM, módulo Honorários e Nuvemshop removidos.
- **Decidido NÃO fazer antes da VPS** (para não misturar mudança de código com migração): remover Empresas e Pessoas,
  telefonia interna e Extensões. Vão para depois.
- O instalador `install-single-server.sh` puxa imagens do projeto ORIGINAL (`ghcr.io/melgarafael/...`), que **não têm o
  código da M1**. Por isso o app da M1 não vem dessas imagens.

## Arquitetura proposta (confirme com o Arthur antes de executar)

| Peça                     | Como                                                                                                                                                                                                                                                                                                                                     | Observação                                                                                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Supabase self-hosted** | Compose oficial do Supabase (a ref pinada do kit: `SUPABASE_REF` em `hostgator-setup-kit/_common.sh`, hoje `self-hosted/v0.8.1`) em `/opt/m1-supabase`, com `hostgator-setup-kit/supabase-single-server.override.yml` (gateway só em `127.0.0.1:8000`, sem `container_name` fixo, rede privada compartilhada)                            | Conferir cada imagem em ARM64. Desligar o que não usamos (analytics, vector). Postgres ajustado à máquina (~2 GB de memória compartilhada). O baseline é Postgres 15+; o Supabase novo vem em 17, o que serve      |
| **App (Next.js)**        | Serviço `systemd` `m1-app` (`deploy/vps/m1-app.service`), pasta `/opt/m1-growth-crm`, `next start -p 3001`                                                                                                                                                                                                                               | `pnpm install` **na própria VPS** (módulos nativos são por arquitetura). Atualização pelo `m1-puxar-build` (baixa o `m1-build.tgz` do release `m1-build-latest`, troca `.next`, reinicia, volta sozinho se falhar) |
| **Worker**               | `pnpm worker` como serviço systemd novo (a criar), ou contêiner                                                                                                                                                                                                                                                                          | Hoje na VPS atual não existe; decidir e criar                                                                                                                                                                      |
| **Agendador (crons)**    | Rotinas de `docker/scheduler/entrypoint.sh` chamando as rotas `/api/v1/cron/*` com o token de cron                                                                                                                                                                                                                                       | Sem ele param: sincronia do Google Agenda, lembretes, follow-up, recuperação de mensagens, retenção. **Auditar uma a uma.** Hoje só as de `deploy/vps/*.timer` rodam                                               |
| **Redis + SRH**          | Docker (`deploy/vps/whatsapp`), usado por rate limit e filas                                                                                                                                                                                                                                                                             | Já tem receita                                                                                                                                                                                                     |
| **WAHA**                 | Docker ARM (`noweb-arm`), sem limite de sessões no Core desde a 2026.6.1 (ver `deploy/vps/whatsapp/LEIA-ME.md`)                                                                                                                                                                                                                                                                       | Só na Fase 4                                                                                                                                                                                                       |
| **Proxy (NPM)**          | Dois **Proxy Hosts** novos no Nginx Proxy Manager: `app.assessoria-m1.com.br` → app (porta 3001) e a API do Supabase (ex.: `api.assessoria-m1.com.br` → gateway, porta 8000), com **Websockets Support ligado** (o Realtime exige), certificado Let's Encrypt pelo próprio NPM e tamanho máximo de corpo grande em "Advanced" para mídia | O destino precisa ser alcançável **de dentro do contêiner do NPM** (ver "Portas e firewall"). O DNS de `api.` o Arthur ainda precisa criar                                                                         |

## ⚠️ Armadilha das variáveis públicas (leia antes de construir)

O build do GitHub **embute** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_APP_URL`
(Settings → Secrets and variables → Actions → **Variables**). Hoje elas apontam para o banco/endereço de TESTE.
Ordem certa: (1) subir o Supabase novo e gerar as chaves → (2) o Arthur troca as 3 variáveis no GitHub pelas novas
(URL pública da API do Supabase, anon key nova, `https://app.assessoria-m1.com.br`) → (3) rodar o `build-m1`
(`workflow_dispatch`) → (4) a VPS puxa o build. Um build feito antes disso abre a tela apontando para o banco errado.

## Checklist (marque conforme avança; peça confirmação ao Arthur nos passos que alteram)

**A. Só leitura**

- [x] Capacidade, portas, docker, serviços: **já mapeado** (seção "Mapa real da VPS"). Falta só: onde fica o volume do `postgres` do n8n,
      quais Proxy Hosts o NPM já tem (para não colidir) e se o `evolution_api` pode sair.

**B. Proteger** — backup de boot (Arthur), `pg_dump` do banco do n8n (contêiner `postgres`), export dos workflows, cópia de `n8n_data` (inclui o arquivo `config` com a chave) para fora, swap 4 GB,
teste de fumaça do n8n (lead de teste chega no Excel) e anotar o resultado.

**C. Supabase self-hosted** — `/opt/m1-supabase`, segredos novos (JWT secret, anon, service role, senha do Postgres,
chave de cifra dos segredos do app, token de cron, chave da WAHA), `mem_limit`, gateway em loopback, conferir ARM64.

**D. Banco** — aplicar `supabase/baseline.sql` com `ON_ERROR_STOP=1`; semear a chave de cifra em
`private.app_secrets` (o Supabase self-hosted aceita `ALTER DATABASE SET`, mas o app lê da tabela; ver `CONTEXTO-M1.md`,
seção "Chave de cifra dos segredos"); `scripts/bootstrap-owner.ts` para criar o dono; testar o isolamento entre empresas
(`pnpm test:db` roda na máquina de desenvolvimento; na VPS, ao menos uma conferência manual com 2 empresas).

**E. App** — Node 22 + pnpm, clonar em `/opt/m1-growth-crm`, `.env.local` novo (modo 600), serviço `m1-app`,
`m1-puxar-build` e os timers de `deploy/vps`, depois da troca das variáveis do GitHub (ver a armadilha acima).

**F. Publicar** — Proxy Hosts no NPM (com Websockets e SSL), conferir
`/api/v1/health` e o login (esperado: 307 para o login na raiz), conferir o n8n.

**G. Rotinas e backup** — worker e agendador, auditar os crons; backup diário (`pg_dump` + mídia + chaves) para fora da VPS
(Cloudflare R2 ou Backblaze B2) com **um teste de restauração**; monitor externo (UptimeRobot) no `/api/v1/health` e no
webhook do n8n.

**H. Ensaio de recuperação** — reiniciar a VPS e ver tudo voltar sozinho, n8n inclusive.

**Fase 4 (depois, com o Arthur):** criar as empresas dos clientes, conectar Meta Ads, Google Agenda (atualizar a URL de
retorno OAuth para o domínio novo; app ainda em modo teste), WAHA, ramo paralelo no n8n (HTTP Request com "On Error:
Continue" para `/api/v1/webhooks/in/<token>`, primeiro numa empresa de teste).

## O que eu (Arthur) preciso decidir ou fazer

- Criar o DNS `api.assessoria-m1.com.br` (ou outro nome) apontando para `163.176.43.6`, sem proxy.
- Trocar as 3 variáveis públicas no GitHub quando o Claude da VPS pedir.
- Conta Oracle em Pay As You Go: **feito**.
- E-mail transacional (Resend) e Google verificado: podem esperar.

## Como retomar o contexto

Leia o histórico do git (`git log --oneline | head -40`) e `docs/ROTEIRO-DE-TESTES-CADENCIA.md` (último item usado: 23.149).
Entrega por mudança: implementar → typecheck → fragmento em `.changes/` → linha no roteiro → commit → PR → squash merge.
Regras do Arthur: não rodar `pnpm build` local, nada de force-push, nada apagado sem a lista aprovada.
