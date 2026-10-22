-- manifest: **Custos de captação por fonte.** `lead_source_costs`: quanto a empresa investiu para captar leads de uma fonte (extração, importação, lista comprada…), por dia e, se quiser, por campanha — alimenta o investimento e o CPL do dashboard de Prospecção Ativa.

create table if not exists public.lead_source_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.demand_campaigns(id) on delete cascade,
  source text not null,
  day date not null default current_date,
  amount_cents bigint not null,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lead_source_costs_source_check check (length(btrim(source)) between 1 and 60),
  constraint lead_source_costs_amount_check check (amount_cents > 0),
  constraint lead_source_costs_note_check check (length(note) <= 300)
);

create index if not exists lead_source_costs_org_day_idx
  on public.lead_source_costs (organization_id, day);

alter table public.lead_source_costs enable row level security;

drop policy if exists lead_source_costs_select on public.lead_source_costs;
create policy lead_source_costs_select on public.lead_source_costs
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists lead_source_costs_write on public.lead_source_costs;
create policy lead_source_costs_write on public.lead_source_costs
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

revoke all on public.lead_source_costs from anon;
grant select, insert, update, delete on public.lead_source_costs to authenticated;

comment on table public.lead_source_costs is
  'Custo de captação de leads por fonte e dia (extração, importação…). campaign_id nulo = vale para todas as campanhas. Lido pela empresa toda; escrito a partir de manager.';

notify pgrst, 'reload schema';
