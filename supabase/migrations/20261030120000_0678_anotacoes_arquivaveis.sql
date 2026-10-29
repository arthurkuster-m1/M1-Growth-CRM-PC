-- manifest: lead_notes ganha archived_at — a anotação pode ser arquivada (some da lista, não se perde) em vez de só apagada
alter table public.lead_notes
  add column if not exists archived_at timestamptz;

create index if not exists idx_lead_notes_ativas
  on public.lead_notes (organization_id, contact_id, created_at desc)
  where archived_at is null;
