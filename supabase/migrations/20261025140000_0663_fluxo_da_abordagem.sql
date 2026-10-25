-- manifest: **Fluxo de conversa da abordagem de WhatsApp.** `demand_campaign_approaches.central_idea` (a ideia central que a IA personaliza por lead) e `demand_approach_steps` (mensagem, áudio, aguardar a resposta e encaminhar, em ordem). Por ora só desenho e simulação.
alter table public.demand_campaign_approaches
  add column if not exists central_idea text not null default '';
alter table public.demand_campaign_approaches drop constraint if exists demand_campaign_approaches_idea_check;
alter table public.demand_campaign_approaches add constraint demand_campaign_approaches_idea_check
  check (length(central_idea) <= 1500);

create table if not exists public.demand_approach_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approach_id uuid not null references public.demand_campaign_approaches(id) on delete cascade,
  position integer not null default 0,
  kind text not null default 'mensagem',
  body text not null default '',
  ai_personalize boolean not null default false,
  audio_label text not null default '',
  wait_hours integer,
  constraint demand_approach_steps_kind_check
    check (kind in ('mensagem', 'audio', 'aguardar', 'encaminhar')),
  constraint demand_approach_steps_text_check
    check (length(body) <= 1500 and length(audio_label) <= 120),
  constraint demand_approach_steps_wait_check
    check (wait_hours is null or wait_hours between 1 and 720)
);
create index if not exists demand_approach_steps_approach_idx
  on public.demand_approach_steps (approach_id, position);

alter table public.demand_approach_steps enable row level security;
drop policy if exists demand_approach_steps_select on public.demand_approach_steps;
create policy demand_approach_steps_select on public.demand_approach_steps
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_approach_steps_write on public.demand_approach_steps;
create policy demand_approach_steps_write on public.demand_approach_steps
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
revoke all on public.demand_approach_steps from anon;
grant select, insert, update, delete on public.demand_approach_steps to authenticated;

comment on column public.demand_campaign_approaches.central_idea is
  'A ideia central da abordagem: o que o agente de IA usa para escrever a mensagem personalizada de cada lead.';
comment on table public.demand_approach_steps is
  'O fluxo de conversa de uma abordagem de WhatsApp: mensagem, áudio, aguardar a resposta e encaminhar ao atendente, em ordem. Fase 7 só desenha e simula; a execução vem depois.';

notify pgrst, 'reload schema';
