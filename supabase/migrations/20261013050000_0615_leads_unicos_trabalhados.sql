-- manifest: **Leads únicos trabalhados no período.** O resultado das campanhas conta cada pessoa uma vez só: `fn_demand_leads_trabalhados` devolve, por campanha, os leads (pessoas) que ENTRARAM no funil da campanha no período ou foram TRABALHADOS nele (mudança de etapa, atendimento, tarefa, agendamento…); `fn_demand_campaigns_resultados` usa essa contagem por campanha e `fn_demand_leads_unicos` dá o total sem repetir quem está em mais de uma campanha. A mesma pessoa conta no mês em que entrou e em todo mês em que for trabalhada de novo.

create or replace function public.fn_demand_leads_trabalhados(
  p_org uuid, p_from date, p_to date, p_tz text default 'America/Sao_Paulo'
)
returns table (campaign_id uuid, lead_key uuid)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select distinct c.id, coalesce(l.contact_id, l.id)
    from public.demand_campaigns c
    join public.crm_leads l
      on l.organization_id = p_org
     and (l.pipeline_id = c.pipeline_id or l.demand_campaign_id = c.id)
   where c.organization_id = p_org
     and (
       (l.created_at at time zone p_tz)::date between p_from and p_to
       or exists (
         select 1 from public.crm_lead_activities a
          where a.lead_id = l.id
            and a.type in ('stage_changed', 'ai_turn', 'note', 'conversation_claimed',
                           'handoff_triggered', 'handoff_resolved', 'voice_call',
                           'task_created', 'task_completed', 'appointment_scheduled',
                           'appointment_completed', 'followup_scheduled',
                           'reactivation_accepted', 'moved_from_pipeline')
            and (a.performed_at at time zone p_tz)::date between p_from and p_to
       )
     )
$$;
revoke all on function public.fn_demand_leads_trabalhados(uuid, date, date, text) from public, anon;
grant execute on function public.fn_demand_leads_trabalhados(uuid, date, date, text) to authenticated;

-- Quantas pessoas diferentes foram trabalhadas nas campanhas escolhidas (sem repetir).
create or replace function public.fn_demand_leads_unicos(
  p_org uuid, p_from date, p_to date, p_tz text, p_campaigns uuid[]
)
returns integer
language sql stable security invoker set search_path = public, pg_temp
as $$
  select count(distinct t.lead_key)::integer
    from public.fn_demand_leads_trabalhados(p_org, p_from, p_to, p_tz) t
   where t.campaign_id = any (p_campaigns)
$$;
revoke all on function public.fn_demand_leads_unicos(uuid, date, date, text, uuid[]) from public, anon;
grant execute on function public.fn_demand_leads_unicos(uuid, date, date, text, uuid[]) to authenticated;

create or replace function public.fn_demand_campaigns_resultados(
  p_org uuid, p_from date, p_to date, p_tz text default 'America/Sao_Paulo'
)
returns table (campaign_id uuid, investido numeric, leads integer, vendas integer,
               recebido bigint, a_receber bigint)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select c.id,
    coalesce((select sum(d.spend) from public.demand_campaign_days d
               where d.campaign_id = c.id and d.day between p_from and p_to), 0),
    coalesce((select count(*)::integer
                from public.fn_demand_leads_trabalhados(p_org, p_from, p_to, p_tz) t
               where t.campaign_id = c.id), 0),
    coalesce((select count(*)::integer from public.crm_sales s
               where s.organization_id = p_org and s.demand_campaign_id = c.id
                 and s.status in ('comprometida', 'concluida')
                 and coalesce(s.closed_on, s.paid_on) between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_sales s on s.id = p.sale_id
              where s.demand_campaign_id = c.id and p.status = 'recebida'
                and s.status <> 'cancelada' and p.paid_on between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_sales s on s.id = p.sale_id
              where s.demand_campaign_id = c.id and p.status = 'prevista'
                and s.status <> 'cancelada' and p.due_on between p_from and p_to), 0)
  from public.demand_campaigns c
  where c.organization_id = p_org;
$$;

notify pgrst, 'reload schema';
