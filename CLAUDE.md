# CLAUDE.md — M1 Growth CRM

Fork independente (MIT) do DeskcommCRM. **Estado do projeto, VPS, próximos passos: [`CONTEXTO-M1.md`](CONTEXTO-M1.md)** (leia primeiro).
A doutrina completa do upstream está em [`CLAUDE.upstream.md`](CLAUDE.upstream.md) — **não é carregada sozinha**; abra só a seção que a tarefa pedir (schema, WAHA, audit, LGPD, testes, migrations).

## Como trabalhar com o Arthur
- Ele NÃO é programador. Português simples, **um passo de cada vez**, testando cada passo.
- Comando para ele rodar: um por bloco de código, sem `$`, explicando o que faz.
- Telas existentes ficam intactas; só se cria "em cima".
- Nunca ação destrutiva em nuvem/banco sem pedir permissão. Não contornar bloqueios de segurança. Nunca digitar a senha dele.
- Nunca tocar no Supabase `gyskfoxsltgjhagxkbhg` (é de outro projeto).

## Stack
Next.js 16 (App Router) + React 19 + TypeScript estrito + Tailwind 4 (CSS-first, sem `tailwind.config`) + shadcn/ui; Supabase (Postgres, RLS, Auth, Realtime, Storage); Zod em todo input externo; pnpm, Node 22.

## Regras que não se negociam
- **Multi-tenant:** `organization_id` + RLS em toda tabela; admin client (service role) sempre filtra `organization_id` vindo de fonte confiável, nunca do body.
- **Auth:** `getUser()`, nunca `getSession()`. API key nunca em query string. Bearer só em hash SHA256.
- **Rota mutante:** `requireRole` + `requireSupportWrite(` antes do efeito, `ok()/fail()` (`lib/api/wrappers.ts`), `audit()` com ação em `lib/audit/actions.ts`, Zod no input.
- **Trigger Postgres nunca faz HTTP** (emite em `event_log`).
- **Migration:** arquivo em `supabase/migrations/<timestamp>_<NNNN>_<slug>.sql` (com `-- manifest:`) **e** apêndice idempotente no fim de `supabase/baseline.sql`. NNNN = próximo sequencial (hoje as do M1 passam de 0595). Função nova em `public`: `revoke execute ... from public, anon`.
- **i18n:** texto da tela = `t("português")` + espanhol em `lib/i18n/dicionario.ts`.
- **Tela nova** precisa de porta em `lib/navigation/catalogo.ts`.
- Sem `console.log`; env nova vai em `.env.example` + `lib/env.ts`.
- Padrões do motor (edição otimista, Ctrl+Z, posição `numeric`): ver `CONTEXTO-M1.md`.

## Comandos
```bash
pnpm typecheck        # NODE_OPTIONS=--max-old-space-size=6144 se faltar memória
pnpm lint
pnpm test:unit        # sem caminho; --maxWorkers=1 se faltar memória
pnpm vitest run arquivo.test.ts
```
Testes: mova `.env.local` para fora antes (ele altera o limitador de taxa). Antes de commitar: tsc zerado, eslint sem erros, prettier só nos arquivos tocados (nunca em pasta inteira), testes dos arquivos tocados.

## Git e deploy
- Commits só dos arquivos tocados (nunca `git add -A` às cegas). Terminam com a linha `Co-Authored-By` indicada pela sessão.
- Deploy: `git push origin main` → GitHub `build-m1` (~2 min) → a VPS troca sozinha (~20 s). Detalhes em `CONTEXTO-M1.md`.
- Atualize a branch com a `main` antes de começar (`git fetch origin && git merge origin/main`); nunca `reset --hard`.

## Mapa de docs
`docs/PLANO-M1.md` (plano-mãe) · `docs/PLANO-CRM-M1.md` · `docs/PLANO-CAMPANHAS-M1.md` · `docs/PLANO-MARKETING-M1.md` · `docs/HANDOFF-VPS-M1.md` · histórico completo: `docs/historico/CONTEXTO-M1-completo.md`.
