-- manifest: **Verificação de WhatsApp das empresas extraídas.** `prospecting_candidates.whatsapp_status` ('exists' | 'missing' | 'unknown') e `whatsapp_checked_at` guardam se o número da empresa tem WhatsApp, conferido antes de abordar; número sem WhatsApp é pulado na fila.
alter table public.prospecting_candidates
  add column if not exists whatsapp_status text,
  add column if not exists whatsapp_checked_at timestamptz;
alter table public.prospecting_candidates drop constraint if exists prospecting_candidates_whatsapp_status_check;
alter table public.prospecting_candidates add constraint prospecting_candidates_whatsapp_status_check
  check (whatsapp_status is null or whatsapp_status in ('exists', 'missing', 'unknown'));
notify pgrst, 'reload schema';
