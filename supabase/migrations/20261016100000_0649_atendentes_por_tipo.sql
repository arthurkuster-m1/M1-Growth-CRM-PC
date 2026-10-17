-- manifest: **Quais atendentes fazem cada tipo de atendimento.** A Agenda passa a aceitar vários atendentes por tipo (cada um com a própria agenda e a própria jornada): a tabela `calendar_event_type_attendants` liga pessoa e tipo, com prioridade e um liga/desliga. É o que permite escolher o atendente e ver só os horários dele, ou escolher o horário e ver só os atendentes livres, e distribuir ao "qualquer atendente" pelo menos carregado no dia. Preenche a tabela a partir do responsável atual de cada tipo, então nada muda para quem já usa. Só cria a tabela (aditiva); o código novo funciona sem ela (cai no responsável do tipo).

create table if not exists public.calendar_event_type_attendants (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type_id uuid not null references public.calendar_event_types(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- menor = primeiro; desempata a distribuição entre atendentes com a mesma carga
  priority integer not null default 100 check (priority between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_type_id, user_id)
);

create index if not exists calendar_event_type_attendants_org_user_idx
  on public.calendar_event_type_attendants (organization_id, user_id);

alter table public.calendar_event_type_attendants enable row level security;

drop policy if exists tenant_isolation_calendar_event_type_attendants_read on public.calendar_event_type_attendants;
create policy tenant_isolation_calendar_event_type_attendants_read on public.calendar_event_type_attendants
  for select
  using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());

drop policy if exists tenant_isolation_calendar_event_type_attendants_write on public.calendar_event_type_attendants;
create policy tenant_isolation_calendar_event_type_attendants_write on public.calendar_event_type_attendants
  for all
  using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin_full())
  with check (
    public.fn_is_platform_admin_full()
    or (organization_id in (select public.fn_user_org_ids())
        and public.fn_role_at_least(organization_id, 'manager'))
  );

do $$
begin
  if exists (select 1 from pg_proc where proname = 'fn_touch_updated_at') then
    drop trigger if exists trg_calendar_event_type_attendants_touch on public.calendar_event_type_attendants;
    create trigger trg_calendar_event_type_attendants_touch before update on public.calendar_event_type_attendants
      for each row execute function public.fn_touch_updated_at();
  end if;
end $$;

-- Quem já era responsável de um tipo continua sendo atendente dele.
insert into public.calendar_event_type_attendants (organization_id, event_type_id, user_id, priority)
select t.organization_id, t.id, t.default_owner_user_id, 100
  from public.calendar_event_types t
 where t.default_owner_user_id is not null
   and exists (
     select 1 from public.user_organizations m
      where m.organization_id = t.organization_id
        and m.user_id = t.default_owner_user_id
        and m.revoked_at is null)
on conflict do nothing;
