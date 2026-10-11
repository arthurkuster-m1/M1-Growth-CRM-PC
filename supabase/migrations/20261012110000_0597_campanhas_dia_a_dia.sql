-- manifest: **Dia a dia das campanhas de demanda (C2).** `demand_campaign_days`: uma linha por campanha e dia com impressões, alcance, cliques, visitas à LP, leads e investido, mais `extras` (métricas dos canais sem API: abordagens, reuniões, vendas…). Base do resumo, do pace e dos alertas.

-- ============================================================================
-- 0597 — DIA A DIA DA CAMPANHA (a "aba diária" da planilha)
--
-- Uma linha por campanha e por dia. Os campos fixos são os do tráfego pago; `extras` guarda as
-- métricas dos outros canais (prospecção, social media, indicações, parcerias) como {chave:
-- número}. `source` diz de onde veio ('manual', 'csv' ou, na C3, 'meta').
-- Leitura: toda a empresa. Escrita: manager+.
-- ============================================================================

create table if not exists public.demand_campaign_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.demand_campaigns(id) on delete cascade,
  day date not null,
  impressions integer not null default 0,
  reach integer not null default 0,
  link_clicks integer not null default 0,
  lp_views integer not null default 0,
  leads integer not null default 0,
  spend numeric(14, 2) not null default 0,
  extras jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_campaign_days_unique unique (campaign_id, day),
  constraint demand_campaign_days_counts_check
    check (impressions >= 0 and reach >= 0 and link_clicks >= 0 and lp_views >= 0 and leads >= 0
           and spend >= 0),
  constraint demand_campaign_days_source_check check (source in ('manual', 'csv', 'meta')),
  constraint demand_campaign_days_extras_check
    check (jsonb_typeof(extras) = 'object' and pg_column_size(extras) <= 4000)
);

create index if not exists demand_campaign_days_org_idx
  on public.demand_campaign_days (organization_id, campaign_id, day desc);

alter table public.demand_campaign_days enable row level security;

drop policy if exists demand_campaign_days_select on public.demand_campaign_days;
create policy demand_campaign_days_select on public.demand_campaign_days
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_campaign_days_write on public.demand_campaign_days;
create policy demand_campaign_days_write on public.demand_campaign_days
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

revoke all on public.demand_campaign_days from anon;
grant select, insert, update, delete on public.demand_campaign_days to authenticated;

drop trigger if exists trg_demand_campaign_days_updated_at on public.demand_campaign_days;
create trigger trg_demand_campaign_days_updated_at
  before update on public.demand_campaign_days
  for each row execute function public.fn_set_updated_at();

comment on table public.demand_campaign_days is
  'Dia a dia de uma campanha de demanda: impressões, alcance, cliques, visitas à LP, leads e investido (mais `extras` para canais sem API). Uma linha por campanha e dia.';
comment on column public.demand_campaign_days.extras is
  'Métricas dos canais sem API como {chave: número} (ex.: abordagens, reunioes_feitas, vendas, valor_total). As chaves de cada canal vivem em lib/marketing/campanhas-resumo.ts.';

notify pgrst, 'reload schema';
