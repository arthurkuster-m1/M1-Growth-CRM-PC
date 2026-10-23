-- manifest: **Diário de bordo em blocos.** As entradas do diário da campanha usam o editor de blocos (JSON), então `demand_campaign_notes.body` passa a aceitar até 20.000 caracteres.

alter table public.demand_campaign_notes drop constraint if exists demand_campaign_notes_body_check;
alter table public.demand_campaign_notes add constraint demand_campaign_notes_body_check
  check (length(btrim(body)) between 1 and 20000);

notify pgrst, 'reload schema';
