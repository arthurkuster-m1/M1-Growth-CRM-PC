-- manifest: **Criativos e legendas das campanhas de demanda (C4).** `demand_campaign_creatives`: cada criativo/anúncio da campanha com nome, status, formato, título, legenda, mídia, LP de destino, anúncio do Meta (id) e as métricas que o Meta informa (gasto, impressões, cliques, visitas à LP). Leads e CPL por criativo virão do CRM (C5).

-- ============================================================================
-- 0600 — CRIATIVOS DA CAMPANHA
--
-- Leitura: toda a empresa (o cliente vê os criativos). Escrita: manager+.
-- Só números de entrega vêm do Meta (gasto, impressões, cliques, visitas à LP); leads e
-- resultados nunca (decisão do Arthur: variação falsa).
-- ============================================================================

create table if not exists public.demand_campaign_creatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.demand_campaigns(id) on delete cascade,
  name text not null,
  status text not null default 'ativo',
  format text not null default 'imagem',
  headline text not null default '',
  caption text not null default '',
  media_url text not null default '',
  thumbnail_url text not null default '',
  link_url text not null default '',
  notes text not null default '',
  -- O anúncio no Meta (id da plataforma, sem FK) e o nome que ele tinha ao importar.
  ad_id text,
  ad_name text not null default '',
  spend numeric(14, 2) not null default 0,
  impressions integer not null default 0,
  link_clicks integer not null default 0,
  lp_views integer not null default 0,
  metrics_synced_at timestamptz,
  position numeric not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_campaign_creatives_name_check check (length(btrim(name)) between 1 and 160),
  constraint demand_campaign_creatives_status_check check (status in ('ativo', 'pausado', 'encerrado')),
  constraint demand_campaign_creatives_format_check
    check (format in ('imagem', 'video', 'carrossel', 'outro')),
  constraint demand_campaign_creatives_texts_check
    check (length(headline) <= 300 and length(caption) <= 4000 and length(notes) <= 2000
           and length(media_url) <= 1000 and length(thumbnail_url) <= 2000
           and length(link_url) <= 1000 and length(ad_name) <= 300
           and (ad_id is null or length(ad_id) <= 40)),
  constraint demand_campaign_creatives_numbers_check
    check (spend >= 0 and impressions >= 0 and link_clicks >= 0 and lp_views >= 0)
);

create unique index if not exists demand_campaign_creatives_ad_uk
  on public.demand_campaign_creatives (campaign_id, ad_id) where ad_id is not null;
create index if not exists demand_campaign_creatives_campaign_idx
  on public.demand_campaign_creatives (organization_id, campaign_id, position);

alter table public.demand_campaign_creatives enable row level security;

drop policy if exists demand_campaign_creatives_select on public.demand_campaign_creatives;
create policy demand_campaign_creatives_select on public.demand_campaign_creatives
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_campaign_creatives_write on public.demand_campaign_creatives;
create policy demand_campaign_creatives_write on public.demand_campaign_creatives
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

revoke all on public.demand_campaign_creatives from anon;
grant select, insert, update, delete on public.demand_campaign_creatives to authenticated;

drop trigger if exists trg_demand_campaign_creatives_updated_at on public.demand_campaign_creatives;
create trigger trg_demand_campaign_creatives_updated_at
  before update on public.demand_campaign_creatives
  for each row execute function public.fn_set_updated_at();

comment on table public.demand_campaign_creatives is
  'Criativos (anúncios) de uma campanha de demanda: nome, legenda, mídia, LP e as métricas de entrega do Meta. Lidos pela empresa toda; escritos a partir de manager.';
comment on column public.demand_campaign_creatives.ad_id is
  'Id do anúncio no Meta (sem FK). Preenchido ao importar; a leitura de métricas e a importação não duplicam por ele.';

notify pgrst, 'reload schema';
