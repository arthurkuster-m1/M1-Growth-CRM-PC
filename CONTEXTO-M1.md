# CONTEXTO DO M1 GROWTH CRM

> Estado atual para uma sessão nova. Histórico completo (builds antigos, VPS velha, diários): `docs/historico/CONTEXTO-M1-completo.md`.
> Doutrina técnica do upstream: `CLAUDE.upstream.md` (sob demanda).

## O que é
**M1 Growth CRM**: fork independente (MIT) do DeskcommCRM, não recebe atualizações do original. Visual clean, arredondado, pouco texto; cor primária **#366D6F**; white-label (cor/nome/logo em `/admin/marca`) e tema claro/escuro. Estilo "Notion": editar no lugar, arrastar, edição em massa (Tarefas, depois CRM).

## Onde roda (VPS nova, desde 04/11/2026)
- **VPS Oracle** São Paulo, IP 163.176.43.6, Ubuntu 22.04 **ARM64**, 4 núcleos, 23 GB. O **n8n** (leads → Excel) mora na mesma máquina em `/home/ubuntu/automacoes` e é **intocável**.
- Proxy = **Nginx Proxy Manager** (contêiner `npm`, painel :81). Nunca reiniciar `npm`; só `docker exec npm nginx -t && docker exec npm nginx -s reload`.
- Endereços: CRM `https://app.assessoria-m1.com.br` · Supabase API `https://supabase.assessoria-m1.com.br` · n8n `https://n8n.assessoria-m1.com.br`.
- **Supabase self-hosted** em `/opt/m1-supabase` (projeto Docker `m1-supabase`, Postgres 17, override `docker-compose.m1.yml`, banco em 127.0.0.1:54322).
- **App** em `/opt/m1-growth-crm`, serviço systemd `m1-app` (porta 3001, usuário `ubuntu`, log `/var/log/m1.log`). `.env.local` só na VPS (modo 600). Reinício: `systemctl restart m1-app`. **Não usar `nohup`.**
- **Deploy:** `git push origin main` → workflow `build-m1` → release `m1-build-latest` → timer `m1-puxar-build` (2 em 2 min) troca `.next`, reinicia, volta sozinho se falhar. Abas abertas dão "Server Reference ID did not match" até Ctrl+Shift+R. Remote: `git@github-m1:arthurkuster-m1/M1-Growth-CRM-PC.git`.
- **Crons:** 39 linhas no crontab de `ubuntu` chamando `http://127.0.0.1:3001/api/v1/cron/*` com `INTERNAL_SECRET`. Não usar `docker/scheduler/entrypoint.sh` (quebrado por aspas) e não instalar os timers `deploy/vps/m1-*` (duplicariam).
- **Backup diário** 03:15 UTC (`/home/ubuntu/backup-diario.sh`, gpg → Cloudflare R2 `m1-backups/diario/`, 14 dias; restauração testada). Credencial R2 só em `~/.config/rclone/rclone.conf`.
- **Redis + SRH** em `/opt/m1-whatsapp`. **WAHA**: padrão da agência em `127.0.0.1:3100` + uma instância por cliente (`/opt/m1-whatsapp/clientes/<slug>/`, novo: `/opt/m1-whatsapp/novo-cliente.sh <slug> <porta>`). Segredos em `/home/ubuntu/segredos-waha.env`. Serviço `m1-worker` ligado com a **IA DESLIGADA** (decisão do Arthur: segue pausada). Ver `deploy/vps/whatsapp/LEIA-ME.md`.
- Monitor: UptimeRobot. Dono do banco: arthurkuster2.0@gmail.com, empresa "Assessoria M1".
- Chave de cifra dos segredos: `private.app_secrets` (`nuvemshop_oauth_key`). **Não trocar** sem migrar o que já está cifrado.
- Google Agenda: OAuth em `/admin/google`, app em modo TESTE; cada pessoa conecta em `/app/agenda`.
- Migrations próprias do M1 vão além da 0595; cada uma existe em `supabase/migrations/` E como bloco no fim de `supabase/baseline.sql`. Sem `psql` na VPS: aplicar com script Node + `pg` (2×, testar RLS com ROLLBACK; `#` na senha vira `%23`).

## Armadilhas
- Nunca `pkill -f "next ..."` num comando que contém esse texto (mata o próprio shell); use PIDs.
- Nunca `prettier --write` em pasta inteira; nunca `git add -A` sem checar.
- Build local só como plano B (`NODE_OPTIONS=--max-old-space-size=3072 pnpm build`).
- `NEXT_PUBLIC_*` entram no BUILD (variáveis do repositório no GitHub).
- Testes: `.env.local` fora do lugar; `tsc` com `--max-old-space-size=6144`; `catalogo-de-ensaio-espelha-o-vocabulario` falha sem Python.

## Padrões do motor (siga-os)
- Edição otimista (`setQueryData` + rollback); posição `numeric` por ponto médio (`lib/motor/ordem.ts`); layout por pessoa guarda só desvios (`lib/motor/layout.ts`); status = opção por organização ligada a grupo fixo via trigger; valores personalizados em `crm_tasks.custom_fields` validados por tipo (`lib/tarefas/propriedades.ts`); datas no fuso da organização (`lib/inicio/datas.ts`).
- **Ctrl+Z é padrão** em toda tabela (`lib/motor/desfazer.ts`) e no Editor de Blocos; recurso novo que edita/apaga nasce com Ctrl+Z.
- i18n: `t("português")` + espanhol em `lib/i18n/dicionario.ts` (sem `t(variável)`, sem prosa fora de `t()`, cuidado com chave duplicada).
- Rota mutante: `requireRole`/`requireSupportWrite`, `ok()/fail()`, `audit()`. Tela nova: porta em `lib/navigation/catalogo.ts`.

## Documentos (fonte da verdade)
`docs/PLANO-M1.md` (plano-mãe, 15 frentes) · `docs/PLANO-CRM-M1.md` · `docs/PLANO-CAMPANHAS-M1.md` (C1 feito; C2 = planilha no app) · `docs/PLANO-MARKETING-M1.md` · `docs/PLANO-REDES-SOCIAIS-M1.md` (só plano) · `docs/HANDOFF-VPS-M1.md`.

## Estado do produto (fim de 11/10/2026; confira os planos para o resto)
Feito e no ar: Tarefas (motor Notion: tabela/kanban/calendário/timeline, filtros, propriedades, massa), Cronograma, Produtos em escala, aba Marketing completa (páginas em blocos, link público `/p/<token>`, histórico, ofertas → `catalog_products`), CRM sessões 1–2, Campanhas C1. Fluxo "Arthur manda os dados, Claude monta": `npx tsx scripts/marketing-preencher.ts <id-empresa> <módulo> <blocos.json>` (grava só rascunho).
**Anotações (A1 + editor estilo Notion, 11/2026):** árvore de páginas por organização em `notes_pages` (migration 0686; `blocks` guarda o documento do **BlockNote**, `visible_to_client` por página, lixeira em `deleted_at`). Telas `/app/anotacoes` (cliente, abaixo de Financeiro) e `/app/agencia/anotacoes` (abaixo de Configurações; guarda na organização ativa). Editor `components/anotacoes/EditorDeNotas.tsx` (página em branco, "/" e "+", bloco `subpagina` = cartão arrastável; ao abrir, os cartões são ajustados às filhas da árvore; cartão apagado manda a subpágina para a lixeira). Documento: `lib/anotacoes/documento.ts`. Próximo: A2 (busca, favoritos, recentes, Caixa de entrada).
Próximos (o Arthur escolhe UM de cada vez): otimizar tela de Campanhas; Campanhas C2; CRM sessões 3–9; dashboard meta × realizado; IA ajudante (prompts em `docs/metodo-m1-referencia/`); Inbox; Conexões; Agenda.
Pendências técnicas: restringir porta 81 do NPM; Advanced do host `app.` no NPM (`client_max_body_size 100m` + buffers 32k) se sumir após salvar; Meta Ads, Google Agenda (URL de retorno OAuth) e ramo paralelo no n8n (Fase 4); limpeza do que veio do projeto original e instalador para VPS nova (depois de terminar a edição do software).
Regra do Arthur: um único chat, uma coisa por vez.
