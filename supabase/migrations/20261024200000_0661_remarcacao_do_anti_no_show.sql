-- manifest: **Mini-cadência de remarcação do anti no-show.** `agenda_noshow_flows` ganha `remarcar_attempts` e `remarcar_interval_days`; `agenda_noshow_remarcacoes` guarda as tentativas de remarcar de cada lead que faltou (uma ativa por lead).
alter table public.agenda_noshow_flows
  add column if not exists remarcar_attempts integer not null default 1,
  add column if not exists remarcar_interval_days integer not null default 2;
alter table public.agenda_noshow_flows drop constraint if exists agenda_noshow_flows_attempts_check;
alter table public.agenda_noshow_flows add constraint agenda_noshow_flows_attempts_check
  check (remarcar_attempts between 1 and 6);
alter table public.agenda_noshow_flows drop constraint if exists agenda_noshow_flows_interval_check;
alter table public.agenda_noshow_flows add constraint agenda_noshow_flows_interval_check
  check (remarcar_interval_days between 1 and 14);

create table if not exists public.agenda_noshow_remarcacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  flow_id uuid references public.agenda_noshow_flows(id) on delete set null,
  appointment_id uuid references public.calendar_appointments(id) on delete set null,
  status text not null default 'ativa',
  attempts_done integer not null default 0,
  max_attempts integer not null default 1,
  interval_days integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_noshow_remarcacoes_status_check
    check (status in ('ativa', 'respondeu', 'remarcou', 'esgotada', 'cancelada')),
  constraint agenda_noshow_remarcacoes_counts_check
    check (attempts_done >= 0 and max_attempts between 1 and 6 and interval_days between 1 and 14)
);
create unique index if not exists agenda_noshow_remarcacoes_ativa_uidx
  on public.agenda_noshow_remarcacoes (lead_id) where status = 'ativa';
create index if not exists agenda_noshow_remarcacoes_org_idx
  on public.agenda_noshow_remarcacoes (organization_id, status);

drop trigger if exists trg_agenda_noshow_remarcacoes_updated_at on public.agenda_noshow_remarcacoes;
create trigger trg_agenda_noshow_remarcacoes_updated_at
  before update on public.agenda_noshow_remarcacoes
  for each row execute function public.fn_set_updated_at();

alter table public.agenda_noshow_remarcacoes enable row level security;
drop policy if exists agenda_noshow_remarcacoes_select on public.agenda_noshow_remarcacoes;
create policy agenda_noshow_remarcacoes_select on public.agenda_noshow_remarcacoes
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists agenda_noshow_remarcacoes_write on public.agenda_noshow_remarcacoes;
create policy agenda_noshow_remarcacoes_write on public.agenda_noshow_remarcacoes
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

revoke all on public.agenda_noshow_remarcacoes from anon;
grant select, insert, update, delete on public.agenda_noshow_remarcacoes to authenticated;

comment on table public.agenda_noshow_remarcacoes is
  'A mini-cadência de remarcação de UM lead que faltou: tentativas feitas, máximo e intervalo (dias úteis). Uma ativa por lead. Termina quando o lead responde (respondeu), marca novo compromisso (remarcou), as tentativas acabam (esgotada) ou é cancelada.';

notify pgrst, 'reload schema';
