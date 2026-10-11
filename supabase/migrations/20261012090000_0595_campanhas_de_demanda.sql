-- manifest: **Campanhas de demanda (Geração de demanda).** `demand_campaigns` (uma campanha do Software = uma ação de vendas: canal, status, período ou contínua, funil do CRM, investimento com imposto, metas, campanhas da plataforma atreladas) e `demand_campaign_notes` (diário de bordo: análise, feedback do cliente, planejamento e otimização). Não confundir com `campaigns` (disparo em massa).

-- ============================================================================
-- 0595 — CAMPANHAS DE DEMANDA
--
-- Uma campanha do Software é uma AÇÃO DE VENDAS (ex.: "[1º sessão] Campanha R$79,90"). Pode ter
-- várias campanhas da plataforma (Meta, Google…) atreladas ao mesmo objetivo, guardadas como uma
-- lista em `platform_campaigns` (id da plataforma, quando existe, e o nome).
--
-- O que é MEDIDO (investimento por dia, leads, vendas) entra nas próximas sessões; aqui está o
-- cadastro e o diário de bordo. Nome próprio de propósito: `campaigns` já é o disparo em massa.
--
-- Leitura: toda a empresa (o cliente vê as campanhas). Escrita: manager+. As notas de análise,
-- feedback e planejamento são só da agência; as "otimizações" o cliente também lê.
-- ============================================================================

create table if not exists public.demand_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null default 'trafego_pago',
  status text not null default 'planejada',
  description text not null default '',
  idea text not null default '',
  objective text not null default '',
  start_date date,
  end_date date,
  continuous boolean not null default false,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  -- Investimento bruto e como ele vale (total da campanha, por dia, semana ou mês).
  budget numeric(14, 2),
  budget_period text not null default 'total',
  -- Imposto sobre o investimento (ex.: 12,5% da Meta); o líquido é bruto ÷ (1 + imposto).
  tax_pct numeric(5, 2) not null default 0,
  goal_leads integer,
  goal_cpl numeric(12, 2),
  goal_sales integer,
  goal_revenue numeric(14, 2),
  platform text not null default '',
  sheet_url text not null default '',
  platform_campaigns jsonb not null default '[]'::jsonb,
  position numeric not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_campaigns_name_check check (length(btrim(name)) between 1 and 160),
  constraint demand_campaigns_channel_check
    check (channel in ('trafego_pago', 'prospeccao', 'social_media', 'indicacao', 'parcerias')),
  constraint demand_campaigns_status_check
    check (status in ('planejada', 'ativa', 'pausada', 'encerrada')),
  constraint demand_campaigns_texts_check
    check (length(description) <= 4000 and length(idea) <= 4000 and length(objective) <= 2000
           and length(platform) <= 40 and length(sheet_url) <= 500),
  constraint demand_campaigns_period_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint demand_campaigns_budget_period_check
    check (budget_period in ('total', 'diario', 'semanal', 'mensal')),
  constraint demand_campaigns_money_check
    check ((budget is null or budget >= 0) and (goal_cpl is null or goal_cpl >= 0)
           and (goal_revenue is null or goal_revenue >= 0)),
  constraint demand_campaigns_goals_check
    check ((goal_leads is null or goal_leads >= 0) and (goal_sales is null or goal_sales >= 0)),
  constraint demand_campaigns_tax_check check (tax_pct >= 0 and tax_pct <= 100),
  constraint demand_campaigns_platform_campaigns_check
    check (jsonb_typeof(platform_campaigns) = 'array' and jsonb_array_length(platform_campaigns) <= 50
           and pg_column_size(platform_campaigns) <= 20000)
);

create index if not exists demand_campaigns_org_status_idx
  on public.demand_campaigns (organization_id, status, position);
create index if not exists demand_campaigns_org_pipeline_idx
  on public.demand_campaigns (organization_id, pipeline_id) where pipeline_id is not null;

create table if not exists public.demand_campaign_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.demand_campaigns(id) on delete cascade,
  kind text not null,
  note_date date not null default current_date,
  body text not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint demand_campaign_notes_kind_check
    check (kind in ('analise', 'feedback', 'planejamento', 'otimizacao')),
  constraint demand_campaign_notes_body_check check (length(btrim(body)) between 1 and 4000)
);

create index if not exists demand_campaign_notes_campaign_idx
  on public.demand_campaign_notes (campaign_id, note_date desc, created_at desc);

alter table public.demand_campaigns enable row level security;
alter table public.demand_campaign_notes enable row level security;

drop policy if exists demand_campaigns_select on public.demand_campaigns;
create policy demand_campaigns_select on public.demand_campaigns
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_campaigns_write on public.demand_campaigns;
create policy demand_campaigns_write on public.demand_campaigns
  using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  )
  with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

-- As notas: a agência lê tudo; o cliente (qualquer membro) lê só as otimizações.
drop policy if exists demand_campaign_notes_select on public.demand_campaign_notes;
create policy demand_campaign_notes_select on public.demand_campaign_notes
  for select using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and (kind = 'otimizacao' or public.fn_role_at_least(organization_id, 'manager')))
  );
drop policy if exists demand_campaign_notes_write on public.demand_campaign_notes;
create policy demand_campaign_notes_write on public.demand_campaign_notes
  using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  )
  with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

revoke all on public.demand_campaigns from anon;
revoke all on public.demand_campaign_notes from anon;
grant select, insert, update, delete on public.demand_campaigns to authenticated;
grant select, insert, update, delete on public.demand_campaign_notes to authenticated;

drop trigger if exists trg_demand_campaigns_updated_at on public.demand_campaigns;
create trigger trg_demand_campaigns_updated_at
  before update on public.demand_campaigns
  for each row execute function public.fn_set_updated_at();

comment on table public.demand_campaigns is
  'Campanha de demanda: uma ação de vendas (canal, período, funil, investimento, metas e as campanhas da plataforma atreladas). Lida pela empresa toda; escrita a partir de manager. Não confundir com `campaigns` (disparo em massa).';
comment on column public.demand_campaigns.tax_pct is
  'Imposto sobre o investimento, em %. O investimento líquido = bruto ÷ (1 + tax_pct/100). 12,5 na Meta; 0 onde não há.';
comment on column public.demand_campaigns.platform_campaigns is
  'As campanhas da plataforma (Meta, Google…) atreladas: lista de {id?, name}. O id é da plataforma, sem FK.';
comment on table public.demand_campaign_notes is
  'Diário de bordo da campanha: análise, feedback do cliente, planejamento e otimização, com data. O cliente lê só as otimizações.';

notify pgrst, 'reload schema';
