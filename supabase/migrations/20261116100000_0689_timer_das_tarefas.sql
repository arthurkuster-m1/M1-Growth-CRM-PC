-- manifest: **Timer das tarefas (estilo ClickUp).** `crm_task_time_entries`: cada vez que alguém aperta Iniciar nasce um lançamento (`started_at`, `ended_at` nulo enquanto roda); Parar fecha. Um cronômetro rodando por pessoa (índice único parcial): iniciar outra tarefa fecha o anterior. `fn_tarefa_timer_iniciar/parar` (security invoker, RLS vale) e `fn_tempos_das_tarefas` (total fechado + quem está rodando, por tarefa). Concluir ou cancelar a tarefa fecha os cronômetros dela (gatilho). Aditiva: nada existente muda.

-- ============================================================================
-- 0689 — TIMER DAS TAREFAS
--
-- A tabela de Tarefas ganha a propriedade "Tempo": Iniciar começa a cronometrar quanto se leva
-- para fazer a tarefa, Parar fecha o lançamento. O total da tarefa é a soma dos lançamentos
-- fechados mais o que está rodando agora. Guarda-se cada lançamento (quem, quando) em vez de só
-- um número: dá o histórico, e dois colegas podem cronometrar a mesma tarefa.
-- ============================================================================

create table if not exists public.crm_task_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.crm_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Nulo = o cronômetro está rodando.
  ended_at timestamptz,
  duration_seconds integer generated always as (
    case when ended_at is null then null
         else greatest(0, extract(epoch from (ended_at - started_at))::integer) end
  ) stored,
  created_at timestamptz not null default now(),
  constraint crm_task_time_entries_fim_check check (ended_at is null or ended_at >= started_at)
);

create index if not exists crm_task_time_entries_tarefa_idx
  on public.crm_task_time_entries (organization_id, task_id);

-- UM cronômetro rodando por pessoa (em cada empresa): iniciar outra tarefa fecha o anterior.
create unique index if not exists crm_task_time_entries_um_rodando
  on public.crm_task_time_entries (organization_id, user_id) where ended_at is null;

alter table public.crm_task_time_entries enable row level security;

drop policy if exists crm_task_time_entries_select on public.crm_task_time_entries;
create policy crm_task_time_entries_select on public.crm_task_time_entries
  for select using (
    public.fn_is_platform_admin()
    or (organization_id in (select public.fn_user_org_ids()))
  );

drop policy if exists crm_task_time_entries_insert on public.crm_task_time_entries;
create policy crm_task_time_entries_insert on public.crm_task_time_entries
  for insert with check (
    user_id = auth.uid()
    and (organization_id in (select public.fn_user_org_ids()))
    and public.fn_role_at_least(organization_id, 'agent')
  );

-- Cada pessoa só fecha o PRÓPRIO cronômetro.
drop policy if exists crm_task_time_entries_update on public.crm_task_time_entries;
create policy crm_task_time_entries_update on public.crm_task_time_entries
  for update using (
    user_id = auth.uid()
    and (organization_id in (select public.fn_user_org_ids()))
  ) with check (
    user_id = auth.uid()
    and (organization_id in (select public.fn_user_org_ids()))
  );

revoke all on public.crm_task_time_entries from anon;
grant select, insert, update on public.crm_task_time_entries to authenticated;

-- ── Iniciar ─────────────────────────────────────────────────────────────────
create or replace function public.fn_tarefa_timer_iniciar(p_task uuid, p_organization_id uuid)
returns void language plpgsql set search_path = public, pg_temp as $f$
declare
  v_status text;
begin
  select status into v_status from public.crm_tasks
   where id = p_task and organization_id = p_organization_id;
  if not found then
    raise exception 'tarefa_nao_encontrada' using errcode = 'P0002';
  end if;
  if v_status in ('done', 'cancelled') then
    raise exception 'tarefa_encerrada' using errcode = 'P0001';
  end if;
  -- Já está cronometrando ESTA tarefa: nada a fazer (clique duplo não cria lançamento).
  if exists (select 1 from public.crm_task_time_entries
              where organization_id = p_organization_id and task_id = p_task
                and user_id = auth.uid() and ended_at is null) then
    return;
  end if;
  -- Um cronômetro por pessoa: o que estava rodando em outra tarefa fecha agora.
  update public.crm_task_time_entries set ended_at = now()
   where organization_id = p_organization_id and user_id = auth.uid() and ended_at is null;
  insert into public.crm_task_time_entries (organization_id, task_id, user_id)
  values (p_organization_id, p_task, auth.uid());
end
$f$;

-- ── Parar ───────────────────────────────────────────────────────────────────
create or replace function public.fn_tarefa_timer_parar(p_task uuid, p_organization_id uuid)
returns void language plpgsql set search_path = public, pg_temp as $f$
begin
  update public.crm_task_time_entries set ended_at = now()
   where organization_id = p_organization_id and task_id = p_task
     and user_id = auth.uid() and ended_at is null;
end
$f$;

-- ── Os tempos de todas as tarefas da empresa (a lista usa uma vez só) ───────
create or replace function public.fn_tempos_das_tarefas(p_organization_id uuid)
returns table (task_id uuid, total_seconds bigint, running jsonb)
language sql stable set search_path = public, pg_temp as $f$
  select e.task_id,
         coalesce(sum(e.duration_seconds) filter (where e.ended_at is not null), 0)::bigint,
         coalesce(
           jsonb_agg(jsonb_build_object('user_id', e.user_id, 'started_at', e.started_at))
             filter (where e.ended_at is null),
           '[]'::jsonb)
    from public.crm_task_time_entries e
   where e.organization_id = p_organization_id
   group by e.task_id
$f$;

-- ── Concluir ou cancelar a tarefa fecha os cronômetros dela ─────────────────
-- security definer: fecha também o cronômetro de OUTRA pessoa (a tarefa acabou para todos).
create or replace function public.fn_tarefa_encerrada_fecha_timer()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if new.status in ('done', 'cancelled') and old.status is distinct from new.status then
    update public.crm_task_time_entries set ended_at = now()
     where task_id = new.id and ended_at is null;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_tasks_fecha_timer on public.crm_tasks;
create trigger trg_crm_tasks_fecha_timer
  after update of status on public.crm_tasks
  for each row execute function public.fn_tarefa_encerrada_fecha_timer();

revoke execute on function public.fn_tarefa_timer_iniciar(uuid, uuid) from public, anon;
revoke execute on function public.fn_tarefa_timer_parar(uuid, uuid) from public, anon;
revoke execute on function public.fn_tempos_das_tarefas(uuid) from public, anon;
revoke execute on function public.fn_tarefa_encerrada_fecha_timer() from public, anon;
grant execute on function public.fn_tarefa_timer_iniciar(uuid, uuid) to authenticated;
grant execute on function public.fn_tarefa_timer_parar(uuid, uuid) to authenticated;
grant execute on function public.fn_tempos_das_tarefas(uuid) to authenticated;

comment on table public.crm_task_time_entries is
  'Timer das tarefas: um lançamento por Iniciar/Parar (ended_at nulo = rodando).';
