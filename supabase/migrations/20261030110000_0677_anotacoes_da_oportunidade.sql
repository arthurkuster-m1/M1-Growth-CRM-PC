-- manifest: **Anotações ligadas à oportunidade.** lead_notes ganha lead_id (a oportunidade em que a anotação foi feita; nulo = do contato) e a coluna pinned (que o baseline não tinha), e o comentário que já estava na oportunidade vira uma anotação dela, sem duplicar.

alter table public.lead_notes
  add column if not exists pinned boolean not null default false;

alter table public.lead_notes
  add column if not exists lead_id uuid references public.crm_leads(id) on delete set null;

create index if not exists idx_lead_notes_lead
  on public.lead_notes (organization_id, lead_id)
  where lead_id is not null;

-- O comentário que já estava escrito na oportunidade vira uma anotação dela (uma vez só).
insert into public.lead_notes (organization_id, contact_id, lead_id, headline, body, created_at)
select l.organization_id, l.contact_id, l.id, 'Comentário', btrim(l.notes), coalesce(l.updated_at, now())
  from public.crm_leads l
 where l.contact_id is not null
   and l.notes is not null
   and btrim(l.notes) <> ''
   and not exists (select 1 from public.lead_notes n where n.lead_id = l.id);

notify pgrst, 'reload schema';
