-- manifest: **Cadência da campanha de prospecção.** `demand_cadences` (desenho por campanha ou modelo da empresa), `demand_cadence_steps` (passos D+N) e `demand_cadence_enrollments` (inscrição de cada lead); o lead que entra na etapa Abordagem começa a cadência por trigger; `optional_tabs` aceita a página `cadencia`.
alter table public.demand_campaigns drop constraint if exists demand_campaigns_optional_tabs_check;
alter table public.demand_campaigns add constraint demand_campaigns_optional_tabs_check
  check (optional_tabs is null
         or optional_tabs <@ array['landing', 'criativos', 'abordagem', 'cadencia', 'extracao', 'disparos']::text[]);

create table if not exists public.demand_cadences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.demand_campaigns(id) on delete cascade,
  name text not null default '',
  end_action text not null default 'perdido',
  end_stage_id uuid references public.crm_stages(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_cadences_end_action_check check (end_action in ('perdido', 'etapa')),
  constraint demand_cadences_name_check check (length(name) <= 160),
  constraint demand_cadences_template_name_check check (campaign_id is not null or length(btrim(name)) >= 1)
);
create unique index if not exists demand_cadences_campaign_uidx
  on public.demand_cadences (campaign_id) where campaign_id is not null;
create index if not exists demand_cadences_org_idx on public.demand_cadences (organization_id);

create table if not exists public.demand_cadence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cadence_id uuid not null references public.demand_cadences(id) on delete cascade,
  position integer not null default 0,
  day_offset integer not null default 0,
  medium text not null default 'whatsapp',
  approach_id uuid references public.demand_campaign_approaches(id) on delete set null,
  note text not null default '',
  constraint demand_cadence_steps_day_check check (day_offset between 0 and 365),
  constraint demand_cadence_steps_medium_check
    check (medium in ('whatsapp', 'ligacao', 'email', 'linkedin', 'instagram', 'presencial', 'outro')),
  constraint demand_cadence_steps_note_check check (length(note) <= 500)
);
create index if not exists demand_cadence_steps_cadence_idx
  on public.demand_cadence_steps (cadence_id, position);

create table if not exists public.demand_cadence_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cadence_id uuid not null references public.demand_cadences(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  status text not null default 'ativa',
  current_step integer not null default 0,
  started_at timestamptz not null default now(),
  next_due_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint demand_cadence_enrollments_status_check
    check (status in ('ativa', 'respondeu', 'concluida', 'cancelada')),
  constraint demand_cadence_enrollments_unique unique (cadence_id, lead_id)
);
create index if not exists demand_cadence_enrollments_due_idx
  on public.demand_cadence_enrollments (organization_id, next_due_at) where status = 'ativa';
create index if not exists demand_cadence_enrollments_lead_idx
  on public.demand_cadence_enrollments (lead_id);

drop trigger if exists trg_demand_cadences_updated_at on public.demand_cadences;
create trigger trg_demand_cadences_updated_at
  before update on public.demand_cadences
  for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_demand_cadence_enrollments_updated_at on public.demand_cadence_enrollments;
create trigger trg_demand_cadence_enrollments_updated_at
  before update on public.demand_cadence_enrollments
  for each row execute function public.fn_set_updated_at();

alter table public.demand_cadences enable row level security;
alter table public.demand_cadence_steps enable row level security;
alter table public.demand_cadence_enrollments enable row level security;

drop policy if exists demand_cadences_select on public.demand_cadences;
create policy demand_cadences_select on public.demand_cadences
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_cadences_write on public.demand_cadences;
create policy demand_cadences_write on public.demand_cadences
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

drop policy if exists demand_cadence_steps_select on public.demand_cadence_steps;
create policy demand_cadence_steps_select on public.demand_cadence_steps
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_cadence_steps_write on public.demand_cadence_steps;
create policy demand_cadence_steps_write on public.demand_cadence_steps
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

drop policy if exists demand_cadence_enrollments_select on public.demand_cadence_enrollments;
create policy demand_cadence_enrollments_select on public.demand_cadence_enrollments
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_cadence_enrollments_write on public.demand_cadence_enrollments;
create policy demand_cadence_enrollments_write on public.demand_cadence_enrollments
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

revoke all on public.demand_cadences from anon;
revoke all on public.demand_cadence_steps from anon;
revoke all on public.demand_cadence_enrollments from anon;
grant select, insert, update, delete on public.demand_cadences to authenticated;
grant select, insert, update, delete on public.demand_cadence_steps to authenticated;
grant select, insert, update, delete on public.demand_cadence_enrollments to authenticated;

comment on table public.demand_cadences is
  'Cadência de abordagem: o desenho (passos por dia) de UMA campanha de prospecção, ou um modelo da empresa (campaign_id nulo). end_action/end_stage_id dizem para onde vai o lead que esgotou a cadência sem responder.';
comment on table public.demand_cadence_steps is
  'Passos da cadência: no dia D+N, por tal meio, com tal abordagem (opcional) e uma observação.';
comment on table public.demand_cadence_enrollments is
  'A inscrição de UM lead numa cadência: passo atual, próxima data e situação (ativa, respondeu, concluida, cancelada). Nasce sozinha quando o lead entra na etapa Abordagem.';

-- Lead que ENTRA na etapa "Abordagem" (slug abordagem) de uma campanha com cadência começa a
-- cadência; lead que SAI da etapa por outro caminho tem a inscrição ativa cancelada. Só escreve
-- linha (nunca HTTP): o avanço e o fim ficam com a aplicação e o cron.
create or replace function public.fn_cadence_enroll_on_stage()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_slug text;
  v_cad uuid;
  v_dia integer;
begin
  if tg_op = 'UPDATE' then
    if old.stage_id is not distinct from new.stage_id then
      return new;
    end if;
    update public.demand_cadence_enrollments
       set status = 'cancelada', finished_at = now()
     where lead_id = new.id and status = 'ativa';
  end if;
  if new.demand_campaign_id is null or new.status <> 'open' then
    return new;
  end if;
  select s.slug into v_slug from public.crm_stages s where s.id = new.stage_id;
  if v_slug is distinct from 'abordagem' then
    return new;
  end if;
  select c.id into v_cad
    from public.demand_cadences c
   where c.campaign_id = new.demand_campaign_id and c.organization_id = new.organization_id;
  if v_cad is null then
    return new;
  end if;
  select p.day_offset into v_dia
    from public.demand_cadence_steps p
   where p.cadence_id = v_cad
   order by p.position, p.day_offset limit 1;
  if v_dia is null then
    return new;
  end if;
  insert into public.demand_cadence_enrollments
    (organization_id, cadence_id, lead_id, status, current_step, started_at, next_due_at)
  values
    (new.organization_id, v_cad, new.id, 'ativa', 0, now(), now() + make_interval(days => v_dia))
  on conflict (cadence_id, lead_id) do update
    set status = 'ativa', current_step = 0, started_at = now(),
        next_due_at = now() + make_interval(days => v_dia), finished_at = null;
  return new;
end
$f$;
revoke execute on function public.fn_cadence_enroll_on_stage() from public, anon, authenticated;
drop trigger if exists trg_cadence_enroll_on_stage on public.crm_leads;
create trigger trg_cadence_enroll_on_stage
  after insert or update of stage_id on public.crm_leads
  for each row execute function public.fn_cadence_enroll_on_stage();

notify pgrst, 'reload schema';
