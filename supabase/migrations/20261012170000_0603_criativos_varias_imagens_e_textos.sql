-- manifest: **Criativos com várias imagens e 5 títulos, 5 textos e 5 descrições.** `demand_campaign_creatives` ganha `images` (arquivos do bucket de imagens do Marketing, até 10), `headlines`, `bodies` e `descriptions` (até 5 cada, como no anúncio dinâmico do Meta); os campos antigos `headline` e `caption` seguem como a primeira variação.

alter table public.demand_campaign_creatives
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists headlines jsonb not null default '[]'::jsonb,
  add column if not exists bodies jsonb not null default '[]'::jsonb,
  add column if not exists descriptions jsonb not null default '[]'::jsonb;

alter table public.demand_campaign_creatives
  drop constraint if exists demand_campaign_creatives_variants_check;
alter table public.demand_campaign_creatives
  add constraint demand_campaign_creatives_variants_check
  check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 10
         and jsonb_typeof(headlines) = 'array' and jsonb_array_length(headlines) <= 5
         and jsonb_typeof(bodies) = 'array' and jsonb_array_length(bodies) <= 5
         and jsonb_typeof(descriptions) = 'array' and jsonb_array_length(descriptions) <= 5
         and pg_column_size(images) + pg_column_size(headlines) + pg_column_size(bodies)
             + pg_column_size(descriptions) <= 40000);

-- O que já existia vira a primeira variação.
update public.demand_campaign_creatives
   set headlines = jsonb_build_array(headline)
 where headlines = '[]'::jsonb and headline <> '';
update public.demand_campaign_creatives
   set bodies = jsonb_build_array(caption)
 where bodies = '[]'::jsonb and caption <> '';

comment on column public.demand_campaign_creatives.images is
  'Nomes de arquivo (bucket marketing-images) das imagens do criativo, até 10.';
comment on column public.demand_campaign_creatives.headlines is 'Até 5 títulos (variações do anúncio dinâmico).';
comment on column public.demand_campaign_creatives.bodies is 'Até 5 textos principais (legendas).';
comment on column public.demand_campaign_creatives.descriptions is 'Até 5 descrições.';

notify pgrst, 'reload schema';
