-- manifest: **A abordagem do disparo.** `campaigns.approach_id` liga o disparo à abordagem de WhatsApp (e ao fluxo de conversa dela) que ele executa; nulo = disparo só com o texto, como sempre.
alter table public.campaigns
  add column if not exists approach_id uuid references public.demand_campaign_approaches(id) on delete set null;
create index if not exists campaigns_approach_idx
  on public.campaigns (organization_id, approach_id) where approach_id is not null;
comment on column public.campaigns.approach_id is
  'A abordagem (e, por ela, o fluxo de conversa) que este disparo executa; nulo = disparo só com o texto.';
notify pgrst, 'reload schema';
