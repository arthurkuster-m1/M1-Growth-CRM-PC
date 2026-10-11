-- manifest: **Origem da campanha no lead.** `crm_leads` ganha `demand_campaign_id`, `demand_landing_page_id` e `demand_creative_id` (de qual campanha, LP e criativo o lead veio); `webhook_sources.demand_campaign_id` liga um formulário a uma campanha; as contagens de leads da campanha passam a somar quem tem a campanha gravada OU está no funil dela.

alter table public.crm_leads
  add column if not exists demand_campaign_id uuid references public.demand_campaigns(id) on delete set null,
  add column if not exists demand_landing_page_id uuid references public.demand_campaign_landing_pages(id) on delete set null,
  add column if not exists demand_creative_id uuid references public.demand_campaign_creatives(id) on delete set null;

create index if not exists crm_leads_demand_campaign_idx
  on public.crm_leads (organization_id, demand_campaign_id) where demand_campaign_id is not null;

comment on column public.crm_leads.demand_campaign_id is
  'Campanha de demanda de onde o lead veio (anúncio, LP, formulário ou cadastro manual). Gravada na entrada; as contagens da campanha usam isto OU o funil dela.';

alter table public.webhook_sources
  add column if not exists demand_campaign_id uuid references public.demand_campaigns(id) on delete set null;

comment on column public.webhook_sources.demand_campaign_id is
  'Campanha de demanda alimentada por este formulário: o lead nasce no funil da campanha e carrega a origem.';

-- Leads por dia: quem tem a campanha gravada OU está no funil dela (contatos distintos).
drop function if exists public.fn_demand_campaign_leads_by_day(uuid, uuid, date, date, text);
create or replace function public.fn_demand_campaign_leads_by_day(
  p_org uuid,
  p_pipeline uuid,
  p_from date,
  p_to date,
  p_tz text default 'America/Sao_Paulo',
  p_campaign uuid default null
)
returns table (day date, leads integer)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select (l.created_at at time zone p_tz)::date as day,
         count(distinct coalesce(l.contact_id, l.id))::integer as leads
    from public.crm_leads l
   where l.organization_id = p_org
     and ((p_pipeline is not null and l.pipeline_id = p_pipeline)
          or (p_campaign is not null and l.demand_campaign_id = p_campaign))
     and (l.created_at at time zone p_tz)::date between p_from and p_to
   group by 1
   order by 1;
$$;

revoke all on function public.fn_demand_campaign_leads_by_day(uuid, uuid, date, date, text, uuid) from public, anon;
grant execute on function public.fn_demand_campaign_leads_by_day(uuid, uuid, date, date, text, uuid) to authenticated;

create or replace function public.fn_demand_campaigns_estado(
  p_org uuid,
  p_tz text default 'America/Sao_Paulo'
)
returns table (campaign_id uuid, de date, ate date, spend numeric, leads integer)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with hoje as (select (now() at time zone p_tz)::date as d),
  janela as (
    select c.id,
           c.pipeline_id,
           case when c.continuous or c.start_date is null
                then date_trunc('month', h.d)::date else c.start_date end as de,
           case when c.continuous or c.end_date is null
                then h.d else least(c.end_date, h.d) end as ate
      from public.demand_campaigns c
     cross join hoje h
     where c.organization_id = p_org
  )
  select j.id,
         j.de,
         j.ate,
         coalesce((select sum(d.spend)
                     from public.demand_campaign_days d
                    where d.campaign_id = j.id and d.day between j.de and j.ate), 0),
         coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                     from public.crm_leads l
                    where l.organization_id = p_org
                      and (l.pipeline_id = j.pipeline_id or l.demand_campaign_id = j.id)
                      and (l.created_at at time zone p_tz)::date between j.de and j.ate), 0)
    from janela j;
$$;

notify pgrst, 'reload schema';
