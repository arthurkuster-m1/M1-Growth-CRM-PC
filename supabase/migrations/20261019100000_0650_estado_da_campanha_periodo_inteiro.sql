-- manifest: **Investido, Leads e CPL da campanha passam a contar o período inteiro, inclusive o gasto lançado antes da data de início.** `fn_demand_campaigns_estado` cortava a janela na data de início da campanha: o gasto de dias anteriores (ex.: lançado em 12/10 numa campanha que começa em 19/10) ficava de fora e a listagem mostrava R$ 219 onde a página da campanha somava R$ 3.819. Agora a janela de uma campanha com datas começa no menor entre a data de início e o primeiro dia com gasto; a contínua segue o mês vigente. Só `create or replace function`, idempotente; apêndice no fim do `baseline.sql`.

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
           -- Contínua: o mês vigente. Com datas: o período INTEIRO da campanha, e isso inclui o
           -- gasto lançado antes da data de início (o que foi gasto de verdade conta).
           case when c.continuous
                then date_trunc('month', h.d)::date
                else coalesce(
                       least(c.start_date, (select min(d2.day) from public.demand_campaign_days d2 where d2.campaign_id = c.id)),
                       c.start_date,
                       (select min(d2.day) from public.demand_campaign_days d2 where d2.campaign_id = c.id),
                       date_trunc('month', h.d)::date
                     ) end as de,
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

revoke all on function public.fn_demand_campaigns_estado(uuid, text) from public, anon;

notify pgrst, 'reload schema';
