-- manifest: **Abordagens das campanhas de contato direto.** `demand_campaign_approaches`: para campanhas de prospecção, indicação, parceria e aproveitamento de base, cada abordagem (meio, gancho, mensagem, follow-up, público) — o equivalente aos criativos das campanhas de anúncio.

create table if not exists public.demand_campaign_approaches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.demand_campaigns(id) on delete cascade,
  name text not null,
  status text not null default 'ativo',
  medium text not null default 'whatsapp',
  audience text not null default '',
  hook text not null default '',
  script text not null default '',
  follow_up text not null default '',
  notes text not null default '',
  position numeric not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_campaign_approaches_name_check check (length(btrim(name)) between 1 and 160),
  constraint demand_campaign_approaches_status_check check (status in ('ativo', 'pausado', 'encerrado')),
  constraint demand_campaign_approaches_medium_check
    check (medium in ('whatsapp', 'ligacao', 'email', 'linkedin', 'instagram', 'presencial', 'outro')),
  constraint demand_campaign_approaches_texts_check
    check (length(audience) <= 500 and length(hook) <= 500 and length(script) <= 6000
           and length(follow_up) <= 6000 and length(notes) <= 2000)
);

create index if not exists demand_campaign_approaches_campaign_idx
  on public.demand_campaign_approaches (organization_id, campaign_id, position);

alter table public.demand_campaign_approaches enable row level security;

drop policy if exists demand_campaign_approaches_select on public.demand_campaign_approaches;
create policy demand_campaign_approaches_select on public.demand_campaign_approaches
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_campaign_approaches_write on public.demand_campaign_approaches;
create policy demand_campaign_approaches_write on public.demand_campaign_approaches
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

revoke all on public.demand_campaign_approaches from anon;
grant select, insert, update, delete on public.demand_campaign_approaches to authenticated;

drop trigger if exists trg_demand_campaign_approaches_updated_at on public.demand_campaign_approaches;
create trigger trg_demand_campaign_approaches_updated_at
  before update on public.demand_campaign_approaches
  for each row execute function public.fn_set_updated_at();

comment on table public.demand_campaign_approaches is
  'Abordagens de uma campanha de contato direto (prospecção, indicação, parceria, base): meio, gancho, mensagem e follow-up. Lidas pela empresa toda; escritas a partir de manager.';

notify pgrst, 'reload schema';
