-- manifest: **Leads das campanhas vêm do CRM.** `fn_demand_campaign_leads_by_day`: conta, por dia, os leads (contatos distintos) que entraram no funil da campanha de demanda — a fonte oficial dos leads nos resultados; o Meta só informa impressões, gasto, cliques e visitas à LP.

-- ============================================================================
-- 0599 — LEADS DA CAMPANHA VÊM DO CRM
--
-- Decisão do Arthur (11/10/2026): leads e resultados nunca vêm do Meta (variação falsa). Um lead
-- que entra no funil da campanha, no CRM, conta nos dados da campanha. A função é SECURITY
-- INVOKER: quem chama só conta o que a RLS de `crm_leads` deixa ver.
-- ============================================================================

create or replace function public.fn_demand_campaign_leads_by_day(
  p_org uuid,
  p_pipeline uuid,
  p_from date,
  p_to date,
  p_tz text default 'America/Sao_Paulo'
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
     and l.pipeline_id = p_pipeline
     and (l.created_at at time zone p_tz)::date between p_from and p_to
   group by 1
   order by 1;
$$;

comment on function public.fn_demand_campaign_leads_by_day(uuid, uuid, date, date, text) is
  'Leads por dia (contatos distintos) que entraram num funil do CRM no período, no fuso informado. Fonte dos leads das campanhas de demanda.';

revoke all on function public.fn_demand_campaign_leads_by_day(uuid, uuid, date, date, text) from public, anon;
grant execute on function public.fn_demand_campaign_leads_by_day(uuid, uuid, date, date, text) to authenticated;

notify pgrst, 'reload schema';
