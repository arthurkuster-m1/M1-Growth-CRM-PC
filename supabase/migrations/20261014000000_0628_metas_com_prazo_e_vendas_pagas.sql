-- manifest: **Prazo das metas (trimestre, semestre, ano e datas personalizadas) e vendas só com algo pago.** `marketing_cronograma_metas.period` aceita também `trimestre`, `semestre`, `ano` e `personalizado` (este com `period_from`/`period_to`, as datas escolhidas no seletor). `fn_metricas_do_crm` e `fn_demand_campaigns_resultados` passam a contar a VENDA só quando algo foi pago (ao menos uma parcela recebida — um sinal já vale; concluída sem parcelas conta pela data do pagamento), no período do primeiro recebimento — a mesma regra das telas de campanha e do CRM.

alter table public.marketing_cronograma_metas
  add column if not exists period_from date,
  add column if not exists period_to date;

alter table public.marketing_cronograma_metas drop constraint if exists marketing_cronograma_metas_auto_check;
alter table public.marketing_cronograma_metas add constraint marketing_cronograma_metas_auto_check
  check (source in ('manual', 'leads', 'vendas', 'faturamento', 'a_receber', 'investido', 'cpl', 'roas')
         and period in ('hoje', 'ontem', 'ultimos_5_dias', 'ultimos_7_dias', 'ultimos_30_dias',
                        'semana', 'mes', 'mes_passado', 'trimestre', 'semestre', 'ano', 'personalizado')
         and aggregation in ('soma', 'media_diaria')
         and (period <> 'personalizado'
              or (period_from is not null and period_to is not null and period_to >= period_from)));

-- Uma venda "conta" no período do primeiro dinheiro que entrou nela.
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
                 and coalesce(
                       (select min(p.paid_on) from public.crm_sale_payments p
                         where p.sale_id = s.id and p.status = 'recebida'),
                       case when s.status = 'concluida'
                                 and not exists (select 1 from public.crm_sale_payments p2 where p2.sale_id = s.id)
                            then coalesce(s.paid_on, s.closed_on) end
                     ) between p_from and p_to), 0),
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
                 and coalesce(
                       (select min(p.paid_on) from public.crm_sale_payments p
                         where p.sale_id = s.id and p.status = 'recebida'),
                       case when s.status = 'concluida'
                                 and not exists (select 1 from public.crm_sale_payments p2 where p2.sale_id = s.id)
                            then coalesce(s.paid_on, s.closed_on) end
                     ) between p_from and p_to), 0),
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
