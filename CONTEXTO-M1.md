# CONTEXTO DO M1 GROWTH CRM — leia antes de qualquer coisa

> Este arquivo existe para uma sessão nova do Claude Code saber onde o projeto está.
> Ele vale MAIS que o `CLAUDE.md` do DeskcommCRM quando os dois divergirem sobre o "como trabalhar com o Arthur".
> A doutrina técnica (multi-tenancy, RLS, migrations, i18n, auditoria) do `CLAUDE.md` continua valendo.

## Quem é o usuário e como trabalhar
- Arthur NÃO é programador (sabe HTML/landing pages no Cloudflare Pages e n8n). Fale em português simples, **um passo de cada vez**, e teste cada passo antes do próximo.
- Comandos para ele rodar: **um comando por bloco de código**, sem `$`, explicando o que faz.
- Ordem combinada: do mais fácil (frontend) ao mais difícil. **Telas existentes ficam intactas**; só se cria "em cima".
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Nunca executar ação destrutiva em nuvem/banco sem pedir permissão. Não contornar bloqueios de segurança.

## O que é
**M1 Growth CRM**: fork independente (MIT) do DeskcommCRM. Não recebe atualizações do original.
Visual: clean, arredondado, pouco texto (referência: Chronos Dock e assessoria-m1.com.br/cronograma). Cor primária **#366D6F**. Mantém white-label (cor/nome/logo em /admin/marca) e tema claro/escuro.

Escopo desejado (longo): login e-mail/Google, super admin multi-tenant, Estratégico (onboarding, planejamento estilo Notion, ZMOT, cronograma, dashboard), Produtos/Ofertas, equipe, Tarefas estilo Notion (Kanban/Lista/Timeline/Calendário), leads+inbox+CRM (rastreio de origem, Meta CAPI via n8n), funis, compras/LTV, agenda Google, respostas rápidas, prospecção, automações, agente de IA, conexões, webhooks de LP, dashboards (tráfego, LPs/criativos, financeiro), audit log traduzido, central de avisos. Ele quer o "jeito Notion" (editar status/propriedades no lugar, arrastar ordem/largura, edição em massa) em Tarefas e depois no CRM (leads).

## Ambiente (VPS — é onde se trabalha agora)
- Pasta: `/opt/m1-growth-crm`. Repositório: https://github.com/arthurkuster-m1/M1-Growth-CRM-PC (público; tudo é teste).
- No ar em **https://www.infra-assessoria-m1.cloud** (Caddy na porta 443 → app na porta 3001). Caddy é um serviço do sistema (`/etc/caddy/Caddyfile`).
- A VPS (7,8 GB RAM, 2 núcleos) tem **swap de 6 GB** criado só para o build. Sem swap o build é morto (exit 137).
- O app roda em modo PRODUÇÃO, fora do Docker, com `nohup` (ainda NÃO é serviço fixo — se a VPS reiniciar, ele não volta. Pendência: criar serviço systemd).
- Atualizar o que está no ar depois de mudar o código:
  1. `cd /opt/m1-growth-crm && git pull`
  2. `pnpm install` (se mudou dependência)
  3. `NODE_OPTIONS=--max-old-space-size=3072 pnpm build` (5–15 min)
  4. `pkill -f "next start"; nohup pnpm exec next start -p 3001 > /var/log/m1.log 2>&1 &`
  5. conferir: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/login` (200 ou 307) e `tail -40 /var/log/m1.log`
- `NEXT_PUBLIC_*` entram no BUILD; mudar uma exige build de novo. Variáveis normais são lidas ao ligar.
- `.env.local` mora só na VPS (ignorado pelo git). Contém chaves de TESTE do Supabase. Valores provisórios (sem WhatsApp/Redis ainda): `WAHA_*` e `UPSTASH_*` são placeholders só para passar a validação de produção — rate limit/IA/WhatsApp NÃO funcionam de verdade.
- Aviso do Next: "next start does not work with output: standalone". Funciona; se algum arquivo estático falhar, a alternativa é `node .next/standalone/server.js` (copiando `.next/static` e `public` para dentro de `.next/standalone`).
- `vitest`: use `--maxWorkers=1` se faltar memória. `tsc`: `NODE_OPTIONS=--max-old-space-size=8192` (na VPS, 3072–4096 e swap). O teste `catalogo-de-ensaio-espelha-o-vocabulario` falha sem Python (já era assim).
- O desenvolvimento no PC do Arthur ficou lento demais (Windows). Por isso o trabalho passou para a VPS. Para testar a tela, ele abre o domínio acima; **faça build + restart** para ele ver a mudança (não há servidor de desenvolvimento rodando).

## Banco (Supabase de TESTE)
- Projeto novo `fpxgtidrkcypzbsmchev` (sa-east-1), só do M1. Credenciais só no `.env.local`.
- **NUNCA tocar, apagar ou apontar para o Supabase `gyskfoxsltgjhagxkbhg`** (é do DeskcommCRM antigo do Arthur).
- Troque todas as senhas/chaves antes de qualquer uso com dado real (já foram coladas em chat).
- Migrations próprias: 0582 (status por organização + posição), 0583 (`user_view_preferences`), 0584 (propriedades personalizadas + `custom_fields`). Cada uma existe como arquivo em `supabase/migrations/` E como bloco no fim do `supabase/baseline.sql`. Já aplicadas no banco novo.
- Para aplicar migration nova: script Node com `pg` lendo a connection string do `.env.local` (não há `psql`), aplicando 2× (idempotência), testando RLS em transação com ROLLBACK. Senha com `#` precisa ser codificada (`%23`) na URL.
- Acesso ao app: Arthur entra sozinho (login Supabase). **Nunca digite a senha dele em tela de login.**
- Site URL / Redirect URLs do Supabase já apontam para o domínio.

## O que já foi feito (commits)
1. Visual base teal #366D6F + neutros slate (`app/globals.css`, `lib/branding/*`).
2. Menu lateral novo (`components/shell/Sidebar.tsx`): itens soltos Início/Tarefas, grupos fechados exceto o ativo.
3. `/app/inicio` (home pós-login).
4. `/app/tarefas` — motor de tabela estilo Notion (`components/motor/*`, `hooks/tarefas/*`, `lib/motor/*`, `lib/tarefas/*`).
5. 5a colunas arrastáveis/redimensionáveis/ocultáveis (layout por pessoa em `user_view_preferences`); 5b propriedades personalizadas (texto, número, seleção, múltipla, data, caixa, link); 5c seleção + ações em massa (`/api/v1/tasks/bulk`).
6. **6a (último commit `7ae8cd8`)**: filtros, ordenação e agrupamento — regras puras em `lib/motor/consulta.ts` (22 testes em `tests/unit/motor-consulta.test.ts`), barra `components/motor/BarraDeConsulta.tsx`, grupos recolhíveis em `TabelaDoMotor`. Guardados no mesmo `config` do layout (`preferenciasDaTabelaSchema`). **Validado pelo Arthur na tela (08/10/2026): funciona.**
7. **6b (commit `bd9139b`)**: alternador de visualização Tabela | Quadro (Kanban) | Calendário | Linha do tempo em `/app/tarefas` (`QuadroKanban.tsx`, `CalendarioDeTarefas.tsx`, `LinhaDoTempo.tsx`; escolha guardada em `config.visualizacao`: tabela/kanban/calendario/timeline; contas de calendário em `lib/motor/calendario.ts`). No celular (<768px, hook `useCelular`) a tabela vira lista de cartões. Tarefa nova herda os filtros ativos (`valoresDeNascimento` em `lib/motor/consulta.ts`). **Aguardando o Arthur testar na tela** (build feito, ver abaixo).

## Aprendizados desta rodada (08/10/2026)
- Modo dev (`next dev`) foi testado na VPS e DESCARTADO: lento demais (compila cada tela na 1ª visita). Mantemos produção + build. Ideia aprovada em princípio: build automático no GitHub Actions (máquina maior, 3–5 min) enviando o pronto para a VPS; ainda não feito. Enquanto isso: juntar várias mudanças em UM build.
- NUNCA use `pkill -f "next ..."` num comando que contém esse texto: o pkill mata o próprio shell (exit 144). Use PIDs (`pgrep`/`ps`) ou um script em arquivo (`/tmp/m1-deploy.sh`: build → mata next-server → `setsid nohup pnpm exec next start -p 3001`).
- Caddyfile de produção aponta para a porta 3001 (backup em `/etc/caddy/Caddyfile.prod.bak`).
- Remote Control foi ligado nesta sessão a pedido do Arthur (ele trabalha também pelo celular).

## Build automático no GitHub (montado em 09/10/2026; falta o Arthur ligar 2 coisas no GitHub)
- Fluxo: commit na VPS → `git push` → workflow `.github/workflows/build-m1.yml` constrói o app (em `/opt/m1-growth-crm` no runner, mesmo caminho da VPS) e publica `m1-build.tgz` no release público `m1-build-latest` (corpo do release = sha do commit) → timer `m1-puxar-build.timer` na VPS (a cada 2 min) roda `/usr/local/bin/m1-puxar-build.sh`: baixa, troca `.next`, reinicia `m1-app`, confere /login e volta ao build anterior se falhar. Arquivos em `deploy/vps/`.
- O app agora é um serviço systemd: `systemctl status|restart m1-app` (log em /var/log/m1.log). Resolve a pendência "app não volta após reiniciar a VPS". NÃO use mais `nohup`.
- A VPS não tem credencial para dar push no GitHub. Foi criada a chave `~/.ssh/m1_github_deploy` (alias `github-m1` em `~/.ssh/config`); o Arthur precisa cadastrar a parte pública em Settings → Deploy keys (com escrita). Depois: `git remote set-url origin git@github-m1:arthurkuster-m1/M1-Growth-CRM-PC.git`.
- O workflow precisa de 3 Variables do repositório (Settings → Secrets and variables → Actions → Variables): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_APP_URL (valores no `.env.local`).
- Enquanto isso não estiver ligado, o jeito antigo continua valendo (build na VPS: `/tmp/m1-deploy.sh` ou os passos acima, mas reinicie com `systemctl restart m1-app`).
- Push na main também dispara os workflows herdados do DeskcommCRM (ci, e2e, perf, publish-image, release…). `tests/unit/executor-proprio-so-roda-o-que-e-nosso.test.ts` já falhava antes (depende do nome do repo do fork).

## Integrações montadas em 09/10/2026
- **Google Agenda**: credenciais OAuth (cliente "Aplicativo da Web") cadastradas em /admin/google; escopos `calendar.events` + `calendar.readonly`; app do Google Cloud em modo TESTE (só e-mails cadastrados como "usuários de teste"; produção exige verificação do Google). Cada pessoa conecta em /app/agenda › Conectar Google.
- **Chave de cifra dos segredos** (`private.app_secrets.nuvemshop_oauth_key`, cópia em `NUVEMSHOP_OAUTH_ENCRYPTION_KEY` no `.env.local`): semeada no banco de teste. NÃO trocar sem migrar o que já foi guardado cifrado. O Supabase cloud não aceita `ALTER DATABASE SET` de GUC; por isso a chave mora na tabela.
- **WhatsApp**: WAHA + Redis(SRH) em Docker, pasta `/opt/m1-whatsapp` (ver `deploy/vps/whatsapp/LEIA-ME.md`). WAHA Core = 1 número; vários números = WAHA Plus (pago) ou API oficial da Meta.
- ⚠️ **Crons**: `docker/scheduler/entrypoint.sh` lista dezenas de rotinas (sincronia do Google Agenda, lembretes, follow-up, retenção…) que num self-host rodam por um container `scheduler`. Na VPS do M1 só a de tarefas repetidas está agendada (systemd). As demais NÃO rodam ainda — a sincronia contínua do Google Agenda e os lembretes dependem disso.

## Padrões do motor (siga-os)
- Edição otimista (`setQueryData` + rollback) nos hooks; posição `numeric` por ponto médio (`lib/motor/ordem.ts`); layout por pessoa guardando só os desvios (`lib/motor/layout.ts`); status = opção (nome/cor por organização) ligada a um grupo fixo (pending/in_progress/done/cancelled) via trigger; valores personalizados em `crm_tasks.custom_fields` validados por tipo (`lib/tarefas/propriedades.ts`); datas sempre no fuso da organização (`lib/inicio/datas.ts`, `lib/motor/datas-do-campo.ts`).
- i18n: texto da tela = `t("português literal")` + espanhol obrigatório em `lib/i18n/dicionario.ts` (teste `i18n-espanhol-cobre-a-tela`; sem `t(variável)`, sem prosa fora de `t()`; cuidado com chave duplicada no objeto).
- Rota mutante: `requireRole`/`requireSupportWrite`, `ok()/fail()`, `audit()` com ação enumerada em `lib/audit/actions.ts`. Tela nova precisa de porta em `lib/navigation/catalogo.ts`.
- Verificação antes de commitar: `tsc` zerado, `eslint` sem erros (warnings aceitos), `prettier`, testes unitários dos arquivos tocados + os guardas de i18n/navegação/sidebar.

## Próximos passos (plano aprovado)
- **6c (próximo)**: criar tarefa dentro de um grupo/coluna do Quadro herdando o valor do grupo; **visualizações salvas e compartilháveis** (filtro+ordem+grupo+layout com nome), que passam a viver no banco (`user_view_preferences` hoje guarda só a preferência da própria pessoa).
- Depois: adotar o motor no **CRM (leads)** POR CIMA da estrutura existente, com muito cuidado (leads alimentam inbox, automações, follow-up, IA, webhooks).
- Depois: módulos da lista (Estratégico/Planejamento/Onboarding, Produtos, dashboards, etc.).
- Pendências menores: trocar redirecionamento pós-onboarding de /app/inbox para /app; nome do usuário "Dono" → nome real; seletor de empresa no menu; instalar Redis/WAHA de verdade quando formos usar WhatsApp e IA.
