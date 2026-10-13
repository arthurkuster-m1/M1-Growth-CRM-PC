-- manifest: **Conjuntos de anúncios do Meta (cadastro).** `ad_adsets`: o conjunto (id, nome, status, campanha da plataforma) lido do Meta mesmo quando NÃO teve entrega no período — os insights só trazem quem entregou, e conjunto ativo sem gasto sumia da tela. Escrita só pelo servidor (sincronização); leitura da própria empresa.

create table if not exists public.ad_adsets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta_ads',
  adset_id text not null,
  campaign_id text not null default '',
  name text not null default '',
  status text not null default '',
  effective_status text not null default '',
  synced_at timestamptz not null default now(),
  primary key (organization_id, platform, adset_id),
  constraint ad_adsets_platform_check check (platform in ('meta_ads', 'google_ads'))
);

create index if not exists ad_adsets_campanha_idx
  on public.ad_adsets (organization_id, platform, campaign_id);

alter table public.ad_adsets enable row level security;

drop policy if exists ad_adsets_select on public.ad_adsets;
create policy ad_adsets_select on public.ad_adsets
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

revoke all on public.ad_adsets from anon, authenticated;
grant select on public.ad_adsets to authenticated;
grant select, insert, update, delete on public.ad_adsets to service_role;

comment on table public.ad_adsets is
  'Conjuntos de anúncios lidos da plataforma (cadastro: nome e status), independentes de terem tido entrega no período.';

notify pgrst, 'reload schema';
