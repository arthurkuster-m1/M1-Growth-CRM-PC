-- manifest: **Modelos de tarefa e tarefas repetidas.** `crm_task_templates`: a tarefa "de molde" (título, descrição, prioridade, status, responsável, início e prazo relativos) que se cria com um clique — e, se o modelo repete (diário, semanal em dias escolhidos, mensal em um dia), o agendador cria a tarefa sozinho na hora marcada, no relógio da organização (`next_run_at`/`last_run_at`). Lido por todos da organização; criado e editado a partir de `agent`.

-- ============================================================================
-- 0586 — MODELOS DE TAREFA E TAREFAS REPETIDAS
--
-- ─── Um conceito só
--
-- O Notion chama de "modelo" a tarefa de molde e põe o "Repetir" DENTRO dele. Aqui é
-- igual: uma linha = um modelo; `repeat_enabled` liga a criação automática. Dois
-- conceitos (modelo e recorrência) pediriam duas telas e um vínculo entre elas que ninguém
-- ia manter.
--
-- ─── Quem cria a tarefa repetida
--
-- A rota `/api/v1/cron/tarefas-repetidas` (chamada por um timer, a cada poucos minutos)
-- pega os modelos com `next_run_at <= agora`, REIVINDICA cada um (UPDATE condicionado ao
-- `next_run_at` antigo — duas rodadas ao mesmo tempo não criam a tarefa duas vezes) e só
-- então cria a tarefa. Se o servidor ficou parado e perdeu várias ocorrências, cria UMA
-- e pula para a próxima futura: não despeja dez tarefas de uma vez.
--
-- ─── O que o banco garante
--
-- Só a FORMA: dias da semana de 0 a 6, dia do mês de 1 a 31, horários "HH:mm". A regra de
-- "quando é a próxima ocorrência" mora no código (`lib/tarefas/modelos.ts`), testada com o
-- relógio fixo — SQL de calendário com fuso é onde esse tipo de regra erra em silêncio.
-- ============================================================================

create table if not exists public.crm_task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- O nome do MODELO (na lista); o título é o da TAREFA que ele cria.
  name text not null,
  title text not null,
  description text,
  priority text not null default 'medium',
  status_option_id uuid references public.crm_task_status_options(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,

  -- Dias entre a criação e o início/prazo. Nulo = a tarefa nasce sem início/prazo.
  start_offset_days integer,
  due_offset_days integer,
  -- Horário do prazo ("HH:mm"). Nulo = só a data (o dia todo).
  due_time text,

  repeat_enabled boolean not null default false,
  repeat_frequency text,
  -- 0 = segunda … 6 = domingo.
  repeat_weekdays smallint[] not null default '{}',
  repeat_day_of_month smallint,
  -- A que horas (relógio da organização) a tarefa nasce.
  repeat_time text not null default '07:00',
  next_run_at timestamptz,
  last_run_at timestamptz,

  position numeric not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_task_templates_name_check
    check (length(btrim(name)) > 0 and length(name) <= 60),
  constraint crm_task_templates_title_check
    check (length(btrim(title)) > 0 and length(title) <= 255),
  constraint crm_task_templates_description_check
    check (description is null or length(description) <= 5000),
  constraint crm_task_templates_priority_check
    check (priority in ('low','medium','high','urgent')),
  constraint crm_task_templates_frequency_check
    check (repeat_frequency is null or repeat_frequency in ('daily','weekly','monthly')),
  constraint crm_task_templates_weekdays_check
    check (repeat_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint crm_task_templates_day_of_month_check
    check (repeat_day_of_month is null or repeat_day_of_month between 1 and 31),
  constraint crm_task_templates_times_check
    check (
      repeat_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    ),
  constraint crm_task_templates_offsets_check
    check (
      (start_offset_days is null or start_offset_days between -365 and 730)
      and (due_offset_days is null or due_offset_days between -365 and 730)
    )
);

create index if not exists crm_task_templates_org_position_idx
  on public.crm_task_templates (organization_id, position);

-- O agendador varre só o que repete e já venceu.
create index if not exists crm_task_templates_due_run_idx
  on public.crm_task_templates (next_run_at)
  where repeat_enabled;

alter table public.crm_task_templates enable row level security;

-- Todo membro da organização VÊ os modelos; criar, editar e apagar é de `agent` para cima,
-- o mesmo corte de editar as tarefas.
drop policy if exists crm_task_templates_select on public.crm_task_templates;
create policy crm_task_templates_select on public.crm_task_templates
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists crm_task_templates_write on public.crm_task_templates;
create policy crm_task_templates_write on public.crm_task_templates
  using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

-- O default do baseline concede TUDO a `anon` em toda tabela nova.
revoke all on public.crm_task_templates from anon;
grant select, insert, update, delete on public.crm_task_templates to authenticated;
grant all on public.crm_task_templates to service_role;

drop trigger if exists trg_crm_task_templates_updated_at on public.crm_task_templates;
create trigger trg_crm_task_templates_updated_at
  before update on public.crm_task_templates
  for each row execute function public.fn_set_updated_at();

comment on table public.crm_task_templates is
  'Modelos de tarefa (e, ligado o repeat_enabled, tarefas repetidas): a tarefa de molde com início e prazo relativos. Quem cria a tarefa repetida é a rota /api/v1/cron/tarefas-repetidas, que reivindica o modelo (UPDATE condicionado a next_run_at) antes de criar. A regra da próxima ocorrência mora em lib/tarefas/modelos.ts.';

notify pgrst, 'reload schema';
