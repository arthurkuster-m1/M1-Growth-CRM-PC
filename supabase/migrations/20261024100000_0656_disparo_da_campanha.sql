-- manifest: **Disparos dentro da campanha de prospecção.** `campaigns.demand_campaign_id` liga cada disparo (lote de contatos) à campanha de demanda que o fez — uma campanha faz vários disparos, com lotes diferentes que se somam; nulo = disparo avulso, de antes.
alter table public.campaigns
  add column if not exists demand_campaign_id uuid references public.demand_campaigns(id) on delete set null;
create index if not exists campaigns_demand_idx
  on public.campaigns (organization_id, demand_campaign_id) where demand_campaign_id is not null;
notify pgrst, 'reload schema';
