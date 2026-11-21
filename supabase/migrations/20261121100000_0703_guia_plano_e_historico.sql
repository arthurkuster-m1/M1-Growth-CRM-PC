-- manifest: **Guia (G4) — o plano do cliente.** `guia_passos` ganha `no_plano`, `lado` (agência ou cliente), `responsavel_id`, `prazo` e `ordem` (posição numeric por ponto médio): o plano é o conjunto de passos do mapa que a agência escolheu fazer, com quem faz e até quando. Nova `guia_historico` (o que mudou no plano e nas marcações, quando e por quem). A tarefa criada a partir do passo herda responsável, prazo e lado e entra na semana do Cronograma (`crm_tasks.cronograma_lado`). RLS: gerente ou acima. Sem função, sem trigger.

-- 0703 — GUIA: O PLANO DO CLIENTE (docs/PLANO-GUIA-M1.md, G4)

-- ── 1. O plano mora em guia_passos: continua "só as exceções", agora também as escolhas ───────────
alter table public.guia_passos
  add column if not exists no_plano boolean not null default false,
  add column if not exists lado text,
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null,
  add column if not exists prazo date,
  add column if not exists ordem numeric not null default extract(epoch from clock_timestamp());

alter table public.guia_passos drop constraint if exists guia_passos_lado_check;
alter table public.guia_passos
  add constraint guia_passos_lado_check check (lado is null or lado in ('agencia', 'cliente'));

create index if not exists guia_passos_plano_idx
  on public.guia_passos (organization_id, ordem) where no_plano;

-- ── 2. O histórico: o que mudou, quando e por quem ──────────────────────────────────────────────
create table if not exists public.guia_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Nulo = mudança do plano como um todo (ex.: "montou o plano padrão").
  passo_id text check (passo_id is null or passo_id ~ '^P[0-9]{2}(\.[0-9])?$'),
  acao text not null check (acao in (
    'plano_montado', 'plano_adicionado', 'plano_removido', 'plano_alterado',
    'passo_marcado', 'passo_reaberto', 'tarefa_criada'
  )),
  -- O que mudou, em campos curtos (de → para). Nunca texto livre longo nem dado de lead.
  detalhe jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhe) = 'object' and pg_column_size(detalhe) <= 4000),
  feito_por uuid references auth.users(id) on delete set null,
  feito_em timestamptz not null default now()
);
create index if not exists guia_historico_org_idx
  on public.guia_historico (organization_id, feito_em desc);

-- ── 3. RLS: gerente ou acima (a agência entra por ser platform admin ou membro) ─────────────────
alter table public.guia_historico enable row level security;
drop policy if exists guia_historico_select on public.guia_historico;
create policy guia_historico_select on public.guia_historico for select using (
  ((organization_id in (select public.fn_user_org_ids()))
   and public.fn_role_at_least(organization_id, 'manager'))
  or public.fn_is_platform_admin());
drop policy if exists guia_historico_write on public.guia_historico;
create policy guia_historico_write on public.guia_historico
  using (public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager')))
  with check (public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager')));
revoke all on public.guia_historico from anon;
grant select, insert, update, delete on public.guia_historico to authenticated;

notify pgrst, 'reload schema';
