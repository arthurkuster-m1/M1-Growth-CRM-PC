-- manifest: **Landing pages das campanhas de demanda.** `demand_campaign_landing_pages`: as LPs que rodam em cada campanha (nome, link, status, observações) — base da pré-visualização e da análise comparativa (as métricas vêm dos criativos que apontam para cada LP).

create table if not exists public.demand_campaign_landing_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.demand_campaigns(id) on delete cascade,
  name text not null,
  url text not null default '',
  status text not null default 'ativo',
  notes text not null default '',
  position numeric not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_campaign_lps_name_check check (length(btrim(name)) between 1 and 160),
  constraint demand_campaign_lps_status_check check (status in ('ativo', 'pausado', 'encerrado')),
  constraint demand_campaign_lps_texts_check check (length(url) <= 1000 and length(notes) <= 2000)
);

create index if not exists demand_campaign_lps_campaign_idx
  on public.demand_campaign_landing_pages (organization_id, campaign_id, position);

alter table public.demand_campaign_landing_pages enable row level security;

drop policy if exists demand_campaign_lps_select on public.demand_campaign_landing_pages;
create policy demand_campaign_lps_select on public.demand_campaign_landing_pages
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_campaign_lps_write on public.demand_campaign_landing_pages;
create policy demand_campaign_lps_write on public.demand_campaign_landing_pages
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

revoke all on public.demand_campaign_landing_pages from anon;
grant select, insert, update, delete on public.demand_campaign_landing_pages to authenticated;

drop trigger if exists trg_demand_campaign_lps_updated_at on public.demand_campaign_landing_pages;
create trigger trg_demand_campaign_lps_updated_at
  before update on public.demand_campaign_landing_pages
  for each row execute function public.fn_set_updated_at();

comment on table public.demand_campaign_landing_pages is
  'Landing pages de uma campanha de demanda: nome, link, status e observações. As métricas de cada LP vêm dos criativos cujo link de destino é o dela. Lidas pela empresa toda; escritas a partir de manager.';

notify pgrst, 'reload schema';
