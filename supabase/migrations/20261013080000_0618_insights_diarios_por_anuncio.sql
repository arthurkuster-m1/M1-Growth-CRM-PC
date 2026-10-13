-- manifest: **Base diária por anúncio (Meta).** `ad_insights_daily`: uma linha por anúncio e dia com gasto, impressões, alcance, cliques no link e visitas à LP, guardando também o conjunto e a campanha da plataforma. É a base de CPL, ROAS e comparações por criativo, conjunto e landing page em QUALQUER período. Escrita só pelo servidor (sincronização); leitura da própria empresa. `demand_campaigns` ganha `meta_ads_synced_at` e `meta_ads_diff_pct` (a conferência entre a soma dos anúncios e o total da campanha).

create table if not exists public.ad_insights_daily (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta_ads',
  ad_id text not null,
  day date not null,
  account_id text not null default '',
  campaign_id text not null default '',
  adset_id text not null default '',
  ad_name text not null default '',
  adset_name text not null default '',
  campaign_name text not null default '',
  spend numeric(14, 2) not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  link_clicks bigint not null default 0,
  lp_views bigint not null default 0,
  currency text not null default '',
  synced_at timestamptz not null default now(),
  primary key (organization_id, platform, ad_id, day),
  constraint ad_insights_daily_platform_check check (platform in ('meta_ads', 'google_ads'))
);

create index if not exists ad_insights_daily_campanha_idx
  on public.ad_insights_daily (organization_id, platform, campaign_id, day);
create index if not exists ad_insights_daily_conjunto_idx
  on public.ad_insights_daily (organization_id, platform, adset_id, day);

alter table public.ad_insights_daily enable row level security;

drop policy if exists ad_insights_daily_select on public.ad_insights_daily;
create policy ad_insights_daily_select on public.ad_insights_daily
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

revoke all on public.ad_insights_daily from anon, authenticated;
grant select on public.ad_insights_daily to authenticated;
grant select, insert, update, delete on public.ad_insights_daily to service_role;

comment on table public.ad_insights_daily is
  'Insights diários por anúncio da plataforma de anúncios (nível anúncio, um dia por linha). Gasto, impressões, alcance, cliques no link e visitas à LP — leads e resultados NUNCA vêm daqui (vêm do CRM). Alcance de dias diferentes não soma: pessoas únicas não são aditivas.';

alter table public.demand_campaigns
  add column if not exists meta_ads_synced_at timestamptz,
  add column if not exists meta_ads_diff_pct numeric;

comment on column public.demand_campaigns.meta_ads_diff_pct is
  'Diferença percentual entre a soma do gasto por anúncio e o gasto por campanha (mesmos dias). Perto de zero = a base por anúncio confere com o total.';

notify pgrst, 'reload schema';
