-- manifest: **Etiquetas (tags) nas páginas de Anotações.** `notes_pages.tags` (text[], padrão vazio) guarda as etiquetas de cada página (até 20, de até 40 caracteres) para a vista em cartões filtrar e organizar. Aditiva e idempotente; sem ela as páginas funcionam igual, só sem etiquetas.

-- 0694 — ETIQUETAS NAS PÁGINAS DE ANOTAÇÕES

alter table public.notes_pages
  add column if not exists tags text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notes_pages_tags_check'
  ) then
    alter table public.notes_pages
      add constraint notes_pages_tags_check
      check (cardinality(tags) <= 20 and length(array_to_string(tags, '')) <= 800);
  end if;
end $$;

comment on column public.notes_pages.tags is
  'Etiquetas da página (texto livre, até 20), usadas na vista em cartões para filtrar.';

notify pgrst, 'reload schema';
