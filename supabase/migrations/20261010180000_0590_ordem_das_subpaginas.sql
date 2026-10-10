-- manifest: **Ordem das subpáginas de Marketing.** `marketing_pages.sort_order` — a posição que a agência escolhe para cada subpágina dentro do módulo (menor primeiro; empate pela data de criação).

alter table public.marketing_pages
  add column if not exists sort_order integer not null default 0;

comment on column public.marketing_pages.sort_order is
  'Posição da subpágina dentro do módulo, escolhida pela agência (menor primeiro; empate pela criação). Escrito por PUT /api/v1/marketing/pages/ordem.';

notify pgrst, 'reload schema';
