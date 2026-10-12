-- manifest: **Metas automáticas e resultados por período (C6).** `demand_campaigns.goal_period` (meta total ou mensal); `marketing_cronograma_metas` ganha `source` (de onde sai o "onde estamos hoje": manual, leads, vendas, faturamento, a receber, investido, CPL, ROAS), `period` e `aggregation` (soma ou média por dia); `fn_metricas_do_crm` e `fn_demand_campaigns_resultados` devolvem os números reais do CRM e das campanhas num período (o mesmo cálculo para metas e dashboards).

alter table public.demand_campaigns
  add column if not exists goal_period text not null default 'total';
alter table public.demand_campaigns drop constraint if exists demand_campaigns_goal_period_check;
alter table public.demand_campaigns add constraint demand_campaigns_goal_period_check
  check (goal_period in ('total', 'mensal'));

alter table public.marketing_cronograma_metas
  add column if not exists source text not null default 'manual',
  add column if not exists period text not null default 'mes',
  add column if not exists aggregation text not null default 'soma';
alter table public.marketing_cronograma_metas drop constraint if exists marketing_cronograma_metas_auto_check;
alter table public.marketing_cronograma_metas add constraint marketing_cronograma_metas_auto_check
  check (source in ('manual', 'leads', 'vendas', 'faturamento', 'a_receber', 'investido', 'cpl', 'roas')
         and period in ('hoje', 'ontem', 'ultimos_5_dias', 'ultimos_7_dias', 'ultimos_30_dias',
                        'semana', 'mes', 'mes_passado')
         and aggregation in ('soma', 'media_diaria'));

-- Os números da empresa inteira num período (datas no fuso informado).
create or replace function public.fn_metricas_do_crm(
  p_org uuid, p_from date, p_to date, p_tz text default 'America/Sao_Paulo'
)
returns table (leads integer, vendas integer, recebido bigint, a_receber bigint, investido numeric)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select
    coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                from public.crm_leads l
               where l.organization_id = p_org
                 and (l.created_at at time zone p_tz)::date between p_from and p_to), 0),
    coalesce((select count(*)::integer from public.crm_sales s
               where s.organization_id = p_org and s.status in ('comprometida', 'concluida')
                 and coalesce(s.closed_on, s.paid_on) between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_sales s on s.id = p.sale_id
              where p.organization_id = p_org and p.status = 'recebida'
                and s.status <> 'cancelada' and p.paid_on between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_sales s on s.id = p.sale_id
              where p.organization_id = p_org and p.status = 'prevista'
                and s.status <> 'cancelada' and p.due_on between p_from and p_to), 0),
    coalesce((select sum(d.spend) from public.demand_campaign_days d
               where d.organization_id = p_org and d.day between p_from and p_to), 0);
$$;
revoke all on function public.fn_metricas_do_crm(uuid, date, date, text) from public, anon;
grant execute on function public.fn_metricas_do_crm(uuid, date, date, text) to authenticated;

-- O resultado de CADA campanha de demanda num período.
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
    coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                from public.crm_leads l
               where l.organization_id = p_org
                 and (l.pipeline_id = c.pipeline_id or l.demand_campaign_id = c.id)
                 and (l.created_at at time zone p_tz)::date between p_from and p_to), 0),
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
revoke all on function public.fn_demand_campaigns_resultados(uuid, date, date, text) from public, anon;
grant execute on function public.fn_demand_campaigns_resultados(uuid, date, date, text) to authenticated;

notify pgrst, 'reload schema';
