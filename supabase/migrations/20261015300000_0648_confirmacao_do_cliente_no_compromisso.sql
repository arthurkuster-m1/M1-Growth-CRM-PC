-- manifest: **Confirmação do cliente no compromisso (anti no-show).** O cliente responde ao lembrete ("1/sim" confirma, "2/remarcar", "3/cancelar") e isso fica no compromisso: `client_confirmation` (confirmed | reschedule | cancel), `client_confirmed_at`, e `confirmation_alerted_at` (o aviso "sem confirmação" já foi dado à equipe). Só aditivo; a presença continua sendo declarada por uma pessoa.

alter table public.calendar_appointments
  add column if not exists client_confirmation text,
  add column if not exists client_confirmed_at timestamptz,
  add column if not exists confirmation_alerted_at timestamptz;

alter table public.calendar_appointments
  drop constraint if exists calendar_appointments_client_confirmation_check;
alter table public.calendar_appointments
  add constraint calendar_appointments_client_confirmation_check
  check (client_confirmation is null or client_confirmation in ('confirmed', 'reschedule', 'cancel'));

-- A resposta vale para a REVISÃO atual: remarcou, a confirmação antiga não vale mais.
create or replace function public.fn_calendar_limpa_confirmacao_ao_remarcar()
returns trigger language plpgsql set search_path = public as $f$
begin
  if tg_op = 'UPDATE'
     and (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at)
     and new.client_confirmation is not distinct from old.client_confirmation then
    new.client_confirmation := null;
    new.client_confirmed_at := null;
    new.confirmation_alerted_at := null;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_calendar_limpa_confirmacao_ao_remarcar on public.calendar_appointments;
create trigger trg_calendar_limpa_confirmacao_ao_remarcar
  before update on public.calendar_appointments
  for each row execute function public.fn_calendar_limpa_confirmacao_ao_remarcar();
