-- manifest: **Motor único, passo 2a: o sujeito do fluxo de automação.** `followup_enrollments` ganha `subject_kind`/`subject_id` (lead, contato ou compromisso do evento) e `source_event_id`; `contact_id` aceita NULL no banco, mas o trigger `fn_enrollment_superficie_coerente` só o permite em `surface='crm_automation'` (que nenhuma tela cria ainda) — todo fluxo de hoje continua exigindo contato. Novo índice único de um fluxo vivo por (fluxo, sujeito). Só estrutura, sem mudar comportamento. Idempotente.

-- 0705 — MOTOR ÚNICO, PASSO 2a: o sujeito do fluxo de automação
--
-- Só ESTRUTURA. Nenhum fluxo existente muda: toda linha de `followup_enrollments` de hoje continua
-- exigindo contato (a regra nova vive no trigger, e só afrouxa para `surface = 'crm_automation'`,
-- que nenhuma tela ou rota cria ainda).
--   · `subject_kind`/`subject_id`: de quem é o fluxo (lead, contato ou compromisso do evento).
--   · `source_event_id`: o evento do event_log que inscreveu (rastro e idempotência).
--   · `contact_id` passa a aceitar NULL no banco; o trigger o exige em toda superfície que não seja
--     `crm_automation`.
--   · um fluxo vivo por (fluxo, sujeito): o anti-spam de hoje é por contato e não enxerga linha sem
--     contato.
alter table public.followup_enrollments
  add column if not exists subject_kind text,
  add column if not exists subject_id uuid,
  add column if not exists source_event_id uuid references public.event_log(id) on delete set null;

alter table public.followup_enrollments
  drop constraint if exists followup_enrollments_subject_check;
alter table public.followup_enrollments
  add constraint followup_enrollments_subject_check check (
    (subject_kind is null and subject_id is null)
    or (subject_kind in ('lead', 'contact', 'appointment') and subject_id is not null)
  );

alter table public.followup_enrollments
  alter column contact_id drop not null;

create unique index if not exists idx_followup_enrollments_um_vivo_por_sujeito
  on public.followup_enrollments (pointer_id, subject_kind, subject_id)
  where subject_id is not null
    and status in ('active', 'waiting_reply', 'paused_handoff');

create or replace function public.fn_enrollment_superficie_coerente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_surface text;
begin
  select p.surface into v_surface
    from public.followup_flow_pointers p
   where p.id = new.pointer_id;
  if v_surface = 'atendimento' and new.status not in ('coletando','completed','cancelled','dead') then
    raise exception 'roteiro de atendimento só roda como coletando (status %)', new.status
      using errcode = '23514';
  end if;
  if v_surface is distinct from 'atendimento' and new.status = 'coletando' then
    raise exception 'coletando é exclusivo de roteiro de atendimento'
      using errcode = '23514';
  end if;
  if new.contact_id is null and v_surface is distinct from 'crm_automation' then
    raise exception 'inscrição sem contato só existe em automação de CRM (surface %)', v_surface
      using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.fn_enrollment_superficie_coerente() from public;
revoke execute on function public.fn_enrollment_superficie_coerente() from anon;
revoke execute on function public.fn_enrollment_superficie_coerente() from authenticated;

drop trigger if exists trg_enrollment_superficie_coerente on public.followup_enrollments;
create trigger trg_enrollment_superficie_coerente
  before insert or update of status, pointer_id, contact_id on public.followup_enrollments
  for each row
  execute function public.fn_enrollment_superficie_coerente();

notify pgrst, 'reload schema';
