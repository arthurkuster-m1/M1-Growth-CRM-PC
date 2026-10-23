-- manifest: **Extração de leads dentro da campanha de prospecção.** `prospecting_campaigns.demand_campaign_id` liga cada extração (busca de leads) à campanha de demanda que a fez — uma campanha faz várias extrações; nulo = extração antiga, sem campanha. `demand_campaigns.optional_tabs` passa a aceitar as páginas `extracao` e `disparos` (só a campanha de Prospecção as oferece).
alter table public.prospecting_campaigns
  add column if not exists demand_campaign_id uuid references public.demand_campaigns(id) on delete set null;
create index if not exists prospecting_campaigns_demand_idx
  on public.prospecting_campaigns (organization_id, demand_campaign_id) where demand_campaign_id is not null;
alter table public.demand_campaigns drop constraint if exists demand_campaigns_optional_tabs_check;
alter table public.demand_campaigns add constraint demand_campaigns_optional_tabs_check
  check (optional_tabs is null
         or optional_tabs <@ array['landing', 'criativos', 'abordagem', 'extracao', 'disparos']::text[]);
notify pgrst, 'reload schema';
