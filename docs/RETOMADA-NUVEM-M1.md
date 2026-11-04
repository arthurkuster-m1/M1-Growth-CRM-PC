# Retomada da sessão de código (nuvem) — M1 Growth CRM

> Para a sessão nova de código, que trabalha no GitHub (branch → PR → merge). A sessão que roda **dentro da VPS**
> cuida só de operar o servidor (`docs/HANDOFF-VPS-M1.md`). Escrito em 04/11/2026.
> Leia: `CLAUDE.md` → `CONTEXTO-M1.md` → este arquivo.

## Quem é o Arthur e como trabalhar com ele

- **Não é programador.** Explique em português simples, um passo de cada vez. Respostas curtas e diretas.
- **Não rodar `pnpm build` local. Não verificar por tela** (ele testa sozinho quando o build chega na VPS). Nunca `force-push`.
- **Nada é apagado sem a lista aprovada por ele; remoções uma de cada vez.**
- Tudo precisa ficar **commitado e enviado** (há um hook que reclama de mudança sem commit).

## Fluxo de entrega de cada mudança

1. Branch de trabalho: `claude/repo-access-local-fleet-app-ehu4eq` (recriada a partir da `main` a cada PR).
2. Implementar. `NODE_OPTIONS=--max-old-space-size=6144 pnpm typecheck` (passa de 120 s: rodar em segundo plano e esperar) e os
   testes do que mexeu (`pnpm vitest run <arquivos>`). A suíte inteira (`pnpm test:unit`) tem ~58 arquivos vermelhos **que já
   existiam na `main`** (ambiente, mocks): compare a lista antes/depois, não espere zero.
3. Fragmento em `.changes/<slug>.md` (`impacto: nada_mudou|capacidade_nova|exige_acao`, `secao`, `titulo`) e uma linha nova no
   fim de `docs/ROTEIRO-DE-TESTES-CADENCIA.md` (último número usado: **23.149**; o próximo é 23.150).
4. Commit com as linhas finais:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: <url da sessão>`.
5. `git fetch origin main && git merge -s ours origin/main -m "Merge: histórico já incorporado à main"` e `git push origin <branch>`.
6. PR (base `main`, repo `arthurkuster-m1/m1-growth-crm-pc`), corpo terminando com
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)` e a URL da sessão. **Squash merge** pelo GitHub.
7. Realinhar: `git fetch origin main && git checkout -B <branch> origin/main && git merge -s ours <HEAD anterior> && git push`.

- Mudança de schema: migration + apêndice idempotente no `supabase/baseline.sql` (antes do bloco da migration 0679) + linha `-- manifest:`.
- O deploy é: push na `main` → o GitHub (`build-m1`) constrói → a VPS puxa sozinha em ~2 min. **O banco de produção é o Supabase
  self-hosted da VPS: nunca executar nada contra ele a partir da nuvem.**

## O que está pronto (até 04/11/2026)

- Limpeza: evidências, módulo Honorários e integração Nuvemshop removidos. Seletores nativos trocados pelo seletor do CRM
  (`SelectDoApp` / `SeletorEmPopup`, que agora aceita `id`, `name`, `required`, opção desabilitada).
- Dashboards por link sem login (`/p/<token>/dashboards`, dados em `/p/<token>/dados/<rota>`; contexto em `lib/dashboards/painel-publico.ts`).
- IA e onboarding antigo suspensos (flags `M1_IA_SUSPENSA`, `M1_ONBOARDING_ANTIGO_SUSPENSO`); novo onboarding curto; selo "Em breve".
- Go-live: `docs/PLANO-GO-LIVE-MVP-M1.md` (trilha), `docs/PLANO-GO-LIVE-M1.md` (roteiro técnico), `docs/HANDOFF-VPS-M1.md` (VPS).
- Inventário de limpeza: `docs/INVENTARIO-LIMPEZA-M1.md` (lotes 1, 2 e 5 aguardam aprovação do Arthur).

## Pendências, em ordem

1. **Commits feitos na VPS (`a0c4dbfb`, `70bca3a9`)**: só existem no disco da VPS. Para chegarem: chave de deploy com escrita
   no GitHub e a sessão da VPS faz `git push origin HEAD:refs/heads/vps/ajustes-da-vps`; depois trazer, abrir PR e mesclar.
2. **Tela de Gestão de Tenants (super-admin)** — pedido detalhado abaixo.
3. Remoções aprovadas, **uma de cada vez**: Empresas e Pessoas (`crm_b2b`; manter "Dados externos"), telefonia interna (manter
   `lib/wacalls`, conferir `app/api/v1/voice/*`), Extensões. **Só depois de a VPS estar estável.**
4. Perguntas do onboarding novo ("Para conversar", `docs/PLANO-ONBOARDING-NOVO-M1.md`) e TTL do convite (hoje 24 h; sugerido 7 dias).
5. Automações (fases), Anti-No-show (rascunho a aprovar), IA, Financeiro: fase 6 do plano, não bloqueiam o MVP.

## Plano do onboarding e do cadastro de novos clientes (o Arthur quer seguir EXATAMENTE este plano)

O desenho está em **`docs/PLANO-ONBOARDING-NOVO-M1.md`** (telas já feitas em 03/11: Seu negócio → Sua equipe → Tudo pronto; o que foi
reaproveitado e o que ficou de lado; **perguntas de desenho para conversar com ele** e pendências técnicas). Junto com ele valem:
`docs/PLANO-GO-LIVE-MVP-M1.md` (fase 1.1: criar empresa, convidar dono e funcionário, Modo agência, ver como o cliente) e
`docs/GUIA-ADMIN-M1.md` (o que cada tela do `/admin` faz). A tela de Gestão de Tenants (seção acima) é a parte de cadastro de empresas
desse mesmo plano. **Não mudar o desenho sem perguntar:** ao começar, leia as perguntas abertas do plano e leve-as ao Arthur uma por vez.
Pendências técnicas conhecidas: reescrever o e2e J1 (`tests/e2e/vps-fresh-onboarding.spec.ts`, hoje `describe.skip`) para o fluxo novo;
decidir o prazo do convite (24 h hoje, 7 dias sugerido).

## Pedido: refazer a Gestão de Tenants (`/admin/tenants`)

Visual do design system do CRM (`components/ui`, tokens de `app/globals.css`, referência `/app/design-system`) e a lógica de
uso do cadastro de oportunidade: abrir a empresa e editar tudo no lugar, estilo Notion. Ordem:

1. **Ficha** em `/admin/tenants/[id]`, no padrão de `app/app/leads/[id]` (`components/leads/FichaDoLead.tsx`, `SecaoDaFicha.tsx`).
   Clicar numa empresa da lista abre a ficha.
2. **Todos os dados editáveis**: `display_name`, `legal_name`, `cnpj`, `slug`, `status`, `timezone`, `locale`, `currency`, `country`,
   `dpo_email`, `privacy_policy_url`, `ai_budget_cents`, `media_retention_days`, `interface_settings`, `onboarded_at`,
   `suspended_at/reason`, `created_at`, e a marca (`organizations.settings.branding`: nome, cor, logo). Hoje
   `app/api/v1/admin/tenants/[id]/route.ts` só tem GET: **criar o PATCH** (platform admin com escrita, `requireSupportWrite` antes do
   efeito, Zod, auditoria com ação enumerada em `lib/audit/actions.ts`). **Slug só leitura** depois de criado, a menos que se
   prove que trocar é seguro. Suspender/reativar já existem (rotas `suspend` e `reactivate`): reaproveitar, com confirmação.
3. **Seção Equipe** na ficha: membros de `user_organizations` (nome, e-mail, papel viewer/agent/manager/admin, último acesso, ativo ou
   revogado), com trocar papel, revogar e convidar. Reaproveitar `/app/team` e `lib/auth/issue-invite.ts`; respeitar RBAC e MFA do `CLAUDE.md`.
4. **Lista** `/admin/tenants` no mesmo visual (cartões ou tabela do design system, busca, filtro por status, cor da empresa,
   contagem de pessoas). Pode usar o motor de tabela em `components/motor`.
5. **Criar empresa** (`/admin/tenants/new`) no mesmo visual, **sem o campo "Plano"** (não faz nada: só vai para o metadata da
   auditoria). Tirar de `lib/schemas/tenant-creation.ts`, de `new/_form.tsx`, da rota POST e do metadata da auditoria. Sem migration.
   Manter o fluxo: se o e-mail do dono for o do próprio super-admin, ele vira dono sem convite; senão cria o convite (link com Copiar).

- Regras: telas fora de `/admin/tenants` intactas; sem migration salvo se indispensável; i18n com `t("português")` e espanhol em
  `lib/i18n/dicionario.ts`; tela nova com porta em `lib/navigation/catalogo.ts`; Ctrl+Z na edição de dado; service role sempre com
  `organization_id` filtrado manualmente e nunca vindo do body; rota mutante = `requirePlatformAdminEscrita` + `requireSupportWrite` +
  `audit()` + `ok()/fail()`; nada de "Deskcomm" novo em texto de tela (`tests/unit/branding.test.ts`).
- Observação: a ficha atual ainda conta a integração Nuvemshop (`app/api/v1/admin/tenants/[id]/route.ts`, `health`); isso sai.
- Prova: typecheck, lint e testes novos (PATCH: permissão, validação, auditoria; ficha). **A prova por tela com Playwright que o
  prompt original pede NÃO se aplica ao combinado com o Arthur** (ele testa sozinho); registrar a linha no roteiro de testes.
- Produção: existe uma empresa (Assessoria M1, slug `assessoria-m1`, dono `arthurkuster2.0@gmail.com`). Serão criadas por esta tela:
  Rua Model Management (`05-rua-model`), One Company (`06-one-company`) e Diore Talents (`07-diore`), todas com o Arthur como dono.
- Sugestão de PRs: (1) Plano + PATCH; (2) ficha; (3) equipe; (4) lista e criar.
