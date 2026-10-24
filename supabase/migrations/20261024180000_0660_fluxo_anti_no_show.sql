-- manifest: **Fluxo anti no-show da Agenda.** `agenda_noshow_flows` (horas para ligar sem confirmação, tags de confirmou/faltou e dias para remarcar) e `agenda_noshow_flow_types` (a quais tipos de compromisso cada fluxo se aplica; um fluxo por tipo).
create table if not exists public.agenda_noshow_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  call_hours_before integer,
  confirm_tag text not null default 'Confirmou',
  no_show_tag text not null default 'No Show',
  remarcar_days integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_noshow_flows_name_check check (length(btrim(name)) between 1 and 160),
  constraint agenda_noshow_flows_call_check check (call_hours_before is null or call_hours_before between 1 and 72),
  constraint agenda_noshow_flows_remarcar_check check (remarcar_days is null or remarcar_days between 0 and 30),
  constraint agenda_noshow_flows_tags_check check (length(confirm_tag) <= 30 and length(no_show_tag) <= 30)
);
create index if not exists agenda_noshow_flows_org_idx on public.agenda_noshow_flows (organization_id);

create table if not exists public.agenda_noshow_flow_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flow_id uuid not null references public.agenda_noshow_flows(id) on delete cascade,
  event_type_id uuid not null references public.calendar_event_types(id) on delete cascade,
  constraint agenda_noshow_flow_types_type_unique unique (event_type_id)
);
create index if not exists agenda_noshow_flow_types_flow_idx
  on public.agenda_noshow_flow_types (flow_id);

drop trigger if exists trg_agenda_noshow_flows_updated_at on public.agenda_noshow_flows;
create trigger trg_agenda_noshow_flows_updated_at
  before update on public.agenda_noshow_flows
  for each row execute function public.fn_set_updated_at();

alter table public.agenda_noshow_flows enable row level security;
alter table public.agenda_noshow_flow_types enable row level security;

drop policy if exists agenda_noshow_flows_select on public.agenda_noshow_flows;
create policy agenda_noshow_flows_select on public.agenda_noshow_flows
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists agenda_noshow_flows_write on public.agenda_noshow_flows;
create policy agenda_noshow_flows_write on public.agenda_noshow_flows
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

drop policy if exists agenda_noshow_flow_types_select on public.agenda_noshow_flow_types;
create policy agenda_noshow_flow_types_select on public.agenda_noshow_flow_types
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists agenda_noshow_flow_types_write on public.agenda_noshow_flow_types;
create policy agenda_noshow_flow_types_write on public.agenda_noshow_flow_types
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

revoke all on public.agenda_noshow_flows from anon;
revoke all on public.agenda_noshow_flow_types from anon;
grant select, insert, update, delete on public.agenda_noshow_flows to authenticated;
grant select, insert, update, delete on public.agenda_noshow_flow_types to authenticated;

comment on table public.agenda_noshow_flows is
  'Fluxo anti no-show da Agenda: quantas horas antes, sem confirmação, vira tarefa de ligar (call_hours_before; nulo = não cria), as tags de quem confirma e de quem falta, e em quantos dias úteis a oportunidade volta à fila para remarcar (nulo = não agenda). Aplicado aos tipos de compromisso ligados em agenda_noshow_flow_types.';
comment on table public.agenda_noshow_flow_types is
  'A quais tipos de compromisso um fluxo anti no-show se aplica. Um tipo tem no máximo um fluxo.';

notify pgrst, 'reload schema';
